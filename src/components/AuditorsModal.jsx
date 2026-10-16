import React, { useState } from 'react';
import { Users, X, Check, Wifi, UserCheck } from 'lucide-react';
import { emitSetAuditorName } from '../utils/socket';

export default function AuditorsModal({
  isOpen,
  onClose,
  auditors = [],
  totalUsers = 1,
  currentUserName,
  setCurrentUserName
}) {
  const [nameInput, setNameInput] = useState(currentUserName || '');
  const [serverUrlInput, setServerUrlInput] = useState(() => localStorage.getItem('inventariosapp_server_url') || '');

  if (!isOpen) return null;

  const handleSaveName = (e) => {
    e?.preventDefault();
    if (!nameInput.trim()) return;
    const clean = nameInput.trim();
    setCurrentUserName(clean);
    localStorage.setItem('inventariosapp_auditor_name', clean);
    emitSetAuditorName(clean);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Usuarios en Línea (Tiempo Real)</h3>
              <p className="text-xs text-slate-500">
                {totalUsers} {totalUsers === 1 ? 'dispositivo conectado' : 'dispositivos conectados'} en esta sesión
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          
          {/* Change my name */}
          <form onSubmit={handleSaveName} className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
              Tu Identificador / Nombre de Estación:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Nombre del auditor o estación"
                className="flex-1 px-3.5 py-2 bg-slate-50 text-slate-900 placeholder-slate-400 rounded-xl border border-slate-300 focus:border-slate-800 focus:outline-none text-xs font-medium"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-all shadow-xs"
              >
                Guardar
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Este nombre aparecerá cuando agregues o modifiques productos en las pantallas de tus compañeros.
            </p>
          </form>

          {/* Cloud Server URL */}
          <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs">
            <label className="block text-slate-700 font-semibold uppercase text-[11px]">
              URL del Servidor en Render (Opcional):
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={serverUrlInput}
                onChange={(e) => setServerUrlInput(e.target.value)}
                placeholder="https://inventarioaapp.onrender.com"
                className="flex-1 px-3 py-1.5 bg-slate-50 text-slate-800 placeholder-slate-400 rounded-lg border border-slate-300 text-xs font-mono"
              />
              <button
                type="button"
                onClick={() => {
                  if (serverUrlInput.trim()) {
                    localStorage.setItem('inventariosapp_server_url', serverUrlInput.trim());
                    window.location.reload();
                  } else {
                    localStorage.removeItem('inventariosapp_server_url');
                    window.location.reload();
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs"
              >
                Conectar
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              Conexión directa a tu servidor en la nube en Render.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Sincronización WebSockets bidireccional</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium"
          >
            Listo
          </button>
        </div>

      </div>
    </div>
  );
}
