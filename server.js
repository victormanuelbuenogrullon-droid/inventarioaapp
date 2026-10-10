import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 1e8 // 100MB for catalog syncing
});

app.use(cors());
app.use(express.json({ limit: '100mb' }));

// Ensure data directory exists for persistent storage on server disk
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const STATE_FILE = path.join(DATA_DIR, 'inventory_state.json');
const CATALOG_FILE = path.join(DATA_DIR, 'catalog.json');

// Default initial state
let sharedState = {
  sessionName: 'Pase de Inventario General',
  countedItems: [],
  lastUpdated: new Date().toISOString()
};

let sharedCatalog = [];

// Load saved state from disk if exists
try {
  if (fs.existsSync(STATE_FILE)) {
    const raw = fs.readFileSync(STATE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.countedItems)) {
      sharedState = parsed;
      console.log(`[Storage] Estado cargado desde disco: ${sharedState.countedItems.length} productos contados.`);
    }
  }
} catch (err) {
  console.error('[Storage] Error al leer archivo de estado:', err);
}

// Load saved catalog from disk if exists
try {
  if (fs.existsSync(CATALOG_FILE)) {
    const rawCat = fs.readFileSync(CATALOG_FILE, 'utf-8');
    const parsedCat = JSON.parse(rawCat);
    if (Array.isArray(parsedCat)) {
      sharedCatalog = parsedCat;
      console.log(`[Storage] Catálogo compartido cargado desde disco: ${sharedCatalog.length} productos.`);
    }
  }
} catch (err) {
  console.error('[Storage] Error al leer archivo de catálogo:', err);
}

// Debounced save to disk helpers
let saveTimeout = null;
function persistStateToDisk() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      sharedState.lastUpdated = new Date().toISOString();
      fs.writeFileSync(STATE_FILE, JSON.stringify(sharedState, null, 2), 'utf-8');
    } catch (e) {
      console.error('[Storage] Error guardando estado en disco:', e);
    }
  }, 300);
}

let saveCatalogTimeout = null;
function persistCatalogToDisk() {
  clearTimeout(saveCatalogTimeout);
  saveCatalogTimeout = setTimeout(() => {
    try {
      fs.writeFileSync(CATALOG_FILE, JSON.stringify(sharedCatalog), 'utf-8');
      console.log(`[Catalog] Guardados ${sharedCatalog.length} productos del catálogo en disco.`);
    } catch (e) {
      console.error('[Catalog] Error guardando catálogo en disco:', e);
    }
  }, 500);
}

// Connected clients tracking
const connectedAuditors = new Map();

function getAuditorsList() {
  return Array.from(connectedAuditors.values());
}

function getItemKey(p) {
  return p.codigoInternacional || p.codigoInterno || p.codigo || p.id;
}

// ==========================================
// REST API ENDPOINTS FOR CATALOG & HEALTH
// ==========================================

// Get entire shared catalog
app.get('/api/catalog', (req, res) => {
  res.json(sharedCatalog);
});

// Get catalog metadata
app.get('/api/catalog/meta', (req, res) => {
  res.json({
    totalProducts: sharedCatalog.length,
    lastUpdated: sharedState.lastUpdated
  });
});

// Upload entire catalog from a client (e.g. User uploads CSV)
app.post('/api/catalog/upload', (req, res) => {
  const { products } = req.body;
  if (Array.isArray(products) && products.length > 0) {
    sharedCatalog = products;
    persistCatalogToDisk();
    
    // Broadcast to all connected clients that a new catalog is available
    io.emit('catalog:updated', {
      totalProducts: sharedCatalog.length,
      updatedAt: new Date().toISOString()
    });

    console.log(`[Catalog] Catálogo actualizado por usuario: ${products.length} productos.`);
    return res.json({ success: true, total: products.length });
  }
  res.status(400).json({ error: 'Formato de productos inválido' });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    sessionName: sharedState.sessionName,
    totalCounted: sharedState.countedItems.length,
    catalogCount: sharedCatalog.length,
    onlineUsers: connectedAuditors.size
  });
});

// ==========================================
// REAL-TIME WEBSOCKETS LOGIC
// ==========================================

