import React, { useState, useEffect, useRef } from 'react';
import { 
  Barcode, 
  Database, 
  FileSpreadsheet, 
  Printer, 
  Trash2, 
  Volume2, 
  VolumeX, 
  UploadCloud, 
  Save, 
  ClipboardList,
  Users,
  History,
  QrCode,
  ShieldCheck,
  LogOut,
  Clock,
  Copy,
  Check,
  ListOrdered,
  Menu,
  CreditCard,
  DollarSign
} from 'lucide-react';
import { getSocket } from '../utils/socket';

export default function Navbar({
  activeView,
  setActiveView,
  catalogCount,
  totalHistoryLogs = 0,
  onOpenUploader,
  onOpenSessionManager,
  onOpenPrint,
  onExportExcel,
  onClearCount,
  soundEnabled,
  setSoundEnabled,
  totalItemsCounted,
  sessionName,
  setSessionName,
  isOnline = false,
  onlineUsers = 1,
  onOpenAuditorsModal,
  onOpenShareModal,
  currentUserName,
  currentUser,
  activeSession,
  onOpenSessionSelector,
  onOpenUserManagement,
  onOpenPaymentConfig,
  onOpenAccessRequests,
  pendingRequestsCount = 0,
  onLogout
}) {
  const [codeCopied, setCodeCopied] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown menu on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const handleCopySessionCode = () => {
    if (!activeSession?.code) return;
    navigator.clipboard.writeText(activeSession.code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  // Compute remaining access days for the logged-in user or session
  let remainingAccessDays = null;
  let isAccessExpiringSoon = false;
  let isAccessExpired = false;

  const isCollaborator = currentUser?.isCollaborator || currentUser?.role === 'collaborator' || String(currentUser?.id || '').startsWith('collab_');

  const targetExpiration = activeSession?.expiresAt || currentUser?.expiresAt;
  if (targetExpiration) {
    const diffMs = new Date(targetExpiration).getTime() - Date.now();
    remainingAccessDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    isAccessExpiringSoon = remainingAccessDays <= 3 && remainingAccessDays > 0;
    isAccessExpired = remainingAccessDays <= 0;
  }

  return (
    <header className="bg-white/95 backdrop-blur border-b border-slate-200 sticky top-0 z-40 px-3 sm:px-5 py-2.5 shadow-xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        
        {/* 1. Left: Brand, Active Session Code & Live Indicator */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-slate-900 flex items-center justify-center shadow-xs text-white shrink-0">
            <Barcode className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
              <h1 className="text-xs sm:text-base font-extrabold tracking-tight text-slate-900 truncate">
                InventariosApp
              </h1>

              {/* Active Session Code Pill */}
              {activeSession?.code && (
                <div 
                  className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-950 shadow-2xs text-[10px] sm:text-[11px] shrink-0"
                  title="Código de sesión para que tus auxiliares puedan unirse"
                >
                  <span className="font-extrabold text-indigo-600 uppercase tracking-wider text-[9px] sm:text-[10px]">
                    <span className="hidden sm:inline">CÓDIGO:</span>
                    <span className="sm:hidden">CÓD:</span>
                  </span>
                  <span className="font-mono font-black text-indigo-700 tracking-wide select-all text-xs">
                    {activeSession.code}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopySessionCode}
                    className="p-0.5 sm:p-1 hover:bg-indigo-100 rounded text-indigo-600 transition-colors"
                    title="Copiar código al portapapeles"
                  >
                    {codeCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              )}

              {/* Real-time Collaboration Live Pill */}
              <button
                type="button"
                onClick={() => {
                  if (!isOnline) {
                    try {
                      const s = getSocket();
                      if (s) s.connect();
                    } catch {}
                  }
                  onOpenAuditorsModal();
                }}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold border transition-all cursor-pointer shrink-0 ${
                  isOnline
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                }`}
                title={isOnline ? "En línea. Haz clic para ver usuarios conectados" : "Reconectando... Haz clic para reintentar conexión"}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
                <span className="hidden sm:inline">
                  {isOnline ? `${onlineUsers} en línea` : 'Reconectando...'}
                </span>
                <span className="sm:hidden font-bold">
                  {onlineUsers}
                </span>
                <Users className="w-3 h-3 text-slate-500" />
              </button>
            </div>

            {/* Subtitle: Session Name & Current Station */}
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-400 mt-0.5">
              <span className="truncate max-w-[120px] sm:max-w-[200px] font-medium text-slate-600">
                {sessionName}
              </span>
              {currentUserName && (
                <span className="hidden md:inline">
                  • Estación: <strong className="text-slate-600">{currentUserName}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 2. Center: Main View Navigation Switcher (Desktop & Tablets sm+) */}
        <div className="hidden sm:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/90 shadow-2xs shrink-0">
          <button
            type="button"
            onClick={() => setActiveView('inventory')}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              activeView === 'inventory'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600" />
            <span>Pase de Inventario</span>
            {totalItemsCounted > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-800 text-[10px] font-extrabold">
                {totalItemsCounted}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveView('catalog')}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              activeView === 'catalog'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600" />
            <span>Catálogo</span>
            {catalogCount > 0 && (
              <span className="text-[10px] text-slate-500 font-normal hidden sm:inline">
                ({catalogCount.toLocaleString()})
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveView('history')}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              activeView === 'history'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600" />
            <span>Historial</span>
            {totalHistoryLogs > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-800 text-[10px] font-extrabold">
                {totalHistoryLogs}
              </span>
            )}
          </button>
        </div>

        {/* 3. Right: Quick Excel & Unified Dropdown Menu */}
        <div className="flex items-center gap-2 shrink-0">
          
          {/* Quick Export to Excel (only visible when inventory has counted items) */}
          {activeView === 'inventory' && totalItemsCounted > 0 && (
            <button
              type="button"
              onClick={onExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all active:scale-95"
              title="Descargar inventario contado en archivo Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Excel</span>
            </button>
          )}

          {/* Unified Dropdown Menu Trigger */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-2xs active:scale-95 ${
                isMenuOpen
                  ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-900/15'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 hover:border-slate-300'
              }`}
              title="Menú de opciones, configuración y administración"
            >
              <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-extrabold ${
                currentUser?.role === 'admin' 
                  ? 'bg-indigo-600 text-white' 
                  : isCollaborator 
                    ? 'bg-amber-600 text-white' 
                    : 'bg-slate-700 text-white'
              }`}>
                {currentUser?.name ? currentUser.name.slice(0, 1).toUpperCase() : 'U'}
              </div>
              <span className="font-bold text-slate-800 hidden sm:inline">
                Menú
              </span>
              {pendingRequestsCount > 0 && currentUser?.role === 'admin' && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </span>
              )}
              <Menu className={`w-4 h-4 ${isMenuOpen ? 'text-white' : 'text-slate-600'}`} />
            </button>

            {/* Menu Dropdown Popup */}
            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-[calc(100vw-24px)] max-w-xs sm:w-80 max-h-[85vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-2.5 z-50 animate-in fade-in zoom-in-95 origin-top-right">
                
                {/* User Profile & Access Validity Header */}
                <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-extrabold text-white shrink-0 shadow-2xs ${
                      currentUser?.role === 'admin' ? 'bg-indigo-600' : isCollaborator ? 'bg-amber-600' : 'bg-slate-800'
                    }`}>
                      {currentUser?.name ? currentUser.name.slice(0, 1).toUpperCase() : 'U'}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-900 truncate">
                        {currentUser?.name || 'Usuario'}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        @{currentUser?.username || 'usuario'} • {currentUser?.role === 'admin' ? 'Administrador' : isCollaborator ? 'Auxiliar' : 'Auditor'}
                      </div>
                    </div>
                  </div>

                  {/* Access Expiration Notice */}
                  <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                    <span className="text-slate-500 font-medium">Vigencia de acceso:</span>
                    {currentUser?.expiresAt ? (
                      <span className={`font-bold flex items-center gap-1 ${
                        isAccessExpired 
                          ? 'text-rose-600' 
                          : isAccessExpiringSoon 
                            ? 'text-amber-600' 
                            : 'text-indigo-600'
                      }`}>
                        <Clock className="w-3 h-3" />
                        {isAccessExpired
                          ? 'Vencido'
                          : remainingAccessDays === 1
                            ? 'Último día'
                            : `${remainingAccessDays} días restantes`}
                      </span>
                    ) : (
                      <span className="font-bold text-emerald-600 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Acceso permanente
                      </span>
                    )}
                  </div>
                </div>

                {/* Administration & Catalog Section */}
                <div className="px-2 py-1.5">
                  <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Administración y Catálogo
                  </div>

                  {/* Access Requests - Admin Only */}
                  {currentUser?.role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenAccessRequests?.();
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-slate-50 transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0 group-hover:bg-amber-600 group-hover:text-white transition-colors relative">
                        <CreditCard className="w-3.5 h-3.5" />
                        {pendingRequestsCount > 0 && (
                          <span className="w-2 h-2 rounded-full bg-rose-500 absolute -top-0.5 -right-0.5 ring-2 ring-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">Solicitudes de Acceso</span>
                          {pendingRequestsCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-black">
                              {pendingRequestsCount} nueva{pendingRequestsCount > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">Ver comprobantes y activar cuentas</div>
                      </div>
                    </button>
                  )}

                  {/* Payment & Pricing Configuration - Admin Only */}
                  {currentUser?.role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenPaymentConfig?.();
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-slate-50 transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <DollarSign className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-800">Ajustes de Pago y Tarifas</div>
                        <div className="text-[10px] text-slate-400">Tarifa por día, bancos y correo</div>
                      </div>
                    </button>
                  )}

                  {/* Import Catalog (CSV / Excel) - Admin Only */}
                  {currentUser?.role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenUploader();
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-slate-50 transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <UploadCloud className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-800">Importar Catálogo</div>
                        <div className="text-[10px] text-slate-400">Subir archivo CSV o Excel de productos</div>
                      </div>
                    </button>
                  )}

                  {/* User Management - Admin Only */}
                  {currentUser?.role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenUserManagement();
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-slate-50 transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-800">Administrador de Usuarios</div>
                        <div className="text-[10px] text-slate-400">Crear o renovar cuentas de auxiliares</div>
                      </div>
                    </button>
                  )}

                  {/* Save / Backups - Non-Collaborators only */}
                  {!isCollaborator && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenSessionManager();
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-slate-50 transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <Save className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-800">Guardar / Respaldos</div>
                        <div className="text-[10px] text-slate-400">Puntos de restauración y copias locales</div>
                      </div>
                    </button>
                  )}

                  {/* Switch or Create Session - Non-collaborator only */}
                  {!isCollaborator && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenSessionSelector();
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-slate-50 transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                        <ListOrdered className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-800">Gestionar Sesiones</div>
                        <div className="text-[10px] text-slate-400">Cambiar o crear otro conteo de inventario</div>
                      </div>
                    </button>
                  )}

                  {/* Connect other devices (QR / Share) */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenShareModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-slate-50 transition-colors group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600 shrink-0 group-hover:bg-violet-600 group-hover:text-white transition-colors">
                      <QrCode className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-800">Conectar Dispositivos</div>
                      <div className="text-[10px] text-slate-400">Compartir código QR para móviles o PCs</div>
                    </div>
                  </button>
                </div>

                {/* Tools and Print Reports Section */}
                <div className="px-2 py-1.5 border-t border-slate-100">
                  <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Herramientas y Reportes
                  </div>

                  {/* Print Report */}
                  <button
                    type="button"
                    disabled={totalItemsCounted === 0}
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenPrint();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-slate-50 transition-colors group disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0 group-hover:bg-slate-800 group-hover:text-white transition-colors">
                      <Printer className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-800">Imprimir Reporte</div>
                      <div className="text-[10px] text-slate-400">Generar PDF o imprimir conteo</div>
                    </div>
                  </button>

                  {/* Export to Excel */}
                  <button
                    type="button"
                    disabled={totalItemsCounted === 0}
                    onClick={() => {
                      setIsMenuOpen(false);
                      onExportExcel();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-slate-50 transition-colors group disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-800">Descargar Excel (.xlsx)</div>
                      <div className="text-[10px] text-slate-400">Exportar planilla con cálculos y costos</div>
                    </div>
                  </button>

                  {/* Sound Toggle Row */}
                  <div className="flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                        {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-600" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">Sonido de Escaneo</div>
                        <div className="text-[10px] text-slate-400">Pitido al leer código de barra</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all border ${
                        soundEnabled 
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {soundEnabled ? 'ACTIVO' : 'SILENCIO'}
                    </button>
                  </div>
                </div>

                {/* Danger & Exit Section */}
                <div className="px-2 pt-1.5 pb-1 border-t border-slate-100 bg-slate-50/50">
                  {/* Clear count */}
                  {!isCollaborator && (
                    <button
                      type="button"
                      disabled={totalItemsCounted === 0}
                      onClick={() => {
                        setIsMenuOpen(false);
                        onClearCount();
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-rose-50 text-rose-600 transition-colors group disabled:opacity-40 disabled:cursor-not-allowed mb-1"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold">Limpiar Conteo Actual</span>
                      </div>
                    </button>
                  )}

                  {/* Logout Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-colors border border-rose-200/80"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-600" />
                    <span>Cerrar Sesión</span>
                  </button>
                </div>

              </div>
            )}
          </div>

        </div>

      </div>

      {/* 4. Mobile Navigation Tab Bar (< sm) */}
      <div className="sm:hidden pt-2 border-t border-slate-100 mt-2 max-w-7xl mx-auto flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/90 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveView('inventory')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeView === 'inventory' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5 text-slate-600" />
          <span>Pase</span>
          {totalItemsCounted > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-800 text-[10px] font-extrabold">
              {totalItemsCounted}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveView('catalog')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeView === 'catalog' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Database className="w-3.5 h-3.5 text-slate-600" />
          <span>Catálogo</span>
          {catalogCount > 0 && (
            <span className="text-[10px] text-slate-500 font-normal">
              ({catalogCount > 999 ? `${(catalogCount / 1000).toFixed(0)}k` : catalogCount})
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveView('history')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeView === 'history' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <History className="w-3.5 h-3.5 text-slate-600" />
          <span>Historial</span>
          {totalHistoryLogs > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-800 text-[10px] font-extrabold">
              {totalHistoryLogs}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
