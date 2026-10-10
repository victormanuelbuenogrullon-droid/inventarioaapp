import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { 
  Camera, 
  X, 
  Zap, 
  ZapOff, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ListPlus, 
  Volume2, 
  VolumeX,
  Sparkles,
  RotateCcw
} from 'lucide-react';
import { findProduct } from '../utils/db';
import { playSuccessBeep, playDoubleBeep, playErrorBeep } from '../utils/sound';

export default function CameraScannerModal({
  isOpen,
  onClose,
  onProductFound,
  onOpenGenericModal,
  scanMode, // 'auto1' | 'askQty'
  setScanMode,
  soundEnabled,
  setSoundEnabled,
  autoReopenCamera = true,
  setAutoReopenCamera
}) {
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(() => {
    return localStorage.getItem('inventariosapp_preferred_cam_id') || null;
  });
  const [isScanning, setIsScanning] = useState(false);
  const [torchOn, setTorchOn] = useState(() => {
    return localStorage.getItem('inventariosapp_torch_enabled') === 'true';
  });
  const [hasTorch, setHasTorch] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [recentScan, setRecentScan] = useState(null);

  const scannerRef = useRef(null);
  const lastScannedCodeRef = useRef({ code: '', time: 0 });
  const isProcessingRef = useRef(false);

  // Vibrate phone on scan if supported
  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(80);
      } catch (e) {
        // Ignore vibration errors
      }
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setRecentScan(null);
      setErrorMessage(null);
      return;
    }

    let isMounted = true;

    async function initCamera() {
      try {
        setErrorMessage(null);
        // Get list of cameras
        const devices = await Html5Qrcode.getCameras();
        if (!isMounted) return;

        if (!devices || devices.length === 0) {
          throw new Error('No se detectó ninguna cámara en este dispositivo.');
        }

        setCameras(devices);

        // Check if there is a saved preferred camera ID that still exists
        const savedCamId = localStorage.getItem('inventariosapp_preferred_cam_id');
        const matchedSaved = devices.find(d => d.id === savedCamId);

        // Otherwise find back/environment camera
        const backCam = devices.find(d => 
          /back|rear|environment|trasera|posterior/i.test(d.label)
        );

        const targetCamId = matchedSaved 
          ? matchedSaved.id 
          : (backCam ? backCam.id : devices[devices.length - 1].id);

        setSelectedCameraId(targetCamId);
        localStorage.setItem('inventariosapp_preferred_cam_id', targetCamId);

        startScanner(targetCamId);
      } catch (err) {
        console.error('Error inicializando cámara:', err);
        if (isMounted) {
          setErrorMessage(err.message || 'Error al acceder a la cámara. Revisa los permisos de tu navegador.');
        }
      }
    }

    initCamera();

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [isOpen]);

  const startScanner = async (cameraId) => {
    try {
      if (scannerRef.current) {
        await stopCamera();
      }

      const html5QrCode = new Html5Qrcode('camera-scanner-view');
      scannerRef.current = html5QrCode;

      const formats = [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.CODE_93,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.CODABAR,
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.DATA_MATRIX
      ];

      const config = {
        fps: 15,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const width = Math.min(Math.floor(minEdge * 0.88), 340);
          const height = Math.min(Math.floor(minEdge * 0.55), 200);
          return { width: Math.max(width, 220), height: Math.max(height, 140) };
        },
        aspectRatio: 1.333333,
        formatsToSupport: formats,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      };

      await html5QrCode.start(
        cameraId ? { deviceId: { exact: cameraId } } : { facingMode: 'environment' },
        config,
        onScanSuccess,
        onScanFailure
      );

      setIsScanning(true);

      // Check if camera supports torch and restore saved torch state
      try {
        const capabilities = html5QrCode.getRunningTrackCapabilities?.();
        if (capabilities && capabilities.torch) {
          setHasTorch(true);
          const savedTorch = localStorage.getItem('inventariosapp_torch_enabled') === 'true';
          if (savedTorch) {
            await html5QrCode.applyVideoConstraints({
              advanced: [{ torch: true }]
            });
            setTorchOn(true);
          }
        } else {
          setHasTorch(false);
        }
      } catch (e) {
        console.warn('Torch feature check warning:', e);
        setHasTorch(false);
      }
    } catch (err) {
      console.error('Error al iniciar escáner de cámara:', err);
      setErrorMessage(
        'No se pudo abrir el visor de la cámara. Verifica que diste permiso para usar la cámara en tu navegador.'
      );
      setIsScanning(false);
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.warn('Error al detener cámara:', err);
      } finally {
        scannerRef.current = null;
        setIsScanning(false);
      }
    }
  };

  const handleToggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const newStatus = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: newStatus }]
      });
      setTorchOn(newStatus);
      localStorage.setItem('inventariosapp_torch_enabled', newStatus ? 'true' : 'false');
    } catch (err) {
      console.warn('Error activando linterna:', err);
    }
  };

  const handleSwitchCamera = () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex(c => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCam = cameras[nextIndex];
    setSelectedCameraId(nextCam.id);
    localStorage.setItem('inventariosapp_preferred_cam_id', nextCam.id);
    startScanner(nextCam.id);
  };

  const onScanSuccess = async (decodedText) => {
    const code = (decodedText || '').trim();
    if (!code) return;

    const now = Date.now();
    // Debounce duplicate scans within 1.8 seconds
    if (
      lastScannedCodeRef.current.code === code &&
      now - lastScannedCodeRef.current.time < 1800
    ) {
      return;
    }

    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    lastScannedCodeRef.current = { code, time: now };

    triggerHaptic();

    try {
      const product = await findProduct(code);

      if (product) {
        if (soundEnabled) {
          if (scanMode === 'auto1') playSuccessBeep();
          else playDoubleBeep();
        }

        setRecentScan({
          found: true,
          product,
          code,
          time: new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });

        // Pass isFromCamera = true so App knows to trigger auto-reopen if configured
        onProductFound(product, scanMode, code, true);

        if (scanMode === 'askQty') {
          // In "Pedir Cantidad" mode, close the camera modal so QuantityModal can open smoothly
          setTimeout(() => {
            onClose();
          }, 200);
        }
      } else {
        if (soundEnabled) playErrorBeep();

        setRecentScan({
          found: false,
          code,
          time: new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });

        onProductFound(null, scanMode, code, true);
      }
    } catch (err) {
      console.error('Error buscando código escaneado por cámara:', err);
    } finally {
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 400);
    }
  };

  const onScanFailure = () => {
    // Normal frame scanning cycle
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-800 text-indigo-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Escáner de Cámara</span>
                {torchOn && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-0.5">
                    <Zap className="w-2.5 h-2.5 fill-current" />
                    Flash ON
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400">
                Apunta al código de barras del producto
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Viewport Container */}
        <div className="relative bg-black flex-1 min-h-[300px] flex items-center justify-center overflow-hidden">
          
          {/* HTML5 QRCODE Video Container */}
          <div id="camera-scanner-view" className="w-full h-full min-h-[300px]" />

          {/* Visual Scan Reticle Overlay (Laser & Corners) */}
          {isScanning && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
              <div className="relative w-64 sm:w-72 h-40 rounded-2xl border-2 border-indigo-400/80 shadow-[0_0_20px_rgba(99,102,241,0.3)] flex items-center justify-center overflow-hidden">
                {/* Laser animation line */}
                <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-rose-500 to-transparent shadow-[0_0_12px_#f43f5e] animate-[scan_2s_ease-in-out_infinite]" />
                
                {/* Corner markers */}
                <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-white rounded-tl-sm" />
                <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-white rounded-tr-sm" />
                <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-white rounded-bl-sm" />
                <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-white rounded-br-sm" />

                <span className="text-[10px] text-white/70 bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-xs">
                  Centra el código aquí
                </span>
              </div>
            </div>
          )}

          {/* Error display */}
          {errorMessage && (
            <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-6 text-center z-20">
              <AlertCircle className="w-10 h-10 text-rose-500 mb-2" />
              <h4 className="text-sm font-bold text-white mb-1">Permiso o Cámara no disponible</h4>
              <p className="text-xs text-slate-300 max-w-xs mb-4">{errorMessage}</p>
              <button
                onClick={() => startScanner(selectedCameraId)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reintentar
              </button>
            </div>
          )}

          {/* Quick Floating Camera Controls (Torch, Switch Camera) */}
          <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
            {/* Torch / Flashlight Toggle */}
            {hasTorch && (
              <button
                type="button"
                onClick={handleToggleTorch}
                className={`p-2.5 rounded-xl backdrop-blur-md border transition-all ${
                  torchOn
                    ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.5)]'
                    : 'bg-black/60 text-white border-white/20 hover:bg-black/80'
                }`}
                title={torchOn ? 'Apagar linterna (se recordará apagada)' : 'Encender linterna (se mantendrá encendida)'}
              >
                {torchOn ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4" />}
              </button>
            )}

            {/* Switch Camera */}
            {cameras.length > 1 && (
              <button
                type="button"
                onClick={handleSwitchCamera}
                className="p-2.5 rounded-xl bg-black/60 text-white border border-white/20 hover:bg-black/80 backdrop-blur-md transition-all"
                title="Cambiar cámara (se guardará tu selección)"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>

        </div>

        {/* Live Scan Feedback Drawer */}
        {recentScan && (
          <div className={`p-3 border-t text-xs transition-all ${
            recentScan.found
              ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-200'
              : 'bg-rose-950/40 border-rose-800/50 text-rose-200'
          }`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 truncate">
                {recentScan.found ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  {recentScan.found ? (
                    <div>
                      <p className="font-bold text-white text-xs sm:text-sm leading-snug break-words">{recentScan.product.descripcion}</p>
                      <p className="text-[10px] text-emerald-300/80 mt-0.5">Código: {recentScan.code} • ¡Detectado con éxito!</p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-bold text-rose-300">Código no encontrado: {recentScan.code}</p>
                    </div>
                  )}
                </div>
              </div>

              {!recentScan.found && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenGenericModal(recentScan.code);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white text-slate-900 text-[11px] font-bold shrink-0 hover:bg-slate-100"
                >
                  Registrar
                </button>
              )}
            </div>
          </div>
        )}

        {/* Bottom Modal Footer & Mode Controls */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3">
          
          {/* Scan Mode Switcher */}
          <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setScanMode('auto1')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg font-semibold transition-all ${
                scanMode === 'auto1'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>+1 Rápido</span>
            </button>

            <button
              type="button"
              onClick={() => setScanMode('askQty')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg font-semibold transition-all ${
                scanMode === 'askQty'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ListPlus className="w-3.5 h-3.5" />
              <span>Pedir Cantidad</span>
            </button>
          </div>

          {/* Auto-reopen toggle option */}
          {setAutoReopenCamera && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <RotateCcw className={`w-3.5 h-3.5 ${autoReopenCamera ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span>Reabrir cámara tras ingresar cantidad</span>
              </div>
              <button
                type="button"
                onClick={() => setAutoReopenCamera(!autoReopenCamera)}
                className={`px-2.5 py-1 rounded-lg font-bold text-[10px] transition-all uppercase ${
                  autoReopenCamera
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {autoReopenCamera ? 'Activado' : 'Desactivado'}
              </button>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            {/* Sound toggle button */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors"
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
              <span>{soundEnabled ? 'Sonido ON' : 'Sonido OFF'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors"
            >
              Cerrar Cámara
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
