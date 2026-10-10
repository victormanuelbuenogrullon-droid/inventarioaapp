import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export default function ClearConfirmModal({
  isOpen,
  onClose,
  onConfirmClear,
  totalItems
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-xl overflow-hidden p-6 space-y-4 animate-in zoom-in-95 duration-150">
        
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <div className="text-center space-y-1">
          <h3 className="text-base font-bold text-slate-900">¿Reiniciar listado de conteo?</h3>
          <p className="text-xs text-slate-500">
            Estás a punto de borrar los <strong className="text-rose-600 font-bold">{totalItems} productos contados</strong> de esta sesión. Esta acción no se puede deshacer.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all border border-slate-200"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              onConfirmClear();
              onClose();
            }}
            className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Sí, limpiar todo</span>
          </button>
        </div>

      </div>
    </div>
  );
}
