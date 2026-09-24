import React from 'react';
import { TrendingUp, ArrowDownRight, ArrowUpRight, Lock, Scale } from 'lucide-react';

export default function EconomicPerformance({ stats }) {
  const {
    tradingPnl = 0,
    totalCosts = 0,
    totalPayouts = 0,
    capitalRetenido = 0,
    balanceEconomicoCaja = 0,
    valorEconomicoGenerado = 0
  } = stats || {};

  const fmt = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
      <div className="mb-4 pb-3 border-b border-slate-100">
        <h2 className="text-lg font-bold text-slate-800">Resultado Económico Real</h2>
        <p className="text-xs text-slate-500">Diferenciación estricta entre beneficio operativo y flujo de caja.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
          <div className="flex justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase">Trading P&L</span>
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className={`text-xl font-bold ${tradingPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {fmt(tradingPnl)}
          </div>
        </div>

        <div className="p-4 rounded-lg bg-rose-50 border border-rose-100">
          <div className="flex justify-between text-rose-600 mb-1">
            <span className="text-xs font-semibold uppercase">Costos & Fees</span>
            <ArrowDownRight className="w-4 h-4" />
          </div>
          <div className="text-xl font-bold text-rose-600">
            -{fmt(totalCosts)}
          </div>
        </div>

        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100">
          <div className="flex justify-between text-emerald-600 mb-1">
            <span className="text-xs font-semibold uppercase">Payouts Cobrados</span>
            <ArrowUpRight className="w-4 h-4" />
          </div>
          <div className="text-xl font-bold text-emerald-600">
            +{fmt(totalPayouts)}
          </div>
        </div>

        <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
          <div className="flex justify-between text-blue-600 mb-1">
            <span className="text-xs font-semibold uppercase">Capital Retenido</span>
            <Lock className="w-4 h-4" />
          </div>
          <div className={`text-xl font-bold ${capitalRetenido >= 0 ? 'text-blue-700' : 'text-rose-600'}`}>
            {fmt(capitalRetenido)}
          </div>
        </div>

        <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-100">
          <div className="flex justify-between text-indigo-600 mb-1">
            <span className="text-xs font-semibold uppercase">Balance de Caja</span>
            <Scale className="w-4 h-4" />
          </div>
          <div className={`text-xl font-bold ${balanceEconomicoCaja >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
            {fmt(balanceEconomicoCaja)}
          </div>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 flex flex-wrap justify-between">
        <div>
          <span className="font-semibold text-slate-700">Valor Económico Creado: </span>
          <span className={valorEconomicoGenerado >= 0 ? 'text-emerald-600 font-bold ml-1' : 'text-rose-600 font-bold ml-1'}>
            {fmt(valorEconomicoGenerado)}
          </span>
        </div>
        <div>* Los retiros son monetización, no P&L adicional.</div>
      </div>
    </div>
  );
}
