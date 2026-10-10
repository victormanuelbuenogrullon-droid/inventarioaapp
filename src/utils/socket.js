import { io } from 'socket.io-client';

let socket = null;

export function getServerBaseUrl() {
  const url = import.meta.env.VITE_BACKEND_URL || localStorage.getItem('inventariosapp_server_url') || window.location.origin;
  return url.replace(/\/$/, '');
}

export async function uploadCatalogToServer(products) {
  const baseUrl = getServerBaseUrl();
  const response = await fetch(`${baseUrl}/api/catalog/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
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

export function getSocket() {
  if (!socket) {
    const serverUrl = getServerBaseUrl();
    
    socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socket.on('connect', () => {
      console.log('🟢 [Socket] Conectado en tiempo real al servidor:', socket.id);
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



export function emitCountApply(product, qty, isSettingExact = false) {
  const s = getSocket();
  if (s && s.connected) {
    s.emit('count:apply', { product, qty, isSettingExact });
  }
}

export function emitItemDelete(product) {
  const s = getSocket();
  if (s && s.connected) {
    s.emit('item:delete', product);
  }
}

export function emitInventoryClear() {
  const s = getSocket();
  if (s && s.connected) {
    s.emit('inventory:clear');
  }
}

export function emitSessionRename(newName) {
  const s = getSocket();
  if (s && s.connected) {
    s.emit('session:rename', newName);
  }
}

export function emitSessionRestore(items, name) {
  const s = getSocket();
  if (s && s.connected) {
    s.emit('session:restore', { items, name });
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

export function emitHistoryClear() {
  const s = getSocket();
  if (s && s.connected) {
    s.emit('history:clear');
  }
}

