import React, { useState, useEffect, useRef } from 'react';
import { PlusCircle, X, Check, RefreshCw } from 'lucide-react';
import { formatCurrency } from '../utils/export';

const COMMON_UNITS = ['UNIDAD', 'PAQUETE', 'CAJA', 'LIBRA', 'KILO', 'BOLSA', 'LITRO', 'BOTELLA', 'DOCENA'];

export default function GenericProductModal({
  isOpen,
  initialCode = '',
  isAdmin = false,
  onClose,
  onSave
}) {
  const [codigo, setCodigo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [unidad, setUnidad] = useState('UNIDAD');
  const [costo, setCosto] = useState('');
  const [precio, setPrecio] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [categoria, setCategoria] = useState('GENERICOS');
  const [saveToCatalog, setSaveToCatalog] = useState(isAdmin);

  const descInputRef = useRef(null);

  const generateGenericCode = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `GEN-${Date.now().toString().slice(-4)}${randomNum.toString().slice(0, 2)}`;
  };

  useEffect(() => {
    if (isOpen) {
      setCodigo(initialCode ? initialCode.trim() : generateGenericCode());
      setDescripcion('');
      setUnidad('UNIDAD');
      setCosto('');
      setPrecio('');
      setCantidad('1');
      setCategoria('GENERICOS');
      setSaveToCatalog(isAdmin);

      setTimeout(() => {
        descInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, initialCode]);

  if (!isOpen) return null;

  const numQty = parseFloat(cantidad) || 0;
  const numCost = parseFloat(costo) || 0;
  const numPrice = parseFloat(precio) || 0;
  const totalCost = numQty * numCost;
  const totalPrice = numQty * numPrice;

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!descripcion.trim()) {
      alert('Por favor ingresa una descripción para el producto.');
      return;
    }
    if (numQty <= 0) {
      alert('La cantidad contada debe ser mayor a 0.');
      return;
    }

    const finalProduct = {
      codigo: codigo.trim() || generateGenericCode(),
      codigoInterno: codigo.trim() || generateGenericCode(),
      codigoInternacional: codigo.trim() || generateGenericCode(),
      descripcion: descripcion.trim().toUpperCase(),
      unidad: unidad.trim().toUpperCase() || 'UNIDAD',
      categoria: categoria.trim().toUpperCase() || 'GENERICOS',
      departamento: 'GENERICOS',
      costo: numCost,
      precio: numPrice,
      existencia: 0,
      isGeneric: true
    };

    onSave(finalProduct, numQty, isAdmin && saveToCatalog);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white border border-slate-200 w-full max-w-xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Registrar Producto Genérico / Nuevo
              </h3>
              <p className="text-xs text-slate-500">
                Agrega artículos no registrados directamente durante el inventario
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

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          
          {/* Barcode / Code */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide flex items-center justify-between">
              <span>Código de Barra / Identificador:</span>
              <button
                type="button"
                onClick={() => setCodigo(generateGenericCode())}
                className="text-[11px] text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium lowercase"
              >
                <RefreshCw className="w-3 h-3" />
                Generar código auto
              </button>
            </label>
            <input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ej: 7501234567890 o GEN-001"
              className="w-full px-3.5 py-2.5 bg-slate-50 text-slate-900 placeholder-slate-400 rounded-xl border border-slate-300 focus:border-slate-800 focus:outline-none font-mono text-xs"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Descripción del Producto <span className="text-rose-500">*</span>
            </label>
            <input
              ref={descInputRef}
              type="text"
              required
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: PAN INTEGRAL ARTESANAL"
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
                placeholder="GENERICOS"
                className="w-full px-3.5 py-2.5 bg-slate-50 text-slate-800 placeholder-slate-400 rounded-xl border border-slate-300 focus:border-slate-800 focus:outline-none text-xs uppercase font-medium"
              />
            </div>
          </div>

          {/* Cost, Price, Quantity */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Costo Unit. ($):
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={costo}
                onChange={(e) => setCosto(e.target.value)}
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 bg-slate-50 text-slate-800 font-bold placeholder-slate-400 rounded-xl border border-slate-300 focus:border-slate-800 focus:outline-none text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Precio Venta ($):
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 bg-slate-50 text-slate-800 font-bold placeholder-slate-400 rounded-xl border border-slate-300 focus:border-slate-800 focus:outline-none text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5 uppercase tracking-wide">
                Cantidad Contada: <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                placeholder="1"
                className="w-full px-3.5 py-2.5 bg-slate-50 text-slate-900 font-extrabold placeholder-slate-400 rounded-xl border border-slate-400 focus:border-slate-800 focus:outline-none text-xs text-center"
              />
            </div>
          </div>

          {/* Real-time Calculation Preview */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block">Inversión Total Fila:</span>
              <span className="text-sm font-bold text-emerald-800">
                {formatCurrency(totalCost)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Precio Total Venta:</span>
              <span className="text-sm font-bold text-slate-900">
                {formatCurrency(totalPrice)}
              </span>
            </div>
          </div>

          {/* Checkbox (Admin Only) vs Session Notice (Collaborator/Auditor) */}
          {isAdmin ? (
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer text-xs text-slate-700 hover:bg-slate-100 transition-colors">
              <input
                type="checkbox"
                checked={saveToCatalog}
                onChange={(e) => setSaveToCatalog(e.target.checked)}
                className="w-4 h-4 rounded text-slate-800 focus:ring-slate-500 border-slate-300"
              />
              <div>
                <span className="font-semibold text-slate-900 block">
                  Guardar también en el catálogo permanente de la base de datos (Administrador)
                </span>
                <span className="text-slate-500 text-[11px]">
                  Permite reconocer este código de forma global si vuelves a escanearlo más adelante.
                </span>
              </div>
            </label>
          ) : (
            <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-2">
              <span>🔒 <strong>Modo Sesión:</strong> Este producto se agregará a tu conteo activo. Solo el Administrador puede registrar productos permanentes en la base de datos principal.</span>
            </div>
          )}

          {/* Action Buttons */}
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
              className="flex-[2] py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-2 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Registrar y Agregar al Conteo (Enter)</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
