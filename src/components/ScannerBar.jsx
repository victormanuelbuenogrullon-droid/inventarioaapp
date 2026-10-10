import React, { useState, useRef, useEffect } from 'react';
import { Barcode, Search, Zap, ListPlus, CornerDownLeft, PlusCircle, Check, AlertCircle } from 'lucide-react';
import { findProduct } from '../utils/db';
import { playSuccessBeep, playDoubleBeep, playErrorBeep } from '../utils/sound';

export default function ScannerBar({
  onProductFound,
  onOpenManualSearch,
  onOpenGenericModal,
  scanMode, // 'auto1' | 'askQty'
  setScanMode,
  soundEnabled,
  lastScannedMessage
}) {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef(null);

  // Auto focus input on mount and whenever user clicks outside
  useEffect(() => {
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
    <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-sm">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
        
        {/* Main Barcode Scan Input */}
        <form onSubmit={handleScanSubmit} className="flex-1 relative flex items-center">
          <div className="absolute left-3.5 text-slate-400 pointer-events-none flex items-center gap-1.5">
            <Barcode className="w-5 h-5" />
          </div>

          <input
            ref={inputRef}
            type="text"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            placeholder="Pasa la pistola lectora o escribe el código de barra / SKU..."
            disabled={isSearching}
            autoComplete="off"
            spellCheck="false"
            className="w-full pl-11 pr-24 py-3 bg-slate-50 text-slate-900 placeholder-slate-400 rounded-xl border border-slate-300 focus:border-slate-600 focus:ring-2 focus:ring-slate-200 focus:outline-none text-sm sm:text-base font-medium transition-all"
          />

          <div className="absolute right-2 flex items-center gap-1.5">
            {barcodeInput && (
              <button
                type="button"
                onClick={() => setBarcodeInput('')}
                className="text-xs text-slate-500 hover:text-slate-800 px-1.5 py-1 rounded bg-slate-200"
              >
                Limpiar
              </button>
            )}
            <button
              type="submit"
              disabled={!barcodeInput.trim() || isSearching}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              <span>Buscar</span>
              <CornerDownLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>

        {/* Scan Mode Toggle & Buttons */}
        <div className="flex flex-wrap items-center gap-2 justify-between lg:justify-end">
          
          {/* Mode Switcher */}
          <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setScanMode('askQty')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                scanMode === 'askQty'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Al escanear, solicita ingresar la cantidad contada"
            >
              <ListPlus className="w-3.5 h-3.5 text-slate-500" />
              <span>Pedir Cantidad</span>
            </button>

            <button
              type="button"
              onClick={() => setScanMode('auto1')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                scanMode === 'auto1'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Cada escaneo suma +1 automáticamente"
            >
              <Zap className="w-3.5 h-3.5 text-slate-500" />
              <span>+1 Rápido</span>
            </button>
          </div>

          {/* Manual Search Button */}
          <button
            type="button"
            onClick={onOpenManualSearch}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-all shadow-sm"
            title="Buscar producto por nombre si no tiene código de barra"
          >
            <Search className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Buscar Nombre</span>
          </button>

          {/* New / Generic Product Button */}
          <button
            type="button"
            onClick={() => onOpenGenericModal('')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-all shadow-sm"
            title="Registrar un producto genérico o nuevo al vuelo"
          >
            <PlusCircle className="w-3.5 h-3.5 text-slate-300" />
            <span>+ Genérico / Nuevo</span>
          </button>

        </div>

      </div>

      {/* Feedback banner (Last scanned action or Unfound code alert) */}
      {lastScannedMessage && (
        <div
          className={`mt-2.5 px-3.5 py-2 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2 transition-all ${
            lastScannedMessage.type === 'success'
              ? 'bg-slate-100 border border-slate-200 text-slate-800'
              : lastScannedMessage.type === 'error'
              ? 'bg-rose-50 border border-rose-200 text-rose-800'
              : 'bg-slate-100 border border-slate-200 text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2 truncate font-medium">
            {lastScannedMessage.type === 'success' && <Check className="w-4 h-4 shrink-0 text-emerald-600" />}
            {lastScannedMessage.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />}
            <span>{lastScannedMessage.text}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {lastScannedMessage.unfoundCode && (
              <button
                type="button"
                onClick={() => onOpenGenericModal(lastScannedMessage.unfoundCode)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-semibold shadow-sm transition-all flex items-center gap-1"
              >
                <PlusCircle className="w-3 h-3" />
                <span>¿Registrar "{lastScannedMessage.unfoundCode}" ahora?</span>
              </button>
            )}

            {lastScannedMessage.time && (
              <span className="text-[10px] text-slate-400">{lastScannedMessage.time}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
