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
import nodemailer from 'nodemailer';
import {
  initDatabaseTables,
  isDbConnected,
  dbLoadUsers,
  dbSaveUser,
  dbUpdateUserPassword,
  dbUpdateUserAccess,
  dbDeleteUser,
  dbLoadSessions,
  dbUpsertSession,
  dbDeleteSession,
  dbLoadCatalog,
  dbSaveCatalog,
  dbLoadSettings,
  dbSaveSettings,
  dbLoadAccessRequests,
  dbSaveAccessRequest,
  dbUpdateAccessRequest,
  dbDeleteAccessRequest,
  dbLoadPaymentConfig,
  dbSavePaymentConfig
} from './database.js';

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
const PAYMENT_CONFIG_FILE = path.join(DATA_DIR, 'payment_config.json');
const ACCESS_REQUESTS_FILE = path.join(DATA_DIR, 'access_requests.json');

const DEFAULT_PAYMENT_CONFIG = {
  pricePerDay: 5.0,
  currency: 'USD',
  currencySymbol: '$',
  adminNotificationEmail: process.env.ADMIN_EMAIL || '',
  bankName: '',
  accountType: '',
  accountNumber: '',
  accountHolder: '',
  idNumber: '',
  phone: '',
  paymentEmail: '',
  instructions: '',
  emailProvider: 'brevo', // 'brevo' | 'resend' | 'smtp'
  smtpConfig: {
    provider: 'brevo',
    apiKey: process.env.BREVO_API_KEY || process.env.RESEND_API_KEY || '',
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || '',
    fromEmail: process.env.SMTP_FROM_EMAIL || '',
    fromName: 'InventariosApp'
  }
};

function cleanDummyPaymentConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return cfg;
  if (cfg.bankName === 'Banco Nacional / Transferencia / Zelle') cfg.bankName = '';
  if (cfg.accountType === 'Cuenta Corriente') cfg.accountType = '';
  if (cfg.accountNumber === '0102-0000-00-0000000000') cfg.accountNumber = '';
  if (cfg.accountHolder === 'InventariosApp') cfg.accountHolder = '';
  if (cfg.idNumber === 'J-12345678-0') cfg.idNumber = '';
  if (cfg.phone === '+1 (555) 123-4567') cfg.phone = '';
  if (cfg.paymentEmail === 'pagos@inventariosapp.com') cfg.paymentEmail = '';
  if (typeof cfg.instructions === 'string' && cfg.instructions.includes('Por favor realiza el pago o transferencia por el monto exacto')) {
    cfg.instructions = '';
  }
  return cfg;
}

let sharedPaymentConfig = { ...DEFAULT_PAYMENT_CONFIG };
let sharedAccessRequests = [];

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
  saveSessionsTimeout = setTimeout(async () => {
    try {
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sharedSessions, null, 2), 'utf-8');
    } catch (e) {
      console.error('[Storage] Error guardando sesiones en disco:', e);
    }
    // Also save all sessions to PostgreSQL database if connected
    if (isDbConnected()) {
      try {
        for (const sess of Object.values(sharedSessions)) {
          await dbUpsertSession(sess);
        }
      } catch (err) {
        console.error('[Database] Error sincronizando sesiones con PostgreSQL:', err);
      }
    }
  }, 300);
}

function loadSessionsFromDisk() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const rawSessions = fs.readFileSync(SESSIONS_FILE, 'utf-8');
      const parsedSessions = JSON.parse(rawSessions);
      if (parsedSessions && typeof parsedSessions === 'object') {
        sharedSessions = parsedSessions;
        Object.values(sharedSessions).forEach((s) => {
          if (!Array.isArray(s.backups)) s.backups = [];
        });
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
  } catch (err) {
    console.error('[Storage] Error al inicializar sesiones desde disco:', err);
  }
}

