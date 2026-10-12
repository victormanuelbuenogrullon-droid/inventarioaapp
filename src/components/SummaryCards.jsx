import React from 'react';
import { Package, Hash, DollarSign, TrendingUp, ShoppingCart } from 'lucide-react';
import { formatCurrency, formatNumber } from '../utils/export';

/**
 * Dynamically adjusts typography size based on value length to prevent card distortion
 */
function getDynamicFontSize(valString) {
  const len = String(valString || '').length;
  if (len > 16) return 'text-sm sm:text-base md:text-lg';
  if (len > 13) return 'text-base sm:text-lg md:text-xl';
  if (len > 10) return 'text-lg sm:text-xl md:text-2xl';
  if (len > 7) return 'text-xl sm:text-2xl md:text-3xl';
  return 'text-2xl sm:text-3xl';
}

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

  const strSkus = formatNumber(totalSkus);
  const strUnits = formatNumber(totalUnits);
  const strCost = formatCurrency(totalCostInvestment);
  const strRetail = formatCurrency(totalRetailPrice);
  const strProfit = formatCurrency(potentialGrossProfit);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 my-4">
      
      {/* 1. SKUs Contados */}
      <div className="min-w-0 bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-between shadow-sm hover:border-slate-300 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">SKUs Contados</span>
          <div className="p-2 rounded-xl bg-slate-100 text-slate-600 shrink-0 ml-1">
            <Package className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 min-w-0">
          <div 
            className={`${getDynamicFontSize(strSkus)} font-bold text-slate-900 tracking-tight tabular-nums truncate`}
            title={strSkus}
          >
            {strSkus}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">Líneas de producto distintas</p>
        </div>
      </div>

      {/* 2. Unidades Físicas Contadas */}
      <div className="min-w-0 bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-between shadow-sm hover:border-slate-300 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">Total Unidades</span>
          <div className="p-2 rounded-xl bg-slate-100 text-slate-600 shrink-0 ml-1">
            <Hash className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 min-w-0">
          <div 
            className={`${getDynamicFontSize(strUnits)} font-bold text-slate-900 tracking-tight tabular-nums truncate`}
            title={strUnits}
          >
            {strUnits}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">Piezas físicas contadas</p>
        </div>
      </div>

      {/* 3. Inversión Total Contada (Costo) */}
      <div className="min-w-0 bg-white border border-emerald-200 rounded-2xl p-4 flex flex-col justify-between shadow-sm hover:border-emerald-300 transition-all ring-1 ring-emerald-100">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider truncate">Inversión Total</span>
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 shrink-0 ml-1">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 min-w-0">
          <div 
            className={`${getDynamicFontSize(strCost)} font-extrabold text-emerald-900 tracking-tight tabular-nums truncate`}
            title={strCost}
          >
            {strCost}
          </div>
          <p className="text-[11px] text-emerald-700 font-medium mt-0.5 truncate">Costo total de lo contado</p>
        </div>
      </div>

      {/* 4. Venta Total Contada (Precio) */}
      <div className="min-w-0 bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-between shadow-sm hover:border-slate-300 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">Venta Total</span>
          <div className="p-2 rounded-xl bg-slate-100 text-slate-600 shrink-0 ml-1">
            <ShoppingCart className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 min-w-0">
          <div 
            className={`${getDynamicFontSize(strRetail)} font-bold text-slate-900 tracking-tight tabular-nums truncate`}
            title={strRetail}
          >
            {strRetail}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">Valor en venta al público</p>
        </div>
      </div>

      {/* 5. Margen / Ganancia Proyectada */}
      <div className="min-w-0 col-span-2 sm:col-span-2 lg:col-span-1 bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-between shadow-sm hover:border-slate-300 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">Margen Estimado</span>
          <div className="flex items-center gap-1.5 shrink-0 ml-1">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 tabular-nums">
              {profitMarginPercent}%
            </span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
        </div>
        <div className="mt-2 min-w-0">
          <div 
            className={`${getDynamicFontSize(strProfit)} font-bold text-slate-800 tracking-tight tabular-nums truncate`}
            title={strProfit}
          >
            {strProfit}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">Ganancia bruta proyectada</p>
        </div>
      </div>

    </div>
  );
}
