import React, { useState, useEffect } from 'react';
import { 
  X, 
  CreditCard, 
  Mail, 
  Calendar, 
  User, 
  Phone, 
  FileText, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Copy, 
  Check, 
  DollarSign,
  Building,
  ShieldCheck,
  Image as ImageIcon
} from 'lucide-react';
import { fetchPublicPaymentConfig, submitAccessRequest } from '../utils/payment';

export default function RequestAccessModal({ isOpen, onClose }) {
  const [config, setConfig] = useState({
    pricePerDay: 5.0,
    currency: 'USD',
    currencySymbol: '$',
    bankName: '',
    accountType: '',
    accountNumber: '',
    accountHolder: '',
    idNumber: '',
    phone: '',
    paymentEmail: '',
    instructions: ''
  });

  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [daysRequested, setDaysRequested] = useState(30);
  const [notes, setNotes] = useState('');

  // Voucher file state
  const [voucherFile, setVoucherFile] = useState(null);
  const [voucherPreview, setVoucherPreview] = useState(null);
  const [voucherError, setVoucherError] = useState(null);

  const [copiedField, setCopiedField] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoadingConfig(true);
      setErrorMessage(null);
      setIsSuccess(false);
      fetchPublicPaymentConfig()
        .then((data) => {
          if (data) setConfig(data);
        })
        .catch((err) => console.warn('Error loading payment config:', err))
        .finally(() => setIsLoadingConfig(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const pricePerDay = Number(config.pricePerDay) || 5.0;
  const parsedDays = Math.max(1, parseInt(daysRequested, 10) || 1);
  const totalAmount = Number((pricePerDay * parsedDays).toFixed(2));
  const currSymbol = config.currencySymbol || '$';
  const currCode = config.currency || 'USD';

  const handleCopy = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVoucherError(null);

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      setVoucherError('El archivo es demasiado grande (máximo 10MB).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target.result;
      setVoucherFile({
        filename: file.name,
        mimetype: file.type,
        data: base64Data
      });

      if (file.type.startsWith('image/')) {
        setVoucherPreview(base64Data);
      } else {
        setVoucherPreview(null);
      }
    };
    reader.onerror = () => {
      setVoucherError('Error al leer el archivo seleccionado.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveVoucher = () => {
    setVoucherFile(null);
    setVoucherPreview(null);
    setVoucherError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Por favor ingresa un correo electrónico válido.');
      return;
    }

    if (parsedDays < 1) {
      setErrorMessage('La cantidad de días debe ser de al menos 1.');
      return;
    }

    if (!voucherFile) {
      setErrorMessage('Debes adjuntar el comprobante o voucher de pago para verificar tu solicitud.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await submitAccessRequest({
        email: email.trim().toLowerCase(),
        name: name.trim(),
        phone: phone.trim(),
        daysRequested: parsedDays,
        voucher: voucherFile,
        notes: notes.trim()
      });

      setIsSuccess(true);
    } catch (err) {
      setErrorMessage(err.message || 'Error al enviar la solicitud.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/80 border border-indigo-400/30 text-white">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                Solicitud de Acceso y Tarifas
              </h3>
              <p className="text-xs text-indigo-200">
                Paso a paso para adquirir vigencia de uso en InventariosApp
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {isSuccess ? (
            <div className="text-center py-8 space-y-4 animate-in fade-in zoom-in-95">
              <div className="inline-flex p-4 rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h4 className="text-xl font-black text-slate-900">
                ¡Solicitud Enviada con Éxito!
              </h4>
              <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                Hemos recibido tu comprobante por <strong>{currSymbol}{totalAmount} {currCode}</strong> ({parsedDays} días de acceso).
              </p>
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 max-w-md mx-auto text-left text-xs text-indigo-950 space-y-2">
                <div className="flex items-start gap-2">
                  <Mail className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>
                    El Administrador verificará el pago y enviará tus datos de inicio de sesión (usuario y contraseña) a: <strong className="font-bold underline">{email}</strong>
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>
                    Una vez recibas el correo, podrás ingresar de inmediato a la aplicación.
                  </span>
                </div>
              </div>
              <div className="pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="py-3 px-8 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm shadow-md transition-all cursor-pointer"
                >
                  Regresar al Inicio de Sesión
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Error Banner */}
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="font-semibold">{errorMessage}</span>
                </div>
              )}

              {/* 1. Calculator & Days Selector */}
              <div className="bg-gradient-to-br from-indigo-50 via-slate-50 to-blue-50 border border-indigo-100 rounded-2xl p-4 sm:p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-indigo-600" />
                      <span>Cantidad de Días a Solicitar</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={daysRequested}
                        onChange={(e) => setDaysRequested(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        required
                        className="w-32 py-2 px-3 bg-white border border-slate-300 rounded-xl text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      />
                      <div className="flex items-center gap-1.5">
                        {[7, 15, 30, 60].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setDaysRequested(preset)}
                            className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all ${
                              daysRequested === preset
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {preset}d
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      Tarifa diaria fijada por el administrador: <strong>{currSymbol}{pricePerDay} {currCode}</strong> por día.
                    </p>
                  </div>

                  {/* Calculated Total Price Card */}
                  <div className="sm:text-right bg-white sm:bg-transparent p-3 sm:p-0 rounded-xl border sm:border-0 border-indigo-100">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Total a Transferir
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-indigo-700 font-mono tracking-tight">
                      {currSymbol}{totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span className="text-xs font-bold text-slate-500 ml-1">{currCode}</span>
                    </div>
                    <div className="text-[11px] text-emerald-700 font-bold">
                      {parsedDays} {parsedDays === 1 ? 'día de acceso' : 'días de acceso completo'}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Admin Banking Information Card */}
              <div className="border border-slate-200 rounded-2xl p-4 sm:p-5 bg-white shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-indigo-600" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Información Bancaria para el Pago
                    </h4>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400">
                    Datos del Administrador
                  </span>
                </div>

                {isLoadingConfig ? (
                  <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                    <span>Cargando datos bancarios...</span>
                  </div>
                ) : !(config.bankName || config.accountType || config.accountNumber || config.accountHolder || config.idNumber || config.phone || config.paymentEmail) ? (
                  <div className="p-3.5 text-center text-slate-500 text-xs bg-slate-50 border border-slate-100 rounded-xl">
                    <p className="font-medium text-slate-600">
                      El Administrador indicará los datos bancarios para la transferencia. Sube tu comprobante de pago una vez realizado el depósito o transferencia.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {config.bankName && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-slate-400 block text-[10px] font-semibold">Banco / Plataforma:</span>
                        <strong className="text-slate-800 font-bold">{config.bankName}</strong>
                      </div>
                    )}

                    {config.accountType && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-slate-400 block text-[10px] font-semibold">Tipo de Cuenta:</span>
                        <strong className="text-slate-800 font-bold">{config.accountType}</strong>
                      </div>
                    )}

                    {config.accountNumber && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between col-span-1 sm:col-span-2">
                        <div>
                          <span className="text-slate-400 block text-[10px] font-semibold">Número de Cuenta / Identificador:</span>
                          <strong className="text-slate-900 font-mono font-bold select-all text-xs sm:text-sm">{config.accountNumber}</strong>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(config.accountNumber, 'accountNumber')}
                          className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors ml-2"
                          title="Copiar número"
                        >
                          {copiedField === 'accountNumber' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}

                    {config.accountHolder && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-slate-400 block text-[10px] font-semibold">Titular / Beneficiario:</span>
                        <strong className="text-slate-800 font-bold">{config.accountHolder}</strong>
                      </div>
                    )}

                    {config.idNumber && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="text-slate-400 block text-[10px] font-semibold">Cédula / RIF / ID Fiscal:</span>
                          <strong className="text-slate-800 font-mono font-bold select-all">{config.idNumber}</strong>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(config.idNumber, 'idNumber')}
                          className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors ml-1"
                        >
                          {copiedField === 'idNumber' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}

                    {config.phone && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="text-slate-400 block text-[10px] font-semibold">Teléfono Pago Móvil / Zelle:</span>
                          <strong className="text-slate-800 font-mono font-bold select-all">{config.phone}</strong>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(config.phone, 'phone')}
                          className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors ml-1"
                        >
                          {copiedField === 'phone' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}

                    {config.paymentEmail && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="text-slate-400 block text-[10px] font-semibold">Correo de Pago / Zelle:</span>
                          <strong className="text-slate-800 font-mono font-bold select-all">{config.paymentEmail}</strong>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(config.paymentEmail, 'paymentEmail')}
                          className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors ml-1"
                        >
                          {copiedField === 'paymentEmail' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {config.instructions && (
                  <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5 mt-2">
                    💡 <strong>Nota del Administrador:</strong> {config.instructions}
                  </p>
                )}
              </div>

              {/* 3. User Contact Form Fields */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Tus Datos de Contacto
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Correo Electrónico <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu@correo.com"
                        required
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Aquí recibirás tu usuario y contraseña.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nombre Completo o Empresa
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nombre o Razón Social"
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Teléfono o WhatsApp
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Phone className="w-4 h-4" />
                      </div>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+58 412..."
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Notas Adicionales (opcional)
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Número de referencia o detalles..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Voucher / Comprobante Upload */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Adjuntar Comprobante de Pago (Voucher) <span className="text-rose-500">*</span></span>
                  <span className="text-[10px] text-slate-400 lowercase font-normal">JPG, PNG o PDF</span>
                </label>

                {voucherError && (
                  <p className="text-xs text-rose-600 font-semibold mb-2">{voucherError}</p>
                )}

                {voucherFile ? (
                  <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {voucherPreview ? (
                        <img 
                          src={voucherPreview} 
                          alt="Comprobante" 
                          className="w-12 h-12 object-cover rounded-lg border border-indigo-200 shrink-0" 
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
                          <FileText className="w-6 h-6" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-indigo-950 truncate">
                          {voucherFile.filename}
                        </div>
                        <div className="text-[10px] text-indigo-700">
                          Comprobante adjuntado listo para enviar
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveVoucher}
                      className="px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 rounded-lg font-bold transition-colors shrink-0"
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50/50 hover:bg-indigo-50/20 rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all group">
                    <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center text-slate-500 group-hover:text-indigo-600 mb-2 transition-colors">
                      <Upload className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-700 text-center">
                      Haz clic para subir o arrastra la foto del comprobante
                    </span>
                    <span className="text-[11px] text-slate-400 mt-0.5">
                      Archivos soportados: Imágenes (JPG, PNG) o documentos PDF
                    </span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleFileChange}
                      className="hidden"
                      required
                    />
                  </label>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !voucherFile}
                  className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Enviando comprobante y solicitud...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Enviar Solicitud ({currSymbol}{totalAmount} {currCode})</span>
                    </>
                  )}
                </button>
                <p className="text-[11px] text-slate-400 text-center mt-2">
                  Al enviar la solicitud, el Administrador recibirá el comprobante y activará tu cuenta.
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
