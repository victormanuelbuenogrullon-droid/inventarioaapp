import React, { useState, useMemo } from 'react';
import { 
  Trash2, 
  Edit3, 
  Plus, 
  Minus, 
  Search, 
  PackageOpen, 
  ArrowUpDown,
  X,
  ClipboardList,
  RotateCcw
} from 'lucide-react';
import { formatCurrency, formatNumber } from '../utils/export';

export default function InventoryTable({
  items,
  onEditItem,
  onIncrementItem,
  onDecrementItem,
  onDeleteItem,
  onClearCount
}) {
  const [filterText, setFilterText] = useState('');
  const [sortField, setSortField] = useState('updatedAt');
  const [sortAsc, setSortAsc] = useState(false);

  // Multi-word Filter & Sort
  const filteredAndSortedItems = useMemo(() => {
    let result = [...items];

    if (filterText.trim()) {
      const q = filterText.toLowerCase().trim();
      const words = q.split(/\s+/).filter(Boolean);

      result = result.filter(item => {
        const desc = (item.descripcion || '').toLowerCase();
        const bar = (item.codigoInternacional || '').toLowerCase();
        const sku = (item.codigoInterno || '').toLowerCase();
        const code = (item.codigo != null ? String(item.codigo) : '').toLowerCase();
        const cat = (item.categoria || '').toLowerCase();
        const brand = (item.marca || '').toLowerCase();
        const model = (item.modelo || '').toLowerCase();

        const fullText = `${desc} ${bar} ${sku} ${code} ${cat} ${brand} ${model}`;
        return words.every(word => fullText.includes(word));
      });
    }

    result.sort((a, b) => {
      let valA, valB;
      const qtyA = Number(a.cantidadContada) || 0;
      const qtyB = Number(b.cantidadContada) || 0;
      const costA = (Number(a.costo) || 0) * qtyA;
      const costB = (Number(b.costo) || 0) * qtyB;
      const priceA = (Number(a.precio) || 0) * qtyA;
      const priceB = (Number(b.precio) || 0) * qtyB;

      switch (sortField) {
        case 'costTotal':
          valA = costA;
          valB = costB;
          break;
        case 'priceTotal':
          valA = priceA;
          valB = priceB;
          break;
        case 'qty':
          valA = qtyA;
          valB = qtyB;
          break;
        case 'desc':
          valA = (a.descripcion || '').toLowerCase();
          valB = (b.descripcion || '').toLowerCase();
          break;
        case 'updatedAt':
        default:
          valA = a.updatedAt || 0;
          valB = b.updatedAt || 0;
          break;
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return result;
  }, [items, filterText, sortField, sortAsc]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden my-4">
      
      {/* 1. TABLE TOP CONTROLS & PROMINENT SEARCH BAR */}
      <div className="p-3.5 sm:p-4 border-b border-slate-200/80 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        
        {/* Count Title & Total Badge */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <ClipboardList className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-slate-900">
                Productos en Conteo
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800 font-bold">
                {items.length} {items.length === 1 ? 'producto' : 'productos'}
              </span>
            </div>
            {filterText.trim() && items.length > 0 && (
              <span className="text-[11px] text-indigo-700 font-bold">
                Mostrando {filteredAndSortedItems.length} de {items.length} filtrados
              </span>
            )}
          </div>
        </div>

        {/* Prominent Search Bar specifically for counted products */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80 md:w-96">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <Search className="w-4 h-4 text-slate-500" />
            </div>

            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              disabled={items.length === 0}
              placeholder={items.length === 0 ? "No hay productos contados aún..." : "Buscar producto contado por nombre, código o SKU..."}
              className="w-full h-10 sm:h-11 pl-10 pr-9 bg-white border border-slate-300 hover:border-slate-400 focus:border-indigo-600 focus:ring-3 focus:ring-indigo-500/15 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none font-medium transition-all shadow-2xs disabled:bg-slate-100 disabled:cursor-not-allowed"
            />

            {filterText && (
              <button
                type="button"
                onClick={() => setFilterText('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

      </div>

      {/* 2. BODY STATES: EMPTY LIST VS NO SEARCH MATCHES VS ITEMS TABLE */}

      {/* State A: Complete Empty Inventory */}
      {items.length === 0 && (
        <div className="p-12 text-center bg-white">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <PackageOpen className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">El listado de inventario está vacío</h3>
          <p className="text-slate-500 text-xs max-w-md mx-auto">
            Pasa los códigos de barras con la pistola o escribe en el buscador superior para comenzar a registrar las cantidades contadas.
          </p>
        </div>
      )}

      {/* State B: Search Filter Returned 0 Results */}
      {items.length > 0 && filteredAndSortedItems.length === 0 && (
        <div className="p-10 text-center bg-slate-50/50">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 mb-1">No se encontraron productos en el conteo</h3>
          <p className="text-slate-500 text-xs max-w-sm mx-auto mb-3">
            Ningún producto contado coincide con "<strong>{filterText}</strong>".
          </p>
          <button
            type="button"
            onClick={() => setFilterText('')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all shadow-xs active:scale-95"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Mostrar todos los productos ({items.length})</span>
          </button>
        </div>
      )}

      {/* State C: Desktop & Tablet Table View */}
      {filteredAndSortedItems.length > 0 && (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold tracking-wider uppercase text-[11px]">
                  <th className="py-3 px-3 w-12 text-center">#</th>
                  <th className="py-3 px-3">Código Barra / SKU</th>
                  <th 
                    onClick={() => handleSort('desc')}
                    className="py-3 px-4 cursor-pointer hover:text-slate-900 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Descripción del Producto</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-3 text-center">Unidad</th>
                  <th 
                    onClick={() => handleSort('qty')}
                    className="py-3 px-4 text-center cursor-pointer hover:text-slate-900 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Cantidad Contada</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-3 text-right">Costo Unit.</th>
                  <th 
                    onClick={() => handleSort('costTotal')}
                    className="py-3 px-4 text-right cursor-pointer hover:text-slate-900 transition-colors font-bold text-slate-800"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Inversión Total</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-3 text-right">Precio Unit.</th>
                  <th 
                    onClick={() => handleSort('priceTotal')}
                    className="py-3 px-4 text-right cursor-pointer hover:text-slate-900 transition-colors font-bold text-slate-800"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Precio Total</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-3 text-center w-24">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {filteredAndSortedItems.map((item, idx) => {
                  const qty = Number(item.cantidadContada) || 0;
                  const cost = Number(item.costo) || 0;
                  const price = Number(item.precio) || 0;
                  const lineTotalCost = qty * cost;
                  const lineTotalPrice = qty * price;

                  return (
                    <tr
                      key={item.id || item.codigo || idx}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      {/* # Index */}
                      <td className="py-3 px-3 text-center text-slate-400 text-[11px] font-mono">
                        {idx + 1}
                      </td>

                      {/* Code */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-mono text-slate-700 font-semibold">
                          {item.codigoInternacional || item.codigoInterno || item.codigo}
                        </div>
                        {item.codigoInterno && item.codigoInterno !== item.codigoInternacional && (
                          <div className="text-[10px] text-slate-400">SKU: {item.codigoInterno}</div>
                        )}
                      </td>

                      {/* Description */}
                      <td className="py-3 px-4">
                        <div className="text-slate-900 font-bold text-xs sm:text-sm">
                          {item.descripcion}
                        </div>
                        {item.categoria && (
                          <span className="text-[10px] text-slate-400 font-normal">
                            {item.categoria} {item.departamento ? `• ${item.departamento}` : ''}
                          </span>
                        )}
                      </td>

                      {/* Unit */}
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold">
                          {item.unidad || 'UNIDAD'}
                        </span>
                      </td>

                      {/* Counted Quantity */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                          <button
                            onClick={() => onDecrementItem(item)}
                            className="w-6 h-6 rounded-lg bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors shadow-xs"
                            title="Restar 1"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          
                          <button
                            onClick={() => onEditItem(item)}
                            className="px-2.5 py-0.5 text-sm font-bold text-slate-900 hover:text-blue-600 hover:underline"
                            title="Haz clic para cambiar la cantidad contada"
                          >
                            {formatNumber(qty)}
                          </button>

                          <button
                            onClick={() => onIncrementItem(item)}
                            className="w-6 h-6 rounded-lg bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors shadow-xs"
                            title="Sumar 1"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Unit Cost */}
                      <td className="py-3 px-3 text-right text-slate-500 whitespace-nowrap">
                        {formatCurrency(cost)}
                      </td>

                      {/* Total Cost / Inversion Total */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="font-extrabold text-emerald-700 text-sm">
                          {formatCurrency(lineTotalCost)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono font-normal">
                          {qty} × {formatCurrency(cost)}
                        </div>
                      </td>

                      {/* Unit Price */}
                      <td className="py-3 px-3 text-right text-slate-500 whitespace-nowrap">
                        {formatCurrency(price)}
                      </td>

                      {/* Total Price / Venta Total */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="font-extrabold text-slate-800 text-sm">
                          {formatCurrency(lineTotalPrice)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono font-normal">
                          {qty} × {formatCurrency(price)}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onEditItem(item)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                            title="Editar cantidad"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteItem(item)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors"
                            title="Eliminar del inventario"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View (Optimized for Smartphones & Tablets) */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredAndSortedItems.map((item, idx) => {
              const qty = Number(item.cantidadContada) || 0;
              const cost = Number(item.costo) || 0;
              const price = Number(item.precio) || 0;
              const lineTotalCost = qty * cost;
              const lineTotalPrice = qty * price;

              return (
                <div key={item.id || item.codigo || idx} className="p-4 space-y-3 bg-white">
                  
                  {/* Product Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-semibold">
                          #{idx + 1}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-700">
                          {item.codigoInternacional || item.codigoInterno || item.codigo}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mt-0.5 leading-snug">
                        {item.descripcion}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                          {item.unidad || 'UNIDAD'}
                        </span>
                        {item.categoria && (
                          <span className="text-[10px] text-slate-400">
                            {item.categoria}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEditItem(item)}
                        className="p-2 rounded-xl bg-slate-100 active:bg-slate-200 text-slate-700"
                        title="Editar"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteItem(item)}
                        className="p-2 rounded-xl bg-rose-50 active:bg-rose-100 text-rose-600"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Quantity Controls & Values in Mobile Card */}
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
                    
                    {/* Touch-Friendly Quantity Stepper */}
                    <div className="inline-flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                      <button
                        onClick={() => onDecrementItem(item)}
                        className="w-8 h-8 rounded-xl bg-white active:bg-slate-200 text-slate-800 flex items-center justify-center font-bold shadow-xs"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={() => onEditItem(item)}
                        className="px-3 py-1 text-base font-extrabold text-slate-900"
                      >
                        {formatNumber(qty)}
                      </button>

                      <button
                        onClick={() => onIncrementItem(item)}
                        className="w-8 h-8 rounded-xl bg-white active:bg-slate-200 text-slate-800 flex items-center justify-center font-bold shadow-xs"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Totals */}
                    <div className="text-right">
                      <div className="text-[11px] text-slate-400">Inversión:</div>
                      <div className="text-sm font-extrabold text-emerald-700">
                        {formatCurrency(lineTotalCost)}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Venta: <strong className="text-slate-800 font-semibold">{formatCurrency(lineTotalPrice)}</strong>
                      </div>
                    </div>

                  </div>

                </div>
              );
            })}
          </div>
        </>
      )}

    </div>
  );
}
