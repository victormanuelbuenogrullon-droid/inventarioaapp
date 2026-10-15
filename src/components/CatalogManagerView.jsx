import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Search, 
  Edit3, 
  Trash2, 
  Plus, 
  FileSpreadsheet, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  Database,
  RefreshCw,
  ArrowLeft,
  Tag,
  DollarSign
} from 'lucide-react';
import { 
  getProductsPaged, 
  getAllCatalogCategories, 
  deleteProductFromDB, 
  exportAllCatalogData 
} from '../utils/db';
import { formatCurrency } from '../utils/export';
import * as XLSX from 'xlsx';

export default function CatalogManagerView({
  onBackToInventory,
  onEditProduct,
  onAddNewProduct,
  catalogCount,
  isAdmin = false
}) {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Debounce search input (180ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 180);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    getAllCatalogCategories().then(setCategories);
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getProductsPaged({
        page,
        pageSize,
        search,
        category
      });
      setProducts(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      console.error('Error fetching catalog paged:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, category]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCategoryChange = (val) => {
    setCategory(val);
    setPage(1);
  };

  const handleDelete = async (product) => {
    if (!isAdmin) {
      alert('Solo el Administrador puede eliminar productos de la base de datos principal.');
      return;
    }

    const confirm = window.confirm(`¿Estás seguro de eliminar "${product.descripcion}" del catálogo de la base de datos principal?`);
    if (!confirm) return;

    try {
      await deleteProductFromDB(product.id);
      await loadData();
    } catch (err) {
      alert('Error al eliminar producto: ' + err.message);
    }
  };

  const handleExportCatalog = async () => {
    setIsLoading(true);
    try {
      const allItems = await exportAllCatalogData();
      if (allItems.length === 0) {
        alert('No hay productos en el catálogo para exportar.');
        return;
      }

      const rows = allItems.map((item, idx) => ({
        '#': idx + 1,
        'Código': item.codigo || '',
        'Código Interno': item.codigoInterno || '',
        'Código Internacional (Barra)': item.codigoInternacional || item.codigoInternaciona || '',
        'Descripción': item.descripcion || '',
        'Unidad': item.unidad || 'UNIDAD',
        'Categoría': item.categoria || '',
        'Departamento': item.departamento || '',
        'Costo Unitario ($)': Number(item.costo) || 0,
        'Precio 1 ($)': Number(item.precio) || 0,
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Catalogo_Productos');
      XLSX.writeFile(wb, `Catalogo_Actualizado_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (err) {
      alert('Error al exportar catálogo: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToInventory}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all flex items-center gap-1.5 text-xs font-semibold active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver al Pase</span>
          </button>
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 flex-wrap">
              <Database className="w-5 h-5 text-slate-600" />
              Catálogo de Productos
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                {total.toLocaleString()} encontrados
              </span>
              {!isAdmin && (
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-semibold border border-amber-200">
                  Modo Consulta (Solo Lectura)
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500">
              {isAdmin 
                ? 'Búsqueda ultrarrápida • Administra, edita o consulta más de 20,000 productos del catálogo maestro'
                : 'Búsqueda ultrarrápida • Consulta precios, costos y códigos de los artículos de la base de datos principal'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={onAddNewProduct}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nuevo Producto</span>
            </button>
          )}

          <button
            onClick={handleExportCatalog}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold transition-all shadow-xs"
            title="Exportar catálogo a Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col md:flex-row items-center gap-3">
        
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por descripción, código de barra (EAN), SKU o categoría..."
            className="w-full pl-10 pr-8 py-2.5 bg-slate-50 text-slate-900 placeholder-slate-400 rounded-xl border border-slate-300 focus:border-slate-800 focus:ring-2 focus:ring-slate-200 focus:outline-none text-xs sm:text-sm font-medium transition-all"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs p-1"
            >
              ✕
            </button>
          )}
        </div>

        {/* Category Filter */}
        <div className="w-full md:w-64">
          <select
            value={category}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 text-slate-800 rounded-xl border border-slate-300 focus:border-slate-800 focus:outline-none text-xs font-medium"
          >
            <option value="">Todas las Categorías ({categories.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Page Size Selector */}
        <div className="flex items-center gap-1.5 shrink-0 text-xs text-slate-500 self-end md:self-center">
          <span>Mostrar:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="px-2.5 py-1.5 bg-slate-50 text-slate-800 rounded-xl border border-slate-300 focus:border-slate-800 focus:outline-none text-xs font-semibold"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>

      </div>

      {/* MOBILE CARD VIEW (for small screens md:hidden) */}
      <div className="block md:hidden space-y-3">
        {isLoading ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
            Cargando catálogo...
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 text-xs">
            No se encontraron productos con los filtros especificados.
          </div>
        ) : (
          products.map((p, idx) => {
            const globalIdx = (page - 1) * pageSize + idx + 1;
            return (
              <div
                key={p.id || idx}
                className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">
                        #{globalIdx}
                      </span>
                      <span className="font-mono text-xs font-semibold text-slate-700">
                        {p.codigoInternacional || p.codigoInterno || p.codigo}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">
                        {p.unidad || 'UNIDAD'}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm mt-1 leading-snug">
                      {p.descripcion}
                    </h3>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => onEditProduct && onEditProduct(p)}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                        title="Editar producto"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors"
                        title="Eliminar producto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                  <div className="text-slate-500 truncate max-w-[50%]">
                    {p.categoria || 'Sin categoría'}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500">
                      Costo: <strong className="text-slate-700">{formatCurrency(p.costo)}</strong>
                    </span>
                    <span className="text-slate-500">
                      Precio: <strong className="text-slate-900 font-bold">{formatCurrency(p.precio)}</strong>
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* DESKTOP CATALOG TABLE (hidden md:block) */}
      <div className="hidden md:block bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold tracking-wider uppercase text-[11px]">
                <th className="py-3 px-3 w-12 text-center">#</th>
                <th className="py-3 px-3">Código Barra / SKU</th>
                <th className="py-3 px-4">Descripción del Producto</th>
                <th className="py-3 px-3 text-center">Unidad</th>
                <th className="py-3 px-3">Categoría</th>
                <th className="py-3 px-3 text-right">Costo Unit. ($)</th>
                <th className="py-3 px-3 text-right">Precio Venta ($)</th>
                {isAdmin && <th className="py-3 px-3 text-center w-24">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                    Cargando productos del catálogo...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="py-12 text-center text-slate-400">
                    No se encontraron productos con los filtros especificados.
                  </td>
                </tr>
              ) : (
                products.map((p, idx) => {
                  const globalIdx = (page - 1) * pageSize + idx + 1;
                  return (
                    <tr
                      key={p.id || idx}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                        {globalIdx}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-mono text-slate-700 font-semibold">
                          {p.codigoInternacional || p.codigoInterno || p.codigo}
                        </div>
                        {p.codigoInterno && p.codigoInterno !== p.codigoInternacional && (
                          <div className="text-[10px] text-slate-400">SKU: {p.codigoInterno}</div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="text-slate-900 font-bold text-xs sm:text-sm">
                          {p.descripcion}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                          {p.unidad || 'UNIDAD'}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-slate-500 text-xs">
                        {p.categoria || '—'}
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-slate-700 whitespace-nowrap">
                        {formatCurrency(p.costo)}
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                        {formatCurrency(p.precio)}
                      </td>

                      {isAdmin && (
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => onEditProduct && onEditProduct(p)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                              title="Editar descripción, unidad, costo o precio"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(p)}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors"
                              title="Eliminar producto del catálogo maestro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <div>
          Mostrando <strong className="text-slate-800">{products.length}</strong> de <strong className="text-slate-800">{total.toLocaleString()}</strong> productos
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Primera página"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-medium"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Anterior</span>
          </button>

          <span className="px-3 py-1.5 bg-slate-200 rounded-lg text-slate-800 font-bold">
            {page} / {totalPages}
          </span>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || totalPages === 0}
            className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-medium"
          >
            <span className="hidden sm:inline">Siguiente</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages || totalPages === 0}
            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Última página"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

    </div>
  );
}
