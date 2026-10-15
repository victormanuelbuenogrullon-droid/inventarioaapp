import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

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
const USERS_FILE = path.join(DATA_DIR, 'users.json');

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

// ==========================================
// USER AUTHENTICATION & SECURITY HELPERS
// ==========================================
const AUTH_SECRET = process.env.AUTH_SECRET || 'inventariosapp_secret_key_prod_2026';

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  if (!password || !hash || !salt) return false;
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return verifyHash === hash;
}

function generateToken(user) {
  const payload = Buffer.from(JSON.stringify({
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30 // 30 days
  })).toString('base64');
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadBase64, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(payloadBase64).digest('hex');
  if (sig !== expectedSig) return null;
  try {
    const data = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf-8'));
    if (data.exp && data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

let sharedUsers = [];

function persistUsersToDisk() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(sharedUsers, null, 2), 'utf-8');
    console.log(`[Auth] ${sharedUsers.length} usuarios guardados en disco.`);
  } catch (err) {
    console.error('[Auth] Error guardando usuarios en disco:', err);
  }
}

// Load saved users from disk or create default admin
try {
  if (fs.existsSync(USERS_FILE)) {
    const rawUsers = fs.readFileSync(USERS_FILE, 'utf-8');
    const parsedUsers = JSON.parse(rawUsers);
    if (Array.isArray(parsedUsers) && parsedUsers.length > 0) {
      sharedUsers = parsedUsers;
      console.log(`[Auth] Cargados ${sharedUsers.length} usuarios registrados desde disco.`);
    }
  }

  // If no users exist, initialize default admin
  if (sharedUsers.length === 0) {
    const initialAdminPass = process.env.ADMIN_PASSWORD || 'admin';
    const { hash, salt } = hashPassword(initialAdminPass);
    sharedUsers = [
      {
        id: 'u_admin',
        username: 'admin',
        name: 'Administrador',
        role: 'admin',
        passwordHash: hash,
        salt,
        createdAt: new Date().toISOString()
      }
    ];
    persistUsersToDisk();
    console.log('[Auth] Administrador por defecto inicializado.');
  }

  // If ADMIN_PASSWORD env var is set, enforce it for the admin user
  if (process.env.ADMIN_PASSWORD) {
    const adminUser = sharedUsers.find((u) => u.username.toLowerCase() === 'admin');
    if (adminUser) {
      const { hash, salt } = hashPassword(process.env.ADMIN_PASSWORD);
      adminUser.passwordHash = hash;
      adminUser.salt = salt;
      persistUsersToDisk();
      console.log('[Auth] Contraseña de admin actualizada según variable de entorno ADMIN_PASSWORD.');
    }
  }
} catch (err) {
  console.error('[Auth] Error al inicializar usuarios:', err);
}

function isUserExpired(user) {
  if (!user || !user.expiresAt) return false;
  return new Date(user.expiresAt).getTime() < Date.now();
}

// Authentication Middlewares
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acceso no autorizado. Inicia sesión.' });
  }
  const token = authHeader.slice(7).trim();
  const tokenData = verifyToken(token);
  if (!tokenData) {
    return res.status(401).json({ error: 'Sesión expirada o inválida. Inicia sesión de nuevo.' });
  }
  const user = sharedUsers.find((u) => u.id === tokenData.userId);
  if (!user) {
    return res.status(401).json({ error: 'El usuario ya no existe o fue eliminado.' });
  }
  if (isUserExpired(user)) {
    return res.status(403).json({ error: 'Tu período de acceso a la aplicación ha culminado. Comunícate con el Administrador.' });
  }
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Permiso denegado. Se requieren privilegios de Administrador.' });
    }
    next();
  });
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
// REST API ENDPOINTS FOR AUTH & USERS
// ==========================================

