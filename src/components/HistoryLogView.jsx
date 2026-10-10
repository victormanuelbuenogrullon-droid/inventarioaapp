import React, { useState, useMemo } from 'react';
import { 
  History, 
  Search, 
  FileSpreadsheet, 
  Trash2, 
  ArrowLeft, 
  Filter, 
  Users, 
  Layers, 
  Package, 
  Clock, 
  Tag, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Hash
} from 'lucide-react';
import { formatCurrency, formatNumber, exportHistoryToExcel } from '../utils/export';

export default function HistoryLogView({
  historyLogs = [],
  onBackToInventory,
  onClearHistory,
  sessionName = 'Pase de Inventario'
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStation, setSelectedStation] = useState('ALL');
  const [selectedAction, setSelectedAction] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  // Distinct Stations list & station statistics
  const stationStats = useMemo(() => {
    const statsMap = new Map();

    historyLogs.forEach(log => {
      const station = log.stationName || 'Auditor sin nombre';
      const existing = statsMap.get(station) || { name: station, count: 0, totalUnits: 0 };
      existing.count += 1;
      if (log.action !== 'delete') {
        existing.totalUnits += Number(log.cantidad) || 0;
      }
      statsMap.set(station, existing);
    });

    return Array.from(statsMap.values()).sort((a, b) => b.count - a.count);
  }, [historyLogs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    let result = [...historyLogs];

    // 1. Text search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(log => 
        (log.descripcion || '').toLowerCase().includes(q) ||
        (log.codigo || '').toLowerCase().includes(q) ||
        (log.codigoInterno || '').toLowerCase().includes(q) ||
        (log.stationName || '').toLowerCase().includes(q) ||
        (log.categoria || '').toLowerCase().includes(q)
      );
    }

    // 2. Station filter
    if (selectedStation !== 'ALL') {
      result = result.filter(log => (log.stationName || 'Auditor sin nombre') === selectedStation);
    }

    // 3. Action filter
    if (selectedAction !== 'ALL') {
      result = result.filter(log => log.action === selectedAction);
    }

    return result;
  }, [historyLogs, searchTerm, selectedStation, selectedAction]);

  // Pagination
  const totalItems = filteredLogs.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const pagedLogs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, page, pageSize]);

  // Overall statistics
  const totalScans = historyLogs.length;
  const totalUnitsCounted = historyLogs.reduce((acc, log) => {
    if (log.action !== 'delete') {
      return acc + (Number(log.cantidad) || 0);
    }
    return acc;
  }, 0);

  const handleExportExcel = () => {
    exportHistoryToExcel(filteredLogs, `${sessionName}_Historial`);
  };

  const handleConfirmClear = () => {
    if (onClearHistory) {
      onClearHistory();
    }
    setIsClearConfirmOpen(false);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToInventory}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shadow-xs"
            title="Volver al Pase de Inventario"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>Historial y Auditoría de Conteos</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                  {totalScans.toLocaleString()} registros
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Registro cronológico de todas las lecturas por estación, producto y cantidad.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            title="Exportar historial filtrado a Excel"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exportar Historial Excel</span>
          </button>

          <button
            type="button"
            onClick={() => setIsClearConfirmOpen(true)}
            disabled={historyLogs.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            title="Limpiar registro de historial"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span className="hidden sm:inline">Limpiar Historial</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Total Lecturas */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Lecturas</span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
              <History className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {formatNumber(totalScans)}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Escaneos y registros procesados</p>
        </div>

        {/* Total Unidades Sumadas */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Unidades Movidas</span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
              <Hash className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {formatNumber(totalUnitsCounted)}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Piezas físicas sumadas en historial</p>
        </div>

        {/* Estaciones Participantes */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Estaciones Activas</span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {stationStats.length}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Auditores y dispositivos registrados</p>
        </div>

        {/* Última Lectura */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Último Registro</span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-sm font-bold text-slate-800 truncate">
            {historyLogs[0]?.stationName || 'Sin actividad'}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {historyLogs[0]?.timestamp 
              ? new Date(historyLogs[0].timestamp).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) 
              : 'Aún no hay escaneos'}
          </p>
        </div>

      </div>

      {/* Station Pills Filter */}
      {stationStats.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-700">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span>Filtrar por Estación / Auditor:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { setSelectedStation('ALL'); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                selectedStation === 'ALL'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Todas las estaciones ({totalScans})
            </button>
            {stationStats.map(st => (
              <button
                key={st.name}
                type="button"
                onClick={() => { setSelectedStation(st.name); setPage(1); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  selectedStation === st.name
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>{st.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-normal ${
                  selectedStation === st.name ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-600'
                }`}>
                  {st.count} lecturas • {st.totalUnits} unid.
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filter Controls */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        
        {/* Search Box */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            placeholder="Buscar por artículo, código de barra, SKU, o auditor..."
            className="w-full pl-10 pr-9 py-2 bg-slate-50 text-slate-800 placeholder-slate-400 rounded-xl border border-slate-300 focus:border-slate-600 focus:outline-none text-xs sm:text-sm font-medium transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Action Type Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={selectedAction}
            onChange={(e) => { setSelectedAction(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-slate-600"
          >
            <option value="ALL">Todas las acciones</option>
            <option value="add">Suma (+N)</option>
            <option value="new">Nuevo Producto</option>
            <option value="set">Cantidad Exacta (=N)</option>
            <option value="delete">Eliminaciones</option>
          </select>
        </div>

      </div>

      {/* Empty State */}
      {filteredLogs.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <History className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">No se encontraron registros</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {historyLogs.length === 0 
              ? 'Aún no se ha realizado ninguna lectura o escaneo en esta sesión.' 
              : 'No hay registros que coincidan con los filtros aplicados.'}
          </p>
        </div>
      )}

      {/* Desktop Table View */}
      {filteredLogs.length > 0 && (
        <div className="hidden md:block bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold tracking-wider uppercase text-[11px]">
                  <th className="py-3 px-3 w-12 text-center">#</th>
                  <th className="py-3 px-3">Hora / Fecha</th>
                  <th className="py-3 px-3">Estación / Auditor</th>
                  <th className="py-3 px-3">Código Barra / SKU</th>
                  <th className="py-3 px-4">Descripción del Artículo</th>
                  <th className="py-3 px-3 text-center">Acción</th>
                  <th className="py-3 px-4 text-center">Cantidad</th>
                  <th className="py-3 px-3 text-right">Costo Unit.</th>
                  <th className="py-3 px-4 text-right">Inversión</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {pagedLogs.map((log, idx) => {
                  const globalIdx = (page - 1) * pageSize + idx + 1;
                  const qty = Number(log.cantidad) || 0;
                  const cost = Number(log.costo) || 0;
                  const lineCost = qty * cost;

                  return (
                    <tr key={log.id || idx} className="hover:bg-slate-50 transition-colors">
                      
                      {/* Index */}
                      <td className="py-3 px-3 text-center text-slate-400 text-[11px] font-mono">
                        {globalIdx}
                      </td>

                      {/* Time */}
                      <td className="py-3 px-3 whitespace-nowrap text-slate-500">
                        <div className="font-semibold text-slate-800">
                          {log.timestamp ? new Date(log.timestamp).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {log.timestamp ? new Date(log.timestamp).toLocaleDateString('es-DO') : ''}
                        </div>
                      </td>

                      {/* Station / Auditor Name */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 font-bold text-xs">
                          <Users className="w-3.5 h-3.5 text-slate-500" />
                          <span>{log.stationName || 'Auditor'}</span>
                        </div>
                      </td>

                      {/* Barcode */}
                      <td className="py-3 px-3 whitespace-nowrap font-mono text-slate-700">
                        <span className="font-bold">{log.codigo || log.codigoInterno}</span>
                        {log.codigoInterno && log.codigoInterno !== log.codigo && (
                          <div className="text-[10px] text-slate-400">SKU: {log.codigoInterno}</div>
                        )}
                      </td>

                      {/* Description */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-xs sm:text-sm">
                          {log.descripcion}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-slate-400 font-normal">
                            Unidad: <strong className="text-slate-600">{log.unidad || 'UNIDAD'}</strong>
                          </span>
                          {log.categoria && (
                            <span className="text-[10px] text-slate-400">
                              • {log.categoria}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action Type */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {log.action === 'new' && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                            ★ Nuevo
                          </span>
                        )}
                        {log.action === 'add' && (
                          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                            + Suma
                          </span>
                        )}
                        {log.action === 'set' && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                            = Exacto
                          </span>
                        )}
                        {log.action === 'delete' && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                            🗑 Borrado
                          </span>
                        )}
                      </td>

                      {/* Quantity */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className={`font-extrabold text-sm ${
                          log.action === 'delete' ? 'text-rose-600' : 'text-slate-900'
                        }`}>
                          {log.action === 'add' ? `+${qty}` : (log.action === 'delete' ? '0' : qty)}
                        </div>
                        {log.cantidadResultado !== undefined && log.action !== 'delete' && (
                          <div className="text-[10px] text-slate-400">
                            Total: {log.cantidadResultado}
                          </div>
                        )}
                      </td>

                      {/* Unit Cost */}
                      <td className="py-3 px-3 text-right text-slate-500 whitespace-nowrap">
                        {formatCurrency(cost)}
                      </td>

                      {/* Line Cost */}
                      <td className="py-3 px-4 text-right whitespace-nowrap font-extrabold text-emerald-700">
                        {formatCurrency(lineCost)}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mobile Card View */}
      {filteredLogs.length > 0 && (
        <div className="md:hidden space-y-3">
          {pagedLogs.map((log, idx) => {
            const globalIdx = (page - 1) * pageSize + idx + 1;
            const qty = Number(log.cantidad) || 0;
            const cost = Number(log.costo) || 0;
            const lineCost = qty * cost;

            return (
              <div key={log.id || idx} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2.5">
                
                {/* Card Top Header: Station & Time */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-bold">
                      #{globalIdx}
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-slate-100 font-bold text-xs text-slate-800 border border-slate-200 flex items-center gap-1">
                      <Users className="w-3 h-3 text-slate-500" />
                      {log.stationName || 'Auditor'}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 font-medium">
                    {log.timestamp ? new Date(log.timestamp).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
                  </div>
                </div>

                {/* Product info */}
                <div>
                  <div className="font-mono text-xs font-bold text-slate-700">
                    {log.codigo || log.codigoInterno}
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                    {log.descripcion}
                  </h4>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Unidad: {log.unidad || 'UNIDAD'} {log.categoria ? `• ${log.categoria}` : ''}
                  </div>
                </div>

                {/* Bottom values: Action & Quantity */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    {log.action === 'new' && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                        ★ Nuevo
                      </span>
                    )}
                    {log.action === 'add' && (
                      <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                        + Suma
                      </span>
                    )}
                    {log.action === 'set' && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                        = Cantidad Exacta
                      </span>
                    )}
                    {log.action === 'delete' && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                        🗑 Borrado
                      </span>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-400 mr-1.5">Contado:</span>
                    <span className="text-base font-extrabold text-slate-900">
                      {log.action === 'add' ? `+${qty}` : qty}
                    </span>
                    <span className="text-xs text-slate-500 ml-1">
                      ({formatCurrency(lineCost)})
                    </span>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm flex items-center justify-between text-xs">
          <div className="text-slate-500 font-medium">
            Página <strong className="text-slate-800 font-bold">{page}</strong> de <strong className="text-slate-800 font-bold">{totalPages}</strong> ({totalItems.toLocaleString()} registros filtrados)
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Clear History Confirmation Modal */}
      {isClearConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">¿Limpiar Historial de Conteos?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Esto borrará el registro de auditoría de lecturas realizadas para todos los usuarios. El inventario actual contado se conservará.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsClearConfirmOpen(false)}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmClear}
                className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm"
              >
                Sí, Limpiar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
