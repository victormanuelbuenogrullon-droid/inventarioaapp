import React, { useState, useEffect } from 'react';
import { Edit3, X, Check } from 'lucide-react';
import { formatCurrency } from '../utils/export';

const COMMON_UNITS = ['UNIDAD', 'PAQUETE', 'CAJA', 'LIBRA', 'KILO', 'BOLSA', 'LITRO', 'BOTELLA', 'DOCENA', 'SOBRE', 'LATA', 'GALON'];

export default function EditProductModal({
  isOpen,
  product,
  onClose,
  onSave
}) {
  const [codigoInternacional, setCodigoInternacional] = useState('');
  const [codigoInterno, setCodigoInterno] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [unidad, setUnidad] = useState('UNIDAD');
  const [categoria, setCategoria] = useState('');
  const [costo, setCosto] = useState('');
  const [precio, setPrecio] = useState('');

  useEffect(() => {
    if (isOpen && product) {
      setCodigoInternacional(product.codigoInternacional || '');
      setCodigoInterno(product.codigoInterno || '');
      setDescripcion(product.descripcion || '');
      setUnidad(product.unidad || 'UNIDAD');
      setCategoria(product.categoria || '');
      setCosto(product.costo !== undefined ? product.costo.toString() : '0');
      setPrecio(product.precio !== undefined ? product.precio.toString() : '0');
    }
  }, [isOpen, product]);

  if (!isOpen || !product) return null;

  const numCost = parseFloat(costo) || 0;
  const numPrice = parseFloat(precio) || 0;
  const margin = numPrice - numCost;
  const marginPercent = numPrice > 0 ? ((margin / numPrice) * 100).toFixed(1) : '0.0';

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!descripcion.trim()) {
      alert('La descripción no puede estar vacía.');
      return;
    }

    const updatedProduct = {
      ...product,
      codigoInternacional: codigoInternacional.trim(),
      codigoInterno: codigoInterno.trim(),
      descripcion: descripcion.trim().toUpperCase(),
      unidad: unidad.trim().toUpperCase() || 'UNIDAD',
      categoria: categoria.trim().toUpperCase(),
      costo: numCost,
      precio: numPrice,
    };

    onSave(updatedProduct);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Editar Producto del Catálogo</h3>
              <p className="text-xs text-slate-500">Modifica la descripción, unidad, costo o precio</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          
          {/* Codes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Código de Barra (EAN/UPC):
              </label>
              <input
                type="text"
                value={codigoInternacional}
                onChange={(e) => setCodigoInternacional(e.target.value)}
                placeholder="7509546015477"
                className="w-full px-3.5 py-2.5 bg-slate-50 text-slate-900 font-mono placeholder-slate-400 rounded-xl border border-slate-300 focus:border-slate-800 focus:outline-none text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Código Interno (SKU):
              </label>
              <input
                type="text"
                value={codigoInterno}
                onChange={(e) => setCodigoInterno(e.target.value)}
                placeholder="000001"
                className="w-full px-3.5 py-2.5 bg-slate-50 text-slate-900 font-mono placeholder-slate-400 rounded-xl border border-slate-300 focus:border-slate-800 focus:outline-none text-xs"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Descripción del Producto <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="NOMBRE DEL PRODUCTO"
              className="w-full px-3.5 py-2.5 bg-slate-50 text-slate-900 font-bold placeholder-slate-400 rounded-xl border border-slate-300 focus:border-slate-800 focus:outline-none text-sm uppercase"
            />
          </div>

          {/* Unit & Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Unidad de Medida:
              </label>
              <select
                value={unidad}
                onChange={(e) => setUnidad(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 text-slate-800 rounded-xl border border-slate-300 focus:border-slate-800 focus:outline-none text-xs font-medium"
              >
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Categoría:
              </label>
              <input
                type="text"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="SUPERMERCADO"
                className="w-full px-3.5 py-2.5 bg-slate-50 text-slate-800 rounded-xl border border-slate-300 focus:border-slate-800 focus:outline-none text-xs uppercase"
              />
            </div>
          </div>

          {/* Cost & Price */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <label className="block text-xs font-semibold text-slate-700 mb-1 uppercase tracking-wide">
                Costo Unitario ($):
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={costo}
                onChange={(e) => setCosto(e.target.value)}
                placeholder="0.00"
                className="w-full py-1.5 bg-transparent text-slate-900 text-lg font-bold focus:outline-none"
              />
              <span className="text-[10px] text-slate-500">Costo de adquisición</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <label className="block text-xs font-semibold text-slate-700 mb-1 uppercase tracking-wide">
                Precio de Venta ($):
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                placeholder="0.00"
                className="w-full py-1.5 bg-transparent text-slate-900 text-lg font-bold focus:outline-none"
              />
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>Margen: <strong className="text-slate-800">{formatCurrency(margin)}</strong></span>
                <span className="text-slate-700 font-bold">{marginPercent}%</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-200 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-[2] py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-2 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Guardar Cambios</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
