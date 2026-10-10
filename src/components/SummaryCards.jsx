import React from 'react';
import { Package, Hash, DollarSign, TrendingUp, ShoppingCart } from 'lucide-react';
import { formatCurrency, formatNumber } from '../utils/export';

export default function SummaryCards({ items }) {
  // Aggregate totals
  const totalSkus = items.length;
  
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

  const potentialGrossProfit = totalRetailPrice - totalCostInvestment;
  const profitMarginPercent = totalRetailPrice > 0 
    ? ((potentialGrossProfit / totalRetailPrice) * 100).toFixed(1) 
    : '0.0';

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 my-4">
      
      {/* 1. SKUs Contados */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-between shadow-sm hover:border-slate-300 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">SKUs Contados</span>
          <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
            <Package className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {formatNumber(totalSkus)}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Líneas de producto distintas</p>
        </div>
      </div>

      {/* 2. Unidades Físicas Contadas */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-between shadow-sm hover:border-slate-300 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Unidades</span>
          <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
            <Hash className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {formatNumber(totalUnits)}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Piezas físicas contadas</p>
        </div>
      </div>

      {/* 3. Inversión Total Contada (Costo) */}
      <div className="bg-white border border-emerald-200 rounded-2xl p-4 flex flex-col justify-between shadow-sm hover:border-emerald-300 transition-all ring-1 ring-emerald-100">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Inversión Total</span>
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-900 tracking-tight">
            {formatCurrency(totalCostInvestment)}
          </div>
          <p className="text-[11px] text-emerald-700 font-medium mt-0.5">Costo total de lo contado</p>
        </div>
      </div>

      {/* 4. Venta Total Contada (Precio) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-between shadow-sm hover:border-slate-300 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Venta Total</span>
          <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
            <ShoppingCart className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {formatCurrency(totalRetailPrice)}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Valor en venta al público</p>
        </div>
      </div>

      {/* 5. Margen / Ganancia Proyectada */}
      <div className="col-span-2 sm:col-span-2 lg:col-span-1 bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-between shadow-sm hover:border-slate-300 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Margen Estimado</span>
          <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <div className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
            {formatCurrency(potentialGrossProfit)}
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
            {profitMarginPercent}%
          </span>
        </div>
        <p className="text-[11px] text-slate-500 mt-0.5">Ganancia bruta proyectada</p>
      </div>

    </div>
  );
}
