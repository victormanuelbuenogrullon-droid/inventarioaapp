import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

function getLocalIpAddress() {
  try {
    const interfaces = os.networkInterfaces();
    let fallbackIp = null;
    for (const name of Object.keys(interfaces)) {
      const isVirtual = /vmnet|virtual|hyper-v|vethernet|loopback/i.test(name);
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254')) {
          if (!isVirtual) {
            return iface.address;
          } else if (!fallbackIp) {
            fallbackIp = iface.address;
          }
        }
      }
    }
    if (fallbackIp) return fallbackIp;
  } catch (err) {
    console.warn('[Network] Error al detectar IP local:', err);
  }
  return 'localhost';
}

let sharedTunnelUrl = null;
let cloudflaredProcess = null;

function startCloudflareTunnel(port) {
  const binaryName = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared';
  const binaryPath = path.join(__dirname, binaryName);

  if (!fs.existsSync(binaryPath)) {
    console.log(`[Tunnel] ${binaryName} no encontrado en la carpeta raíz. Túnel desactivado.`);
    return;
  }

  console.log(`[Tunnel] Iniciando túnel seguro Cloudflare en puerto ${port}...`);
  try {
    cloudflaredProcess = spawn(binaryPath, ['tunnel', '--url', `http://localhost:${port}`, '--no-autoupdate'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const handleOutput = (data) => {
      const text = data.toString();
      const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (match && (!sharedTunnelUrl || sharedTunnelUrl !== match[0])) {
        sharedTunnelUrl = match[0];
        console.log(`\n======================================================================`);
        console.log(` 🌐 ENLACE WEB PÚBLICO (CLOUDFLARE TUNNEL - ACCESO EN CUALQUIER LUGAR):`);
        console.log(`    👉 ${sharedTunnelUrl}`);
        console.log(`======================================================================\n`);
        
        io.emit('tunnel:updated', { tunnelUrl: sharedTunnelUrl });
      }
    };

    cloudflaredProcess.stdout?.on('data', handleOutput);
    cloudflaredProcess.stderr?.on('data', handleOutput);

    cloudflaredProcess.on('error', (err) => {
      console.warn('[Tunnel] Error en proceso cloudflared:', err.message);
    });

    cloudflaredProcess.on('exit', (code) => {
      console.log(`[Tunnel] Proceso cloudflared finalizado (código ${code}).`);
      sharedTunnelUrl = null;
    });

    process.on('exit', () => {
      if (cloudflaredProcess) cloudflaredProcess.kill();
    });
    process.on('SIGINT', () => {
      if (cloudflaredProcess) cloudflaredProcess.kill();
      process.exit(0);
    });
  } catch (err) {
    console.error('[Tunnel] Error al arrancar túnel:', err);
  }
}

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
  historyLogs: [],
  lastUpdated: new Date().toISOString()
};

let sharedCatalog = [];

// Load saved state from disk if exists
try {
  if (fs.existsSync(STATE_FILE)) {
    const raw = fs.readFileSync(STATE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.countedItems)) {
      sharedState.sessionName = parsed.sessionName || 'Pase de Inventario General';
      sharedState.countedItems = parsed.countedItems || [];
      sharedState.historyLogs = Array.isArray(parsed.historyLogs) ? parsed.historyLogs : [];
      sharedState.lastUpdated = parsed.lastUpdated || new Date().toISOString();
      console.log(`[Storage] Estado cargado desde disco: ${sharedState.countedItems.length} productos contados, ${sharedState.historyLogs.length} registros en historial.`);
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

// Get entire shared history logs
app.get('/api/history', (req, res) => {
  res.json(sharedState.historyLogs || []);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    sessionName: sharedState.sessionName,
    totalCounted: sharedState.countedItems.length,
    catalogCount: sharedCatalog.length,
    totalLogs: (sharedState.historyLogs || []).length,
    onlineUsers: connectedAuditors.size
  });
});

// Network information for multi-device sharing
app.get('/api/network-info', (req, res) => {
  const localIp = getLocalIpAddress();
  res.json({
    port: PORT,
    localIp,
    localUrl: `http://localhost:${PORT}`,
    wifiUrl: `http://${localIp}:${PORT}`,
    tunnelUrl: sharedTunnelUrl,
    hasTunnel: !!sharedTunnelUrl,
    totalCounted: sharedState.countedItems.length,
    catalogCount: sharedCatalog.length,
    sessionName: sharedState.sessionName
  });
});

// Migrate local browser state to server shared database
app.post('/api/migrate-from-client', (req, res) => {
  const { sessionName, countedItems, historyLogs, catalog } = req.body;
  let updatedAny = false;

  if (Array.isArray(catalog) && catalog.length > 0) {
    sharedCatalog = catalog;
    persistCatalogToDisk();
    updatedAny = true;
    io.emit('catalog:updated', {
      totalProducts: sharedCatalog.length,
      updatedAt: new Date().toISOString()
    });
    console.log(`[Migrate] Catálogo subido desde navegador local: ${catalog.length} productos.`);
  }

  if (Array.isArray(countedItems) && countedItems.length > 0) {
    sharedState.countedItems = countedItems;
    if (sessionName) sharedState.sessionName = sessionName;
    if (Array.isArray(historyLogs) && historyLogs.length > 0) {
      sharedState.historyLogs = historyLogs;
    }
    persistStateToDisk();
    updatedAny = true;
    io.emit('session:restored', {
      sessionName: sharedState.sessionName,
      countedItems: sharedState.countedItems,
      by: 'Migración desde navegador local'
    });
    console.log(`[Migrate] Inventario subido desde navegador local: ${countedItems.length} productos contados.`);
  }

  res.json({
    success: true,
    totalCounted: sharedState.countedItems.length,
    catalogCount: sharedCatalog.length
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

  const localIp = getLocalIpAddress();

  // 1. Send initial shared state AND history logs to the newly connected user
  socket.emit('sync:init', {
    sessionName: sharedState.sessionName,
    countedItems: sharedState.countedItems,
    historyLogs: sharedState.historyLogs || [],
    catalogCount: sharedCatalog.length,
    auditors: getAuditorsList(),
    totalUsers: connectedAuditors.size,
    tunnelUrl: sharedTunnelUrl,
    wifiUrl: `http://${localIp}:${PORT}`,
    localUrl: `http://localhost:${PORT}`
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
    let finalQty = qty;
    let actionType = 'new';

    if (existingIndex >= 0) {
      const existing = sharedState.countedItems[existingIndex];
      const newQty = isSettingExact ? qty : (Number(existing.cantidadContada) || 0) + qty;
      finalQty = newQty;
      actionType = isSettingExact ? 'set' : 'add';

      if (newQty <= 0) {
        sharedState.countedItems.splice(existingIndex, 1);
        
        // Log deletion
        const deleteLog = {
          id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          stationName: auditorName,
          codigo: product.codigoInternacional || product.codigoInterno || product.codigo || '',
          codigoInterno: product.codigoInterno || '',
          descripcion: product.descripcion || 'Producto eliminado',
          unidad: product.unidad || 'UNIDAD',
          categoria: product.categoria || '',
          cantidad: 0,
          action: 'delete',
          cantidadResultado: 0,
          costo: Number(product.costo) || 0,
          precio: Number(product.precio) || 0,
          timestamp: new Date().toISOString()
        };
        if (!Array.isArray(sharedState.historyLogs)) sharedState.historyLogs = [];
        sharedState.historyLogs.unshift(deleteLog);

        persistStateToDisk();
        io.emit('item:deleted', { key, by: auditorName, log: deleteLog, historyLogs: sharedState.historyLogs });
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

        // Record history log
        const logEntry = {
          id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          stationName: auditorName,
          codigo: product.codigoInternacional || product.codigoInterno || product.codigo || '',
          codigoInterno: product.codigoInterno || '',
          descripcion: product.descripcion || existing.descripcion || 'Sin descripción',
          unidad: product.unidad || existing.unidad || 'UNIDAD',
          categoria: product.categoria || existing.categoria || '',
          cantidad: qty,
          action: actionType,
          cantidadResultado: newQty,
          costo: Number(product.costo) !== undefined ? Number(product.costo) : (Number(existing.costo) || 0),
          precio: Number(product.precio) !== undefined ? Number(product.precio) : (Number(existing.precio) || 0),
          timestamp: new Date().toISOString()
        };

        if (!Array.isArray(sharedState.historyLogs)) sharedState.historyLogs = [];
        sharedState.historyLogs.unshift(logEntry);
        if (sharedState.historyLogs.length > 5000) {
          sharedState.historyLogs = sharedState.historyLogs.slice(0, 5000);
        }

        persistStateToDisk();

        // Broadcast update to ALL connected clients
        io.emit('count:updated', {
          item: updatedItem,
          allCountedItems: sharedState.countedItems,
          action: actionType,
          qtyChange: qty,
          log: logEntry,
          historyLogs: sharedState.historyLogs,
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

        // Record history log
        const logEntry = {
          id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          stationName: auditorName,
          codigo: product.codigoInternacional || product.codigoInterno || product.codigo || '',
          codigoInterno: product.codigoInterno || '',
          descripcion: product.descripcion || 'Sin descripción',
          unidad: product.unidad || 'UNIDAD',
          categoria: product.categoria || '',
          cantidad: qty,
          action: 'new',
          cantidadResultado: qty,
          costo: Number(product.costo) || 0,
          precio: Number(product.precio) || 0,
          timestamp: new Date().toISOString()
        };

        if (!Array.isArray(sharedState.historyLogs)) sharedState.historyLogs = [];
        sharedState.historyLogs.unshift(logEntry);
        if (sharedState.historyLogs.length > 5000) {
          sharedState.historyLogs = sharedState.historyLogs.slice(0, 5000);
        }

        persistStateToDisk();

        io.emit('count:updated', {
          item: newItem,
          allCountedItems: sharedState.countedItems,
          action: 'new',
          qtyChange: qty,
          log: logEntry,
          historyLogs: sharedState.historyLogs,
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
    
    const deleteLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      stationName: auditorName,
      codigo: product.codigoInternacional || product.codigoInterno || product.codigo || '',
      codigoInterno: product.codigoInterno || '',
      descripcion: product.descripcion || 'Producto eliminado',
      unidad: product.unidad || 'UNIDAD',
      categoria: product.categoria || '',
      cantidad: 0,
      action: 'delete',
      cantidadResultado: 0,
      costo: Number(product.costo) || 0,
      precio: Number(product.precio) || 0,
      timestamp: new Date().toISOString()
    };
    if (!Array.isArray(sharedState.historyLogs)) sharedState.historyLogs = [];
    sharedState.historyLogs.unshift(deleteLog);

    persistStateToDisk();
    io.emit('item:deleted', { key, allCountedItems: sharedState.countedItems, log: deleteLog, historyLogs: sharedState.historyLogs, by: auditorName });
  });

  // 5. Clear count
  socket.on('inventory:clear', () => {
    const auditorName = connectedAuditors.get(socket.id)?.name || 'Un usuario';
    sharedState.countedItems = [];
    persistStateToDisk();
    io.emit('inventory:cleared', { by: auditorName });
  });

  // Clear history logs
  socket.on('history:clear', () => {
    const auditorName = connectedAuditors.get(socket.id)?.name || 'Un usuario';
    sharedState.historyLogs = [];
    persistStateToDisk();
    io.emit('history:cleared', { by: auditorName });
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

httpServer.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIpAddress();
  console.log(`======================================================================`);
  console.log(` 🚀 Servidor de Inventario Colaborativo en Línea`);
  console.log(` 💻 Esta PC (Local):     http://localhost:${PORT}`);
  console.log(` 📶 Red Local (Wi-Fi):   http://${localIp}:${PORT}`);
  console.log(` 👥 Sincronización multiusuario en tiempo real activa`);
  console.log(` 📦 Catálogo en servidor: ${sharedCatalog.length} productos`);
  console.log(` 📝 Productos contados:   ${sharedState.countedItems.length}`);
  console.log(`======================================================================`);
  
  // Start Cloudflare Tunnel automatically
  startCloudflareTunnel(PORT);
});
