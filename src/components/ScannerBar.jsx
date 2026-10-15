import React, { useState, useRef, useEffect } from 'react';
import { Barcode, Search, Zap, ListPlus, CornerDownLeft, PlusCircle, Check, AlertCircle, Camera, RotateCcw } from 'lucide-react';
import { findProduct } from '../utils/db';
import { playSuccessBeep, playDoubleBeep, playErrorBeep } from '../utils/sound';

export default function ScannerBar({
  onProductFound,
  onOpenManualSearch,
  onOpenGenericModal,
  onOpenCamScanner,
  scanMode, // 'auto1' | 'askQty'
  setScanMode,
  soundEnabled,
  lastScannedMessage,
  autoReopenCamera = true,
  setAutoReopenCamera
}) {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef(null);

  // Auto focus input on mount only on non-touch desktop devices
  useEffect(() => {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) return; // Don't force focus on mobile to prevent unwanted virtual keyboard popup

    const keepFocus = () => {
      if (document.activeElement?.tagName === 'INPUT' && document.activeElement !== inputRef.current) {
        return;
      }
      inputRef.current?.focus();
    };

    keepFocus();
    window.addEventListener('focus', keepFocus);
    return () => window.removeEventListener('focus', keepFocus);
  }, []);

  const handleScanSubmit = async (e) => {
    e?.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    setIsSearching(true);
    try {
      const product = await findProduct(code);
      if (product) {
        if (soundEnabled) {
          if (scanMode === 'auto1') playSuccessBeep();
          else playDoubleBeep();
        }
        onProductFound(product, scanMode);
        setBarcodeInput('');
      } else {
        if (soundEnabled) playErrorBeep();
        onProductFound(null, scanMode, code);
      }
    } catch (err) {
      console.error('Scan error:', err);
      if (soundEnabled) playErrorBeep();
    } finally {
      setIsSearching(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm shadow-slate-200/50 mt-1 sm:mt-2">
      <div className="max-w-4xl mx-auto space-y-3.5">
        
        {/* 1. HERO SCANNER: Large Barcode Input + Companion Camera Button Next To It */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
          
          {/* Main Barcode Scan Input (Large, Centered, High-Contrast) */}
          <form onSubmit={handleScanSubmit} className="flex-1 relative flex items-center">
            {/* Barcode Icon Badge */}
            <div className="absolute left-3.5 sm:left-4 p-1.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 pointer-events-none flex items-center justify-center">
              <Barcode className="w-6 h-6 sm:w-7 h-7" />
            </div>

            <input
              ref={inputRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Escanea con la pistola lectora o escribe el código de barras..."
              disabled={isSearching}
              autoComplete="off"
              spellCheck="false"
              className="w-full h-14 sm:h-16 pl-14 sm:pl-16 pr-28 sm:pr-32 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 placeholder-slate-400 rounded-2xl border-2 border-slate-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/15 focus:outline-none text-base sm:text-lg font-bold tracking-wide transition-all shadow-2xs"
            />

            {/* Right Buttons inside input: Clear & Buscar */}
            <div className="absolute right-2.5 sm:right-3 flex items-center gap-1.5">
              {barcodeInput && (
                <button
                  type="button"
                  onClick={() => {
                    setBarcodeInput('');
                    inputRef.current?.focus();
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                  title="Limpiar campo"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="submit"
                disabled={!barcodeInput.trim() || isSearching}
                className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white text-xs sm:text-sm font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-xs"
              >
                <span>Buscar</span>
                <CornerDownLeft className="w-3.5 h-3.5 text-slate-300" />
              </button>
            </div>
          </form>

          {/* Camera Scanner Companion Button (Right Next to Barcode Input) */}
          <button
            type="button"
            onClick={onOpenCamScanner}
            className="h-14 sm:h-16 px-5 sm:px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold text-sm sm:text-base shadow-sm shadow-indigo-600/25 flex items-center justify-center gap-2.5 transition-all active:scale-95 shrink-0"
            title="Abrir cámara del dispositivo para escanear códigos"
          >
            <Camera className="w-5 h-5 sm:w-6 h-6 animate-pulse" />
            <span>Cámara</span>
          </button>

        </div>

        {/* 2. OPTIMIZED OPTIONS BAR: Grouped, Clean, Balanced */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-slate-100">
          
          {/* Left Group: Scan Mode Segmented Switcher & Auto-reopen */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Mode Switcher Segmented Control */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setScanMode('askQty')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  scanMode === 'askQty'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Al escanear, solicita ingresar la cantidad contada"
              >
                <ListPlus className={`w-3.5 h-3.5 ${scanMode === 'askQty' ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span>Pedir Cantidad</span>
              </button>

              <button
                type="button"
                onClick={() => setScanMode('auto1')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  scanMode === 'auto1'
                    ? 'bg-white text-amber-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Cada escaneo suma +1 automáticamente sin abrir ventana"
              >
                <Zap className={`w-3.5 h-3.5 ${scanMode === 'auto1' ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} />
                <span>+1 Rápido</span>
              </button>
            </div>

            {/* Auto-reopen Camera Toggle */}
            {setAutoReopenCamera && (
              <button
                type="button"
                onClick={() => setAutoReopenCamera(!autoReopenCamera)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 shadow-2xs ${
                  autoReopenCamera
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:text-slate-800'
                }`}
                title={autoReopenCamera ? 'Reapertura automática de cámara ACTIVADA tras ingresar cantidad' : 'Reapertura automática de cámara DESACTIVADA'}
              >
                <RotateCcw className={`w-3.5 h-3.5 ${autoReopenCamera ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span>Auto-reabrir:</span>
                <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-extrabold uppercase ${
                  autoReopenCamera ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {autoReopenCamera ? 'ON' : 'OFF'}
                </span>
              </button>
            )}

          </div>

          {/* Right Group: Search by Name & Add Generic / New Item */}
          <div className="flex items-center gap-2 ml-auto">
            
            {/* Manual Search Button */}
            <button
              type="button"
              onClick={onOpenManualSearch}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 transition-all shadow-2xs"
              title="Buscar producto por nombre si no tiene código de barra"
            >
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <span>Buscar por Nombre</span>
            </button>

            {/* New / Generic Product Button */}
            <button
              type="button"
              onClick={() => onOpenGenericModal('')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all shadow-2xs active:scale-95"
              title="Registrar un producto genérico o nuevo al vuelo"
            >
              <PlusCircle className="w-3.5 h-3.5 text-indigo-300" />
              <span>+ Genérico / Nuevo</span>
            </button>

          </div>

        </div>

        {/* 3. FEEDBACK BANNER (Scan confirmation, unfound code alert, or session updates) */}
        {lastScannedMessage && (
          <div
            className={`px-3.5 py-2.5 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2 transition-all shadow-2xs animate-in fade-in ${
              lastScannedMessage.type === 'success'
                ? 'bg-emerald-50/80 border border-emerald-200 text-emerald-900 font-semibold'
                : lastScannedMessage.type === 'error'
                ? 'bg-rose-50 border border-rose-200 text-rose-800 font-semibold'
                : 'bg-slate-50 border border-slate-200 text-slate-700 font-medium'
            }`}
          >
            <div className="flex items-center gap-2 truncate font-medium">
              {lastScannedMessage.type === 'success' && <Check className="w-4 h-4 shrink-0 text-emerald-600" />}
              {lastScannedMessage.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />}
              <span className="truncate">{lastScannedMessage.text}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {lastScannedMessage.unfoundCode && (
                <button
                  type="button"
                  onClick={() => onOpenGenericModal(lastScannedMessage.unfoundCode)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold shadow-xs transition-all flex items-center gap-1"
                >
                  <PlusCircle className="w-3 h-3 text-indigo-300" />
                  <span>¿Registrar "{lastScannedMessage.unfoundCode}" ahora?</span>
                </button>
              )}

              {lastScannedMessage.time && (
                <span className="text-[10px] text-slate-400 font-mono font-medium">{lastScannedMessage.time}</span>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
