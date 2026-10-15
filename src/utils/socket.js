import { io } from 'socket.io-client';

let socket = null;

export function getServerBaseUrl() {
  const url = import.meta.env.VITE_BACKEND_URL || localStorage.getItem('inventariosapp_server_url') || window.location.origin;
  return url.replace(/\/$/, '');
}

export async function uploadCatalogToServer(products) {
  const baseUrl = getServerBaseUrl();
  const token = localStorage.getItem('inventariosapp_token_v1');
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}/api/catalog/upload`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ products })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Error del servidor: ${response.statusText}`);
  }

  return await response.json();
}

export async function fetchCatalogFromServer() {
  const baseUrl = getServerBaseUrl();
  const response = await fetch(`${baseUrl}/api/catalog`);
  if (!response.ok) {
    throw new Error(`Error al descargar catálogo: ${response.statusText}`);
  }
  return await response.json();
}

export async function fetchCatalogMeta() {
  try {
    const baseUrl = getServerBaseUrl();
    const response = await fetch(`${baseUrl}/api/catalog/meta`);
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    return null;
  }
}

export async function fetchNetworkInfo() {
  try {
    const baseUrl = getServerBaseUrl();
    const response = await fetch(`${baseUrl}/api/network-info`);
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    return null;
  }
}

export async function migrateLocalDataToServer({ sessionCode, sessionName, countedItems, historyLogs, catalog }) {
  const baseUrl = getServerBaseUrl();
  const token = localStorage.getItem('inventariosapp_token_v1');
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}/api/migrate-from-client`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ sessionCode, sessionName, countedItems, historyLogs, catalog })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Error migrando datos: ${response.statusText}`);
  }

  return await response.json();
}

// Session API Calls
export async function createSessionApi({ name }) {
  const baseUrl = getServerBaseUrl();
  const token = localStorage.getItem('inventariosapp_token_v1');
  const response = await fetch(`${baseUrl}/api/sessions/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ name })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Error al crear la sesión');
  }
  return data.session;
}

export async function validateSessionApi(code) {
  const baseUrl = getServerBaseUrl();
  const clean = String(code || '').trim().toUpperCase();
  const response = await fetch(`${baseUrl}/api/sessions/validate/${encodeURIComponent(clean)}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Código de sesión inválido o expirado');
  }
  return data.session;
}

export async function fetchMySessionsApi() {
  const baseUrl = getServerBaseUrl();
  const token = localStorage.getItem('inventariosapp_token_v1');
  const response = await fetch(`${baseUrl}/api/sessions/my`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Error al obtener tus sesiones');
  }
  return data;
}

export async function fetchSessionDetailsApi(code) {
  const baseUrl = getServerBaseUrl();
  const token = localStorage.getItem('inventariosapp_token_v1');
  const clean = String(code || '').trim().toUpperCase();
  const response = await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(clean)}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Error al obtener datos de la sesión');
  }
  return data.session;
}

export async function deleteSessionApi(code) {
  const baseUrl = getServerBaseUrl();
  const token = localStorage.getItem('inventariosapp_token_v1');
  const clean = String(code || '').trim().toUpperCase();
  const response = await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(clean)}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Error al eliminar sesión');
  }
  return data;
}

// Session-Isolated Backups API calls
export async function fetchSessionBackupsApi(code) {
  if (!code) return [];
  const baseUrl = getServerBaseUrl();
  const token = localStorage.getItem('inventariosapp_token_v1');
  const clean = String(code).trim().toUpperCase();
  const response = await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(clean)}/backups`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json().catch(() => ([]));
  if (!response.ok) {
    throw new Error(data.error || 'Error al obtener respaldos de la sesión');
  }
  return Array.isArray(data) ? data : [];
}

export async function createSessionBackupApi(code, backupPayload) {
  if (!code) return null;
  const baseUrl = getServerBaseUrl();
  const token = localStorage.getItem('inventariosapp_token_v1');
  const clean = String(code).trim().toUpperCase();
  const response = await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(clean)}/backups`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(backupPayload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Error al guardar respaldo en el servidor');
  }
  return data.backup;
}