// Login
app.post('/api/auth/login', (req, res) => {
  const { username, password, backupUsers } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Ingresa tu usuario y contraseña' });
  }

  const cleanUser = String(username).trim().toLowerCase();
  let user = sharedUsers.find((u) => u.username.toLowerCase() === cleanUser);

  // If user not found or password doesn't match current server state,
  // check if backupUsers sent from client is valid (e.g. after a Render container restart/wipe)
  if ((!user || !verifyPassword(String(password), user.passwordHash, user.salt)) && Array.isArray(backupUsers) && backupUsers.length > 0) {
    const backupTarget = backupUsers.find((u) => u.username && u.username.toLowerCase() === cleanUser);
    if (backupTarget && backupTarget.passwordHash && backupTarget.salt) {
      if (verifyPassword(String(password), backupTarget.passwordHash, backupTarget.salt)) {
        console.log(`[Auth] Restaurando usuarios desde respaldo seguro del cliente tras reinicio.`);
        sharedUsers = backupUsers;
        persistUsersToDisk();
        user = backupTarget;
      }
    }
  }

  if (!user || !verifyPassword(String(password), user.passwordHash, user.salt)) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  // Check if user access has expired
  if (isUserExpired(user)) {
    const expiredDateStr = new Date(user.expiresAt).toLocaleDateString('es-DO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    return res.status(403).json({
      error: `Tu acceso a la aplicación ha culminado (venció el ${expiredDateStr}). Comunícate con el Administrador para renovar tu acceso.`
    });
  }

  const token = generateToken(user);
  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      accessDays: user.accessDays || null,
      expiresAt: user.expiresAt || null
    },
    usersBackup: user.role === 'admin' ? sharedUsers : undefined
  });
});

// Check current user profile / session
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      username: req.user.username,
      name: req.user.name,
      role: req.user.role,
      accessDays: req.user.accessDays || null,
      expiresAt: req.user.expiresAt || null
    }
  });
});

// List users (Admin only)
app.get('/api/users', requireAdmin, (req, res) => {
  const safeUsers = sharedUsers.map((u) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    accessDays: u.accessDays || null,
    expiresAt: u.expiresAt || null,
    isExpired: isUserExpired(u),
    createdAt: u.createdAt
  }));
  res.json(safeUsers);
});

