import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Package, Edit3, ChevronDown, ChevronUp, DollarSign, Tag, Sparkles } from 'lucide-react';
import { formatCurrency } from '../utils/export';

export default function QuantityModal({
  isOpen,
  product,
  currentCount = 0,
  isEditing = false,
  isAdmin = false,
  onConfirm,
  onClose
}) {
  const [quantity, setQuantity] = useState('1');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('0');
  const [price, setPrice] = useState('0');
  const [saveToCatalog, setSaveToCatalog] = useState(isAdmin);
  const [isQuickEditOpen, setIsQuickEditOpen] = useState(isEditing);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && product) {
      if (isEditing) {
        setQuantity(currentCount > 0 ? currentCount.toString() : '1');
      } else {
        setQuantity('1');
      }
      setDescription(product.descripcion || '');
      setCost(product.costo !== undefined && product.costo !== null ? product.costo.toString() : '0');
      setPrice(product.precio !== undefined && product.precio !== null ? product.precio.toString() : '0');
      setSaveToCatalog(isAdmin);
      // When editing an existing item from table, expand quick edit fields by default
      setIsQuickEditOpen(isEditing);

      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, product, isEditing, currentCount]);

  if (!isOpen || !product) return null;

  const numQty = parseFloat(quantity) || 0;
  const numCost = parseFloat(cost) >= 0 ? parseFloat(cost) : (Number(product.costo) || 0);
  const numPrice = parseFloat(price) >= 0 ? parseFloat(price) : (Number(product.precio) || 0);

  const totalCost = numQty * numCost;
  const totalPrice = numQty * numPrice;
  const margin = totalPrice - totalCost;
  const marginPercent = totalPrice > 0 ? ((margin / totalPrice) * 100).toFixed(1) : '0.0';

  const cleanDesc = description.trim() || product.descripcion || 'Sin descripción';
  const hasProductChanges =
    cleanDesc !== (product.descripcion || '') ||
    numCost !== (Number(product.costo) || 0) ||
    numPrice !== (Number(product.precio) || 0);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (numQty <= 0) return;

    const updatedProduct = {
      ...product,
      descripcion: cleanDesc,
      costo: numCost,
      precio: numPrice
    };

    onConfirm(updatedProduct, numQty, isEditing, hasProductChanges, isAdmin && saveToCatalog);
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[94vh] animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl text-white shadow-xs ${isEditing ? 'bg-indigo-600' : 'bg-slate-800'}`}>
              {isEditing ? <Edit3 className="w-4 h-4" /> : <Package className="w-4 h-4" />}
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                {isEditing ? 'Modificar Conteo y Producto' : 'Ingresar Cantidad Contada'}
              </span>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug line-clamp-1">
                {description || product.descripcion}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Meta Bar */}
        <div className="px-5 py-2 bg-slate-50 border-b border-slate-100 text-xs flex flex-wrap items-center justify-between gap-2 text-slate-600 shrink-0">
          <div>
            <span className="text-slate-400">Código / Barra:</span>{' '}
            <span className="font-mono font-semibold text-slate-800">
              {product.codigoInternacional || product.codigoInterno || product.codigo}
            </span>
            {product.codigoInterno && product.codigoInterno !== product.codigoInternacional && (
              <span className="ml-2 text-slate-400 text-[11px]">(SKU: {product.codigoInterno})</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold">
              {product.unidad || 'UNIDAD'}
            </span>
            {product.categoria && (
              <span className="text-slate-500 text-[11px]">
                {product.categoria}
              </span>
            )}
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          
          {/* Main Quantity Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Cantidad Física Contada:
              </label>
              {isEditing && (
                <span className="text-[11px] text-slate-400">
                  Conteo anterior: <strong className="text-slate-700">{currentCount}</strong>
                </span>
              )}
            </div>
            <div className="relative">
              <input
                ref={inputRef}
                type="number"
                step="any"
                min="0.01"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                className="w-full text-center py-2.5 bg-slate-50 text-slate-900 text-3xl font-extrabold rounded-xl border border-slate-300 focus:border-slate-800 focus:ring-2 focus:ring-slate-200 focus:outline-none tracking-wider"
              />
            </div>
          </div>

          {/* Quick Presets Buttons */}
          <div className="space-y-1">
            <span className="text-[11px] font-medium text-slate-400">Atajos de cantidad:</span>
            <div className="grid grid-cols-6 gap-1.5">
              {[1, 6, 12, 24, 48, 100].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setExactPreset(amt)}
                  className="py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-bold border border-slate-200 transition-all"
                >
                  {amt}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Product Details Shortcut Section */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => setIsQuickEditOpen(!isQuickEditOpen)}
              className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-indigo-50/70 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-indigo-950">
                  Atajo Rápido: Editar Descripción, Costo y Precio
                </span>
                {hasProductChanges && (
                  <span className="px-1.5 py-0.2 rounded-full bg-indigo-600 text-white text-[10px] font-bold animate-pulse">
                    Modificado
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-indigo-600 text-xs font-semibold">
                <span>{isQuickEditOpen ? 'Ocultar' : 'Editar'}</span>
                {isQuickEditOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </div>
            </button>

            {isQuickEditOpen && (
              <div className="p-3.5 pt-1 space-y-3 border-t border-indigo-100 bg-white/70 animate-in fade-in duration-150">
                
                {/* Description */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Descripción del Producto:
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ej: ARROZ SELECTO 10 LBS"
                    className="w-full px-3 py-1.5 bg-white text-slate-900 font-semibold rounded-lg border border-slate-300 focus:border-indigo-600 focus:outline-none text-xs uppercase"
                  />
                </div>

                {/* Cost and Price grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                      Costo Unitario ($):
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">$</span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={cost}
                        onChange={(e) => setCost(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-6 pr-2.5 py-1.5 bg-white text-slate-900 font-bold rounded-lg border border-slate-300 focus:border-indigo-600 focus:outline-none text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                      Precio Venta ($):
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">$</span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-6 pr-2.5 py-1.5 bg-white text-slate-900 font-bold rounded-lg border border-slate-300 focus:border-indigo-600 focus:outline-none text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Save to Catalog Checkbox - Admin Only vs Session Notice */}
                {isAdmin ? (
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 hover:text-slate-900 pt-1 select-none">
                    <input
                      type="checkbox"
                      checked={saveToCatalog}
                      onChange={(e) => setSaveToCatalog(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <span className="font-medium text-slate-800">Actualizar también en el catálogo general compartido (Administrador)</span>
                  </label>
                ) : (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-900 font-medium mt-1">
                    <span>🔒 <strong>Modo Sesión:</strong> La edición de descripción, costo o precio se aplicará exclusivamente a tu sesión de conteo. La base de datos principal no será alterada.</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Real-time Calculation Cards */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-0.5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Costo Unitario:</span>
                <span className="font-semibold text-slate-700">{formatCurrency(numCost)}</span>
              </div>
              <div className="border-t border-slate-200 pt-1 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Inversión Total:</span>
                <span className="text-sm font-extrabold text-emerald-800">
                  {formatCurrency(totalCost)}
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-0.5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Precio Unitario:</span>
                <span className="font-semibold text-slate-700">{formatCurrency(numPrice)}</span>
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
          <div className="flex items-center gap-2.5 pt-2 shrink-0">
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
              className={`flex-[2] py-2.5 px-4 rounded-xl text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                hasProductChanges ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-800 hover:bg-slate-700'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>
                {hasProductChanges
                  ? 'Guardar Conteo y Producto'
                  : isEditing
                  ? 'Actualizar Conteo'
                  : 'Agregar al Conteo (Enter)'}
              </span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
