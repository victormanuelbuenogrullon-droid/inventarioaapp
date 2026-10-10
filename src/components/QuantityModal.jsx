import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Package } from 'lucide-react';
import { formatCurrency } from '../utils/export';

export default function QuantityModal({
  isOpen,
  product,
  currentCount = 0,
  isEditing = false,
  onConfirm,
  onClose
}) {
  const [quantity, setQuantity] = useState('1');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && product) {
      if (isEditing) {
        setQuantity(currentCount > 0 ? currentCount.toString() : '1');
      } else {
        setQuantity('1');
      }
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, product, isEditing, currentCount]);

  if (!isOpen || !product) return null;

  const numQty = parseFloat(quantity) || 0;
  const unitCost = Number(product.costo) || 0;
  const unitPrice = Number(product.precio) || 0;

  const totalCost = numQty * unitCost;
  const totalPrice = numQty * unitPrice;

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (numQty <= 0) return;
    onConfirm(product, numQty, isEditing);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const setExactPreset = (val) => {
    setQuantity(val.toString());
    inputRef.current?.focus();
  };

  return (
    <div
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                {isEditing ? 'Modificar Conteo' : 'Ingresar Cantidad Contada'}
              </span>
              <h3 className="text-base font-bold text-slate-900 leading-tight truncate max-w-[320px]">
                {product.descripcion}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Details Bar */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 text-xs flex flex-wrap items-center justify-between gap-2 text-slate-600">
          <div>
            <span className="text-slate-400">Código / Barra:</span>{' '}
            <span className="font-mono font-semibold text-slate-800">
              {product.codigoInternacional || product.codigoInterno || product.codigo}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div>
              <span className="text-slate-400">Unidad:</span>{' '}
              <span className="font-semibold text-slate-800">{product.unidad || 'UNIDAD'}</span>
            </div>
            {product.categoria && (
              <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[11px]">
                {product.categoria}
              </span>
            )}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          {/* Quantity Input with Clean Border */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Cantidad Física Contada:
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type="number"
                step="any"
                min="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                className="w-full text-center py-3 bg-slate-50 text-slate-900 text-3xl font-extrabold rounded-xl border border-slate-300 focus:border-slate-800 focus:ring-2 focus:ring-slate-200 focus:outline-none tracking-wider"
              />
            </div>
          </div>

          {/* Quick Presets Buttons */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-slate-400">Atajos rápidos:</span>
            <div className="grid grid-cols-6 gap-1.5">
              {[1, 6, 12, 24, 48, 100].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setExactPreset(amt)}
                  className="py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-all"
                >
                  {amt}
                </button>
              ))}
            </div>
          </div>

          {/* Real-time Calculation Cards */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Costo Unitario:</span>
                <span className="font-semibold text-slate-700">{formatCurrency(unitCost)}</span>
              </div>
              <div className="border-t border-slate-200 pt-1 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Inversión Total:</span>
                <span className="text-sm font-extrabold text-emerald-800">
                  {formatCurrency(totalCost)}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Precio Unitario:</span>
                <span className="font-semibold text-slate-700">{formatCurrency(unitPrice)}</span>
              </div>
              <div className="border-t border-slate-200 pt-1 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Precio Total:</span>
                <span className="text-sm font-extrabold text-slate-900">
                  {formatCurrency(totalPrice)}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-200 transition-all"
            >
              Cancelar (Esc)
            </button>
            <button
              type="submit"
              disabled={numQty <= 0}
              className="flex-[2] py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              <span>{isEditing ? 'Actualizar Conteo' : 'Agregar al Conteo (Enter)'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