// Create new user (Admin only)
app.post('/api/users', requireAdmin, (req, res) => {
  const { username, password, name, role, accessDays } = req.body || {};

  if (!username || !password || !name) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  const cleanUsername = String(username).trim().toLowerCase();
  const cleanName = String(name).trim();

  if (cleanUsername.length < 3) {
    return res.status(400).json({ error: 'El usuario debe tener al menos 3 caracteres' });
  }

  if (String(password).length < 4) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
  }

  if (sharedUsers.some((u) => u.username.toLowerCase() === cleanUsername)) {
    return res.status(400).json({ error: 'Ese nombre de usuario ya está registrado' });
  }

  const assignedRole = role === 'admin' ? 'admin' : 'auditor';
  const { hash, salt } = hashPassword(String(password));

  // Compute expiration if accessDays is specified
  let expiresAt = null;
  let parsedDays = null;
  if (accessDays !== undefined && accessDays !== null && accessDays !== '' && Number(accessDays) > 0) {
    parsedDays = Number(accessDays);
    expiresAt = new Date(Date.now() + parsedDays * 24 * 60 * 60 * 1000).toISOString();
  }

  const newUser = {
    id: `u_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    username: cleanUsername,
    name: cleanName,
    role: assignedRole,
    accessDays: parsedDays,
    expiresAt,
    passwordHash: hash,
    salt,
    createdAt: new Date().toISOString()
  };

  sharedUsers.push(newUser);
  persistUsersToDisk();

  console.log(`[Auth] Nuevo usuario creado por ${req.user.username}: ${newUser.username} (${newUser.role}, vigencia: ${parsedDays ? parsedDays + ' días' : 'Permanente'})`);

  res.json({
    success: true,
    user: {
      id: newUser.id,
      username: newUser.username,
      name: newUser.name,
      role: newUser.role,
      accessDays: newUser.accessDays,
      expiresAt: newUser.expiresAt,
      isExpired: false,
      createdAt: newUser.createdAt
    },
    usersBackup: sharedUsers
  });
});

// Update user access duration in days / renewal (Admin only)
app.put('/api/users/:id/access', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { accessDays } = req.body || {};

  const target = sharedUsers.find((u) => u.id === id);
  if (!target) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  if (accessDays !== undefined && accessDays !== null && accessDays !== '' && Number(accessDays) > 0) {
    const parsedDays = Number(accessDays);
    target.accessDays = parsedDays;
    target.expiresAt = new Date(Date.now() + parsedDays * 24 * 60 * 60 * 1000).toISOString();
  } else {
    target.accessDays = null;
    target.expiresAt = null;
  }

  persistUsersToDisk();
  console.log(`[Auth] Vigencia de ${target.username} actualizada a: ${target.accessDays ? target.accessDays + ' días' : 'Permanente'}`);

  res.json({
    success: true,
    message: 'Vigencia de acceso actualizada exitosamente',
    user: {
      id: target.id,
      username: target.username,
      name: target.name,
      role: target.role,
      accessDays: target.accessDays,
      expiresAt: target.expiresAt,
      isExpired: isUserExpired(target)
    },
    usersBackup: sharedUsers
  });
});

// Delete user (Admin only)
app.delete('/api/users/:id', requireAdmin, (req, res) => {
  const { id } = req.params;

  if (req.user.id === id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propio usuario en uso.' });
  }

  const target = sharedUsers.find((u) => u.id === id);
  if (!target) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  // Prevent deleting the last admin
  const adminCount = sharedUsers.filter((u) => u.role === 'admin').length;
  if (target.role === 'admin' && adminCount <= 1) {
    return res.status(400).json({ error: 'No puedes eliminar el único administrador del sistema.' });
  }

  sharedUsers = sharedUsers.filter((u) => u.id !== id);
  persistUsersToDisk();

  console.log(`[Auth] Usuario ${target.username} eliminado por ${req.user.username}`);
  res.json({ success: true, message: 'Usuario eliminado correctamente', usersBackup: sharedUsers });
});

// Change user password (Admin can change any, user can change own)
app.put('/api/users/:id/password', requireAuth, (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body || {};

  if (req.user.role !== 'admin' && req.user.id !== id) {
    return res.status(403).json({ error: 'No tienes permisos para modificar esta contraseña.' });
  }

  if (!newPassword || String(newPassword).length < 4) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 4 caracteres.' });
  }

  const target = sharedUsers.find((u) => u.id === id);
  if (!target) {
    return res.status(404).json({ error: 'Usuario no encontrado.' });
  }

  const { hash, salt } = hashPassword(String(newPassword));
  target.passwordHash = hash;
  target.salt = salt;
  persistUsersToDisk();

  console.log(`[Auth] Contraseña de ${target.username} actualizada con éxito.`);
  res.json({
    success: true,
    message: 'Contraseña actualizada con éxito.',
    usersBackup: req.user.role === 'admin' ? sharedUsers : undefined
  });
});

// Export full users backup for offline persistence (Admin only)
app.get('/api/users/backup', requireAdmin, (req, res) => {
  res.json(sharedUsers);
});

// Restore full users backup (Admin only)
app.post('/api/users/restore', requireAdmin, (req, res) => {
  const { users } = req.body || {};
  if (Array.isArray(users) && users.length > 0) {
    sharedUsers = users;
    persistUsersToDisk();
    console.log(`[Auth] Respaldo de ${users.length} usuarios restaurado manualmente.`);
    return res.json({ success: true, total: users.length });
  }
  res.status(400).json({ error: 'Formato de usuarios inválido' });
});

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
  let defaultName = `Auditor #${socket.id.slice(-4)}`;

  // Extract user identity from handshake auth token if available
  const clientToken = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (clientToken) {
    const verified = verifyToken(clientToken);
    if (verified && verified.name) {
      defaultName = verified.name;
    }
  }

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