function loadCatalogFromDisk() {
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
  saveCatalogTimeout = setTimeout(async () => {
    try {
      fs.writeFileSync(CATALOG_FILE, JSON.stringify(sharedCatalog), 'utf-8');
      console.log(`[Catalog] Guardados ${sharedCatalog.length} productos del catálogo en disco.`);
    } catch (e) {
      console.error('[Catalog] Error guardando catálogo en disco:', e);
    }
    if (isDbConnected()) {
      try {
        await dbSaveCatalog(sharedCatalog);
      } catch (err) {
        console.error('[Database] Error guardando catálogo en PostgreSQL:', err);
      }
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

function loadUsersFromDisk() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const rawUsers = fs.readFileSync(USERS_FILE, 'utf-8');
      const parsedUsers = JSON.parse(rawUsers);
      if (Array.isArray(parsedUsers) && parsedUsers.length > 0) {
        sharedUsers = parsedUsers;
        console.log(`[Auth] Cargados ${sharedUsers.length} usuarios registrados desde disco.`);
      }
    }
  } catch (err) {
    console.error('[Auth] Error al inicializar usuarios desde disco:', err);
  }
}

function persistPaymentConfigToDisk() {
  try {
    fs.writeFileSync(PAYMENT_CONFIG_FILE, JSON.stringify(sharedPaymentConfig, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Payment] Error guardando config en disco:', e);
  }
}

function loadPaymentConfigFromDisk() {
  try {
    if (fs.existsSync(PAYMENT_CONFIG_FILE)) {
      const raw = fs.readFileSync(PAYMENT_CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        sharedPaymentConfig = { ...DEFAULT_PAYMENT_CONFIG, ...parsed };
      }
    }
    cleanDummyPaymentConfig(sharedPaymentConfig);
  } catch (err) {
    console.error('[Payment] Error cargando config desde disco:', err);
  }
}

function persistAccessRequestsToDisk() {
  try {
    fs.writeFileSync(ACCESS_REQUESTS_FILE, JSON.stringify(sharedAccessRequests, null, 2), 'utf-8');
  } catch (e) {
    console.error('[AccessRequests] Error guardando solicitudes en disco:', e);
  }
}

function loadAccessRequestsFromDisk() {
  try {
    if (fs.existsSync(ACCESS_REQUESTS_FILE)) {
      const raw = fs.readFileSync(ACCESS_REQUESTS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        sharedAccessRequests = parsed;
      }
    }
  } catch (err) {
    console.error('[AccessRequests] Error cargando solicitudes desde disco:', err);
  }
}

function createTransporter(customSmtp) {
  const smtp = customSmtp || sharedPaymentConfig.smtpConfig || {};
  const host = smtp.host || process.env.SMTP_HOST;
  const user = smtp.user || process.env.SMTP_USER;
  const pass = smtp.pass || process.env.SMTP_PASS;
  const port = smtp.port ? Number(smtp.port) : (process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587);
  const secure = smtp.secure !== undefined ? smtp.secure : (process.env.SMTP_SECURE === 'true');

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465 || secure,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
}

/**
 * Universal email dispatcher:
 * - Brevo HTTPS API (Works 100% on Render Free Tier via Port 443 without firewall blockage!)
 * - Resend HTTPS API (Works 100% on Render Free Tier via Port 443!)
 * - Traditional SMTP (Nodemailer for custom hosts / paid tiers)
 */
async function sendAppEmail({ to, subject, html, attachments = [], configOverride = null }) {
  const paymentConfig = configOverride || sharedPaymentConfig;
  const smtp = paymentConfig.smtpConfig || {};
  const provider = smtp.provider || paymentConfig.emailProvider || 
    (smtp.apiKey?.startsWith('xkeysib-') ? 'brevo' : (smtp.apiKey?.startsWith('re_') ? 'resend' : 'smtp'));

  // 1. BREVO HTTPS API (Port 443 - Recommended for Render)
  if (provider === 'brevo' || smtp.apiKey?.startsWith('xkeysib-')) {
    const apiKey = (smtp.apiKey || process.env.BREVO_API_KEY || '').trim();
    if (!apiKey) {
      throw new Error('Falta la Clave API de Brevo (inicia con xkeysib-). Genera una gratis en https://app.brevo.com/settings/keys/api');
    }

    const fromEmail = (smtp.fromEmail || smtp.user || paymentConfig.adminNotificationEmail || 'notificaciones@inventariosapp.com').trim();
    const fromName = smtp.fromName || 'InventariosApp';

    const brevoAttachments = attachments.map(att => {
      let base64Content = '';
      if (Buffer.isBuffer(att.content)) {
        base64Content = att.content.toString('base64');
      } else if (typeof att.content === 'string') {
        base64Content = att.content.includes(',') ? att.content.split(',')[1] : att.content;
      }
      return {
        name: att.filename,
        content: base64Content
      };
    });

    const payload = {
      sender: { name: fromName, email: fromEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      attachment: brevoAttachments.length > 0 ? brevoAttachments : undefined
    };

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        'accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || `Error en Brevo API (código ${res.status})`);
    }
    return { success: true, messageId: data.messageId, provider: 'Brevo API (HTTPS)' };
  }

  // 2. RESEND HTTPS API (Port 443)
  if (provider === 'resend' || smtp.apiKey?.startsWith('re_')) {
    const apiKey = (smtp.apiKey || process.env.RESEND_API_KEY || '').trim();
    if (!apiKey) {
      throw new Error('Falta la Clave API de Resend (inicia con re_). Genera una gratis en https://resend.com/api-keys');
    }

    const from = smtp.from || 'InventariosApp <onboarding@resend.dev>';
    const resendAttachments = attachments.map(att => {
      let base64Content = '';
      if (Buffer.isBuffer(att.content)) {
        base64Content = att.content.toString('base64');
      } else if (typeof att.content === 'string') {
        base64Content = att.content.includes(',') ? att.content.split(',')[1] : att.content;
      }
      return {
        filename: att.filename,
        content: base64Content
      };
    });

    const payload = {
      from,
      to: [to],
      subject,
      html,
      attachments: resendAttachments.length > 0 ? resendAttachments : undefined
    };

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || `Error en Resend API (código ${res.status})`);
    }
    return { success: true, messageId: data.id, provider: 'Resend API (HTTPS)' };
  }

  // 3. TRADITIONAL SMTP (Nodemailer)
  const transporter = createTransporter(smtp);
  if (!transporter) {
    throw new Error('Servidor SMTP o API de correo no configurado.');
  }

  const fromAddress = smtp.from || process.env.SMTP_FROM || smtp.user || process.env.SMTP_USER;
  const info = await transporter.sendMail({
    from: fromAddress.includes('<') ? fromAddress : `"InventariosApp" <${fromAddress}>`,
    to,
    subject,
    html,
    attachments
  });

  return { success: true, messageId: info.messageId, provider: 'SMTP' };
}