export async function restoreSessionBackupApi(code, backupId) {
  if (!code || !backupId) return null;
  const baseUrl = getServerBaseUrl();
  const token = localStorage.getItem('inventariosapp_token_v1');
  const clean = String(code).trim().toUpperCase();
  const response = await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(clean)}/backups/${encodeURIComponent(backupId)}/restore`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Error al restaurar respaldo en el servidor');
  }
  return data;
}

export async function deleteSessionBackupApi(code, backupId) {
  if (!code || !backupId) return null;
  const baseUrl = getServerBaseUrl();
  const token = localStorage.getItem('inventariosapp_token_v1');
  const clean = String(code).trim().toUpperCase();
  const response = await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(clean)}/backups/${encodeURIComponent(backupId)}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Error al eliminar respaldo en el servidor');
  }
  return data;
}

export async function collaboratorLoginApi({ sessionCode, name }) {
  const baseUrl = getServerBaseUrl();
  const response = await fetch(`${baseUrl}/api/auth/collaborator-login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sessionCode, name })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Error al acceder como auxiliar');
  }
  return data;
}

export function getActiveSessionCode() {
  return localStorage.getItem('inventariosapp_active_session_code') || '';
}

export function setActiveSessionCode(code) {
  if (code) {
    localStorage.setItem('inventariosapp_active_session_code', String(code).trim().toUpperCase());
  } else {
    localStorage.removeItem('inventariosapp_active_session_code');
  }
}

export function getSocket() {
  if (!socket) {
    const serverUrl = getServerBaseUrl();
    const token = localStorage.getItem('inventariosapp_token_v1');
    const sessionCode = getActiveSessionCode();

    socket = io(serverUrl, {
      auth: { token, sessionCode },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socket.on('connect', () => {
      console.log('🟢 [Socket] Conectado en tiempo real al servidor:', socket.id);
      const activeCode = getActiveSessionCode();
      const userName = localStorage.getItem('inventariosapp_auditor_name');
      if (activeCode) {
        socket.emit('session:join', { sessionCode: activeCode, userName });
      }
    });

    socket.on('disconnect', (reason) => {
      console.warn('🔴 [Socket] Desconectado del servidor:', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('⚠️ [Socket] Error de conexión:', err.message);
    });
  }

  return socket;
}

export function resetSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function emitSessionJoin(sessionCode, userName) {
  const s = getSocket();
  const cleanCode = String(sessionCode || '').trim().toUpperCase();
  setActiveSessionCode(cleanCode);
  if (s && s.connected) {
    s.emit('session:join', { sessionCode: cleanCode, userName });
  }
}

export function emitCountApply(product, qty, isSettingExact = false, sessionCode = null) {
  const s = getSocket();
  const activeCode = sessionCode || getActiveSessionCode();
  if (s && s.connected) {
    s.emit('count:apply', { product, qty, isSettingExact, sessionCode: activeCode });
  }
}

export function emitItemDelete(product, sessionCode = null) {
  const s = getSocket();
  const activeCode = sessionCode || getActiveSessionCode();
  if (s && s.connected) {
    s.emit('item:delete', product, activeCode);
  }
}

export function emitInventoryClear(sessionCode = null) {
  const s = getSocket();
  const activeCode = sessionCode || getActiveSessionCode();
  if (s && s.connected) {
    s.emit('inventory:clear', activeCode);
  }
}

export function emitSessionRename(newName, sessionCode = null) {
  const s = getSocket();
  const activeCode = sessionCode || getActiveSessionCode();
  if (s && s.connected) {
    s.emit('session:rename', newName, activeCode);
  }
}

export function emitSessionRestore(items, name, sessionCode = null) {
  const s = getSocket();
  const activeCode = sessionCode || getActiveSessionCode();
  if (s && s.connected) {
    s.emit('session:restore', { items, name, sessionCode: activeCode });
  }
}

export function emitCatalogProductUpdated(updatedProduct) {
  const s = getSocket();
  if (s && s.connected) {
    s.emit('catalog:productUpdated', updatedProduct);
  }
}

export function emitSetAuditorName(name) {
  const s = getSocket();
  if (s && s.connected) {
    s.emit('user:setName', name);
  }
}

export function emitHistoryClear(sessionCode = null) {
  const s = getSocket();
  const activeCode = sessionCode || getActiveSessionCode();
  if (s && s.connected) {
    s.emit('history:clear', activeCode);
  }
}

