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
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const CATALOG_FILE = path.join(DATA_DIR, 'catalog.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Sessions store: Record<sessionCode, SessionObject>
let sharedSessions = {};

// Default initial single-session state (for backward-compatibility)
let sharedState = {
  sessionName: 'Pase de Inventario General',
  countedItems: [],
  historyLogs: [],
  lastUpdated: new Date().toISOString()
};

let sharedCatalog = [];

// Helper to check if a session has expired based on its creator's expiration
function isSessionExpired(session) {
  if (!session || !session.expiresAt) return false;
  return new Date(session.expiresAt).getTime() < Date.now();
}

// Generate unique readable session code (e.g. INV-8492)
function generateSessionCode() {
  const digits = '0123456789';
  let code;
  let attempts = 0;
  do {
    let rand = '';
    for (let i = 0; i < 4; i++) {
      rand += digits.charAt(Math.floor(Math.random() * digits.length));
    }
    code = `INV-${rand}`;
    attempts++;
  } while (sharedSessions[code] && attempts < 500);
  return code;
}

// Debounced save for sessions
let saveSessionsTimeout = null;
function persistSessionsToDisk() {
  clearTimeout(saveSessionsTimeout);
  saveSessionsTimeout = setTimeout(() => {
    try {
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sharedSessions, null, 2), 'utf-8');
    } catch (e) {
      console.error('[Storage] Error guardando sesiones en disco:', e);
    }
  }, 300);
}

