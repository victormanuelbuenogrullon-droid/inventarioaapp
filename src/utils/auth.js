import { getServerBaseUrl } from './socket';

const TOKEN_KEY = 'inventariosapp_token_v1';
const USER_KEY = 'inventariosapp_user_v1';

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveAuthSession(token, user) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function loginUser(username, password) {
  const baseUrl = getServerBaseUrl();
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Error al iniciar sesión');
  }

  saveAuthSession(data.token, data.user);
  return data;
}

export async function fetchCurrentUser() {
  const token = getStoredToken();
  if (!token) return null;

  const baseUrl = getServerBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      clearAuthSession();
      return null;
    }

    const data = await response.json();
    if (data?.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      return data.user;
    }
    return null;
  } catch (err) {
    console.warn('Error al verificar sesión actual:', err);
    // Return stored user if offline/temporary network blip
    return getStoredUser();
  }
}

export async function fetchAllUsers() {
  const token = getStoredToken();
  const baseUrl = getServerBaseUrl();
  const response = await fetch(`${baseUrl}/api/users`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Error al obtener usuarios');
  }
  return data;
}

export async function createNewUser({ username, password, name, role, accessDays }) {
  const token = getStoredToken();
  const baseUrl = getServerBaseUrl();
  const response = await fetch(`${baseUrl}/api/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ username, password, name, role, accessDays })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Error al crear usuario');
  }
  return data.user;
}

export async function updateUserAccess(userId, accessDays) {
  const token = getStoredToken();
  const baseUrl = getServerBaseUrl();
  const response = await fetch(`${baseUrl}/api/users/${userId}/access`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ accessDays })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Error al actualizar vigencia de acceso');
  }
  return data.user;
}

export async function deleteUser(userId) {
  const token = getStoredToken();
  const baseUrl = getServerBaseUrl();
  const response = await fetch(`${baseUrl}/api/users/${userId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Error al eliminar usuario');
  }
  return data;
}

export async function updateUserPassword(userId, newPassword) {
  const token = getStoredToken();
  const baseUrl = getServerBaseUrl();
  const response = await fetch(`${baseUrl}/api/users/${userId}/password`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ newPassword })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Error al cambiar contraseña');
  }
  return data;
}