io.on('connection', (socket) => {
  const defaultName = `Auditor #${socket.id.slice(-4)}`;
  connectedAuditors.set(socket.id, {
    id: socket.id,
    name: defaultName,
    joinedAt: new Date().toISOString()
  });

  console.log(`[Socket] Conectado: ${socket.id} (${connectedAuditors.size} usuarios en línea)`);

  // 1. Send initial shared state AND catalog count to the newly connected user
  socket.emit('sync:init', {
    sessionName: sharedState.sessionName,
    countedItems: sharedState.countedItems,
    catalogCount: sharedCatalog.length,
    auditors: getAuditorsList(),
    totalUsers: connectedAuditors.size
  });

  // 2. Broadcast updated user count to all users
  io.emit('users:update', {
    totalUsers: connectedAuditors.size,
    auditors: getAuditorsList()
  });

  // User sets their custom name
  socket.on('user:setName', (userName) => {
    if (userName && userName.trim()) {
      const cleanName = userName.trim();
      const info = connectedAuditors.get(socket.id) || {};
      connectedAuditors.set(socket.id, { ...info, name: cleanName });
      io.emit('users:update', {
        totalUsers: connectedAuditors.size,
        auditors: getAuditorsList()
      });
    }
  });

  // 3. Apply a count (item added, scanned, or quantity modified)
  socket.on('count:apply', ({ product, qty, isSettingExact }) => {
    if (!product) return;
    const auditorName = connectedAuditors.get(socket.id)?.name || 'Un usuario';
    const key = getItemKey(product);
    const now = Date.now();

    const existingIndex = sharedState.countedItems.findIndex((it) => getItemKey(it) === key);

    if (existingIndex >= 0) {
      const existing = sharedState.countedItems[existingIndex];
      const newQty = isSettingExact ? qty : (Number(existing.cantidadContada) || 0) + qty;

      if (newQty <= 0) {
        sharedState.countedItems.splice(existingIndex, 1);
        persistStateToDisk();
        io.emit('item:deleted', { key, by: auditorName });
        return;
      } else {
        const updatedItem = {
          ...existing,
          costo: Number(product.costo) !== undefined ? Number(product.costo) : existing.costo,
          precio: Number(product.precio) !== undefined ? Number(product.precio) : existing.precio,
          descripcion: product.descripcion || existing.descripcion,
          unidad: product.unidad || existing.unidad,
          categoria: product.categoria || existing.categoria,
          cantidadContada: newQty,
          updatedAt: now,
          lastUpdatedBy: auditorName
        };

        sharedState.countedItems.splice(existingIndex, 1);
        sharedState.countedItems.unshift(updatedItem);
        persistStateToDisk();

        // Broadcast update to ALL connected clients
        io.emit('count:updated', {
          item: updatedItem,
          allCountedItems: sharedState.countedItems,
          action: isSettingExact ? 'set' : 'add',
          qtyChange: qty,
          by: auditorName
        });
      }
    } else {
      if (qty > 0) {
        const newItem = {
          id: key,
          codigo: product.codigo,
          codigoInterno: product.codigoInterno,
          codigoInternacional: product.codigoInternacional,
          descripcion: product.descripcion,
          unidad: product.unidad || 'UNIDAD',
          categoria: product.categoria || '',
          departamento: product.departamento || '',
          costo: Number(product.costo) || 0,
          precio: Number(product.precio) || 0,
          cantidadContada: qty,
          updatedAt: now,
          lastUpdatedBy: auditorName
        };

        sharedState.countedItems.unshift(newItem);
        persistStateToDisk();

        io.emit('count:updated', {
          item: newItem,
          allCountedItems: sharedState.countedItems,
          action: 'new',
          qtyChange: qty,
          by: auditorName
        });
      }
    }
  });

  // 4. Delete item
  socket.on('item:delete', (product) => {
    const key = getItemKey(product);
    const auditorName = connectedAuditors.get(socket.id)?.name || 'Un usuario';
    sharedState.countedItems = sharedState.countedItems.filter((it) => getItemKey(it) !== key);
    persistStateToDisk();
    io.emit('item:deleted', { key, allCountedItems: sharedState.countedItems, by: auditorName });
  });

  // 5. Clear count
  socket.on('inventory:clear', () => {
    const auditorName = connectedAuditors.get(socket.id)?.name || 'Un usuario';
    sharedState.countedItems = [];
    persistStateToDisk();
    io.emit('inventory:cleared', { by: auditorName });
  });

  // 6. Rename session
  socket.on('session:rename', (newName) => {
    if (!newName) return;
    const auditorName = connectedAuditors.get(socket.id)?.name || 'Un usuario';
    sharedState.sessionName = newName.trim();
    persistStateToDisk();
    io.emit('session:renamed', { sessionName: sharedState.sessionName, by: auditorName });
  });

  // 7. Restore entire session snapshot
  socket.on('session:restore', ({ items, name }) => {
    const auditorName = connectedAuditors.get(socket.id)?.name || 'Un usuario';
    sharedState.countedItems = Array.isArray(items) ? items : [];
    if (name) sharedState.sessionName = name;
    persistStateToDisk();
    io.emit('session:restored', {
      sessionName: sharedState.sessionName,
      countedItems: sharedState.countedItems,
      by: auditorName
    });
  });

  // 8. Catalog product update broadcast
  socket.on('catalog:productUpdated', (updatedProduct) => {
    const key = getItemKey(updatedProduct);
    
    // Update in sharedCatalog
    const catIdx = sharedCatalog.findIndex((p) => getItemKey(p) === key);
    if (catIdx >= 0) {
      sharedCatalog[catIdx] = updatedProduct;
    } else {
      sharedCatalog.push(updatedProduct);
    }
    persistCatalogToDisk();

    // Also update in current counted items if present
    sharedState.countedItems = sharedState.countedItems.map((item) => {
      if (getItemKey(item) === key) {
        return {
          ...item,
          descripcion: updatedProduct.descripcion,
          unidad: updatedProduct.unidad,
          categoria: updatedProduct.categoria,
          costo: Number(updatedProduct.costo) || 0,
          precio: Number(updatedProduct.precio) || 0
        };
      }
      return item;
    });
    persistStateToDisk();

    io.emit('catalog:syncedProduct', {
      product: updatedProduct,
      allCountedItems: sharedState.countedItems
    });
  });

  // Disconnect
  socket.on('disconnect', () => {
    connectedAuditors.delete(socket.id);
    console.log(`[Socket] Desconectado: ${socket.id} (${connectedAuditors.size} usuarios restantes)`);
    io.emit('users:update', {
      totalUsers: connectedAuditors.size,
      auditors: getAuditorsList()
    });
  });
});

// Serve frontend static build files in production or when dist exists
const DIST_PATH = path.join(__dirname, 'dist');
if (fs.existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH));
  app.use((req, res) => {
    res.sendFile(path.join(DIST_PATH, 'index.html'));
  });
}

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(` 🚀 Servidor de Inventario Colaborativo en Línea`);
  console.log(` 🌐 URL Local: http://localhost:${PORT}`);
  console.log(` 👥 Sincronización multiusuario en tiempo real activa`);
  console.log(` 📦 Catálogo en servidor: ${sharedCatalog.length} productos`);
  console.log(`=======================================================`);
});
