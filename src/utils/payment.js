import { getServerBaseUrl } from './socket';
import { getStoredToken } from './auth';

/**
 * Public: Fetch banking information and daily rate (No authentication required)
 */
export async function fetchPublicPaymentConfig() {
  const baseUrl = getServerBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/public/payment-config`);
    if (!res.ok) throw new Error('Error al cargar información de pago');
    return await res.json();
  } catch (err) {
    console.warn('[Payment] Error fetching public payment config:', err);
    return {
      pricePerDay: 5.0,
      currency: 'USD',
      currencySymbol: '$',
      bankName: 'Transferencia Bancaria / Zelle',
      accountType: 'Cuenta Corriente',
      accountNumber: '',
      accountHolder: '',
      idNumber: '',
      phone: '',
      paymentEmail: '',
      instructions: 'Realiza tu pago por el monto exacto y adjunta tu comprobante.'
    };
  }
}

/**
 * Public: Submit access request with voucher (No authentication required)
 */
export async function submitAccessRequest({ email, name, phone, daysRequested, voucher, notes }) {
  const baseUrl = getServerBaseUrl();
  const res = await fetch(`${baseUrl}/api/access-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name, phone, daysRequested, voucher, notes })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Error al enviar la solicitud de acceso');
  }

  return data;
}

/**
 * Admin: Fetch full payment configuration including notification settings
 */
export async function fetchAdminPaymentConfig() {
  const token = getStoredToken();
  const baseUrl = getServerBaseUrl();
  const res = await fetch(`${baseUrl}/api/admin/payment-config`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Error al cargar la configuración de pagos');
  }

  return data;
}

/**
 * Admin: Update payment and notification settings
 */
export async function updateAdminPaymentConfig(config) {
  const token = getStoredToken();
  const baseUrl = getServerBaseUrl();
  const res = await fetch(`${baseUrl}/api/admin/payment-config`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(config)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Error al guardar la configuración');
  }

  return data;
}

/**
 * Admin: Fetch list of all access requests
 */
export async function fetchAdminAccessRequests() {
  const token = getStoredToken();
  const baseUrl = getServerBaseUrl();
  const res = await fetch(`${baseUrl}/api/admin/access-requests`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Error al obtener solicitudes de acceso');
  }

  return data;
}

/**
 * Admin: Approve access request and generate user credentials
 */
export async function approveAccessRequest(id, payload = {}) {
  const token = getStoredToken();
  const baseUrl = getServerBaseUrl();
  const res = await fetch(`${baseUrl}/api/admin/access-requests/${id}/approve`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Error al aprobar la solicitud');
  }

  return data;
}

/**
 * Admin: Reject access request
 */
export async function rejectAccessRequest(id, adminNotes = '') {
  const token = getStoredToken();
  const baseUrl = getServerBaseUrl();
  const res = await fetch(`${baseUrl}/api/admin/access-requests/${id}/reject`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ adminNotes })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Error al rechazar la solicitud');
  }

  return data;
}

/**
 * Admin: Delete access request
 */
export async function deleteAccessRequest(id) {
  const token = getStoredToken();
  const baseUrl = getServerBaseUrl();
  const res = await fetch(`${baseUrl}/api/admin/access-requests/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Error al eliminar la solicitud');
  }

  return data;
}
