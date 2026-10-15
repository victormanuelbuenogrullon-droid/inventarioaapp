import React, { useState, useEffect, useRef } from 'react';
import { 
  Save, 
  FolderOpen, 
  Trash2, 
  Download, 
  UploadCloud, 
  X, 
  Check, 
  Clock,
  Hash,
  Cloud,
  Laptop
} from 'lucide-react';
import { 
  saveSessionToDB, 
  getAllSessionsFromDB, 
  deleteSessionFromDB, 
  downloadBackupJsonFile 
} from '../utils/db';
import {
  fetchSessionBackupsApi,
  createSessionBackupApi,
  restoreSessionBackupApi,
  deleteSessionBackupApi
} from '../utils/socket';
import { formatCurrency, formatNumber } from '../utils/export';

export default function SessionManagerModal({
  isOpen,
  onClose,
  currentItems,
  currentSessionName,
  activeSession,
  onLoadSession
}) {
  const [activeTab, setActiveTab] = useState('save');
  const [saveName, setSaveName] = useState('');
  const [saveNote, setSaveNote] = useState('');
  const [alsoDownloadJson, setAlsoDownloadJson] = useState(false);
  const [savedSessions, setSavedSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const fileInputRef = useRef(null);

  const sessionCode = activeSession?.code || '';

  useEffect(() => {
    if (isOpen) {
      setSaveName(currentSessionName || (sessionCode ? `Inventario ${sessionCode}` : `Inventario - ${new Date().toLocaleDateString('es-DO')}`));
      setSaveNote('');
      setSuccessMessage(null);
      loadSavedSessions();
    }
  }, [isOpen, currentSessionName, sessionCode]);

  const loadSavedSessions = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch server backups for this session
      let serverBackups = [];
      if (sessionCode) {
        try {
          serverBackups = await fetchSessionBackupsApi(sessionCode);
        } catch (e) {
          console.warn('Could not fetch session backups from server:', e);
        }
      }

      // 2. Fetch local backups for this session
      const localBackups = await getAllSessionsFromDB(sessionCode);

      // 3. Merge server and local backups
      const mergedMap = new Map();
      serverBackups.forEach((b) => mergedMap.set(b.id, { ...b, source: 'server' }));
      localBackups.forEach((b) => {
        if (!mergedMap.has(b.id)) {
          mergedMap.set(b.id, { ...b, source: 'local' });
        }
      });

      const combined = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.savedAt) - new Date(a.savedAt)
      );

      setSavedSessions(combined);
    } catch (err) {
      console.error('Error loading session backups:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const totalSkus = currentItems.length;
  const { totalUnits, totalCostInvestment, totalRetailPrice } = currentItems.reduce(
    (acc, item) => {
      const qty = Number(item.cantidadContada) || 0;
      const cost = Number(item.costo) || 0;
      const price = Number(item.precio) || 0;
      acc.totalUnits += qty;
      acc.totalCostInvestment += qty * cost;
      acc.totalRetailPrice += qty * price;
      return acc;
    },
    { totalUnits: 0, totalCostInvestment: 0, totalRetailPrice: 0 }
  );

  const handleSaveCurrentSession = async (e) => {
    e?.preventDefault();
    const finalName = saveName.trim() || `Inventario ${sessionCode ? sessionCode + ' ' : ''}- ${new Date().toLocaleString('es-DO')}`;
    const sessionId = `bk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const sessionPayload = {
      id: sessionId,
      sessionCode,
      name: finalName,
      note: saveNote.trim(),
      items: currentItems,
      totalSkus,
      totalUnits,
      totalCostInvestment,
      totalRetailPrice,
      savedAt: new Date().toISOString()
    };

    try {
      // Save locally
      await saveSessionToDB(sessionPayload);

      // Save to server session if code is available
      if (sessionCode) {
        try {
          await createSessionBackupApi(sessionCode, sessionPayload);
        } catch (serverErr) {
          console.warn('Error saving session backup on server:', serverErr);
        }
      }

      if (alsoDownloadJson) {
        downloadBackupJsonFile(sessionPayload);
      }
      setSuccessMessage(`✅ Respaldo "${finalName}" guardado para la sesión ${sessionCode || 'actual'}.`);
      await loadSavedSessions();
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err) {
      console.error('Save error:', err);
      alert('Error al guardar el respaldo: ' + err.message);
    }
  };

  const handleRestoreSession = async (session) => {
    const confirm = window.confirm(
      `¿Deseas restaurar el respaldo "${session.name}" en la sesión "${sessionCode || 'actual'}"?\n\nEsto reemplazará el listado de este conteo con los ${session.items?.length || 0} productos guardados.`
    );
    if (!confirm) return;

    try {
      if (sessionCode && session.source === 'server') {
        try {
          await restoreSessionBackupApi(sessionCode, session.id);
        } catch (serverErr) {
          console.warn('Error al restaurar respaldo en servidor:', serverErr);
        }
      }
      onLoadSession(session.items || [], session.name);
      onClose();
    } catch (err) {
      alert('Error restaurando respaldo: ' + err.message);
    }
  };

  const handleDeleteSession = async (sessionId, name) => {
    const confirm = window.confirm(`¿Seguro que deseas eliminar el respaldo "${name}" de la sesión ${sessionCode || 'actual'}?`);
    if (!confirm) return;

    try {
      if (sessionCode) {
        try {
          await deleteSessionBackupApi(sessionCode, sessionId);
        } catch (err) {
          console.warn('Error eliminando en servidor:', err);
        }
      }
      await deleteSessionFromDB(sessionId);
      await loadSavedSessions();
    } catch (err) {
      console.error('Delete session error:', err);
    }
  };

  const handleImportJsonFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!parsed.items || !Array.isArray(parsed.items)) {
          throw new Error('El archivo no contiene un formato válido de respaldo de inventario.');
        }

        const confirm = window.confirm(
          `Se encontró el respaldo "${parsed.name || file.name}" con ${parsed.items.length} productos contados. ¿Deseas cargarlo en la sesión ${sessionCode || 'actual'}?`
        );
        if (confirm) {
          const newId = `bk_imported_${Date.now()}`;
          const importedPayload = {
            ...parsed,
            id: newId,
            sessionCode,
            savedAt: new Date().toISOString()
          };
          await saveSessionToDB(importedPayload);
          if (sessionCode) {
            try {
              await createSessionBackupApi(sessionCode, importedPayload);
            } catch (err) {
              console.warn('Could not save imported backup to server:', err);
            }
          }
          onLoadSession(parsed.items, parsed.name || 'Inventario Restaurado');
          onClose();
        }
      } catch (err) {
        alert('Error al leer el archivo JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-800 text-white shadow-xs">
              <Save className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Respaldos de la Sesión</h3>
                {sessionCode && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-xs">
                    <Hash className="w-3 h-3 text-indigo-500" />
                    <span>{sessionCode}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {sessionCode 
                  ? `Puntos de restauración independientes y exclusivos de la sesión "${activeSession?.name || currentSessionName}"`
                  : 'Guarda puntos de restauración de tu trabajo para recuperarlos cuando quieras'}
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

        {/* Tab Switcher */}
        <div className="px-6 pt-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('save')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'save'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Save className="w-4 h-4" />
            <span>Guardar en esta Sesión</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'history'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>Respaldos Guardados ({savedSessions.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* TAB 1: GUARDAR SESION */}
          {activeTab === 'save' && (
            <form onSubmit={handleSaveCurrentSession} className="space-y-4">
              
              {/* Stats Preview */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-3 gap-3 text-center">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">SKUs Contados:</span>
                  <p className="text-base font-bold text-slate-900">{formatNumber(totalSkus)}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Total Unidades:</span>
                  <p className="text-base font-bold text-slate-900">{formatNumber(totalUnits)}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Inversión Total:</span>
                  <p className="text-base font-bold text-emerald-800">{formatCurrency(totalCostInvestment)}</p>
                </div>
              </div>

              {/* Name input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Nombre del Respaldo / Sesión:
                </label>
                <input
                  type="text"
                  required
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Ej: Pasillo 1 - Lácteos / Conteo Octubre"
                  className="w-full px-3.5 py-2.5 bg-slate-50 text-slate-900 placeholder-slate-400 rounded-xl border border-slate-300 focus:border-slate-800 focus:outline-none text-xs font-semibold"
                />
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Nota u Observación (Opcional):
                </label>
                <input
                  type="text"
                  value={saveNote}
                  onChange={(e) => setSaveNote(e.target.value)}
                  placeholder="Ej: Conteo parcial hasta la sección de harinas"
                  className="w-full px-3.5 py-2.5 bg-slate-50 text-slate-800 placeholder-slate-400 rounded-xl border border-slate-300 focus:border-slate-800 focus:outline-none text-xs"
                />
              </div>

              {/* Checkbox */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer text-xs text-slate-700 hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={alsoDownloadJson}
                  onChange={(e) => setAlsoDownloadJson(e.target.checked)}
                  className="w-4 h-4 rounded text-slate-800 focus:ring-slate-500 border-slate-300"
                />
                <div>
                  <span className="font-semibold text-slate-900 block">
                    Descargar también una copia en archivo de seguridad (.json)
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    Guarda el archivo directamente en tu carpeta de descargas.
                  </span>
                </div>
              </label>

              {successMessage && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Save Button */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={totalSkus === 0}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar Respaldo Ahora</span>
                </button>
              </div>

            </form>
          )}

          {/* TAB 2: HISTORIAL Y RECUPERAR */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              
              {/* Import from JSON */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="font-semibold text-slate-800 block">¿Tienes un archivo de respaldo (.json)?</span>
                  <span className="text-slate-500 text-[11px]">Restaura cualquier inventario descargado previamente</span>
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleImportJsonFile}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 flex items-center gap-1.5 transition-all text-xs shadow-xs"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-slate-500" />
                    <span>Cargar archivo .json</span>
                  </button>
                </div>
              </div>

              {/* List */}
              {savedSessions.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                  <FolderOpen className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-60" />
                  <p className="font-semibold text-slate-600">
                    No hay respaldos guardados para la sesión {sessionCode || 'actual'}.
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Crea un punto de restauración en la pestaña anterior para guardar una copia de este inventario.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {savedSessions.map((sess) => (
                    <div
                      key={sess.id}
                      className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-slate-900 text-sm">{sess.name}</h4>
                          
                          {sess.sessionCode && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-extrabold flex items-center gap-0.5">
                              <Hash className="w-2.5 h-2.5 text-indigo-500" />
                              {sess.sessionCode}
                            </span>
                          )}

                          {sess.source === 'server' ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold flex items-center gap-1" title="Sincronizado en el servidor compartido">
                              <Cloud className="w-2.5 h-2.5 text-emerald-600" />
                              Nube
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-semibold flex items-center gap-1" title="Guardado en este navegador">
                              <Laptop className="w-2.5 h-2.5 text-slate-500" />
                              Local
                            </span>
                          )}

                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-slate-500 border border-slate-200 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {new Date(sess.savedAt).toLocaleString('es-DO')}
                          </span>

                          {sess.savedBy && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              por {sess.savedBy}
                            </span>
                          )}
                        </div>
                        
                        {sess.note && (
                          <p className="text-xs text-slate-500 mt-1 italic">"{sess.note}"</p>
                        )}

                        <div className="flex items-center gap-3 mt-1.5 text-xs">
                          <span className="text-slate-600">
                            <strong>{formatNumber(sess.totalSkus || sess.items?.length || 0)}</strong> SKUs
                          </span>
                          <span className="text-slate-600">
                            <strong>{formatNumber(sess.totalUnits || 0)}</strong> Unidades
                          </span>
                          <span className="text-emerald-800 font-bold">
                            {formatCurrency(sess.totalCostInvestment || 0)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => downloadBackupJsonFile(sess)}
                          className="p-2 rounded-lg bg-white hover:bg-slate-200 text-slate-600 transition-colors border border-slate-200"
                          title="Descargar archivo .json a tu computadora"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleRestoreSession(sess)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs shadow-xs transition-all flex items-center gap-1.5"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          <span>Recuperar</span>
                        </button>

                        <button
                          onClick={() => handleDeleteSession(sess.id, sess.name)}
                          className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors border border-rose-200"
                          title="Eliminar este respaldo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                    </div>
                  ))}
                </div>
              )}

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Los respaldos están aislados por sesión y se sincronizan de forma segura.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
