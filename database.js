import pg from 'pg';
const { Pool } = pg;

let pool = null;
let isConnected = false;

/**
 * Initialize PostgreSQL connection pool using DATABASE_URL environment variable.
 * Compatible with Render PostgreSQL, Supabase, Neon, Railway, or local Postgres.
 */
export function getDbPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return null;
  }

  try {
    const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
    pool = new Pool({
      connectionString,
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('[Database] Error inesperado en el pool de PostgreSQL:', err);
    });

    return pool;
  } catch (err) {
    console.error('[Database] Error al configurar el pool de PostgreSQL:', err);
    return null;
  }
}

/**
 * Run migrations to ensure all required tables exist.
 */
export async function initDatabaseTables() {
  const db = getDbPool();
  if (!db) {
    console.log('[Database] ⚠️  DATABASE_URL no configurada. Usando almacenamiento en disco local.');
    return false;
  }

  try {
    console.log('[Database] Conectando a base de datos PostgreSQL...');
    const client = await db.connect();

    try {
      // 1. Users Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'auditor',
          password_hash TEXT NOT NULL,
          salt TEXT NOT NULL,
          access_days INTEGER,
          expires_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // 2. Sessions Table (multi-session inventory)
      await client.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          code TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_by TEXT,
          creator_username TEXT,
          creator_name TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          expires_at TIMESTAMPTZ,
          counted_items JSONB NOT NULL DEFAULT '[]'::jsonb,
          history_logs JSONB NOT NULL DEFAULT '[]'::jsonb,
          backups JSONB NOT NULL DEFAULT '[]'::jsonb,
          last_updated TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // 3. App Settings & General Configurations Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value JSONB NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // 4. Shared Catalog Table (persistent across redeploys)
      await client.query(`
        CREATE TABLE IF NOT EXISTS catalog_products (
          id TEXT PRIMARY KEY,
          codigo TEXT,
          codigo_interno TEXT,
          codigo_internacional TEXT,
          descripcion TEXT,
          marca TEXT,
          modelo TEXT,
          unidad TEXT,
          categoria TEXT,
          departamento TEXT,
          costo NUMERIC DEFAULT 0,
          precio NUMERIC DEFAULT 0,
          existencia NUMERIC DEFAULT 0,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // 5. Access Requests Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS access_requests (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          name TEXT,
          phone TEXT,
          days_requested INTEGER NOT NULL,
          price_per_day NUMERIC NOT NULL,
          total_amount NUMERIC NOT NULL,
          currency TEXT NOT NULL DEFAULT 'USD',
          voucher_filename TEXT,
          voucher_mimetype TEXT,
          voucher_data TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          notes TEXT,
          admin_notes TEXT,
          approved_username TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          reviewed_at TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);
        CREATE INDEX IF NOT EXISTS idx_access_requests_created ON access_requests(created_at DESC);
      `);

      isConnected = true;
      console.log('[Database] ✅ Base de datos PostgreSQL conectada y tablas inicializadas con éxito.');
      return true;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[Database] ❌ Error conectando a PostgreSQL:', err.message);
    isConnected = false;
    return false;
  }
}

export function isDbConnected() {
  return isConnected;
}

// ==========================================
// USERS CRUD
// ==========================================

export async function dbLoadUsers() {
  const db = getDbPool();
  if (!db || !isConnected) return null;

  try {
    const res = await db.query('SELECT * FROM users ORDER BY created_at ASC');
    return res.rows.map(r => ({
      id: r.id,
      username: r.username,
      name: r.name,
      role: r.role,
      passwordHash: r.password_hash,
      salt: r.salt,
      accessDays: r.access_days,
      expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : null,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
    }));
  } catch (err) {
    console.error('[Database] Error cargando usuarios desde PostgreSQL:', err);
    return null;
  }
}

export async function dbSaveUser(user) {
  const db = getDbPool();
  if (!db || !isConnected) return false;

  try {
    await db.query(`
      INSERT INTO users (id, username, name, role, password_hash, salt, access_days, expires_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        password_hash = EXCLUDED.password_hash,
        salt = EXCLUDED.salt,
        access_days = EXCLUDED.access_days,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW();
    `, [
      user.id,
      user.username.toLowerCase(),
      user.name,
      user.role,
      user.passwordHash,
      user.salt,
      user.accessDays || null,
      user.expiresAt || null,
      user.createdAt || new Date().toISOString()
    ]);
    return true;
  } catch (err) {
    console.error('[Database] Error guardando usuario en PostgreSQL:', err);
    return false;
  }
}

export async function dbUpdateUserPassword(userId, passwordHash, salt) {
  const db = getDbPool();
  if (!db || !isConnected) return false;

  try {
    await db.query(`
      UPDATE users 
      SET password_hash = $1, salt = $2, updated_at = NOW()
      WHERE id = $3
    `, [passwordHash, salt, userId]);
    console.log(`[Database] ✅ Contraseña de usuario (${userId}) guardada en PostgreSQL.`);
    return true;
  } catch (err) {
    console.error('[Database] Error actualizando contraseña en PostgreSQL:', err);
    return false;
  }
}

export async function dbUpdateUserAccess(userId, accessDays, expiresAt) {
  const db = getDbPool();
  if (!db || !isConnected) return false;

  try {
    await db.query(`
      UPDATE users 
      SET access_days = $1, expires_at = $2, updated_at = NOW()
      WHERE id = $3
    `, [accessDays || null, expiresAt || null, userId]);
    return true;
  } catch (err) {
    console.error('[Database] Error actualizando acceso en PostgreSQL:', err);
    return false;
  }
}

export async function dbDeleteUser(userId) {
  const db = getDbPool();
  if (!db || !isConnected) return false;

  try {
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    return true;
  } catch (err) {
    console.error('[Database] Error eliminando usuario en PostgreSQL:', err);
    return false;
  }
}

// ==========================================
// SESSIONS CRUD
// ==========================================

export async function dbLoadSessions() {
  const db = getDbPool();
  if (!db || !isConnected) return null;

  try {
    const res = await db.query('SELECT * FROM sessions');
    const sessions = {};
    res.rows.forEach(r => {
      sessions[r.code] = {
        code: r.code,
        name: r.name,
        createdBy: r.created_by,
        creatorUsername: r.creator_username,
        creatorName: r.creator_name,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : null,
        countedItems: Array.isArray(r.counted_items) ? r.counted_items : [],
        historyLogs: Array.isArray(r.history_logs) ? r.history_logs : [],
        backups: Array.isArray(r.backups) ? r.backups : [],
        lastUpdated: r.last_updated ? new Date(r.last_updated).toISOString() : new Date().toISOString()
      };
    });
    return sessions;
  } catch (err) {
    console.error('[Database] Error cargando sesiones desde PostgreSQL:', err);
    return null;
  }
}

export async function dbUpsertSession(session) {
  const db = getDbPool();
  if (!db || !isConnected) return false;

  try {
    await db.query(`
      INSERT INTO sessions (code, name, created_by, creator_username, creator_name, created_at, expires_at, counted_items, history_logs, backups, last_updated)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        expires_at = EXCLUDED.expires_at,
        counted_items = EXCLUDED.counted_items,
        history_logs = EXCLUDED.history_logs,
        backups = EXCLUDED.backups,
        last_updated = EXCLUDED.last_updated;
    `, [
      session.code,
      session.name,
      session.createdBy || null,
      session.creatorUsername || null,
      session.creatorName || null,
      session.createdAt || new Date().toISOString(),
      session.expiresAt || null,
      JSON.stringify(session.countedItems || []),
      JSON.stringify(session.historyLogs || []),
      JSON.stringify(session.backups || []),
      session.lastUpdated || new Date().toISOString()
    ]);
    return true;
  } catch (err) {
    console.error('[Database] Error guardando sesión en PostgreSQL:', err);
    return false;
  }
}

export async function dbDeleteSession(code) {
  const db = getDbPool();
  if (!db || !isConnected) return false;

  try {
    await db.query('DELETE FROM sessions WHERE code = $1', [code]);
    return true;
  } catch (err) {
    console.error('[Database] Error eliminando sesión en PostgreSQL:', err);
    return false;
  }
}

// ==========================================
// APP SETTINGS & CONFIGURATIONS CRUD
// ==========================================

export async function dbLoadSettings(key) {
  const db = getDbPool();
  if (!db || !isConnected) return null;

  try {
    const res = await db.query('SELECT value FROM app_settings WHERE key = $1', [key]);
    if (res.rows.length > 0) {
      return res.rows[0].value;
    }
    return null;
  } catch (err) {
    console.error('[Database] Error leyendo configuración en PostgreSQL:', err);
    return null;
  }
}

export async function dbSaveSettings(key, value) {
  const db = getDbPool();
  if (!db || !isConnected) return false;

  try {
    await db.query(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = NOW();
    `, [key, JSON.stringify(value)]);
    return true;
  } catch (err) {
    console.error('[Database] Error guardando configuración en PostgreSQL:', err);
    return false;
  }
}

// ==========================================
// SHARED CATALOG CRUD
// ==========================================

export async function dbLoadCatalog() {
  const db = getDbPool();
  if (!db || !isConnected) return null;

  try {
    // Check if catalog is saved in app_settings (fastest for bulk JSON)
    const stored = await dbLoadSettings('shared_catalog');
    if (Array.isArray(stored) && stored.length > 0) {
      return stored;
    }

    // Fallback: check catalog_products table
    const res = await db.query('SELECT * FROM catalog_products');
    if (res.rows.length > 0) {
      return res.rows.map(r => ({
        id: r.id,
        codigo: r.codigo,
        codigoInterno: r.codigo_interno,
        codigoInternacional: r.codigo_internacional,
        descripcion: r.descripcion,
        marca: r.marca,
        modelo: r.modelo,
        unidad: r.unidad,
        categoria: r.categoria,
        departamento: r.departamento,
        costo: Number(r.costo) || 0,
        precio: Number(r.precio) || 0,
        existencia: Number(r.existencia) || 0
      }));
    }
    return null;
  } catch (err) {
    console.error('[Database] Error cargando catálogo desde PostgreSQL:', err);
    return null;
  }
}

export async function dbSaveCatalog(catalog) {
  const db = getDbPool();
  if (!db || !isConnected) return false;

  try {
    // Store full catalog in app_settings JSONB for ultra-fast bulk sync
    await dbSaveSettings('shared_catalog', catalog);
    console.log(`[Database] ✅ Catálogo (${catalog.length} productos) guardado en PostgreSQL.`);
    return true;
  } catch (err) {
    console.error('[Database] Error guardando catálogo en PostgreSQL:', err);
    return false;
  }
}

// ==========================================
// ACCESS REQUESTS CRUD
// ==========================================

export async function dbLoadAccessRequests() {
  const db = getDbPool();
  if (!db || !isConnected) return null;

  try {
    const res = await db.query('SELECT * FROM access_requests ORDER BY created_at DESC');
    return res.rows.map(r => ({
      id: r.id,
      email: r.email,
      name: r.name,
      phone: r.phone,
      daysRequested: Number(r.days_requested),
      pricePerDay: Number(r.price_per_day),
      totalAmount: Number(r.total_amount),
      currency: r.currency,
      voucherFilename: r.voucher_filename,
      voucherMimetype: r.voucher_mimetype,
      voucherData: r.voucher_data,
      status: r.status,
      notes: r.notes,
      adminNotes: r.admin_notes,
      approvedUsername: r.approved_username,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      reviewedAt: r.reviewed_at ? new Date(r.reviewed_at).toISOString() : null
    }));
  } catch (err) {
    console.error('[Database] Error cargando solicitudes de acceso:', err);
    return null;
  }
}

export async function dbSaveAccessRequest(request) {
  const db = getDbPool();
  if (!db || !isConnected) return false;

  try {
    await db.query(`
      INSERT INTO access_requests (
        id, email, name, phone, days_requested, price_per_day, total_amount, currency,
        voucher_filename, voucher_mimetype, voucher_data, status, notes, admin_notes,
        approved_username, created_at, reviewed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        admin_notes = EXCLUDED.admin_notes,
        approved_username = EXCLUDED.approved_username,
        reviewed_at = EXCLUDED.reviewed_at;
    `, [
      request.id,
      request.email.toLowerCase().trim(),
      request.name || null,
      request.phone || null,
      request.daysRequested,
      request.pricePerDay,
      request.totalAmount,
      request.currency || 'USD',
      request.voucherFilename || null,
      request.voucherMimetype || null,
      request.voucherData || null,
      request.status || 'pending',
      request.notes || null,
      request.adminNotes || null,
      request.approvedUsername || null,
      request.createdAt || new Date().toISOString(),
      request.reviewedAt || null
    ]);
    return true;
  } catch (err) {
    console.error('[Database] Error guardando solicitud de acceso:', err);
    return false;
  }
}

export async function dbUpdateAccessRequest(id, updates) {
  const db = getDbPool();
  if (!db || !isConnected) return false;

  try {
    const { status, adminNotes, approvedUsername, reviewedAt } = updates;
    await db.query(`
      UPDATE access_requests
      SET status = COALESCE($1, status),
          admin_notes = COALESCE($2, admin_notes),
          approved_username = COALESCE($3, approved_username),
          reviewed_at = COALESCE($4, reviewed_at)
      WHERE id = $5
    `, [
      status || null,
      adminNotes !== undefined ? adminNotes : null,
      approvedUsername !== undefined ? approvedUsername : null,
      reviewedAt || new Date().toISOString(),
      id
    ]);
    return true;
  } catch (err) {
    console.error('[Database] Error actualizando solicitud de acceso:', err);
    return false;
  }
}

export async function dbDeleteAccessRequest(id) {
  const db = getDbPool();
  if (!db || !isConnected) return false;

  try {
    await db.query('DELETE FROM access_requests WHERE id = $1', [id]);
    return true;
  } catch (err) {
    console.error('[Database] Error eliminando solicitud de acceso:', err);
    return false;
  }
}

// ==========================================
// PAYMENT CONFIGURATION
// ==========================================

export async function dbLoadPaymentConfig() {
  const config = await dbLoadSettings('payment_config');
  return config;
}

export async function dbSavePaymentConfig(config) {
  return await dbSaveSettings('payment_config', config);
}

