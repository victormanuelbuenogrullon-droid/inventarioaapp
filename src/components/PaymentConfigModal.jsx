import React, { useState, useEffect } from 'react';
import { 
  X, 
  CreditCard, 
  DollarSign, 
  Building, 
  Mail, 
  Phone, 
  Save, 
  Check, 
  AlertCircle, 
  Loader2,
  Server,
  KeyRound,
  FileText
} from 'lucide-react';
import { fetchAdminPaymentConfig, updateAdminPaymentConfig } from '../utils/payment';

export default function PaymentConfigModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'banking' | 'smtp'
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    pricePerDay: 5.0,
    currency: 'USD',
    currencySymbol: '$',
    adminNotificationEmail: '',
    bankName: '',
    accountType: '',
    accountNumber: '',
    accountHolder: '',
    idNumber: '',
    phone: '',
    paymentEmail: '',
    instructions: '',
    smtpConfig: {
      host: '',
      port: 587,
      secure: false,
      user: '',
      pass: '',
      from: ''
    }
  });

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setSuccessMessage(null);
      setErrorMessage(null);
      fetchAdminPaymentConfig()
        .then((data) => {
          if (data) {
            setFormData({
              pricePerDay: data.pricePerDay ?? 5.0,
              currency: data.currency || 'USD',
              currencySymbol: data.currencySymbol || '$',
              adminNotificationEmail: data.adminNotificationEmail || '',
              bankName: data.bankName || '',
              accountType: data.accountType || '',
              accountNumber: data.accountNumber || '',
              accountHolder: data.accountHolder || '',
              idNumber: data.idNumber || '',
              phone: data.phone || '',
              paymentEmail: data.paymentEmail || '',
              instructions: data.instructions || '',
              smtpConfig: {
                host: data.smtpConfig?.host || '',
                port: data.smtpConfig?.port || 587,
                secure: Boolean(data.smtpConfig?.secure),
                user: data.smtpConfig?.user || '',
                pass: data.smtpConfig?.pass || '',
                from: data.smtpConfig?.from || ''
              }
            });
          }
        })
        .catch((err) => {
          setErrorMessage(err.message || 'Error al cargar la configuración');
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await updateAdminPaymentConfig(formData);
      setSuccessMessage('¡Configuración guardada exitosamente en la base de datos!');
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err) {
      setErrorMessage(err.message || 'Error al guardar la configuración');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600 text-white">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                Configuración de Pagos y Notificaciones
              </h3>
              <p className="text-xs text-slate-400">
                Ajusta las tarifas por día, datos bancarios y correos de aviso
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`py-2 px-3.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'general'
                ? 'bg-white text-indigo-600 border-indigo-600 shadow-2xs'
                : 'text-slate-500 border-transparent hover:text-slate-800'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Tarifas y Notificación</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('banking')}
            className={`py-2 px-3.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'banking'
                ? 'bg-white text-indigo-600 border-indigo-600 shadow-2xs'
                : 'text-slate-500 border-transparent hover:text-slate-800'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Información Bancaria</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('smtp')}
            className={`py-2 px-3.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'smtp'
                ? 'bg-white text-indigo-600 border-indigo-600 shadow-2xs'
                : 'text-slate-500 border-transparent hover:text-slate-800'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Servidor SMTP (Opcional)</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              <span className="text-xs">Cargando configuración...</span>
            </div>
          ) : (
            <form id="payment-config-form" onSubmit={handleSubmit} className="space-y-4">
              {/* Messages */}
              {successMessage && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold">{successMessage}</span>
                </div>
              )}

              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="font-bold">{errorMessage}</span>
                </div>
              )}

              {/* TAB 1: GENERAL & PRICING */}
              {activeTab === 'general' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 text-xs text-indigo-950">
                    <p className="font-semibold">
                      Define aquí el precio por día. Cuando un usuario solicite acceso e ingrese la cantidad de días deseados, el sistema calculará inmediatamente el monto total multiplicando los días por este valor.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Precio por Día <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.pricePerDay}
                        onChange={(e) => setFormData({ ...formData, pricePerDay: parseFloat(e.target.value) || 0 })}
                        required
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Moneda
                      </label>
                      <input
                        type="text"
                        value={formData.currency}
                        onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
                        placeholder="USD, VES, EUR"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white uppercase font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Símbolo
                      </label>
                      <input
                        type="text"
                        value={formData.currencySymbol}
                        onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                        placeholder="$, Bs, €"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Correo del Administrador (Para recibir comprobantes)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        value={formData.adminNotificationEmail}
                        onChange={(e) => setFormData({ ...formData, adminNotificationEmail: e.target.value })}
                        placeholder="admin@tuempresa.com"
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      />
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      A este correo llegarán los avisos de nuevas solicitudes y los archivos de voucher adjuntos.
                    </span>
                  </div>
                </div>
              )}

              {/* TAB 2: BANKING DETAILS */}
              {activeTab === 'banking' && (
                <div className="space-y-3.5 animate-in fade-in duration-150">
                  <p className="text-xs text-slate-500">
                    Estos datos bancarios se mostrarán al usuario en la ventana de "Solicitar Acceso" para que sepa exactamente dónde realizar el depósito o transferencia.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Banco / Plataforma de Pago
                      </label>
                      <input
                        type="text"
                        value={formData.bankName}
                        onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                        placeholder="ej. Banesco / Chase / Zelle"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Tipo de Cuenta
                      </label>
                      <input
                        type="text"
                        value={formData.accountType}
                        onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
                        placeholder="ej. Corriente / Ahorros / Zelle"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Número de Cuenta o Identificador
                      </label>
                      <input
                        type="text"
                        value={formData.accountNumber}
                        onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                        placeholder="ej. 0134-XXXX-XXXX-XXXX o usuario Zelle"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Titular / Beneficiario
                      </label>
                      <input
                        type="text"
                        value={formData.accountHolder}
                        onChange={(e) => setFormData({ ...formData, accountHolder: e.target.value })}
                        placeholder="ej. Nombre de la empresa o persona"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Cédula / RIF / ID Fiscal
                      </label>
                      <input
                        type="text"
                        value={formData.idNumber}
                        onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                        placeholder="ej. J-12345678-0"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Teléfono (Pago Móvil / Contacto)
                      </label>
                      <input
                        type="text"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="ej. +58 412 1234567"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Correo para Pagos (Zelle / PayPal)
                      </label>
                      <input
                        type="email"
                        value={formData.paymentEmail}
                        onChange={(e) => setFormData({ ...formData, paymentEmail: e.target.value })}
                        placeholder="ej. pagos@tuempresa.com"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Instrucciones o Notas Adicionales
                      </label>
                      <textarea
                        rows={2}
                        value={formData.instructions}
                        onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                        placeholder="ej. Coloca tu correo en el concepto y sube una captura legible del comprobante."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: SMTP EMAIL SERVER */}
              {activeTab === 'smtp' && (
                <div className="space-y-3.5 animate-in fade-in duration-150">
                  <div className="bg-slate-100 rounded-xl p-3 text-xs text-slate-700">
                    <p className="font-bold text-slate-900 mb-1">Configuración de Envío Automático (Opcional)</p>
                    <p>
                      Si configuras tu servidor de correo saliente (SMTP), el sistema enviará automáticamente un correo al administrador con el comprobante adjunto, y enviará las credenciales al usuario al hacer clic en "Aprobar". Si no lo configuras, igualmente podrás ver todas las solicitudes y comprobantes en el panel de la aplicación.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Servidor SMTP (Host)
                      </label>
                      <input
                        type="text"
                        value={formData.smtpConfig.host}
                        onChange={(e) => setFormData({
                          ...formData,
                          smtpConfig: { ...formData.smtpConfig, host: e.target.value }
                        })}
                        placeholder="smtp.gmail.com"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Puerto SMTP
                      </label>
                      <input
                        type="number"
                        value={formData.smtpConfig.port}
                        onChange={(e) => setFormData({
                          ...formData,
                          smtpConfig: { ...formData.smtpConfig, port: parseInt(e.target.value, 10) || 587 }
                        })}
                        placeholder="587 o 465"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Usuario / Correo SMTP
                      </label>
                      <input
                        type="text"
                        value={formData.smtpConfig.user}
                        onChange={(e) => setFormData({
                          ...formData,
                          smtpConfig: { ...formData.smtpConfig, user: e.target.value }
                        })}
                        placeholder="tucuenta@gmail.com"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Contraseña o App Password
                      </label>
                      <input
                        type="password"
                        value={formData.smtpConfig.pass}
                        onChange={(e) => setFormData({
                          ...formData,
                          smtpConfig: { ...formData.smtpConfig, pass: e.target.value }
                        })}
                        placeholder="••••••••••••••••"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Remitente (From)
                      </label>
                      <input
                        type="text"
                        value={formData.smtpConfig.from}
                        onChange={(e) => setFormData({
                          ...formData,
                          smtpConfig: { ...formData.smtpConfig, from: e.target.value }
                        })}
                        placeholder="InventariosApp <notificaciones@tuempresa.com>"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cerrar
          </button>

          <button
            type="submit"
            form="payment-config-form"
            disabled={isSaving || isLoading}
            className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Guardar Configuración</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
