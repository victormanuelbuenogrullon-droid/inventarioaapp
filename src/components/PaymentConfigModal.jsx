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
  FileText,
  ExternalLink,
  Eye,
  EyeOff,
  Zap,
  ShieldCheck,
  Send
} from 'lucide-react';
import { fetchAdminPaymentConfig, updateAdminPaymentConfig, testSmtpConnection } from '../utils/payment';

export default function PaymentConfigModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'banking' | 'smtp'
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);

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
    emailProvider: 'brevo', // 'brevo' | 'resend' | 'smtp'
    smtpConfig: {
      provider: 'brevo',
      apiKey: '',
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      user: '',
      pass: '',
      from: '',
      fromEmail: '',
      fromName: 'InventariosApp'
    }
  });

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setSuccessMessage(null);
      setErrorMessage(null);
      setSmtpTestResult(null);

      fetchAdminPaymentConfig()
        .then((data) => {
          if (data) {
            const initialProvider = data.emailProvider || data.smtpConfig?.provider || 
              (data.smtpConfig?.apiKey?.startsWith('xkeysib-') ? 'brevo' : 
               (data.smtpConfig?.apiKey?.startsWith('re_') ? 'resend' : 'brevo'));

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
              emailProvider: initialProvider,
              smtpConfig: {
                provider: initialProvider,
                apiKey: data.smtpConfig?.apiKey || '',
                host: data.smtpConfig?.host || 'smtp.gmail.com',
                port: data.smtpConfig?.port || 587,
                secure: Boolean(data.smtpConfig?.secure),
                user: data.smtpConfig?.user || '',
                pass: data.smtpConfig?.pass || '',
                from: data.smtpConfig?.from || '',
                fromEmail: data.smtpConfig?.fromEmail || data.adminNotificationEmail || '',
                fromName: data.smtpConfig?.fromName || 'InventariosApp'
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
      const payload = {
        ...formData,
        emailProvider: formData.emailProvider,
        smtpConfig: {
          ...formData.smtpConfig,
          provider: formData.emailProvider,
          fromEmail: formData.smtpConfig.fromEmail || formData.adminNotificationEmail || formData.smtpConfig.user
        }
      };

      await updateAdminPaymentConfig(payload);
      setSuccessMessage('¡Configuración guardada exitosamente en la base de datos!');
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err) {
      setErrorMessage(err.message || 'Error al guardar la configuración');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setIsTestingSmtp(true);
    setSmtpTestResult(null);
    try {
      const target = formData.adminNotificationEmail || formData.smtpConfig.fromEmail || formData.smtpConfig.user;
      const res = await testSmtpConnection({
        ...formData.smtpConfig,
        provider: formData.emailProvider,
        fromEmail: formData.smtpConfig.fromEmail || formData.adminNotificationEmail || formData.smtpConfig.user
      }, target);

      setSmtpTestResult({
        success: true,
        message: res.message || '¡Prueba exitosa! Conexión verificada y correo enviado con éxito.'
      });
    } catch (err) {
      setSmtpTestResult({
        success: false,
        message: err.message || 'Error al enviar el correo de prueba.'
      });
    } finally {
      setIsTestingSmtp(false);
    }
  };

  const isTestReady = () => {
    if (formData.emailProvider === 'brevo') {
      return Boolean(formData.smtpConfig.apiKey?.trim());
    }
    if (formData.emailProvider === 'resend') {
      return Boolean(formData.smtpConfig.apiKey?.trim());
    }
    return Boolean(formData.smtpConfig.host && formData.smtpConfig.user && formData.smtpConfig.pass);
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
                Ajusta las tarifas por día, datos bancarios y servicio de correos
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
            <span>Servidor de Correo</span>
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
                        onChange={(e) => {
                          const email = e.target.value;
                          setFormData({ 
                            ...formData, 
                            adminNotificationEmail: email,
                            smtpConfig: {
                              ...formData.smtpConfig,
                              fromEmail: formData.smtpConfig.fromEmail || email
                            }
                          });
                        }}
                        placeholder="admin@tuempresa.com"
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      />
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      A este correo llegarán los avisos de nuevas solicitudes y los comprobantes (vouchers) adjuntos.
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
                        placeholder="Banco o método de transferencia"
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
                        placeholder="Tipo de cuenta (opcional)"
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
                        placeholder="Número de cuenta o usuario de pago"
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
                        placeholder="Nombre del titular o razón social"
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
                        placeholder="Identificación fiscal o personal"
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
                        placeholder="Teléfono para pagos móviles"
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
                        placeholder="Correo electrónico de pago"
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
                        placeholder="Instrucciones adicionales para los solicitantes..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: EMAIL SERVICE (BREVO / RESEND / SMTP) */}
              {activeTab === 'smtp' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* Selector of email providers */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Selecciona el Método de Envío:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {/* Option 1: Brevo */}
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            emailProvider: 'brevo',
                            smtpConfig: {
                              ...formData.smtpConfig,
                              provider: 'brevo'
                            }
                          });
                        }}
                        className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                          formData.emailProvider === 'brevo'
                            ? 'bg-indigo-50/90 border-indigo-400 text-indigo-950 shadow-sm ring-2 ring-indigo-500/20'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-indigo-600" />
                            Brevo API
                          </span>
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md">
                            Gratis 300/día
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-tight">
                          Recomendado para Render (Puerto 443 HTTPS, sin bloqueos).
                        </p>
                      </button>

                      {/* Option 2: Resend */}
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            emailProvider: 'resend',
                            smtpConfig: {
                              ...formData.smtpConfig,
                              provider: 'resend'
                            }
                          });
                        }}
                        className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                          formData.emailProvider === 'resend'
                            ? 'bg-indigo-50/90 border-indigo-400 text-indigo-950 shadow-sm ring-2 ring-indigo-500/20'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs flex items-center gap-1.5">
                            <Send className="w-3.5 h-3.5 text-indigo-600" />
                            Resend API
                          </span>
                          <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                            100/día
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-tight">
                          Envío rápido y moderno por API HTTPS.
                        </p>
                      </button>

                      {/* Option 3: Traditional SMTP */}
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            emailProvider: 'smtp',
                            smtpConfig: {
                              ...formData.smtpConfig,
                              provider: 'smtp'
                            }
                          });
                        }}
                        className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                          formData.emailProvider === 'smtp'
                            ? 'bg-indigo-50/90 border-indigo-400 text-indigo-950 shadow-sm ring-2 ring-indigo-500/20'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs flex items-center gap-1.5">
                            <Server className="w-3.5 h-3.5 text-indigo-600" />
                            SMTP Tradicional
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-tight">
                          Gmail, Outlook o hosting privado (Puertos 587/465).
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* PROVIDER: BREVO (RECOMMENDED FOR RENDER) */}
                  {formData.emailProvider === 'brevo' && (
                    <div className="space-y-3.5 animate-in fade-in">
                      {/* Tutorial Box */}
                      <div className="bg-gradient-to-br from-indigo-50 to-blue-50/70 border border-indigo-200/80 rounded-2xl p-4 text-xs text-indigo-950 space-y-2">
                        <div className="flex items-center gap-2 font-bold text-indigo-900 text-sm">
                          <ShieldCheck className="w-4 h-4 text-indigo-600" />
                          <span>¿Por qué Brevo es la opción ideal para Render?</span>
                        </div>
                        <p className="text-[11.5px] leading-relaxed text-slate-600">
                          Render bloquea las conexiones salientes por los puertos SMTP tradicionales (587 y 465) en su plan gratuito provocando error de <em>"Connection timeout"</em>. <strong>Brevo envía a través del puerto 443 (HTTPS)</strong>, garantizando que nunca se bloquee y despachando tus correos de inmediato.
                        </p>

                        <div className="bg-white/80 rounded-xl p-3 border border-indigo-100 text-[11px] space-y-1.5 mt-2">
                          <p className="font-bold text-indigo-900">Pasos rápidos para activarlo gratis (Sin tarjeta de crédito):</p>
                          <ol className="list-decimal pl-4 space-y-1 text-slate-700">
                            <li>
                              Regístrate o inicia sesión en{' '}
                              <a 
                                href="https://app.brevo.com/settings/keys/api" 
                                target="_blank" 
                                rel="noreferrer" 
                                className="font-bold text-indigo-600 hover:underline inline-flex items-center gap-0.5"
                              >
                                app.brevo.com/settings/keys/api <ExternalLink className="w-3 h-3" />
                              </a>
                            </li>
                            <li>
                              Haz clic en <strong>"Generar una nueva clave API"</strong> (o "Generate a new API key"). Copia la clave generada (empieza por <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-700 font-bold">xkeysib-...</code>).
                            </li>
                            <li>
                              En Brevo ve a{' '}
                              <a 
                                href="https://app.brevo.com/senders" 
                                target="_blank" 
                                rel="noreferrer" 
                                className="font-bold text-indigo-600 hover:underline inline-flex items-center gap-0.5"
                              >
                                Remitentes e IPs &gt; Remitentes <ExternalLink className="w-3 h-3" />
                              </a>
                              {' '}y añade tu correo personal ({formData.adminNotificationEmail || 'tu correo'}). Haz clic en el enlace de confirmación que Brevo te enviará a ese correo.
                            </li>
                            <li>
                              Pega la clave API y tu correo abajo y pulsa <strong>"Probar Conexión"</strong>.
                            </li>
                          </ol>
                        </div>
                      </div>

                      {/* Brevo Inputs */}
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Clave API de Brevo (API Key) <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type={showApiKey ? 'text' : 'password'}
                              value={formData.smtpConfig.apiKey}
                              onChange={(e) => setFormData({
                                ...formData,
                                smtpConfig: { ...formData.smtpConfig, apiKey: e.target.value.trim() }
                              })}
                              placeholder="xkeysib-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                              className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => setShowApiKey(!showApiKey)}
                              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                            >
                              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <span className="text-[11px] text-slate-400 mt-1 block">
                            Tu clave gratuita de Brevo que inicia con <code className="font-bold">xkeysib-</code>
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Correo Remitente Verificado en Brevo
                            </label>
                            <input
                              type="email"
                              value={formData.smtpConfig.fromEmail || formData.adminNotificationEmail}
                              onChange={(e) => setFormData({
                                ...formData,
                                smtpConfig: { ...formData.smtpConfig, fromEmail: e.target.value.trim() }
                              })}
                              placeholder="victormanuelbuenogrullon@gmail.com"
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                            />
                            <span className="text-[10px] text-slate-400 mt-0.5 block">
                              Debe coincidir con el correo verificado en Brevo &gt; Senders
                            </span>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Nombre del Remitente
                            </label>
                            <input
                              type="text"
                              value={formData.smtpConfig.fromName || 'InventariosApp'}
                              onChange={(e) => setFormData({
                                ...formData,
                                smtpConfig: { ...formData.smtpConfig, fromName: e.target.value }
                              })}
                              placeholder="InventariosApp"
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                            />
                            <span className="text-[10px] text-slate-400 mt-0.5 block">
                              Nombre que verán los usuarios en su bandeja
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PROVIDER: RESEND */}
                  {formData.emailProvider === 'resend' && (
                    <div className="space-y-3.5 animate-in fade-in">
                      <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-4 text-xs text-purple-950 space-y-1.5">
                        <p className="font-bold text-sm text-purple-900">Envío con Resend API (100 correos/día gratis)</p>
                        <p className="text-[11.5px] text-purple-800">
                          Resend ofrece envío inmediato a través de su API HTTP en el puerto 443. Consigue tu clave API en{' '}
                          <a 
                            href="https://resend.com/api-keys" 
                            target="_blank" 
                            rel="noreferrer" 
                            className="font-bold underline inline-flex items-center gap-0.5"
                          >
                            resend.com/api-keys <ExternalLink className="w-3 h-3" />
                          </a>
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Clave API de Resend (inicia con re_...)
                          </label>
                          <div className="relative">
                            <input
                              type={showApiKey ? 'text' : 'password'}
                              value={formData.smtpConfig.apiKey}
                              onChange={(e) => setFormData({
                                ...formData,
                                smtpConfig: { ...formData.smtpConfig, apiKey: e.target.value.trim() }
                              })}
                              placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxxxx"
                              className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => setShowApiKey(!showApiKey)}
                              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                            >
                              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Remitente (From)
                          </label>
                          <input
                            type="text"
                            value={formData.smtpConfig.from || 'InventariosApp <onboarding@resend.dev>'}
                            onChange={(e) => setFormData({
                              ...formData,
                              smtpConfig: { ...formData.smtpConfig, from: e.target.value }
                            })}
                            placeholder="InventariosApp <onboarding@resend.dev>"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PROVIDER: TRADITIONAL SMTP */}
                  {formData.emailProvider === 'smtp' && (
                    <div className="space-y-3.5 animate-in fade-in">
                      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-900 space-y-1">
                        <p className="font-bold flex items-center gap-1.5 text-amber-950">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Aviso Importante si usas Render Free:</span>
                        </p>
                        <p className="text-[11px] text-amber-800 leading-relaxed">
                          Render bloquea las conexiones salientes por los puertos SMTP (587 y 465) en su nivel gratuito, devolviendo error <strong>"Connection timeout"</strong>. Si tienes ese error, cámbiate a la pestaña <strong>Brevo API</strong> (arriba) que es 100% gratuita y funciona sin bloqueos.
                        </p>
                      </div>

                      {/* Presets */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                          Rellenar parámetros de servidor:
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                smtpConfig: {
                                  ...formData.smtpConfig,
                                  host: 'smtp.gmail.com',
                                  port: 587,
                                  secure: false,
                                  from: formData.smtpConfig.user ? `InventariosApp <${formData.smtpConfig.user}>` : 'InventariosApp'
                                }
                              });
                            }}
                            className={`py-1.5 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                              formData.smtpConfig.host === 'smtp.gmail.com'
                                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            Gmail (smtp.gmail.com)
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                smtpConfig: {
                                  ...formData.smtpConfig,
                                  host: 'smtp-mail.outlook.com',
                                  port: 587,
                                  secure: false,
                                  from: formData.smtpConfig.user ? `InventariosApp <${formData.smtpConfig.user}>` : 'InventariosApp'
                                }
                              });
                            }}
                            className={`py-1.5 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                              formData.smtpConfig.host === 'smtp-mail.outlook.com'
                                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            Outlook / Hotmail
                          </button>
                        </div>
                      </div>

                      {/* Gmail instructions */}
                      {formData.smtpConfig.host === 'smtp.gmail.com' && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-700 space-y-1">
                          <p className="font-bold text-slate-900 flex items-center gap-1">
                            <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                            Contraseña de Aplicación de Gmail:
                          </p>
                          <p>
                            En Gmail debes generar una "Contraseña de Aplicación" de 16 caracteres en <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" className="underline font-bold text-indigo-600">myaccount.google.com/security</a>. No uses tu clave personal regular.
                          </p>
                        </div>
                      )}

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
                            Usuario / Correo Electrónico
                          </label>
                          <input
                            type="text"
                            value={formData.smtpConfig.user}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormData({
                                ...formData,
                                smtpConfig: { 
                                  ...formData.smtpConfig, 
                                  user: val,
                                  from: formData.smtpConfig.from ? formData.smtpConfig.from : `InventariosApp <${val}>`
                                }
                              });
                            }}
                            placeholder="tucorreo@gmail.com"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Contraseña o App Password
                          </label>
                          <div className="relative">
                            <input
                              type={showSmtpPass ? 'text' : 'password'}
                              value={formData.smtpConfig.pass}
                              onChange={(e) => setFormData({
                                ...formData,
                                smtpConfig: { ...formData.smtpConfig, pass: e.target.value }
                              })}
                              placeholder="16 letras de Google"
                              className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => setShowSmtpPass(!showSmtpPass)}
                              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                            >
                              {showSmtpPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
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
                            placeholder="InventariosApp <tucorreo@gmail.com>"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Test Result Message */}
                  {smtpTestResult && (
                    <div className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 animate-in fade-in ${
                      smtpTestResult.success 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}>
                      {smtpTestResult.success ? (
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 font-medium leading-relaxed">
                        {smtpTestResult.message}
                      </div>
                    </div>
                  )}

                  {/* Test Button */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={isTestingSmtp || !isTestReady()}
                      onClick={handleTestEmail}
                      className="w-full sm:w-auto py-2.5 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
                    >
                      {isTestingSmtp ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                          <span>Enviando correo de prueba...</span>
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4 text-indigo-400" />
                          <span>Probar Conexión y Enviar Correo de Prueba</span>
                        </>
                      )}
                    </button>
                    <span className="text-[10px] text-slate-400 text-center sm:text-right">
                      Destino:{' '}
                      <strong className="text-slate-600 font-mono">
                        {formData.adminNotificationEmail || formData.smtpConfig.fromEmail || formData.smtpConfig.user || 'admin'}
                      </strong>
                    </span>
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
