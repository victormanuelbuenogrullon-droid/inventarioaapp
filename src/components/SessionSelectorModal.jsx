import React, { useState, useEffect } from 'react';
import { 
  FolderPlus, 
  Hash, 
  ListOrdered, 
  X, 
  Loader2, 
  Check, 
  AlertCircle, 
  ArrowRight, 
  Clock, 
  Copy, 
  Trash2,
  Users,
  ShieldCheck,
  Calendar
} from 'lucide-react';
import { 
  createSessionApi, 
  validateSessionApi, 
  fetchMySessionsApi, 
  deleteSessionApi,
  setActiveSessionCode
} from '../utils/socket';

export default function SessionSelectorModal({
  isOpen,
  onClose,
  currentUser,
  activeSession,
  onSelectSession,
  canClose = true
}) {
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'join' | 'list'
  
  // Create form state
  const [newSessionName, setNewSessionName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Join form state
  const [joinCode, setJoinCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validatedSession, setValidatedSession] = useState(null);

  // List state
  const [mySessions, setMySessions] = useState([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);

  // Compute remaining days for current user
  let remainingDays = null;
  if (currentUser?.expiresAt) {
    const diffMs = new Date(currentUser.expiresAt).getTime() - Date.now();
    remainingDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setSuccessMessage(null);
      setJoinCode('');
      setValidatedSession(null);
      setNewSessionName(currentUser?.name ? `Inventario de ${currentUser.name}` : 'Nuevo Pase de Inventario');
      loadMySessions();
    }
  }, [isOpen, currentUser]);

  const loadMySessions = async () => {
    setIsLoadingSessions(true);
    try {
      const list = await fetchMySessionsApi();
      if (Array.isArray(list)) {
        setMySessions(list);
        // If user already has sessions, default to 'list' tab
        if (list.length > 0 && !activeSession) {
          setActiveTab('list');
        }
      }
    } catch (err) {
      console.warn('Error cargando sesiones:', err);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const isCollaborator = currentUser?.isCollaborator || currentUser?.role === 'collaborator' || String(currentUser?.id || '').startsWith('collab_');

  if (!isOpen || isCollaborator) return null;

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!newSessionName.trim()) {
      setErrorMessage('Ingresa un nombre para identificar la sesión de conteo');
      return;
    }

    setIsCreating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const created = await createSessionApi({ name: newSessionName.trim() });
      setActiveSessionCode(created.code);
      setSuccessMessage(`✅ Sesión creada con código: ${created.code}`);
      setTimeout(() => {
        onSelectSession(created);
      }, 500);
    } catch (err) {
      setErrorMessage(err.message || 'Error al crear la sesión');
    } finally {
      setIsCreating(false);
    }
  };

  const handleValidateCode = async (e) => {
    e?.preventDefault();
    if (!joinCode.trim()) {
      setErrorMessage('Ingresa el código de sesión (ej: INV-8492)');
      return;
    }

    setIsValidating(true);
    setErrorMessage(null);
    setValidatedSession(null);

    try {
      const clean = joinCode.trim().toUpperCase();
      const session = await validateSessionApi(clean);
      setValidatedSession(session);
    } catch (err) {
      setErrorMessage(err.message || 'Código de sesión no encontrado o expirado');
    } finally {
      setIsValidating(false);
    }
  };

  const handleConfirmJoin = () => {
    if (!validatedSession) return;
    setActiveSessionCode(validatedSession.code);
    onSelectSession(validatedSession);
  };

  const handleSelectExisting = (session) => {
    setActiveSessionCode(session.code);
    onSelectSession(session);
  };

  const handleDeleteSession = async (code, e) => {
    e.stopPropagation();
    if (!window.confirm(`¿Seguro que deseas eliminar la sesión ${code}? Se borrarán los datos de este conteo.`)) {
      return;
    }
    try {
      await deleteSessionApi(code);
      await loadMySessions();
      if (activeSession?.code === code) {
        setActiveSessionCode('');
        onSelectSession(null);
      }
    } catch (err) {
      alert(err.message || 'Error eliminando sesión');
    }
  };

  const handleCopyCode = (code, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/30">
              <ListOrdered className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Gestión de Sesiones de Conteo
              </h3>
              <p className="text-xs text-slate-500">
                Cada usuario o equipo cuenta en su propio inventario independiente
              </p>
            </div>
          </div>
          {canClose && activeSession && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* User Expiration Banner */}
        <div className="px-6 py-2.5 bg-indigo-50/70 border-b border-indigo-100/60 flex items-center justify-between text-xs text-indigo-900">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              Usuario: <strong>{currentUser?.name}</strong> • Vigencia:{' '}
              {currentUser?.expiresAt ? (
                <strong className="text-indigo-800">{remainingDays} días de acceso</strong>
              ) : (
                <strong className="text-emerald-700">Acceso Permanente</strong>
              )}
            </span>
          </div>
          <span className="text-[11px] text-indigo-700 font-medium hidden sm:inline">
            Tus sesiones heredarán este tiempo
          </span>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/50 px-6 pt-2">
          <button
            type="button"
            onClick={() => { setActiveTab('create'); setErrorMessage(null); setSuccessMessage(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'create'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FolderPlus className="w-4 h-4 text-indigo-600" />
            <span>Crear Nueva Sesión</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('join'); setErrorMessage(null); setSuccessMessage(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'join'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Hash className="w-4 h-4 text-emerald-600" />
            <span>Unirme con Código</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('list'); setErrorMessage(null); setSuccessMessage(null); loadMySessions(); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'list'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4 text-slate-600" />
            <span>Mis Sesiones ({mySessions.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          
          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="flex-1 font-medium">{successMessage}</div>
            </div>
          )}

          {/* TAB 1: CREAR NUEVA SESION */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreateSession} className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-2">
                <p className="font-bold text-slate-800 flex items-center gap-1.5 text-sm">
                  <FolderPlus className="w-4 h-4 text-indigo-600" />
                  Crea tu propio conteo aislado
                </p>
                <p className="leading-relaxed">
                  Al crear la sesión se generará automáticamente un <strong>Código de Sesión único (ej. INV-8492)</strong>.
                  Tus auxiliares o colaboradores podrán unirse ingresando ese código.
                </p>
                <div className="pt-2 border-t border-slate-200 text-[11px] text-indigo-700 font-semibold">
                  ⏳ La sesión estará activa durante los {remainingDays !== null ? `${remainingDays} días de vigencia de tu cuenta` : 'días asignados a tu cuenta'}.
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nombre de la Sesión / Inventario:
                </label>
                <input
                  type="text"
                  required
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  placeholder="ej. Sucursal Principal - Conteo Octubre"
                  className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-50/80 focus:bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creando sesión y generando código...</span>
                  </>
                ) : (
                  <>
                    <FolderPlus className="w-4 h-4" />
                    <span>Crear Sesión e Iniciar Conteo</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 2: UNIRME CON CODIGO */}
          {activeTab === 'join' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-2">
                <p className="font-bold text-slate-800 flex items-center gap-1.5 text-sm">
                  <Hash className="w-4 h-4 text-emerald-600" />
                  Conéctate al inventario de tu equipo
                </p>
                <p className="leading-relaxed">
                  Ingresa el código de sesión compartido por el líder del conteo para sincronizarte en tiempo real con su lista de productos.
                </p>
              </div>

              <form onSubmit={handleValidateCode} className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Código de Sesión:
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Hash className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => {
                        setJoinCode(e.target.value.toUpperCase());
                        setValidatedSession(null);
                      }}
                      placeholder="ej. INV-8492"
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 hover:bg-slate-50/80 focus:bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold uppercase text-indigo-700 tracking-wider focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isValidating || !joinCode.trim()}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    {isValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verificar'}
                  </button>
                </div>
              </form>

              {/* Validated session card */}
              {validatedSession && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-extrabold text-sm px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300">
                      {validatedSession.code}
                    </span>
                    <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-emerald-600" /> Sesión válida
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{validatedSession.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Creado por: <strong>{validatedSession.creatorName}</strong> • {validatedSession.totalCounted || 0} artículos contados
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleConfirmJoin}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Entrar a este Conteo</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MIS SESIONES ACTIVAS */}
          {activeTab === 'list' && (
            <div className="space-y-3">
              {isLoadingSessions ? (
                <div className="p-8 text-center text-slate-500 space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
                  <p className="text-xs">Cargando tus sesiones de inventario...</p>
                </div>
              ) : mySessions.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                  <ListOrdered className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  No tienes sesiones creadas aún. Puedes crear una en la pestaña <strong>Crear Nueva Sesión</strong>.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {mySessions.map((sess) => {
                    const isCurrent = activeSession?.code === sess.code;
                    return (
                      <div
                        key={sess.code}
                        onClick={() => handleSelectExisting(sess)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-wrap items-center justify-between gap-3 ${
                          isCurrent
                            ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/20'
                            : 'bg-slate-50 hover:bg-slate-100/70 border-slate-200'
                        }`}
                      >
                        <div className="flex-1 min-w-[200px]">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-extrabold text-xs px-2 py-0.5 rounded bg-white text-indigo-700 border border-indigo-200">
                              {sess.code}
                            </span>
                            <h4 className="font-bold text-slate-900 text-sm">
                              {sess.name}
                            </h4>
                            {isCurrent && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-600 text-white">
                                Activa
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                            <span>📦 <strong>{sess.totalCounted || 0}</strong> SKUs</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {new Date(sess.createdAt).toLocaleDateString('es-DO')}
                            </span>
                            {sess.expiresAt && (
                              <>
                                <span>•</span>
                                <span className="text-indigo-600 font-semibold flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  Vence {new Date(sess.expiresAt).toLocaleDateString('es-DO')}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => handleCopyCode(sess.code, e)}
                            className="p-2 rounded-lg bg-white hover:bg-slate-200 text-slate-600 border border-slate-200 transition-colors"
                            title="Copiar código para auxiliares"
                          >
                            {copiedCode === sess.code ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSelectExisting(sess)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1"
                          >
                            <span>Entrar</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>

                          {(currentUser?.role === 'admin' || sess.createdBy === currentUser?.id) && (
                            <button
                              type="button"
                              onClick={(e) => handleDeleteSession(sess.code, e)}
                              className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors"
                              title="Eliminar sesión"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            {activeSession ? (
              <>Sesión en pantalla: <strong className="font-mono text-indigo-700">{activeSession.code}</strong></>
            ) : (
              'Selecciona o crea una sesión para comenzar'
            )}
          </span>
          {canClose && activeSession && (
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold"
            >
              Cerrar
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
