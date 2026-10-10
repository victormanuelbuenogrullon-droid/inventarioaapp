import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (!socket) {
    // In production or hosted on Netlify, connects to VITE_BACKEND_URL if specified, otherwise current origin
    const serverUrl = import.meta.env.VITE_BACKEND_URL || localStorage.getItem('inventariosapp_server_url') || window.location.origin;
    
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
