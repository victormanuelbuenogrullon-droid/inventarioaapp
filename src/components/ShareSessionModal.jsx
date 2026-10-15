import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { 
  Globe, 
  Wifi, 
  Copy, 
  Check, 
  ExternalLink, 
  X, 
  Users, 
  UploadCloud, 
  Loader2, 
  QrCode, 
  AlertCircle,
  Laptop,
  Share2,
  Hash
} from 'lucide-react';
import { fetchNetworkInfo, migrateLocalDataToServer } from '../utils/socket';
import { getAllProductsFromDB } from '../utils/db';

export default function ShareSessionModal({
  isOpen,
  onClose,
  networkUrls = {},
  totalUsers = 1,
  auditors = [],
  sessionName,
  countedItems = [],
  historyLogs = [],
  catalogCount = 0,
  activeSession = null,
  isAdmin = false,
  onSyncSuccess
}) {
  const [activeTab, setActiveTab] = useState('cloud'); // 'cloud' | 'wifi' | 'sync'
  const [tunnelQr, setTunnelQr] = useState('');
  const [wifiQr, setWifiQr] = useState('');
  const [copiedType, setCopiedType] = useState(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrateSuccess, setMigrateSuccess] = useState(null);
  const [migrateError, setMigrateError] = useState(null);
  const [info, setInfo] = useState(networkUrls);

  useEffect(() => {
    if (isOpen) {
      if (!isAdmin && activeTab === 'sync') {
        setActiveTab('cloud');
      }
      setMigrateSuccess(null);
      setMigrateError(null);
      // Fetch latest network info
      fetchNetworkInfo().then((res) => {
        if (res) setInfo(res);
      });
    }
  }, [isOpen, isAdmin, activeTab]);

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const isHostedOnRender = currentOrigin.includes('onrender.com');
  const isHostedOnCloud = isHostedOnRender || (!currentOrigin.includes('localhost') && !currentOrigin.includes('127.0.0.1') && !currentOrigin.startsWith('http://192.168'));
  
  const publicWebUrl = isHostedOnCloud ? currentOrigin : (info?.tunnelUrl || networkUrls?.tunnelUrl || '');
  const wifiUrl = info?.wifiUrl || networkUrls?.wifiUrl || '';

  // Generate QR codes
  useEffect(() => {
    if (publicWebUrl) {
      QRCode.toDataURL(publicWebUrl, { width: 200, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } })
        .then(setTunnelQr)
        .catch(console.warn);
    }
    if (wifiUrl) {
      QRCode.toDataURL(wifiUrl, { width: 200, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } })
        .then(setWifiQr)
        .catch(console.warn);
    }
  }, [publicWebUrl, wifiUrl]);

  if (!isOpen) return null;

  const handleCopy = (url, type) => {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2500);
    });
  };

  const handleCopyWhatsAppInvitation = () => {
    const code = activeSession?.code || '';
    const name = activeSession?.name || sessionName || 'Conteo de Inventario';
    const link = publicWebUrl || currentOrigin;
    const message = `📋 *INVENTARIOS APP - INVITACIÓN AL CONTEO*\n\nHola equipo, para unirse al conteo *"${name}"* en tiempo real:\n\n1. Entren a: ${link}\n2. En la pantalla de inicio, seleccionen *"Auxiliar con Código"*\n3. Ingresen el Código de Sesión: *${code}*\n4. Coloquen su Nombre y presionen *"Unirme al Conteo"*\n\n¡Listo para comenzar a contar! 🚀`;

    navigator.clipboard.writeText(message).then(() => {
      setCopiedType('whatsapp');
      setTimeout(() => setCopiedType(null), 2500);
    });
  };

  const handleMigrateToServer = async () => {
    setIsMigrating(true);
    setMigrateError(null);
    setMigrateSuccess(null);

    try {
      // 1. Get all products from local IndexedDB
      const allLocalCatalog = await getAllProductsFromDB();
      
      // 2. Send counted items and catalog to server
      const result = await migrateLocalDataToServer({
        sessionName: sessionName || 'Pase de Inventario General',
        countedItems: countedItems || [],
        historyLogs: historyLogs || [],
        catalog: allLocalCatalog || []
      });

      setMigrateSuccess(`✅ ¡Datos sincronizados con éxito! ${result.totalCounted || countedItems.length} artículos contados y ${result.catalogCount || allLocalCatalog.length} productos en catálogo subidos al servidor.`);
      if (onSyncSuccess) {
        onSyncSuccess();
      }
    } catch (err) {
      setMigrateError(`Error al sincronizar: ${err.message || 'No se pudo conectar al servidor'}`);
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-800 text-white shadow-xs">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Sincronización y Conexión Multi-PC</h3>
              <p className="text-xs text-slate-500">
                {totalUsers} {totalUsers === 1 ? 'dispositivo conectado' : 'dispositivos conectados en tiempo real'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/50 px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('cloud')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'cloud'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Globe className="w-4 h-4 text-indigo-500" />
            <span>{isHostedOnRender ? 'Enlace Web en Render' : 'Enlace Web en la Nube'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('wifi')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'wifi'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Wifi className="w-4 h-4 text-emerald-500" />
            <span>Red Local Wi-Fi</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('sync')}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all ${
                activeTab === 'sync'
                  ? 'border-amber-600 text-amber-700 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <UploadCloud className="w-4 h-4 text-amber-500" />
              <span>Publicar Datos Locales</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">

          {/* Session Code Card for Auxiliaries */}
          {activeSession?.code && (
            <div className="bg-gradient-to-r from-indigo-50 to-slate-50 border-2 border-indigo-200 rounded-2xl p-4 text-xs shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5" />
                    Código de Sesión para tus Auxiliares
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-2xl font-mono font-black text-indigo-700 tracking-wider">
                      {activeSession.code}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      • "{activeSession.name || sessionName}"
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(activeSession.code, 'sessionCode')}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors"
                  >
                    {copiedType === 'sessionCode' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedType === 'sessionCode' ? '¡Código Copiado!' : 'Copiar Código'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyWhatsAppInvitation}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors"
                    title="Copiar invitación completa para enviar por WhatsApp"
                  >
                    {copiedType === 'whatsapp' ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                    <span>{copiedType === 'whatsapp' ? '¡Invitación Copiada!' : 'Copiar para WhatsApp'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: CLOUDFLARE PUBLIC TUNNEL OR RENDER HOSTED URL */}
          {activeTab === 'cloud' && (
            <div className="space-y-4">
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3.5 text-xs text-indigo-900">
                <p className="font-semibold flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-indigo-600 shrink-0" />
                  {isHostedOnRender ? 'Servidor activo en Render con sincronización en vivo' : 'Acceso desde cualquier computadora o celular en el mundo'}
                </p>
                <p className="text-indigo-700 text-[11px] mt-1">
                  Abre este enlace en la otra PC o escanea el QR con tu teléfono móvil. Toda persona conectada verá los mismos productos e inventario en tiempo real.
                </p>
              </div>

              {publicWebUrl ? (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    {tunnelQr && (
                      <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-xs shrink-0">
                        <img src={tunnelQr} alt="Código QR Enlace Web" className="w-32 h-32" />
                      </div>
                    )}
                    <div className="space-y-2 flex-1 w-full">
                      <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        Enlace HTTPS Compartido:
                      </label>
                      <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-mono break-all text-indigo-700 select-all font-semibold">
                        {publicWebUrl}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleCopy(publicWebUrl, 'publicWeb')}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                        >
                          {copiedType === 'publicWeb' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          <span>{copiedType === 'publicWeb' ? '¡Enlace Copiado!' : 'Copiar Enlace'}</span>
                        </button>
                        <a
                          href={publicWebUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>Abrir</span>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center space-y-3 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700">Detectando enlace del servidor...</p>
                  <p className="text-[11px] text-slate-500">
                    Si estás ejecutando el servidor localmente, el túnel estará listo en unos segundos. También puedes usar la pestaña <strong>Red Local Wi-Fi</strong>.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LOCAL WIFI */}
          {activeTab === 'wifi' && (
            <div className="space-y-4">
              <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3.5 text-xs text-emerald-900">
                <p className="font-semibold flex items-center gap-1.5">
                  <Wifi className="w-4 h-4 text-emerald-600 shrink-0" />
                  Conexión directa en la red local de la empresa / almacén
                </p>
                <p className="text-emerald-700 text-[11px] mt-1">
                  Ambos dispositivos deben estar conectados al mismo Wi-Fi o router. Funciona ultra rápido y sin necesidad de internet exterior.
                </p>
              </div>

              {wifiUrl ? (
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  {wifiQr && (
                    <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-xs shrink-0">
                      <img src={wifiQr} alt="Código QR Wi-Fi" className="w-32 h-32" />
                    </div>
                  )}
                  <div className="space-y-2 flex-1 w-full">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Dirección IP en Red Wi-Fi:
                    </label>
                    <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-mono break-all text-emerald-700 select-all font-semibold">
                      {wifiUrl}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleCopy(wifiUrl, 'wifi')}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                      >
                        {copiedType === 'wifi' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        <span>{copiedType === 'wifi' ? '¡Dirección Copiada!' : 'Copiar Dirección'}</span>
                      </button>
                      <a
                        href={wifiUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Abrir</span>
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 text-center py-4">No se detectó dirección IP local.</p>
              )}
            </div>
          )}

          {/* TAB 3: MIGRATE / UPLOAD LOCAL DATA TO SERVER */}
          {isAdmin && activeTab === 'sync' && (
            <div className="space-y-4">
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-2">
                <p className="font-bold flex items-center gap-1.5 text-amber-950">
                  <UploadCloud className="w-4 h-4 text-amber-600 shrink-0" />
                  Subir mis datos de este navegador al Servidor Compartido
                </p>
                <p className="text-amber-800 leading-relaxed text-[11px]">
                  Si cargaste el catálogo o hiciste conteos en esta computadora y en la otra PC no aparecen, haz clic en el botón de abajo.
                  Esto enviará todos tus datos al servidor central para que <strong>todas las demás PCs y teléfonos los descarguen de inmediato</strong>.
                </p>
                <div className="pt-2 flex flex-wrap gap-4 text-[11px] font-semibold text-slate-700 border-t border-amber-200/60">
                  <span>📦 Catálogo en este navegador: <strong>{catalogCount.toLocaleString()}</strong> productos</span>
                  <span>📝 Conteo en este navegador: <strong>{countedItems.length}</strong> productos</span>
                </div>
              </div>

              {migrateSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{migrateSuccess}</span>
                </div>
              )}

              {migrateError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{migrateError}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleMigrateToServer}
                disabled={isMigrating}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
              >
                {isMigrating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sincronizando datos con el servidor compartido...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    <span>📤 Publicar mis datos locales al Servidor Compartido</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Active users footer */}
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-slate-400" />
              <span>
                {totalUsers} {totalUsers === 1 ? 'dispositivo conectado en vivo' : 'dispositivos conectados en vivo'}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
            >
              Cerrar
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
