import React from 'react';
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
  Wifi,
  WifiOff,
  History,
  QrCode,
  Share2,
  ShieldCheck,
  LogOut,
  User
} from 'lucide-react';

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
  onOpenUserManagement,
  onLogout
}) {
  return (
    <header className="bg-white/95 backdrop-blur border-b border-slate-200 sticky top-0 z-40 px-4 py-2.5 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        
        {/* Brand & Session title */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-slate-800 flex items-center justify-center shadow-sm text-white font-bold">
            <Barcode className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-slate-900">
                InventariosApp
              </h1>

              {/* Real-time Collaboration Live Pill */}
              <button
                type="button"
                onClick={onOpenAuditorsModal}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all ${
                  isOnline
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
                title="Haz clic para ver usuarios conectados o cambiar tu nombre"
              >
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
                <span>
                  {isOnline ? `${onlineUsers} en línea` : 'Reconectando...'}
                </span>
                <Users className="w-3 h-3 ml-0.5 text-slate-500" />
              </button>

              {/* Connect other PCs / Mobile phones button */}
              <button
                type="button"
                onClick={onOpenShareModal}
                className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-all shadow-2xs"
                title="Compartir enlace o código QR para conectar otras PCs y celulares"
              >
                <QrCode className="w-3 h-3 text-indigo-600" />
                <span>Conectar Dispositivos</span>
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="Nombre de sesión"
                className="bg-transparent border-b border-dashed border-slate-300 hover:border-slate-500 focus:border-slate-800 focus:outline-none text-slate-700 px-1 py-0.5 max-w-[170px] text-[11px] font-medium"
                title="Haz clic para renombrar la sesión compartida"
              />
              {currentUserName && (
                <span className="text-[10px] text-slate-400">
                  • Estación: <strong className="text-slate-600">{currentUserName}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center: Main View Navigation Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setActiveView('inventory')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
              activeView === 'inventory'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardList className="w-4 h-4 text-slate-600" />
            <span>Pase de Inventario</span>
            {totalItemsCounted > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-800 text-[10px] font-bold">
                {totalItemsCounted}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveView('catalog')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
              activeView === 'catalog'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-4 h-4 text-slate-600" />
            <span>Catálogo</span>
            {catalogCount > 0 && (
              <span className="text-[10px] text-slate-500 font-normal">
                ({catalogCount.toLocaleString()})
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveView('history')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
              activeView === 'history'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4 text-slate-600" />
            <span>Historial</span>
            {totalHistoryLogs > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-800 text-[10px] font-bold">
                {totalHistoryLogs}
              </span>
            )}
          </button>
        </div>


        {/* Right Actions */}
        <div className="flex items-center gap-2">
          
          {/* Upload CSV button */}
          <button
            onClick={onOpenUploader}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all"
            title="Subir o actualizar base de datos CSV"
          >
            <UploadCloud className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden md:inline">Importar CSV</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg border text-xs transition-colors ${
              soundEnabled
                ? 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
                : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'
            }`}
            title={soundEnabled ? 'Sonido de escáner activado' : 'Sonido desactivado'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Guardar / Respaldos */}
          <button
            onClick={onOpenSessionManager}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white shadow-sm transition-all"
            title="Guardar punto de restauración o recuperar sesiones anteriores"
          >
            <Save className="w-4 h-4 text-slate-300" />
            <span className="hidden sm:inline">Guardar / Respaldos</span>
          </button>

          {/* Export to Excel */}
          {activeView === 'inventory' && (
            <button
              onClick={onExportExcel}
              disabled={totalItemsCounted === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              title="Exportar inventario contado a Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Excel</span>
            </button>
          )}

          {/* Print / Report */}
          {activeView === 'inventory' && (
            <button
              onClick={onOpenPrint}
              disabled={totalItemsCounted === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              title="Imprimir o generar PDF del inventario"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span className="hidden md:inline">Imprimir</span>
            </button>
          )}

          {/* Reset / Clear */}
          {activeView === 'inventory' && (
            <button
              onClick={onClearCount}
              disabled={totalItemsCounted === 0}
              className="p-1.5 rounded-lg text-xs font-medium bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              title="Limpiar conteo actual"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* User Profile, Admin User Management & Logout */}
          {currentUser && (
            <div className="flex items-center gap-1.5 pl-2 sm:pl-3 border-l border-slate-200">
              
              {/* Admin-only User Management Button */}
              {currentUser.role === 'admin' && (
                <button
                  type="button"
                  onClick={onOpenUserManagement}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-all shadow-2xs"
                  title="Gestionar Usuarios (Crear o Eliminar Cuentas)"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="hidden sm:inline">Usuarios</span>
                </button>
              )}

              {/* User Identity Pill */}
              <div 
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200"
                title={`Sesión iniciada como @${currentUser.username} (${currentUser.role === 'admin' ? 'Administrador' : 'Auditor'})`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                  currentUser.role === 'admin' ? 'bg-indigo-600' : 'bg-slate-700'
                }`}>
                  {currentUser.name ? currentUser.name.slice(0, 1).toUpperCase() : 'U'}
                </div>
                <div className="hidden md:flex flex-col text-left">
                  <span className="text-[11px] font-bold text-slate-800 leading-none">
                    {currentUser.name}
                  </span>
                  <span className="text-[9px] text-slate-400 capitalize leading-none mt-0.5">
                    {currentUser.role === 'admin' ? 'Administrador' : 'Auditor'}
                  </span>
                </div>
              </div>

              {/* Logout Button */}
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all shadow-2xs"
                title="Cerrar sesión"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Salir</span>
              </button>

            </div>
          )}
        </div>

      </div>
    </header>
  );
}