async function sendAccessRequestEmailToAdmin(request) {
  const adminEmail = sharedPaymentConfig.adminNotificationEmail || process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.log('[Email] No hay correo de administrador configurado para notificaciones.');
    return false;
  }

  try {
    const attachments = [];
    if (request.voucherData && request.voucherFilename) {
      attachments.push({
        filename: request.voucherFilename,
        content: request.voucherData,
        contentType: request.voucherMimetype || 'application/octet-stream'
      });
    }

    const currSym = sharedPaymentConfig.currencySymbol || '$';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 14px; background-color: #ffffff;">
        <div style="background-color: #4f46e5; padding: 16px; border-radius: 10px; margin-bottom: 20px; text-align: center;">
          <h2 style="color: #ffffff; margin: 0; font-size: 20px;">📩 Nueva Solicitud de Acceso</h2>
          <p style="color: #e0e7ff; margin: 4px 0 0 0; font-size: 13px;">InventariosApp Sistema Colaborativo</p>
        </div>
        <p style="font-size: 14px; color: #334155;">Has recibido una nueva solicitud de acceso a la plataforma con comprobante de pago adjunto:</p>
        
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin: 16px 0;">
          <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b;"><strong>Solicitante:</strong></td><td style="padding: 8px 0; color: #0f172a;">${request.name || 'No especificado'}</td></tr>
          <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b;"><strong>Correo:</strong></td><td style="padding: 8px 0; color: #0f172a;"><a href="mailto:${request.email}" style="color: #4f46e5;">${request.email}</a></td></tr>
          <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b;"><strong>Teléfono / WhatsApp:</strong></td><td style="padding: 8px 0; color: #0f172a;">${request.phone || 'No especificado'}</td></tr>
          <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b;"><strong>Días Solicitados:</strong></td><td style="padding: 8px 0; color: #0f172a; font-weight: bold;">${request.daysRequested} días</td></tr>
          <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b;"><strong>Tarifa por Día:</strong></td><td style="padding: 8px 0; color: #0f172a;">${currSym}${request.pricePerDay} ${request.currency}</td></tr>
          <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b;"><strong>Monto Pagado:</strong></td><td style="padding: 8px 0; color: #16a34a; font-weight: bold; font-size: 16px;">${currSym}${request.totalAmount} ${request.currency}</td></tr>
          ${request.notes ? `<tr><td style="padding: 8px 0; color: #64748b;"><strong>Notas del Solicitante:</strong></td><td style="padding: 8px 0; color: #0f172a;">${request.notes}</td></tr>` : ''}
        </table>

        <div style="background-color: #f8fafc; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 13px; color: #475569; margin-top: 15px;">
          📎 El archivo de comprobante fue adjuntado a este correo. Puedes ingresar a la app en el menú <strong>"Solicitudes de Acceso"</strong> para autorizar la cuenta y generar la clave con un solo clic.
        </div>
      </div>
    `;

    const result = await sendAppEmail({
      to: adminEmail,
      subject: `Nueva Solicitud de Acceso: ${request.name || request.email} (${request.daysRequested} días - ${currSym}${request.totalAmount})`,
      html,
      attachments
    });
    console.log(`[Email] Notificación de solicitud enviada a administrador (${adminEmail}) vía ${result.provider}.`);
    return true;
  } catch (err) {
    console.error('[Email] Error enviando correo al administrador:', err.message);
    return false;
  }
}

async function sendCredentialsEmailToUser(userEmail, credentials, daysRequested, expiresAt) {
  try {
    const expDateStr = expiresAt ? new Date(expiresAt).toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Acceso permanente';
    const appUrl = sharedTunnelUrl || 'https://inventariosapp.onrender.com';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 14px; background-color: #ffffff;">
        <div style="background-color: #10b981; padding: 16px; border-radius: 10px; margin-bottom: 20px; text-align: center;">
          <h2 style="color: #ffffff; margin: 0; font-size: 20px;">🎉 ¡Tu Acceso a InventariosApp ha sido Aprobado!</h2>
        </div>
        <p style="font-size: 14px; color: #334155;">Hola,</p>
        <p style="font-size: 14px; color: #334155;">Tu pago y comprobante han sido validados exitosamente por el administrador. A continuación encontrarás tus credenciales de inicio de sesión:</p>
        
        <div style="background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 10px; padding: 18px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 6px 0; color: #475569;"><strong>Usuario:</strong></td><td style="padding: 6px 0;"><code style="background-color: #e2e8f0; padding: 3px 8px; border-radius: 6px; font-size: 15px; font-weight: bold; color: #1e293b;">${credentials.username}</code></td></tr>
            <tr><td style="padding: 6px 0; color: #475569;"><strong>Contraseña:</strong></td><td style="padding: 6px 0;"><code style="background-color: #e2e8f0; padding: 3px 8px; border-radius: 6px; font-size: 15px; font-weight: bold; color: #1e293b;">${credentials.password}</code></td></tr>
            <tr><td style="padding: 6px 0; color: #475569;"><strong>Días Habilitados:</strong></td><td style="padding: 6px 0; font-weight: bold; color: #1e293b;">${daysRequested} días</td></tr>
            <tr><td style="padding: 6px 0; color: #475569;"><strong>Vigente Hasta:</strong></td><td style="padding: 6px 0; font-weight: bold; color: #4f46e5;">${expDateStr}</td></tr>
          </table>
        </div>

        <div style="text-align: center; margin: 25px 0;">
          <a href="${appUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 14px;">
            Ingresar a InventariosApp
          </a>
        </div>

        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 30px;">
          Por seguridad te sugerimos cambiar tu contraseña una vez que inicies sesión.
        </p>
      </div>
    `;

    const result = await sendAppEmail({
      to: userEmail,
      subject: `Tus Credenciales de Acceso - InventariosApp`,
      html
    });
    console.log(`[Email] Credenciales enviadas exitosamente a ${userEmail} vía ${result.provider}.`);
    return true;
  } catch (err) {
    console.error('[Email] Error enviando credenciales a usuario:', err.message);
    return false;
  }
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
        role: 'collaborator',
        isCollaborator: true,
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
  const { username, password, sessionCode } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Ingresa tu usuario y contraseña' });
  }

  const cleanUser = String(username).trim().toLowerCase();
  let user = sharedUsers.find((u) => u.username.toLowerCase() === cleanUser);

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
      isCollaborator: Boolean(req.user.isCollaborator || req.user.role === 'collaborator' || String(req.user.id).startsWith('collab_')),
      sessionCode: req.user.sessionCode || null,
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
app.post('/api/users', requireAdmin, async (req, res) => {
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
  await dbSaveUser(newUser);

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
    }
  });
});

// Update user access duration in days / renewal (Admin only)
app.put('/api/users/:id/access', requireAdmin, async (req, res) => {
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
  await dbUpdateUserAccess(target.id, target.accessDays, target.expiresAt);

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
    }
  });
});

// Delete user (Admin only)
app.delete('/api/users/:id', requireAdmin, async (req, res) => {
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
  await dbDeleteUser(id);

  console.log(`[Auth] Usuario ${target.username} eliminado por ${req.user.username}`);
  res.json({ success: true, message: 'Usuario eliminado correctamente' });
});

