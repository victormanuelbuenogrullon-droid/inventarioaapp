import React, { useState, useEffect } from 'react';
import { 
  X, 
  CreditCard, 
  Check, 
  AlertCircle, 
  Loader2, 
  Eye, 
  CheckCircle2, 
  XCircle, 
  Trash2, 
  Clock, 
  Mail, 
  User, 
  Phone, 
  Calendar, 
  Copy, 
  ExternalLink,
  MessageCircle,
  ShieldCheck,
  Search
} from 'lucide-react';
import { 
  fetchAdminAccessRequests, 
  approveAccessRequest, 
  rejectAccessRequest, 
  deleteAccessRequest 
} from '../utils/payment';

export default function AccessRequestsModal({ isOpen, onClose, onUserCreated }) {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVoucher, setSelectedVoucher] = useState(null); // { filename, mimetype, data, req }

  // Approval modal state
  const [approvingReq, setApprovingReq] = useState(null);
  const [customUsername, setCustomUsername] = useState('');
  const [customPassword, setCustomPassword] = useState('');
  const [sendEmailNotification, setSendEmailNotification] = useState(true);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [approvedResult, setApprovedResult] = useState(null); // { credentials, copyableMessage, emailSent }

  const [copiedKey, setCopiedKey] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const loadRequests = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchAdminAccessRequests();
      if (Array.isArray(data)) {
        setRequests(data);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Error al cargar las solicitudes de acceso.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadRequests();
      setApprovedResult(null);
      setApprovingReq(null);
      setSelectedVoucher(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartApprove = (req) => {
    const baseUser = req.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'usuario';
    // Generate clean 6-character random password
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let randPass = '';
    for (let i = 0; i < 6; i++) {
      randPass += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    setApprovingReq(req);
    setCustomUsername(baseUser);
    setCustomPassword(randPass);
    setSendEmailNotification(true);
    setApprovedResult(null);
  };

  const handleConfirmApprove = async () => {
    if (!approvingReq) return;
    setIsProcessingAction(true);
    setErrorMessage(null);

    try {
      const result = await approveAccessRequest(approvingReq.id, {
        customUsername: customUsername.trim().toLowerCase(),
        customPassword: customPassword.trim(),
        sendEmail: sendEmailNotification
      });

      setApprovedResult(result);
      if (onUserCreated) onUserCreated();
      await loadRequests();
    } catch (err) {
      setErrorMessage(err.message || 'Error al aprobar la solicitud.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleReject = async (req) => {
    const reason = window.prompt('Motivo del rechazo (opcional):', 'Comprobante no válido o pago no verificado');
    if (reason === null) return; // user cancelled

    setIsProcessingAction(true);
    try {
      await rejectAccessRequest(req.id, reason);
      await loadRequests();
    } catch (err) {
      alert(err.message || 'Error al rechazar la solicitud');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleDelete = async (req) => {
    if (!window.confirm(`¿Eliminar la solicitud de ${req.email}?`)) return;
    try {
      await deleteAccessRequest(req.id);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
    } catch (err) {
      alert(err.message || 'Error al eliminar la solicitud');
    }
  };

  const handleCopy = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const filteredRequests = requests.filter((r) => {
    const q = searchQuery.toLowerCase();
    return (
      (r.email && r.email.toLowerCase().includes(q)) ||
      (r.name && r.name.toLowerCase().includes(q)) ||
      (r.phone && r.phone.toLowerCase().includes(q)) ||
      (r.status && r.status.toLowerCase().includes(q))
    );
  });

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600 text-white">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">
                  Solicitudes de Acceso y Pagos
                </h3>
                {pendingCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider animate-pulse">
                    {pendingCount} Pendiente{pendingCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Revisa los comprobantes, valida transferencias y genera credenciales
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

        {/* Filter bar */}
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por correo, nombre o teléfono..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="text-xs text-slate-500 font-semibold">
            Total: <strong>{requests.length}</strong> solicitudes
          </div>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
              <span className="text-xs font-semibold">Cargando solicitudes...</span>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <CreditCard className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-600">No hay solicitudes registradas</p>
              <p className="text-xs max-w-sm mx-auto text-slate-400">
                Cuando los usuarios soliciten acceso desde la pantalla de inicio de sesión y suban su comprobante, aparecerán listados aquí.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((req) => {
                const isPending = req.status === 'pending';
                const isApproved = req.status === 'approved';
                const isRejected = req.status === 'rejected';

                return (
                  <div 
                    key={req.id} 
                    className={`border rounded-2xl p-4 transition-all ${
                      isPending 
                        ? 'bg-white border-indigo-200 shadow-sm' 
                        : isApproved 
                          ? 'bg-slate-50/70 border-slate-200' 
                          : 'bg-rose-50/30 border-rose-100 opacity-80'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: User & Request info */}
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="text-sm font-bold text-slate-900 truncate">
                            {req.name || 'Sin nombre especificado'}
                          </strong>

                          {/* Status Badge */}
                          {isPending && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-wider">
                              Pendiente
                            </span>
                          )}
                          {isApproved && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                              <Check className="w-3 h-3" /> Aprobada ({req.approvedUsername})
                            </span>
                          )}
                          {isRejected && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black uppercase tracking-wider">
                              Rechazada
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                          <span className="flex items-center gap-1 font-mono text-indigo-700">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            {req.email}
                          </span>
                          {req.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              {req.phone}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-slate-400 text-[11px]">
                            <Clock className="w-3 h-3" />
                            {new Date(req.createdAt).toLocaleString('es-DO', {
                              dateStyle: 'short',
                              timeStyle: 'short'
                            })}
                          </span>
                        </div>

                        {req.notes && (
                          <p className="text-xs text-slate-500 italic mt-1">
                            "{req.notes}"
                          </p>
                        )}
                        {req.adminNotes && (
                          <p className="text-xs text-rose-600 font-semibold mt-0.5">
                            Nota de rechazo: {req.adminNotes}
                          </p>
                        )}
                      </div>

                      {/* Right: Amount & Action Buttons */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100 shrink-0">
                        <div className="text-right">
                          <div className="text-sm sm:text-base font-black text-slate-900 font-mono">
                            ${req.totalAmount} <span className="text-xs font-semibold text-slate-500">{req.currency}</span>
                          </div>
                          <div className="text-[11px] text-indigo-600 font-bold">
                            {req.daysRequested} días de acceso
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* View Voucher Button */}
                          {req.voucherData && (
                            <button
                              type="button"
                              onClick={() => setSelectedVoucher(req)}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1"
                              title="Ver voucher de pago"
                            >
                              <Eye className="w-4 h-4" />
                              <span className="hidden md:inline">Ver Voucher</span>
                            </button>
                          )}

                          {/* Action Buttons for Pending */}
                          {isPending && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleStartApprove(req)}
                                className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Aprobar</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReject(req)}
                                className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors"
                                title="Rechazar solicitud"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          {/* Delete option */}
                          <button
                            type="button"
                            onClick={() => handleDelete(req)}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors"
                            title="Eliminar registro"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <span className="text-xs text-slate-400">
            {requests.length} solicitudes registradas
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* MODAL 1: VOUCHER PREVIEW */}
      {selectedVoucher && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-white truncate">
                  Comprobante: {selectedVoucher.voucherFilename}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {selectedVoucher.email} • ${selectedVoucher.totalAmount} {selectedVoucher.currency} ({selectedVoucher.daysRequested} días)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVoucher(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center bg-slate-100">
              {selectedVoucher.voucherData?.startsWith('data:image/') ? (
                <img 
                  src={selectedVoucher.voucherData} 
                  alt="Voucher" 
                  className="max-h-[70vh] w-auto object-contain rounded-xl shadow-md border border-slate-300"
                />
              ) : selectedVoucher.voucherData?.startsWith('data:application/pdf') ? (
                <iframe 
                  src={selectedVoucher.voucherData} 
                  title="PDF Voucher" 
                  className="w-full h-[65vh] rounded-xl border border-slate-300"
                />
              ) : (
                <div className="text-center p-8 text-slate-500">
                  <p className="text-xs mb-3 font-semibold">Archivo listo para descargar o abrir externamente</p>
                  <a
                    href={selectedVoucher.voucherData}
                    download={selectedVoucher.voucherFilename || 'comprobante'}
                    className="py-2 px-4 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md inline-flex items-center gap-2"
                  >
                    <span>Descargar Archivo</span>
                  </a>
                </div>
              )}
            </div>

            <div className="px-4 py-3 bg-white border-t border-slate-100 flex items-center justify-between">
              <a
                href={selectedVoucher.voucherData}
                download={selectedVoucher.voucherFilename || 'comprobante'}
                className="text-xs text-indigo-600 hover:underline font-bold"
              >
                Descargar Comprobante
              </a>
              <button
                type="button"
                onClick={() => setSelectedVoucher(null)}
                className="py-1.5 px-4 bg-slate-900 text-white rounded-xl text-xs font-bold"
              >
                Cerrar Vista Previa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: APPROVAL & CREDENTIALS CREATOR */}
      {approvingReq && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-emerald-600 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-100" />
                <h4 className="font-bold text-base text-white">
                  Aprobar Solicitud y Crear Credenciales
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setApprovingReq(null)}
                className="p-1 rounded-lg text-emerald-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
              {approvedResult ? (
                /* Success Screen with generated credentials */
                <div className="space-y-4 animate-in fade-in zoom-in-95">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-bold flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>¡Usuario creado y activado exitosamente en la base de datos!</span>
                  </div>

                  {approvedResult.emailSent && (
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>Correo automático con las credenciales enviado a <strong>{approvingReq.email}</strong>.</span>
                    </div>
                  )}

                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Credenciales de Acceso Generadas
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Usuario:</span>
                      <strong className="font-mono text-sm text-slate-900 font-bold select-all">{approvedResult.credentials.username}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Contraseña:</span>
                      <strong className="font-mono text-sm text-indigo-700 font-bold select-all">{approvedResult.credentials.password}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Vigencia autorizada:</span>
                      <strong className="text-slate-800">{approvedResult.credentials.accessDays} días (Vence {new Date(approvedResult.credentials.expiresAt).toLocaleDateString()})</strong>
                    </div>
                  </div>

                  {/* Copy greeting message for WhatsApp / Email */}
                  {approvedResult.copyableMessage && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                          Mensaje listo para enviar por WhatsApp o Correo:
                        </label>
                        <button
                          type="button"
                          onClick={() => handleCopy(approvedResult.copyableMessage, 'fullMsg')}
                          className="text-xs text-indigo-600 hover:underline font-bold flex items-center gap-1"
                        >
                          {copiedKey === 'fullMsg' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedKey === 'fullMsg' ? 'Copiado' : 'Copiar Mensaje'}</span>
                        </button>
                      </div>
                      <textarea
                        rows={5}
                        readOnly
                        value={approvedResult.copyableMessage}
                        className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-800 font-mono select-all focus:outline-none"
                      />
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setApprovingReq(null)}
                      className="w-full py-2.5 px-4 bg-slate-900 text-white rounded-xl text-xs font-bold"
                    >
                      Finalizar y Volver a la Lista
                    </button>
                  </div>
                </div>
              ) : (
                /* Form to approve */
                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
                    <p><strong>Solicitante:</strong> {approvingReq.name || 'Sin nombre'} ({approvingReq.email})</p>
                    <p><strong>Días a autorizar:</strong> {approvingReq.daysRequested} días (${approvingReq.totalAmount} {approvingReq.currency})</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Nombre de Usuario a Asignar
                    </label>
                    <input
                      type="text"
                      value={customUsername}
                      onChange={(e) => setCustomUsername(e.target.value.toLowerCase())}
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Contraseña Temporal
                    </label>
                    <input
                      type="text"
                      value={customPassword}
                      onChange={(e) => setCustomPassword(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                    />
                  </div>

                  <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-indigo-950">
                      <input
                        type="checkbox"
                        checked={sendEmailNotification}
                        onChange={(e) => setSendEmailNotification(e.target.checked)}
                        className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span>Enviar correo automático con estas credenciales a {approvingReq.email}</span>
                    </label>
                    <p className="text-[10px] text-indigo-700 mt-1 pl-6">
                      (Requiere servidor SMTP configurado; de lo contrario, podrás copiar los datos para enviarlos manualmente)
                    </p>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setApprovingReq(null)}
                      className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={isProcessingAction || !customUsername.trim() || !customPassword.trim()}
                      onClick={handleConfirmApprove}
                      className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      {isProcessingAction ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Aprobando y creando cuenta...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Confirmar y Activar Acceso</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
