import React from 'react';
import { X, Printer, FileSpreadsheet, Package, DollarSign, Calendar, Hash } from 'lucide-react';
import { formatCurrency, formatNumber, exportToExcel } from '../utils/export';

export default function PrintReportModal({
  isOpen,
  onClose,
  items,
  sessionName
}) {
  if (!isOpen) return null;

  const { totalUnits, totalCostInvestment, totalRetailPrice } = items.reduce(
    (acc, item) => {
      const qty = Number(item.cantidadContada) || 0;
      const cost = Number(item.costo) || 0;
      const price = Number(item.precio) || 0;

      acc.totalUnits += qty;
      acc.totalCostInvestment += qty * cost;
      acc.totalRetailPrice += qty * price;
      return acc;
    },
    { totalUnits: 0, totalCostInvestment: 0, totalRetailPrice: 0 }
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Top Bar */}
        <div className="no-print px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">Vista Previa para Impresión / Reporte de Auditoría</h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Guardar como PDF</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-white text-slate-900">
          
          {/* Document Header */}
          <div className="border-b-2 border-slate-800 pb-4 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 uppercase">
                  Reporte de Pase de Inventario Físico
                </h1>
                <p className="text-sm font-semibold text-slate-600 mt-0.5">
                  Sesión: <span className="text-emerald-700 font-bold">{sessionName || 'Conteo General'}</span>
                </p>
              </div>
              <div className="text-right text-xs text-slate-600 space-y-1">
                <p><strong>Fecha:</strong> {new Date().toLocaleDateString('es-DO')}</p>
                <p><strong>Hora:</strong> {new Date().toLocaleTimeString('es-DO')}</p>
              </div>
            </div>
          </div>

          {/* KPI Summary Banner */}
          <div className="grid grid-cols-4 gap-4 mb-6 p-4 rounded-xl bg-slate-100 border border-slate-300 text-slate-800">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase">Total SKUs:</span>
              <p className="text-xl font-black text-slate-900">{formatNumber(items.length)}</p>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase">Total Unidades:</span>
              <p className="text-xl font-black text-purple-700">{formatNumber(totalUnits)}</p>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase">Inversión Total:</span>
              <p className="text-xl font-black text-emerald-700">{formatCurrency(totalCostInvestment)}</p>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase">Venta Total:</span>
              <p className="text-xl font-black text-slate-900">{formatCurrency(totalRetailPrice)}</p>
            </div>
          </div>

          {/* Table */}
          <table className="w-full text-left text-xs border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-200 text-slate-800 font-bold border-b border-slate-300">
                <th className="p-2 border border-slate-300 text-center w-8">#</th>
                <th className="p-2 border border-slate-300">Código / Barra</th>
                <th className="p-2 border border-slate-300">Descripción</th>
                <th className="p-2 border border-slate-300 text-center">Unidad</th>
                <th className="p-2 border border-slate-300 text-center">Cantidad</th>
                <th className="p-2 border border-slate-300 text-right">Costo Unit.</th>
                <th className="p-2 border border-slate-300 text-right bg-emerald-50 text-emerald-900 font-bold">Inversión Total</th>
                <th className="p-2 border border-slate-300 text-right">Precio Unit.</th>
                <th className="p-2 border border-slate-300 text-right">Precio Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const qty = Number(item.cantidadContada) || 0;
                const cost = Number(item.costo) || 0;
                const price = Number(item.precio) || 0;
                return (
                  <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="p-2 border border-slate-300 text-center font-mono text-slate-500">{idx + 1}</td>
                    <td className="p-2 border border-slate-300 font-mono text-slate-700">
                      {item.codigoInternacional || item.codigoInterno || item.codigo}
                    </td>
                    <td className="p-2 border border-slate-300 font-medium text-slate-900">{item.descripcion}</td>
                    <td className="p-2 border border-slate-300 text-center font-semibold text-slate-700">{item.unidad || 'UNIDAD'}</td>
                    <td className="p-2 border border-slate-300 text-center font-bold text-slate-900 text-sm">{qty}</td>
                    <td className="p-2 border border-slate-300 text-right text-slate-700">{formatCurrency(cost)}</td>
                    <td className="p-2 border border-slate-300 text-right font-bold text-emerald-800 bg-emerald-50/50">
                      {formatCurrency(qty * cost)}
                    </td>
                    <td className="p-2 border border-slate-300 text-right text-slate-700">{formatCurrency(price)}</td>
                    <td className="p-2 border border-slate-300 text-right font-bold text-slate-900">
                      {formatCurrency(qty * price)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-200 font-bold text-slate-900 border-t-2 border-slate-800">
                <td colSpan={4} className="p-2 border border-slate-300 text-right font-extrabold uppercase">TOTALES:</td>
                <td className="p-2 border border-slate-300 text-center font-black text-sm">{formatNumber(totalUnits)}</td>
                <td className="p-2 border border-slate-300"></td>
                <td className="p-2 border border-slate-300 text-right font-black text-emerald-900 bg-emerald-100 text-sm">
                  {formatCurrency(totalCostInvestment)}
                </td>
                <td className="p-2 border border-slate-300"></td>
                <td className="p-2 border border-slate-300 text-right font-black text-sm">
                  {formatCurrency(totalRetailPrice)}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Signatures */}
          <div className="mt-16 pt-8 border-t border-slate-300 grid grid-cols-2 gap-12 text-center text-xs text-slate-600">
            <div>
              <div className="border-b border-slate-400 w-48 mx-auto mb-2" />
              <p className="font-semibold text-slate-800">Firma Auditor / Contador</p>
            </div>
            <div>
              <div className="border-b border-slate-400 w-48 mx-auto mb-2" />
              <p className="font-semibold text-slate-800">Firma Supervisor / Gerencia</p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="no-print px-6 py-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-end gap-3 text-xs">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