// Change user password (Admin can change any, user can change own)
app.put('/api/users/:id/password', requireAuth, async (req, res) => {
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

  // Commit immediately to PostgreSQL database!
  await dbUpdateUserPassword(target.id, hash, salt);

  console.log(`[Auth] Contraseña de ${target.username} actualizada con éxito en servidor y base de datos.`);
  res.json({
    success: true,
    message: 'Contraseña actualizada con éxito en la base de datos.'
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
// REST API ENDPOINTS FOR PAYMENTS & ACCESS REQUESTS
// ==========================================

// Public: Get current payment & banking configuration for login & requests
app.get('/api/public/payment-config', (req, res) => {
  res.json({
    pricePerDay: Number(sharedPaymentConfig.pricePerDay) || 5.0,
    currency: sharedPaymentConfig.currency || 'USD',
    currencySymbol: sharedPaymentConfig.currencySymbol || '$',
    bankName: sharedPaymentConfig.bankName || '',
    accountType: sharedPaymentConfig.accountType || '',
    accountNumber: sharedPaymentConfig.accountNumber || '',
    accountHolder: sharedPaymentConfig.accountHolder || '',
    idNumber: sharedPaymentConfig.idNumber || '',
    phone: sharedPaymentConfig.phone || '',
    paymentEmail: sharedPaymentConfig.paymentEmail || '',
    instructions: sharedPaymentConfig.instructions || ''
  });
});

// Public: Submit new access request with voucher
app.post('/api/access-requests', async (req, res) => {
  try {
    const { email, name, phone, daysRequested, voucher, notes } = req.body || {};

    if (!email || !String(email).includes('@')) {
      return res.status(400).json({ error: 'Debes ingresar un correo electrónico válido.' });
    }

    const parsedDays = parseInt(daysRequested, 10);
    if (isNaN(parsedDays) || parsedDays < 1) {
      return res.status(400).json({ error: 'La cantidad de días solicitados debe ser de al menos 1 día.' });
    }

    if (!voucher || !voucher.data || String(voucher.data).length < 20) {
      return res.status(400).json({ error: 'Debes adjuntar el comprobante o voucher de pago (foto o PDF).' });
    }

    const pricePerDay = Number(sharedPaymentConfig.pricePerDay) || 5.0;
    const totalAmount = Number((pricePerDay * parsedDays).toFixed(2));

    const newRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      email: String(email).trim().toLowerCase(),
      name: name ? String(name).trim() : '',
      phone: phone ? String(phone).trim() : '',
      daysRequested: parsedDays,
      pricePerDay,
      totalAmount,
      currency: sharedPaymentConfig.currency || 'USD',
      voucherFilename: voucher.filename ? String(voucher.filename).trim() : 'comprobante.jpg',
      voucherMimetype: voucher.mimetype ? String(voucher.mimetype).trim() : 'image/jpeg',
      voucherData: voucher.data,
      status: 'pending',
      notes: notes ? String(notes).trim() : '',
      adminNotes: null,
      approvedUsername: null,
      createdAt: new Date().toISOString(),
      reviewedAt: null
    };

    // Add to in-memory list
    sharedAccessRequests.unshift(newRequest);
    persistAccessRequestsToDisk();

    // Persist to PostgreSQL if connected
    if (isDbConnected()) {
      await dbSaveAccessRequest(newRequest);
    }

    // Real-time broadcast to connected admins
    io.emit('access-request:new', {
      id: newRequest.id,
      email: newRequest.email,
      name: newRequest.name,
      daysRequested: newRequest.daysRequested,
      totalAmount: newRequest.totalAmount,
      currency: newRequest.currency,
      createdAt: newRequest.createdAt
    });

    // Send email notification to admin asynchronously
    sendAccessRequestEmailToAdmin(newRequest).catch((err) => {
      console.warn('[Email] Error al notificar al admin por correo:', err.message);
    });

    console.log(`[AccessRequests] Nueva solicitud recibida de ${newRequest.email} por ${newRequest.daysRequested} días (${sharedPaymentConfig.currencySymbol || '$'}${newRequest.totalAmount}).`);

    res.json({
      success: true,
      message: '¡Tu solicitud ha sido enviada con éxito! El administrador verificará tu comprobante y te enviará las credenciales a tu correo.',
      requestId: newRequest.id
    });
  } catch (err) {
    console.error('[AccessRequests] Error procesando solicitud de acceso:', err);
    res.status(500).json({ error: 'Error interno al procesar la solicitud de acceso.' });
  }
});

// Admin: Get all access requests
app.get('/api/admin/access-requests', requireAdmin, (req, res) => {
  res.json(sharedAccessRequests);
});

// Admin: Get full payment & notification config
app.get('/api/admin/payment-config', requireAdmin, (req, res) => {
  res.json(sharedPaymentConfig);
});

// Admin: Update payment & notification config
app.put('/api/admin/payment-config', requireAdmin, async (req, res) => {
  try {
    const {
      pricePerDay,
      currency,
      currencySymbol,
      adminNotificationEmail,
      bankName,
      accountType,
      accountNumber,
      accountHolder,
      idNumber,
      phone,
      paymentEmail,
      instructions,
      emailProvider,
      smtpConfig
    } = req.body || {};

    if (pricePerDay !== undefined) sharedPaymentConfig.pricePerDay = Math.max(0, Number(pricePerDay) || 0);
    if (currency !== undefined) sharedPaymentConfig.currency = String(currency).trim().toUpperCase();
    if (currencySymbol !== undefined) sharedPaymentConfig.currencySymbol = String(currencySymbol).trim();
    if (adminNotificationEmail !== undefined) sharedPaymentConfig.adminNotificationEmail = String(adminNotificationEmail).trim().toLowerCase();
    if (bankName !== undefined) sharedPaymentConfig.bankName = String(bankName).trim();
    if (accountType !== undefined) sharedPaymentConfig.accountType = String(accountType).trim();
    if (accountNumber !== undefined) sharedPaymentConfig.accountNumber = String(accountNumber).trim();
    if (accountHolder !== undefined) sharedPaymentConfig.accountHolder = String(accountHolder).trim();
    if (idNumber !== undefined) sharedPaymentConfig.idNumber = String(idNumber).trim();
    if (phone !== undefined) sharedPaymentConfig.phone = String(phone).trim();
    if (paymentEmail !== undefined) sharedPaymentConfig.paymentEmail = String(paymentEmail).trim();
    if (instructions !== undefined) sharedPaymentConfig.instructions = String(instructions).trim();
    if (emailProvider !== undefined) sharedPaymentConfig.emailProvider = String(emailProvider).trim();

    if (smtpConfig && typeof smtpConfig === 'object') {
      const existing = sharedPaymentConfig.smtpConfig || {};
      const chosenProvider = String(smtpConfig.provider || emailProvider || existing.provider || 'brevo').trim();
      sharedPaymentConfig.smtpConfig = {
        ...existing,
        provider: chosenProvider,
        apiKey: String(smtpConfig.apiKey !== undefined ? smtpConfig.apiKey : (existing.apiKey || '')).trim(),
        host: String(smtpConfig.host !== undefined ? smtpConfig.host : (existing.host || 'smtp.gmail.com')).trim(),
        port: Number(smtpConfig.port) || existing.port || 587,
        secure: Boolean(smtpConfig.secure !== undefined ? smtpConfig.secure : existing.secure),
        user: String(smtpConfig.user !== undefined ? smtpConfig.user : (existing.user || '')).trim(),
        pass: String(smtpConfig.pass !== undefined ? smtpConfig.pass : (existing.pass || '')).trim(),
        from: String(smtpConfig.from !== undefined ? smtpConfig.from : (existing.from || '')).trim(),
        fromEmail: String(smtpConfig.fromEmail !== undefined ? smtpConfig.fromEmail : (existing.fromEmail || '')).trim(),
        fromName: String(smtpConfig.fromName !== undefined ? smtpConfig.fromName : (existing.fromName || 'InventariosApp')).trim()
      };
      sharedPaymentConfig.emailProvider = chosenProvider;
    }

    persistPaymentConfigToDisk();

    if (isDbConnected()) {
      await dbSavePaymentConfig(sharedPaymentConfig);
    }

    console.log(`[Payment] Configuración actualizada por ${req.user.username}. Tarifa: ${sharedPaymentConfig.currencySymbol || '$'}${sharedPaymentConfig.pricePerDay} ${sharedPaymentConfig.currency}/día. Proveedor de correo: ${sharedPaymentConfig.emailProvider}`);

    res.json({
      success: true,
      message: 'Configuración de pagos y notificaciones guardada exitosamente.',
      config: sharedPaymentConfig
    });
  } catch (err) {
    console.error('[Payment] Error actualizando configuración de pagos:', err);
    res.status(500).json({ error: 'Error al guardar la configuración de pagos.' });
  }
});

// Admin: Test SMTP configuration by sending a verification email
app.post('/api/admin/payment-config/test-smtp', requireAdmin, async (req, res) => {
  try {
    const { smtpConfig, targetEmail, emailProvider } = req.body || {};
    const effectiveSmtp = smtpConfig || sharedPaymentConfig.smtpConfig || {};
    const provider = effectiveSmtp.provider || emailProvider || sharedPaymentConfig.emailProvider || 
      (effectiveSmtp.apiKey?.startsWith('xkeysib-') ? 'brevo' : (effectiveSmtp.apiKey?.startsWith('re_') ? 'resend' : 'smtp'));
    
    const recipient = targetEmail || sharedPaymentConfig.adminNotificationEmail || req.user.username;

    if (!recipient || !recipient.includes('@')) {
      return res.status(400).json({ error: 'Debes especificar un correo de destino válido para recibir la prueba.' });
    }

    if (provider === 'brevo' || effectiveSmtp.apiKey?.startsWith('xkeysib-')) {
      if (!effectiveSmtp.apiKey || !effectiveSmtp.apiKey.trim()) {
        return res.status(400).json({ error: 'Debes ingresar tu Clave API de Brevo (inicia con xkeysib-). Puedes crearla gratis en https://app.brevo.com/settings/keys/api' });
      }
    } else if (provider === 'resend' || effectiveSmtp.apiKey?.startsWith('re_')) {
      if (!effectiveSmtp.apiKey || !effectiveSmtp.apiKey.trim()) {
        return res.status(400).json({ error: 'Debes ingresar tu Clave API de Resend (inicia con re_). Puedes crearla gratis en https://resend.com/api-keys' });
      }
    } else {
      if (!effectiveSmtp.host || !effectiveSmtp.user || !effectiveSmtp.pass) {
        return res.status(400).json({ error: 'Debes completar el Servidor (Host), Usuario y Contraseña SMTP.' });
      }
    }

    const testConfig = {
      ...sharedPaymentConfig,
      emailProvider: provider,
      smtpConfig: {
        ...effectiveSmtp,
        provider
      }
    };

    const providerLabel = provider === 'brevo' 
      ? 'Brevo API (HTTPS Puerto 443)' 
      : provider === 'resend' 
        ? 'Resend API (HTTPS Puerto 443)' 
        : `SMTP Tradicional (${effectiveSmtp.host}:${effectiveSmtp.port || 587})`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 550px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 14px; background-color: #ffffff;">
        <div style="background-color: #10b981; padding: 14px; border-radius: 10px; margin-bottom: 20px; text-align: center;">
          <h2 style="color: #ffffff; margin: 0; font-size: 18px;">🎉 ¡Verificación de Correo Exitosa!</h2>
        </div>
        <p style="font-size: 14px; color: #334155;">Hola Administrador,</p>
        <p style="font-size: 14px; color: #334155;">Este es un mensaje de prueba para verificar que tu servicio de correos funciona a la perfección en <strong>InventariosApp</strong>.</p>
        
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin: 18px 0; font-size: 13px;">
          <p style="margin: 4px 0;"><strong>Proveedor Utilizado:</strong> ${providerLabel}</p>
          <p style="margin: 4px 0;"><strong>Destinatario de prueba:</strong> ${recipient}</p>
          <p style="margin: 4px 0;"><strong>Fecha y Hora:</strong> ${new Date().toLocaleString('es-DO')}</p>
        </div>
        
        <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
          A partir de ahora, cada vez que un usuario solicite acceso recibirás el comprobante de pago (voucher) adjunto en tu correo, y al pulsar "Aprobar" el sistema le enviará sus credenciales automáticamente.
        </p>
      </div>
    `;

    const sendResult = await sendAppEmail({
      to: recipient,
      subject: `✅ Correo de Prueba Exitoso - InventariosApp (${providerLabel})`,
      html,
      configOverride: testConfig
    });

    console.log(`[Email Test] Correo de prueba enviado exitosamente a ${recipient} vía ${sendResult.provider}`);
    res.json({
      success: true,
      message: `¡Correo de prueba enviado con éxito a ${recipient} a través de ${sendResult.provider}! Revisa tu bandeja de entrada o spam.`,
      messageId: sendResult.messageId,
      provider: sendResult.provider
    });
  } catch (err) {
    console.error('[Email Test] Error en prueba de correo:', err);
    let friendlyError = err.message || 'Error al conectar con el servicio de correo';
    
    if (friendlyError.includes('ETIMEDOUT') || friendlyError.includes('Connection timeout') || friendlyError.includes('ESOCKET')) {
      friendlyError = 'Tiempo de conexión agotado (Connection timeout). Render bloquea los puertos SMTP salientes (587, 465, 25) en su plan gratuito. Te recomendamos cambiar a la opción "Brevo API" arriba, la cual funciona 100% garantizada en Render vía HTTPS (puerto 443) y es gratuita (300 correos/día).';
    } else if (friendlyError.includes('Key not found') || friendlyError.includes('unauthorized') || friendlyError.includes('Invalid API Key') || friendlyError.includes('Key is invalid')) {
      friendlyError = 'La clave API ingresada no es válida o fue rechazada. Verifica haber copiado la clave correcta desde la consola de Brevo o Resend.';
    } else if (friendlyError.includes('Sender not found') || friendlyError.includes('unverified') || friendlyError.includes('sender is not verified')) {
      friendlyError = 'El correo remitente aún no está verificado en Brevo. En Brevo entra a "Senders & IP" -> "Senders", agrega tu correo y pulsa el enlace de confirmación que te llegará.';
    } else if (friendlyError.includes('EAUTH') || friendlyError.includes('Invalid login') || friendlyError.includes('Username and Password not accepted')) {
      friendlyError = 'Error de autenticación SMTP: Usuario o contraseña incorrectos. En Gmail recuerda generar una "Contraseña de Aplicación" de 16 caracteres.';
    }

    res.status(500).json({ error: friendlyError });
  }
});

// Admin: Approve access request & generate credentials
app.put('/api/admin/access-requests/:id/approve', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { customUsername, customPassword, adminNotes, sendEmail = true } = req.body || {};

  const target = sharedAccessRequests.find((r) => r.id === id);
  if (!target) {
    return res.status(404).json({ error: 'Solicitud no encontrada.' });
  }

  // Generate or sanitize username
  let finalUsername = '';
  if (customUsername && String(customUsername).trim()) {
    finalUsername = String(customUsername).trim().toLowerCase();
  } else {
    // Derive from email prefix
    const base = target.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'usuario';
    finalUsername = base;
    let counter = 1;
    while (sharedUsers.some((u) => u.username.toLowerCase() === finalUsername)) {
      finalUsername = `${base}${counter}`;
      counter++;
    }
  }

  // Generate or sanitize password
  let finalPassword = '';
  if (customPassword && String(customPassword).trim().length >= 4) {
    finalPassword = String(customPassword).trim();
  } else {
    // Generate clean 6-char alphanumeric password
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    finalPassword = code;
  }

  // Calculate expiration
  const days = Math.max(1, Number(target.daysRequested) || 30);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  // Check if user already exists (if so, renew instead of error)
  let existingUser = sharedUsers.find((u) => u.username.toLowerCase() === finalUsername);
  if (existingUser) {
    existingUser.accessDays = days;
    existingUser.expiresAt = expiresAt;
    const { hash, salt } = hashPassword(finalPassword);
    existingUser.passwordHash = hash;
    existingUser.salt = salt;
    persistUsersToDisk();
    await dbSaveUser(existingUser);
  } else {
    const { hash, salt } = hashPassword(finalPassword);
    const newUser = {
      id: `u_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      username: finalUsername,
      name: target.name || finalUsername,
      role: 'auditor',
      accessDays: days,
      expiresAt,
      passwordHash: hash,
      salt,
      createdAt: new Date().toISOString()
    };
    sharedUsers.push(newUser);
    persistUsersToDisk();
    await dbSaveUser(newUser);
  }

  // Update request state
  target.status = 'approved';
  target.approvedUsername = finalUsername;
  target.adminNotes = adminNotes ? String(adminNotes).trim() : null;
  target.reviewedAt = new Date().toISOString();

  persistAccessRequestsToDisk();
  if (isDbConnected()) {
    await dbUpdateAccessRequest(target.id, {
      status: target.status,
      adminNotes: target.adminNotes,
      approvedUsername: target.approvedUsername,
      reviewedAt: target.reviewedAt
    });
  }

  // Try to send email to user if requested
  let emailSent = false;
  if (sendEmail) {
    try {
      emailSent = await sendCredentialsEmailToUser(
        target.email,
        { username: finalUsername, password: finalPassword },
        days,
        expiresAt
      );
    } catch (err) {
      console.warn('[Email] No se pudo enviar el correo de credenciales:', err.message);
    }
  }

  // Pre-formatted message for admin to copy-paste or send via WhatsApp/Mail
  const expFormatted = new Date(expiresAt).toLocaleDateString('es-DO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const copyableMessage = `¡Hola ${target.name || 'estimado usuario'}! Tu acceso a InventariosApp ha sido activado exitosamente:\n\n` +
    `👤 Usuario: ${finalUsername}\n` +
    `🔑 Contraseña: ${finalPassword}\n` +
    `⏳ Vigencia: ${days} días (Vence el ${expFormatted})\n` +
    `🌐 Enlace: ${sharedTunnelUrl || 'https://inventariosapp.onrender.com'}\n\n` +
    `¡Gracias por tu pago y preferencia!`;

  io.emit('access-request:updated', target);

  console.log(`[AccessRequests] Solicitud ${target.id} aprobada por ${req.user.username}. Usuario creado: ${finalUsername} (${days} días).`);

  res.json({
    success: true,
    message: `Solicitud aprobada con éxito. Usuario creado: ${finalUsername}`,
    credentials: {
      username: finalUsername,
      password: finalPassword,
      accessDays: days,
      expiresAt
    },
    emailSent,
    copyableMessage
  });
});

// Admin: Reject access request
app.put('/api/admin/access-requests/:id/reject', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { adminNotes } = req.body || {};

  const target = sharedAccessRequests.find((r) => r.id === id);
  if (!target) {
    return res.status(404).json({ error: 'Solicitud no encontrada.' });
  }

  target.status = 'rejected';
  target.adminNotes = adminNotes ? String(adminNotes).trim() : 'Comprobante no válido o pago no verificado.';
  target.reviewedAt = new Date().toISOString();

  persistAccessRequestsToDisk();
  if (isDbConnected()) {
    await dbUpdateAccessRequest(target.id, {
      status: target.status,
      adminNotes: target.adminNotes,
      approvedUsername: null,
      reviewedAt: target.reviewedAt
    });
  }

  io.emit('access-request:updated', target);
  console.log(`[AccessRequests] Solicitud ${target.id} rechazada por ${req.user.username}.`);

  res.json({
    success: true,
    message: 'Solicitud marcada como rechazada.'
  });
});

// Admin: Delete access request
app.delete('/api/admin/access-requests/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;

  sharedAccessRequests = sharedAccessRequests.filter((r) => r.id !== id);
  persistAccessRequestsToDisk();

  if (isDbConnected()) {
    await dbDeleteAccessRequest(id);
  }

  io.emit('access-request:deleted', { id });
  res.json({ success: true, message: 'Solicitud eliminada correctamente.' });
});

// ==========================================
// REST API ENDPOINTS FOR SESSIONS / ROOMS
// ==========================================

// Create new counting session
app.post('/api/sessions/create', requireAuth, (req, res) => {
  if (req.user.isCollaborator || req.user.role === 'collaborator' || String(req.user.id).startsWith('collab_')) {
    return res.status(403).json({ error: 'Los auxiliares no tienen permiso para crear sesiones de conteo.' });
  }

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
    backups: [],
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
  if (req.user.isCollaborator || req.user.role === 'collaborator' || String(req.user.id).startsWith('collab_')) {
    return res.json([]);
  }

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
  const isCollab = req.user.isCollaborator || req.user.role === 'collaborator' || String(req.user.id).startsWith('collab_');
  if (isCollab && req.user.sessionCode && req.user.sessionCode !== cleanCode) {
    return res.status(403).json({ error: 'Los auxiliares solo tienen acceso a la sesión asignada.' });
  }

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
app.delete('/api/sessions/:code', requireAuth, async (req, res) => {
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
  await dbDeleteSession(cleanCode);

  console.log(`[Sessions] Sesión ${cleanCode} eliminada por ${req.user.username}`);
  res.json({ success: true, message: `Sesión ${cleanCode} eliminada correctamente.` });
});

// ==========================================
// SESSION-ISOLATED BACKUPS (PUNTOS DE RESTAURACIÓN)
// ==========================================

// Get backups for a specific session
app.get('/api/sessions/:code/backups', requireAuth, (req, res) => {
  const { code } = req.params;
  const cleanCode = String(code).trim().toUpperCase();
  const isCollab = req.user.isCollaborator || req.user.role === 'collaborator' || String(req.user.id).startsWith('collab_');
  if (isCollab && req.user.sessionCode && req.user.sessionCode !== cleanCode) {
    return res.status(403).json({ error: 'Los auxiliares solo tienen acceso a la sesión asignada.' });
  }

  const session = sharedSessions[cleanCode];
  if (!session) {
    return res.status(404).json({ error: `La sesión "${cleanCode}" no existe.` });
  }

  const backups = Array.isArray(session.backups) ? session.backups : [];
  res.json(backups);
});

// Create a new backup snapshot for a specific session
app.post('/api/sessions/:code/backups', requireAuth, (req, res) => {
  const isCollab = req.user.isCollaborator || req.user.role === 'collaborator' || String(req.user.id).startsWith('collab_');
  if (isCollab) {
    return res.status(403).json({ error: 'Los auxiliares no tienen permiso para gestionar respaldos.' });
  }

  const { code } = req.params;
  const cleanCode = String(code).trim().toUpperCase();
  const session = sharedSessions[cleanCode];
  if (!session) {
    return res.status(404).json({ error: `La sesión "${cleanCode}" no existe.` });
  }

  if (isSessionExpired(session)) {
    return res.status(403).json({ error: 'Esta sesión ha culminado su período de vigencia.' });
  }

  const { name, note, items, totalSkus, totalUnits, totalCostInvestment, totalRetailPrice } = req.body || {};
  const backupId = `bk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const backupName = (name && String(name).trim()) || `Respaldo ${cleanCode} - ${new Date().toLocaleDateString('es-DO')}`;

  const backupItem = {
    id: backupId,
    sessionCode: cleanCode,
    name: backupName,
    note: (note && String(note).trim()) || '',
    items: Array.isArray(items) ? items : (session.countedItems || []),
    totalSkus: totalSkus !== undefined ? totalSkus : (session.countedItems || []).length,
    totalUnits: totalUnits !== undefined ? totalUnits : 0,
    totalCostInvestment: totalCostInvestment !== undefined ? totalCostInvestment : 0,
    totalRetailPrice: totalRetailPrice !== undefined ? totalRetailPrice : 0,
    savedAt: new Date().toISOString(),
    savedBy: req.user.name || req.user.username
  };

  if (!Array.isArray(session.backups)) session.backups = [];
  session.backups.unshift(backupItem);
  persistSessionsToDisk();

  console.log(`[Backups] Nuevo respaldo creado en sesión ${cleanCode}: "${backupName}" por ${req.user.username}`);
  res.json({ success: true, backup: backupItem });
});

// Restore a backup snapshot for a specific session
app.post('/api/sessions/:code/backups/:backupId/restore', requireAuth, (req, res) => {
  const isCollab = req.user.isCollaborator || req.user.role === 'collaborator' || String(req.user.id).startsWith('collab_');
  if (isCollab) {
    return res.status(403).json({ error: 'Los auxiliares no tienen permiso para restaurar respaldos.' });
  }

  const { code, backupId } = req.params;
  const cleanCode = String(code).trim().toUpperCase();
  const session = sharedSessions[cleanCode];
  if (!session) {
    return res.status(404).json({ error: `La sesión "${cleanCode}" no existe.` });
  }

  if (isSessionExpired(session)) {
    return res.status(403).json({ error: 'Esta sesión ha culminado su período de vigencia.' });
  }

  if (!Array.isArray(session.backups)) session.backups = [];
  const backup = session.backups.find((b) => b.id === backupId);
  if (!backup) {
    return res.status(404).json({ error: 'El respaldo solicitado no fue encontrado en esta sesión.' });
  }

  session.countedItems = Array.isArray(backup.items) ? [...backup.items] : [];
  session.lastUpdated = new Date().toISOString();
  persistSessionsToDisk();

  // Broadcast restoration to all clients in this session room
  io.to(cleanCode).emit('session:restored', {
    sessionCode: cleanCode,
    sessionName: session.name,
    countedItems: session.countedItems,
    by: `${req.user.name} (Restauró respaldo "${backup.name}")`
  });

  console.log(`[Backups] Respaldo "${backup.name}" restaurado en sesión ${cleanCode} por ${req.user.username}`);
  res.json({
    success: true,
    message: `Respaldo "${backup.name}" restaurado con éxito`,
    totalCounted: session.countedItems.length,
    session
  });
});

// Delete a backup snapshot from a specific session
app.delete('/api/sessions/:code/backups/:backupId', requireAuth, (req, res) => {
  const isCollab = req.user.isCollaborator || req.user.role === 'collaborator' || String(req.user.id).startsWith('collab_');
  if (isCollab) {
    return res.status(403).json({ error: 'Los auxiliares no tienen permiso para eliminar respaldos.' });
  }

  const { code, backupId } = req.params;
  const cleanCode = String(code).trim().toUpperCase();
  const session = sharedSessions[cleanCode];
  if (!session) {
    return res.status(404).json({ error: `La sesión "${cleanCode}" no existe.` });
  }

  if (!Array.isArray(session.backups)) session.backups = [];
  session.backups = session.backups.filter((b) => b.id !== backupId);
  persistSessionsToDisk();

  console.log(`[Backups] Respaldo ${backupId} eliminado de sesión ${cleanCode} por ${req.user.username}`);
  res.json({ success: true, message: 'Respaldo eliminado correctamente.' });
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
    role: 'collaborator',
    isCollaborator: true,
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

// Migrate local browser state to server shared database (Admin Only)
app.post('/api/migrate-from-client', requireAdmin, (req, res) => {
  const { sessionCode, sessionName, countedItems, historyLogs, catalog } = req.body;

  // Only Administrator can replace or modify the shared master catalog!
  if (Array.isArray(catalog) && catalog.length > 0) {
    sharedCatalog = catalog;
    persistCatalogToDisk();
    io.emit('catalog:updated', {
      totalProducts: sharedCatalog.length,
      updatedAt: new Date().toISOString()
    });
    console.log(`[Migrate] Catálogo maestro subido por administrador (${req.user.username}): ${catalog.length} productos.`);
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
  let isCollaborator = false;
  let clientUserId = null;
  if (clientToken) {
    const verified = verifyToken(clientToken);
    if (verified) {
      if (verified.name) {
        defaultName = verified.name;
      }
      if (verified.role) {
        defaultRole = verified.role;
      }
      if (verified.sessionCode) {
        defaultSession = verified.sessionCode;
      }
      clientUserId = verified.userId;
      isCollaborator = Boolean(verified.isCollaborator || verified.role === 'collaborator' || String(verified.userId || '').startsWith('collab_'));
    }
  }

  const handshakeSession = socket.handshake.auth?.sessionCode || socket.handshake.query?.sessionCode || defaultSession;
  const initialSession = handshakeSession && sharedSessions[handshakeSession] ? handshakeSession : null;

  socket.data.name = defaultName;
  socket.data.sessionCode = initialSession;
  socket.data.role = defaultRole;
  socket.data.isCollaborator = isCollaborator;
  socket.data.userId = clientUserId;

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

    // Prevent collaborator from switching to another session
    const isCollab = socket.data.isCollaborator || socket.data.role === 'collaborator' || String(socket.data.userId || '').startsWith('collab_');
    if (isCollab && socket.data.sessionCode && socket.data.sessionCode !== cleanCode) {
      return socket.emit('session:error', { error: 'Los auxiliares no tienen permiso para conectarse a otra sesión.' });
    }

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
    const isCollab = socket.data.isCollaborator || socket.data.role === 'collaborator' || String(socket.data.userId || '').startsWith('collab_');
    if (isCollab) {
      return socket.emit('session:error', { error: 'Los auxiliares no tienen permiso para reiniciar el inventario.' });
    }

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
    const isCollab = socket.data.isCollaborator || socket.data.role === 'collaborator' || String(socket.data.userId || '').startsWith('collab_');
    if (isCollab) {
      return socket.emit('session:error', { error: 'Los auxiliares no tienen permiso para borrar el historial.' });
    }

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
    const isCollab = socket.data.isCollaborator || socket.data.role === 'collaborator' || String(socket.data.userId || '').startsWith('collab_');
    if (isCollab) {
      return socket.emit('session:error', { error: 'Los auxiliares no tienen permiso para renombrar la sesión.' });
    }

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
    const isCollab = socket.data.isCollaborator || socket.data.role === 'collaborator' || String(socket.data.userId || '').startsWith('collab_');
    if (isCollab) {
      return socket.emit('session:error', { error: 'Los auxiliares no tienen permiso para restaurar respaldos en la sesión.' });
    }

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

async function startServer() {
  // 1. Initialize PostgreSQL database tables if DATABASE_URL is configured
  const hasDb = await initDatabaseTables();

  if (hasDb) {
    try {
      const dbUsers = await dbLoadUsers();
      if (dbUsers && dbUsers.length > 0) {
        sharedUsers = dbUsers;
        console.log(`[Database] ✅ Cargados ${sharedUsers.length} usuarios registrados desde PostgreSQL.`);
      }

      const dbSessions = await dbLoadSessions();
      if (dbSessions && Object.keys(dbSessions).length > 0) {
        sharedSessions = dbSessions;
        console.log(`[Database] ✅ Cargadas ${Object.keys(sharedSessions).length} sesiones de inventario desde PostgreSQL.`);
      }

      const dbCatalog = await dbLoadCatalog();
      if (Array.isArray(dbCatalog) && dbCatalog.length > 0) {
        sharedCatalog = dbCatalog;
        console.log(`[Database] ✅ Cargados ${sharedCatalog.length} productos del catálogo desde PostgreSQL.`);
      }

      const dbPayment = await dbLoadPaymentConfig();
      if (dbPayment && typeof dbPayment === 'object') {
        sharedPaymentConfig = { ...DEFAULT_PAYMENT_CONFIG, ...dbPayment };
        cleanDummyPaymentConfig(sharedPaymentConfig);
        console.log(`[Database] ✅ Configuración de pagos cargada desde PostgreSQL. Tarifa: ${sharedPaymentConfig.pricePerDay} ${sharedPaymentConfig.currency}/día.`);
      }

      const dbRequests = await dbLoadAccessRequests();
      if (Array.isArray(dbRequests)) {
        sharedAccessRequests = dbRequests;
        console.log(`[Database] ✅ Cargadas ${sharedAccessRequests.length} solicitudes de acceso desde PostgreSQL.`);
      }
    } catch (err) {
      console.error('[Database] Error al cargar datos iniciales de PostgreSQL:', err);
    }
  }

  // 2. Fallback to local files if database was empty or not connected
  if (sharedUsers.length === 0) {
    loadUsersFromDisk();
  }
  if (Object.keys(sharedSessions).length === 0) {
    loadSessionsFromDisk();
  }
  if (sharedCatalog.length === 0) {
    loadCatalogFromDisk();
  }
  loadPaymentConfigFromDisk();
  loadAccessRequestsFromDisk();

  // 3. Ensure default admin user exists
  if (sharedUsers.length === 0) {
    const initialAdminPass = process.env.ADMIN_PASSWORD || 'admin';
    const { hash, salt } = hashPassword(initialAdminPass);
    const defaultAdmin = {
      id: 'u_admin',
      username: 'admin',
      name: 'Administrador',
      role: 'admin',
      passwordHash: hash,
      salt,
      createdAt: new Date().toISOString()
    };
    sharedUsers = [defaultAdmin];
    persistUsersToDisk();
    await dbSaveUser(defaultAdmin);
    console.log('[Auth] Administrador por defecto inicializado.');
  }

  // Enforce ADMIN_PASSWORD environment variable if set
  if (process.env.ADMIN_PASSWORD) {
    const adminUser = sharedUsers.find((u) => u.username.toLowerCase() === 'admin');
    if (adminUser) {
      const { hash, salt } = hashPassword(process.env.ADMIN_PASSWORD);
      adminUser.passwordHash = hash;
      adminUser.salt = salt;
      persistUsersToDisk();
      await dbUpdateUserPassword(adminUser.id, hash, salt);
      console.log('[Auth] Contraseña de admin actualizada según variable de entorno ADMIN_PASSWORD.');
    }
  }

  // 4. Ensure default session exists
  if (Object.keys(sharedSessions).length === 0) {
    const defaultCode = 'INV-1001';
    const defaultSess = {
      code: defaultCode,
      name: sharedState.sessionName || 'Pase de Inventario General',
      createdBy: 'u_admin',
      creatorUsername: 'admin',
      creatorName: 'Administrador',
      createdAt: new Date().toISOString(),
      expiresAt: null,
      countedItems: sharedState.countedItems || [],
      historyLogs: sharedState.historyLogs || [],
      backups: [],
      lastUpdated: sharedState.lastUpdated || new Date().toISOString()
    };
    sharedSessions[defaultCode] = defaultSess;
    persistSessionsToDisk();
    await dbUpsertSession(defaultSess);
    console.log(`[Storage] Sesión inicial creada con código: ${defaultCode}`);
  }

  // 5. Start listening
  httpServer.listen(PORT, '0.0.0.0', () => {
    const localIp = getLocalIpAddress();
    console.log(`======================================================================`);
    console.log(` 🚀 Servidor de Inventario Colaborativo en Línea`);
    console.log(` 💻 Esta PC (Local):     http://localhost:${PORT}`);
    console.log(` 📶 Red Local (Wi-Fi):   http://${localIp}:${PORT}`);
    console.log(` 👥 Sincronización multiusuario en tiempo real activa`);
    console.log(` 💾 Base de Datos:       ${isDbConnected() ? 'PostgreSQL (Cloud Persistente)' : 'Archivos Locales'}`);
    console.log(` 📦 Catálogo en servidor: ${sharedCatalog.length} productos`);
    console.log(` 📝 Sesiones activas:    ${Object.keys(sharedSessions).length}`);
    console.log(`======================================================================`);
    
    // Start Cloudflare Tunnel automatically
    startCloudflareTunnel(PORT);
  });
}

startServer();