// Load saved state and sessions from disk if exist
try {
  if (fs.existsSync(SESSIONS_FILE)) {
    const rawSessions = fs.readFileSync(SESSIONS_FILE, 'utf-8');
    const parsedSessions = JSON.parse(rawSessions);
    if (parsedSessions && typeof parsedSessions === 'object') {
      sharedSessions = parsedSessions;
      console.log(`[Storage] ${Object.keys(sharedSessions).length} sesiones de inventario cargadas desde disco.`);
    }
  }

  // Load legacy single-state file if exists
  if (fs.existsSync(STATE_FILE)) {
    const raw = fs.readFileSync(STATE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.countedItems)) {
      sharedState.sessionName = parsed.sessionName || 'Pase de Inventario General';
      sharedState.countedItems = parsed.countedItems || [];
      sharedState.historyLogs = Array.isArray(parsed.historyLogs) ? parsed.historyLogs : [];
      sharedState.lastUpdated = parsed.lastUpdated || new Date().toISOString();
    }
  }

  // If no sessions exist yet, migrate from legacy state or initialize default
  if (Object.keys(sharedSessions).length === 0) {
    const defaultCode = 'INV-1001';
    sharedSessions[defaultCode] = {
      code: defaultCode,
      name: sharedState.sessionName || 'Pase de Inventario General',
      createdBy: 'u_admin',
      creatorUsername: 'admin',
      creatorName: 'Administrador',
      createdAt: new Date().toISOString(),
      expiresAt: null,
      countedItems: sharedState.countedItems || [],
      historyLogs: sharedState.historyLogs || [],
      lastUpdated: sharedState.lastUpdated || new Date().toISOString()
    };
    persistSessionsToDisk();
    console.log(`[Storage] Sesión inicial creada con código: ${defaultCode}`);
  }
} catch (err) {
  console.error('[Storage] Error al inicializar sesiones desde disco:', err);
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
    sessionCode: user.sessionCode || null,
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
  let user = sharedUsers.find((u) => u.id === tokenData.userId);
  if (!user) {
    // Check if virtual collaborator token
    if (tokenData.userId && String(tokenData.userId).startsWith('collab_')) {
      const targetSession = tokenData.sessionCode ? sharedSessions[tokenData.sessionCode] : null;
      if (!targetSession || isSessionExpired(targetSession)) {
        return res.status(403).json({ error: 'La sesión a la que intentas acceder ha culminado su vigencia.' });
      }
      user = {
        id: tokenData.userId,
        username: tokenData.username,
        name: tokenData.name,
        role: 'auditor',
        sessionCode: tokenData.sessionCode,
        expiresAt: targetSession.expiresAt
      };
    } else {
      return res.status(401).json({ error: 'El usuario ya no existe o fue eliminado.' });
    }
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

// Connected clients tracking: socket.id -> { id, name, sessionCode, joinedAt }
const connectedAuditors = new Map();

function getAuditorsList() {
  return Array.from(connectedAuditors.values());
}

function getAuditorsForSession(sessionCode) {
  const list = [];
  if (!sessionCode) return list;
  for (const [, auditor] of connectedAuditors.entries()) {
    if (auditor.sessionCode === sessionCode) {
      list.push({ id: auditor.id, name: auditor.name, joinedAt: auditor.joinedAt });
    }
  }
  return list;
}

function getItemKey(p) {
  return p.codigoInternacional || p.codigoInterno || p.codigo || p.id;
}

// ==========================================
// REST API ENDPOINTS FOR AUTH & USERS
// ==========================================

// Login
app.post('/api/auth/login', (req, res) => {
  const { username, password, sessionCode, backupUsers } = req.body || {};
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

  // Optional session validation if sessionCode was provided
  let activeSession = null;
  if (sessionCode) {
    const cleanCode = String(sessionCode).trim().toUpperCase();
    const targetSession = sharedSessions[cleanCode];
    if (!targetSession) {
      return res.status(404).json({ error: `El código de sesión "${cleanCode}" no existe.` });
    }
    if (isSessionExpired(targetSession)) {
      const expDateStr = new Date(targetSession.expiresAt).toLocaleDateString('es-DO');
      return res.status(403).json({ error: `La sesión "${cleanCode}" ha culminado su período de vigencia (venció el ${expDateStr}).` });
    }
    activeSession = {
      code: targetSession.code,
      name: targetSession.name,
      creatorName: targetSession.creatorName,
      expiresAt: targetSession.expiresAt,
      isExpired: false
    };
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
    activeSession,
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

  // Synchronize expiration for all sessions created by this user
  Object.values(sharedSessions).forEach(sess => {
    if (sess.createdBy === target.id) {
      sess.expiresAt = target.expiresAt;
    }
  });
  persistSessionsToDisk();

  console.log(`[Auth] Vigencia de ${target.username} y sus sesiones actualizada a: ${target.accessDays ? target.accessDays + ' días' : 'Permanente'}`);

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
// REST API ENDPOINTS FOR SESSIONS / ROOMS
// ==========================================

// Create new counting session
app.post('/api/sessions/create', requireAuth, (req, res) => {
  const { name } = req.body || {};
  const cleanName = (name && String(name).trim()) || `Inventario de ${req.user.name}`;
  const code = generateSessionCode();

  const newSession = {
    code,
    name: cleanName,
    createdBy: req.user.id,
    creatorUsername: req.user.username,
    creatorName: req.user.name,
    createdAt: new Date().toISOString(),
    expiresAt: req.user.expiresAt || null, // Inherits creator's expiration!
    countedItems: [],
    historyLogs: [],
    lastUpdated: new Date().toISOString()
  };

  sharedSessions[code] = newSession;
  persistSessionsToDisk();

  console.log(`[Sessions] Nueva sesión creada: ${code} ("${cleanName}") por ${req.user.username} (Vigencia: ${newSession.expiresAt || 'Permanente'})`);
  res.json({ success: true, session: newSession });
});

// Validate session code
app.get('/api/sessions/validate/:code', (req, res) => {
  const { code } = req.params;
  const cleanCode = String(code).trim().toUpperCase();
  const session = sharedSessions[cleanCode];
  if (!session) {
    return res.status(404).json({ error: `El código de sesión "${cleanCode}" no existe.` });
  }
  const expired = isSessionExpired(session);
  if (expired) {
    const expDateStr = new Date(session.expiresAt).toLocaleDateString('es-DO');
    return res.status(403).json({
      error: `La sesión "${cleanCode}" ha culminado su período de vigencia (venció el ${expDateStr}).`,
      isExpired: true
    });
  }
  res.json({
    success: true,
    session: {
      code: session.code,
      name: session.name,
      creatorName: session.creatorName,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      totalCounted: session.countedItems.length,
      isExpired: false
    }
  });
});

// Get all sessions created by current user (or all if admin)
app.get('/api/sessions/my', requireAuth, (req, res) => {
  let list = Object.values(sharedSessions);
  if (req.user.role !== 'admin') {
    list = list.filter((s) => s.createdBy === req.user.id);
  }
  const safeList = list.map((s) => ({
    code: s.code,
    name: s.name,
    createdBy: s.createdBy,
    creatorName: s.creatorName,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    isExpired: isSessionExpired(s),
    totalCounted: s.countedItems.length,
    totalLogs: (s.historyLogs || []).length,
    lastUpdated: s.lastUpdated
  })).sort((a, b) => new Date(b.lastUpdated || b.createdAt) - new Date(a.lastUpdated || a.createdAt));

  res.json(safeList);
});

// Get session details
app.get('/api/sessions/:code', requireAuth, (req, res) => {
  const { code } = req.params;
  const cleanCode = String(code).trim().toUpperCase();
  const session = sharedSessions[cleanCode];
  if (!session) {
    return res.status(404).json({ error: `La sesión "${cleanCode}" no fue encontrada.` });
  }
  if (isSessionExpired(session)) {
    return res.status(403).json({ error: 'Esta sesión ha culminado su período de vigencia.' });
  }
  res.json({
    success: true,
    session
  });
});

// Delete session (Creator or Admin only)
app.delete('/api/sessions/:code', requireAuth, (req, res) => {
  const { code } = req.params;
  const cleanCode = String(code).trim().toUpperCase();
  const session = sharedSessions[cleanCode];
  if (!session) {
    return res.status(404).json({ error: `La sesión "${cleanCode}" no existe.` });
  }
  if (req.user.role !== 'admin' && session.createdBy !== req.user.id) {
    return res.status(403).json({ error: 'Solo el creador o un administrador puede eliminar esta sesión.' });
  }

  delete sharedSessions[cleanCode];
  persistSessionsToDisk();
  console.log(`[Sessions] Sesión ${cleanCode} eliminada por ${req.user.username}`);
  res.json({ success: true, message: `Sesión ${cleanCode} eliminada correctamente.` });
});

// Direct Collaborator Login with Session Code and Name
app.post('/api/auth/collaborator-login', (req, res) => {
  const { sessionCode, name } = req.body || {};
  if (!sessionCode || !name) {
    return res.status(400).json({ error: 'Por favor ingresa el Código de Sesión y tu Nombre.' });
  }
  const cleanCode = String(sessionCode).trim().toUpperCase();
  const session = sharedSessions[cleanCode];
  if (!session) {
    return res.status(404).json({ error: `El código de sesión "${cleanCode}" no existe.` });
  }
  if (isSessionExpired(session)) {
    const expDateStr = new Date(session.expiresAt).toLocaleDateString('es-DO');
    return res.status(403).json({
      error: `Esta sesión ha culminado su período de vigencia (venció el ${expDateStr}). Comunícate con el líder del conteo.`
    });
  }

  const cleanName = String(name).trim();
  const collabUser = {
    id: `collab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    username: cleanName.toLowerCase().replace(/\s+/g, '_'),
    name: `${cleanName} (Auxiliar)`,
    role: 'auditor',
    sessionCode: cleanCode,
    expiresAt: session.expiresAt
  };

  const token = generateToken(collabUser);
  res.json({
    success: true,
    token,
    user: collabUser,
    activeSession: {
      code: session.code,
      name: session.name,
      creatorName: session.creatorName,
      expiresAt: session.expiresAt,
      isExpired: false
    }
  });
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

// Upload & Upsert catalog from a client (e.g. User uploads CSV) - ADMIN ONLY
// Matches strictly by barcode (codigoInternacional): updates matching items, creates new ones
app.post('/api/catalog/upload', requireAdmin, (req, res) => {
  const { products } = req.body;
  if (!Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ error: 'Formato de productos inválido o archivo vacío' });
  }

  let updatedCount = 0;
  let createdCount = 0;

  // Helper to extract clean barcode
  const getBarcode = (item) => {
    if (!item) return '';
    const bar = item.codigoInternacional || item.codigoBarra || '';
    return String(bar).trim().toLowerCase();
  };

  // Build index of existing items in sharedCatalog strictly by Barcode
  const barcodeMap = new Map();
  sharedCatalog.forEach((item, index) => {
    const bar = getBarcode(item);
    if (bar && !barcodeMap.has(bar)) {
      barcodeMap.set(bar, index);
    }
  });

  products.forEach((incoming) => {
    const incomingBar = getBarcode(incoming);

    if (incomingBar && barcodeMap.has(incomingBar)) {
      // 1. UPDATE EXISTING ITEM (matches strictly by barcode)
      const idx = barcodeMap.get(incomingBar);
      const existing = sharedCatalog[idx];

      sharedCatalog[idx] = {
        ...existing,
        codigo: incoming.codigo || existing.codigo,
        codigoInterno: incoming.codigoInterno || existing.codigoInterno,
        codigoInternacional: incoming.codigoInternacional || existing.codigoInternacional,
        descripcion: incoming.descripcion || existing.descripcion,
        marca: incoming.marca || existing.marca || '',
        modelo: incoming.modelo || existing.modelo || '',
        unidad: incoming.unidad || existing.unidad || 'UNIDAD',
        categoria: incoming.categoria || existing.categoria || '',
        departamento: incoming.departamento || existing.departamento || '',
        costo: (incoming.costo !== undefined && incoming.costo !== null && !isNaN(incoming.costo))
          ? Number(incoming.costo)
          : (Number(existing.costo) || 0),
        precio: (incoming.precio !== undefined && incoming.precio !== null && !isNaN(incoming.precio))
          ? Number(incoming.precio)
          : (Number(existing.precio) || 0),
        existencia: incoming.existencia !== undefined ? Number(incoming.existencia) : (existing.existencia || 0),
        lastUpdated: new Date().toISOString()
      };
      updatedCount++;
    } else {
      // 2. CREATE NEW PRODUCT (new barcode or uncataloged)
      const newProduct = {
        id: incoming.id || `p_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        codigo: incoming.codigo || '',
        codigoInterno: incoming.codigoInterno || '',
        codigoInternacional: incoming.codigoInternacional || '',
        descripcion: incoming.descripcion || 'Sin descripción',
        marca: incoming.marca || '',
        modelo: incoming.modelo || '',
        unidad: incoming.unidad || 'UNIDAD',
        categoria: incoming.categoria || '',
        departamento: incoming.departamento || '',
        costo: Number(incoming.costo) || 0,
        precio: Number(incoming.precio) || 0,
        existencia: Number(incoming.existencia) || 0,
        createdAt: new Date().toISOString()
      };
      sharedCatalog.push(newProduct);
      if (incomingBar) {
        barcodeMap.set(incomingBar, sharedCatalog.length - 1);
      }
      createdCount++;
    }
  });

  persistCatalogToDisk();
  
  // Broadcast to all connected clients that a new merged catalog is available
  io.emit('catalog:updated', {
    totalProducts: sharedCatalog.length,
    updatedCount,
    createdCount,
    updatedAt: new Date().toISOString()
  });

  console.log(`[Catalog] Catálogo actualizado por administrador (${req.user.username}): ${updatedCount} actualizados por código de barra, ${createdCount} nuevos creados. Total catálogo: ${sharedCatalog.length}`);
  
  return res.json({
    success: true,
    total: sharedCatalog.length,
    updated: updatedCount,
    created: createdCount
  });
});

// Get entire shared history logs
app.get('/api/history', (req, res) => {
  res.json(sharedState.historyLogs || []);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const sessionList = Object.values(sharedSessions);
  res.json({
    status: 'ok',
    totalSessions: sessionList.length,
    catalogCount: sharedCatalog.length,
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
    totalSessions: Object.keys(sharedSessions).length,
    catalogCount: sharedCatalog.length
  });
});

// Migrate local browser state to server shared database
app.post('/api/migrate-from-client', (req, res) => {
  const { sessionCode, sessionName, countedItems, historyLogs, catalog } = req.body;

  // Authenticate user token if provided
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const tokenData = token ? verifyToken(token) : null;
  const isAdmin = tokenData && tokenData.role === 'admin';

  // Only Administrator can replace or modify the shared master catalog!
  if (Array.isArray(catalog) && catalog.length > 0) {
    if (isAdmin) {
      sharedCatalog = catalog;
      persistCatalogToDisk();
      io.emit('catalog:updated', {
        totalProducts: sharedCatalog.length,
        updatedAt: new Date().toISOString()
      });
      console.log(`[Migrate] Catálogo maestro subido por administrador (${tokenData.username}): ${catalog.length} productos.`);
    } else {
      console.warn(`[Migrate] Ignorando subida de catálogo maestro de usuario no administrador (${tokenData?.username || 'anónimo'}).`);
    }
  }

  const targetCode = sessionCode ? String(sessionCode).trim().toUpperCase() : Object.keys(sharedSessions)[0] || 'INV-1001';
  let targetSession = sharedSessions[targetCode];

  if (!targetSession) {
    targetSession = {
      code: targetCode,
      name: sessionName || 'Pase de Inventario Migrado',
      createdBy: 'u_admin',
      creatorUsername: 'admin',
      creatorName: 'Administrador',
      createdAt: new Date().toISOString(),
      expiresAt: null,
      countedItems: [],
      historyLogs: [],
      lastUpdated: new Date().toISOString()
    };
    sharedSessions[targetCode] = targetSession;
  }

  if (Array.isArray(countedItems) && countedItems.length > 0) {
    targetSession.countedItems = countedItems;
    if (sessionName) targetSession.name = sessionName;
    if (Array.isArray(historyLogs) && historyLogs.length > 0) {
      targetSession.historyLogs = historyLogs;
    }
    targetSession.lastUpdated = new Date().toISOString();
    persistSessionsToDisk();

    io.to(targetCode).emit('session:restored', {
      sessionCode: targetCode,
      sessionName: targetSession.name,
      countedItems: targetSession.countedItems,
      by: 'Migración desde navegador local'
    });
    console.log(`[Migrate] Inventario subido a sesión ${targetCode}: ${countedItems.length} productos contados.`);
  }

  res.json({
    success: true,
    sessionCode: targetCode,
    totalCounted: targetSession.countedItems.length,
    catalogCount: sharedCatalog.length
  });
});

// ==========================================
// REAL-TIME WEBSOCKETS LOGIC (ROOM-BASED)
// ==========================================

io.on('connection', (socket) => {
  let defaultName = `Auditor #${socket.id.slice(-4)}`;
  let defaultSession = null;
  let defaultRole = 'auditor';

  // Extract user identity from handshake auth token if available
  const clientToken = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (clientToken) {
    const verified = verifyToken(clientToken);
    if (verified && verified.name) {
      defaultName = verified.name;
    }
    if (verified && verified.role) {
      defaultRole = verified.role;
    }
    if (verified && verified.sessionCode) {
      defaultSession = verified.sessionCode;
    }
  }

  const handshakeSession = socket.handshake.auth?.sessionCode || socket.handshake.query?.sessionCode || defaultSession;
  const initialSession = handshakeSession && sharedSessions[handshakeSession] ? handshakeSession : null;

  socket.data.name = defaultName;
  socket.data.sessionCode = initialSession;
  socket.data.role = defaultRole;

  connectedAuditors.set(socket.id, {
    id: socket.id,
    name: defaultName,
    sessionCode: initialSession,
    joinedAt: new Date().toISOString()
  });

  const localIp = getLocalIpAddress();

  if (initialSession) {
    socket.join(initialSession);
    const session = sharedSessions[initialSession];
    const sessionAuditors = getAuditorsForSession(initialSession);

    socket.emit('sync:init', {
      sessionCode: session.code,
      sessionName: session.name,
      countedItems: session.countedItems,
      historyLogs: session.historyLogs || [],
      catalogCount: sharedCatalog.length,
      expiresAt: session.expiresAt,
      creatorName: session.creatorName,
      isExpired: isSessionExpired(session),
      auditors: sessionAuditors,
      totalUsers: sessionAuditors.length,
      tunnelUrl: sharedTunnelUrl,
      wifiUrl: `http://${localIp}:${PORT}`,
      localUrl: `http://localhost:${PORT}`
    });

    io.to(initialSession).emit('users:update', {
      sessionCode: initialSession,
      totalUsers: sessionAuditors.length,
      auditors: sessionAuditors
    });
  }

  console.log(`[Socket] Conectado: ${socket.id} (${defaultName}) | Sesión: ${initialSession || 'Sin sesión'}`);

  // User joins or switches session room
  socket.on('session:join', ({ sessionCode, userName }) => {
    if (!sessionCode) return;
    const cleanCode = String(sessionCode).trim().toUpperCase();
    const session = sharedSessions[cleanCode];
    if (!session) {
      return socket.emit('session:error', { error: `La sesión "${cleanCode}" no existe.` });
    }

    if (isSessionExpired(session)) {
      const expDateStr = new Date(session.expiresAt).toLocaleDateString('es-DO');
      return socket.emit('session:error', {
        error: `La sesión "${cleanCode}" ha culminado su período de vigencia (venció el ${expDateStr}).`,
        isExpired: true
      });
    }

    const prevSession = socket.data.sessionCode;
    if (prevSession && prevSession !== cleanCode) {
      socket.leave(prevSession);
      const prevAuditors = getAuditorsForSession(prevSession).filter(a => a.id !== socket.id);
      io.to(prevSession).emit('users:update', {
        sessionCode: prevSession,
        totalUsers: prevAuditors.length,
        auditors: prevAuditors
      });
    }

    const currentName = userName && userName.trim() ? userName.trim() : (socket.data.name || defaultName);
    socket.data.sessionCode = cleanCode;
    socket.data.name = currentName;
    socket.join(cleanCode);

    connectedAuditors.set(socket.id, {
      id: socket.id,
      name: currentName,
      sessionCode: cleanCode,
      joinedAt: new Date().toISOString()
    });

    const sessionAuditors = getAuditorsForSession(cleanCode);

    socket.emit('sync:init', {
      sessionCode: session.code,
      sessionName: session.name,
      countedItems: session.countedItems,
      historyLogs: session.historyLogs || [],
      catalogCount: sharedCatalog.length,
      expiresAt: session.expiresAt,
      creatorName: session.creatorName,
      isExpired: isSessionExpired(session),
      auditors: sessionAuditors,
      totalUsers: sessionAuditors.length,
      tunnelUrl: sharedTunnelUrl,
      wifiUrl: `http://${localIp}:${PORT}`,
      localUrl: `http://localhost:${PORT}`
    });

    io.to(cleanCode).emit('users:update', {
      sessionCode: cleanCode,
      totalUsers: sessionAuditors.length,
      auditors: sessionAuditors
    });

    console.log(`[Socket] ${socket.id} (${currentName}) se unió a la sesión ${cleanCode}`);
  });

  // User sets their custom name
  socket.on('user:setName', (userName) => {
    if (userName && userName.trim()) {
      const cleanName = userName.trim();
      socket.data.name = cleanName;
      const info = connectedAuditors.get(socket.id) || {};
      connectedAuditors.set(socket.id, { ...info, name: cleanName });

      if (socket.data.sessionCode) {
        const list = getAuditorsForSession(socket.data.sessionCode);
        io.to(socket.data.sessionCode).emit('users:update', {
          sessionCode: socket.data.sessionCode,
          totalUsers: list.length,
          auditors: list
        });
      }
    }
  });

  // Apply a count (item added, scanned, or quantity modified)
  socket.on('count:apply', ({ product, qty, isSettingExact, sessionCode }) => {
    if (!product) return;
    const targetCode = sessionCode ? String(sessionCode).trim().toUpperCase() : socket.data.sessionCode;
    if (!targetCode) return;
    const session = sharedSessions[targetCode];
    if (!session) return;

    if (isSessionExpired(session)) {
      return socket.emit('session:error', { error: 'Esta sesión ha expirado y no admite modificaciones.' });
    }

    const auditorName = socket.data.name || connectedAuditors.get(socket.id)?.name || 'Un usuario';
    const key = getItemKey(product);
    const now = Date.now();

    const existingIndex = session.countedItems.findIndex((it) => getItemKey(it) === key);
    let finalQty = qty;
    let actionType = 'new';

    if (existingIndex >= 0) {
      const existing = session.countedItems[existingIndex];
      const newQty = isSettingExact ? qty : (Number(existing.cantidadContada) || 0) + qty;
      finalQty = newQty;
      actionType = isSettingExact ? 'set' : 'add';

      if (newQty <= 0) {
        session.countedItems.splice(existingIndex, 1);

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
        if (!Array.isArray(session.historyLogs)) session.historyLogs = [];
        session.historyLogs.unshift(deleteLog);

        session.lastUpdated = new Date().toISOString();
        persistSessionsToDisk();

        io.to(targetCode).emit('item:deleted', {
          sessionCode: targetCode,
          key,
          by: auditorName,
          log: deleteLog,
          historyLogs: session.historyLogs
        });
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

        session.countedItems.splice(existingIndex, 1);
        session.countedItems.unshift(updatedItem);

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

        if (!Array.isArray(session.historyLogs)) session.historyLogs = [];
        session.historyLogs.unshift(logEntry);
        if (session.historyLogs.length > 5000) {
          session.historyLogs = session.historyLogs.slice(0, 5000);
        }

        session.lastUpdated = new Date().toISOString();
        persistSessionsToDisk();

        io.to(targetCode).emit('count:updated', {
          sessionCode: targetCode,
          item: updatedItem,
          allCountedItems: session.countedItems,
          action: actionType,
          qtyChange: qty,
          log: logEntry,
          historyLogs: session.historyLogs,
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

        session.countedItems.unshift(newItem);

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

        if (!Array.isArray(session.historyLogs)) session.historyLogs = [];
        session.historyLogs.unshift(logEntry);
        if (session.historyLogs.length > 5000) {
          session.historyLogs = session.historyLogs.slice(0, 5000);
        }

        session.lastUpdated = new Date().toISOString();
        persistSessionsToDisk();

        io.to(targetCode).emit('count:updated', {
          sessionCode: targetCode,
          item: newItem,
          allCountedItems: session.countedItems,
          action: 'new',
          qtyChange: qty,
          log: logEntry,
          historyLogs: session.historyLogs,
          by: auditorName
        });
      }
    }
  });

  // Delete item from session
  socket.on('item:delete', (product, sessionCode) => {
    const targetCode = sessionCode ? String(sessionCode).trim().toUpperCase() : socket.data.sessionCode;
    if (!targetCode) return;
    const session = sharedSessions[targetCode];
    if (!session) return;

    const key = getItemKey(product);
    const auditorName = socket.data.name || connectedAuditors.get(socket.id)?.name || 'Un usuario';
    session.countedItems = session.countedItems.filter((it) => getItemKey(it) !== key);

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
    if (!Array.isArray(session.historyLogs)) session.historyLogs = [];
    session.historyLogs.unshift(deleteLog);

    session.lastUpdated = new Date().toISOString();
    persistSessionsToDisk();

    io.to(targetCode).emit('item:deleted', {
      sessionCode: targetCode,
      key,
      allCountedItems: session.countedItems,
      log: deleteLog,
      historyLogs: session.historyLogs,
      by: auditorName
    });
  });

  // Clear session count
  socket.on('inventory:clear', (sessionCode) => {
    const targetCode = sessionCode ? String(sessionCode).trim().toUpperCase() : socket.data.sessionCode;
    if (!targetCode || !sharedSessions[targetCode]) return;
    const session = sharedSessions[targetCode];
    const auditorName = socket.data.name || connectedAuditors.get(socket.id)?.name || 'Un usuario';
    session.countedItems = [];
    session.lastUpdated = new Date().toISOString();
    persistSessionsToDisk();
    io.to(targetCode).emit('inventory:cleared', { sessionCode: targetCode, by: auditorName });
  });

  // Clear session history logs
  socket.on('history:clear', (sessionCode) => {
    const targetCode = sessionCode ? String(sessionCode).trim().toUpperCase() : socket.data.sessionCode;
    if (!targetCode || !sharedSessions[targetCode]) return;
    const session = sharedSessions[targetCode];
    const auditorName = socket.data.name || connectedAuditors.get(socket.id)?.name || 'Un usuario';
    session.historyLogs = [];
    session.lastUpdated = new Date().toISOString();
    persistSessionsToDisk();
    io.to(targetCode).emit('history:cleared', { sessionCode: targetCode, by: auditorName });
  });

  // Rename session
  socket.on('session:rename', (newName, sessionCode) => {
    if (!newName) return;
    const targetCode = sessionCode ? String(sessionCode).trim().toUpperCase() : socket.data.sessionCode;
    if (!targetCode || !sharedSessions[targetCode]) return;
    const session = sharedSessions[targetCode];
    const auditorName = socket.data.name || connectedAuditors.get(socket.id)?.name || 'Un usuario';
    session.name = newName.trim();
    session.lastUpdated = new Date().toISOString();
    persistSessionsToDisk();
    io.to(targetCode).emit('session:renamed', {
      sessionCode: targetCode,
      sessionName: session.name,
      by: auditorName
    });
  });

  // Restore entire session snapshot
  socket.on('session:restore', ({ items, name, sessionCode }) => {
    const targetCode = sessionCode ? String(sessionCode).trim().toUpperCase() : socket.data.sessionCode;
    if (!targetCode || !sharedSessions[targetCode]) return;
    const session = sharedSessions[targetCode];
    const auditorName = socket.data.name || connectedAuditors.get(socket.id)?.name || 'Un usuario';
    session.countedItems = Array.isArray(items) ? items : [];
    if (name) session.name = name;
    session.lastUpdated = new Date().toISOString();
    persistSessionsToDisk();
    io.to(targetCode).emit('session:restored', {
      sessionCode: targetCode,
      sessionName: session.name,
      countedItems: session.countedItems,
      by: auditorName
    });
  });

  // Catalog product update broadcast (ADMIN ONLY)
  socket.on('catalog:productUpdated', (updatedProduct) => {
    if (socket.data.role !== 'admin') {
      console.warn(`[Catalog] Intento denegado de modificar catálogo maestro por usuario no administrador: ${socket.id} (${socket.data.name})`);
      return;
    }

    const key = getItemKey(updatedProduct);

    // Update in sharedCatalog
    const catIdx = sharedCatalog.findIndex((p) => getItemKey(p) === key);
    if (catIdx >= 0) {
      sharedCatalog[catIdx] = updatedProduct;
    } else {
      sharedCatalog.push(updatedProduct);
    }
    persistCatalogToDisk();

    // Also update in all sessions where this product is counted
    Object.values(sharedSessions).forEach(session => {
      let modified = false;
      session.countedItems = session.countedItems.map((item) => {
        if (getItemKey(item) === key) {
          modified = true;
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
      if (modified) {
        session.lastUpdated = new Date().toISOString();
      }
    });
    persistSessionsToDisk();

    io.emit('catalog:syncedProduct', {
      product: updatedProduct
    });
  });

  // Disconnect
  socket.on('disconnect', () => {
    const targetCode = socket.data.sessionCode;
    connectedAuditors.delete(socket.id);
    console.log(`[Socket] Desconectado: ${socket.id} (${connectedAuditors.size} usuarios restantes)`);
    if (targetCode) {
      const sessionAuditors = getAuditorsForSession(targetCode);
      io.to(targetCode).emit('users:update', {
        sessionCode: targetCode,
        totalUsers: sessionAuditors.length,
        auditors: sessionAuditors
      });
    }
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
