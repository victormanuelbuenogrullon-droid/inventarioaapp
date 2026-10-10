import React, { useState, useMemo } from 'react';
import { 
  Trash2, 
  Edit3, 
  Plus, 
  Minus, 
  Search, 
  PackageOpen, 
  ArrowUpDown
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

  // Filter & Sort
  const filteredAndSortedItems = useMemo(() => {
    let result = [...items];

    if (filterText.trim()) {
      const q = filterText.toLowerCase().trim();
      result = result.filter(item => 
        (item.descripcion || '').toLowerCase().includes(q) ||
        (item.codigoInternacional || '').toLowerCase().includes(q) ||
        (item.codigoInterno || '').toLowerCase().includes(q) ||
        (item.categoria || '').toLowerCase().includes(q)
      );
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

  if (items.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center my-6 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-3">
          <PackageOpen className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-800 mb-1">El listado de inventario está vacío</h3>
        <p className="text-slate-500 text-xs max-w-md mx-auto">
          Pasa los códigos de barras con la pistola o busca manualmente para ir registrando las cantidades físicas.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden my-4">
      
      {/* Table Top Controls */}
      <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
        
        {/* Count summary title */}
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            Productos en Conteo
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold">
              {filteredAndSortedItems.length} {filteredAndSortedItems.length === 1 ? 'ítem' : 'ítems'}
            </span>
          </h2>
        </div>

        {/* Search within counted items */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filtrar en listado contado..."
              className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-500"
            />
            {filterText && (
              <button
                onClick={() => setFilterText('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Table */}
      <div className="overflow-x-auto">
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

    </div>
  );
}
