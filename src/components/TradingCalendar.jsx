import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getDayStatus } from '../utils/metrics';

export default function TradingCalendar({ dailyData = [] }) {
  // Inicializa en el mes actual
  const [currentDate, setCurrentDate] = useState(() => new Date(2026, 8, 1)); // Septiembre 2026 por defecto

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Mapeo rápido de fecha YYYY-MM-DD -> datos de trading
  const dayDataMap = useMemo(() => {
    const map = new Map();
    dailyData.forEach(d => map.set(d.date, d));
    return map;
  }, [dailyData]);

  // Construcción de la matriz del calendario
  const calendarWeeks = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Ajustar para que la semana empiece en Lunes (0: Lun ... 6: Dom)
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const totalDays = lastDayOfMonth.getDate();
    const weeks = [];
    let currentWeek = [];

    // Rellenar días del mes anterior vacíos
    for (let i = 0; i < startDayOfWeek; i++) {
      currentWeek.push(null);
    }

    // Días del mes
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const data = dayDataMap.get(dateStr) || null;

      currentWeek.push({ dayNumber: day, dateStr, data });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    // Rellenar los días restantes de la última semana
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weeks.push(currentWeek);
    }

    // Calcular balance de cada semana
    return weeks.map(week => {
      let weekPnl = 0;
      let weekTrades = 0;
      let hasData = false;

      week.forEach(cell => {
        if (cell && cell.data) {
          weekPnl += cell.data.netPnl;
          weekTrades += cell.data.totalTrades;
          hasData = true;
        }
      });

      return {
        days: week,
        summary: { weekPnl, weekTrades, hasData, status: getDayStatus(weekPnl) }
      };
    });
  }, [year, month, dayDataMap]);

  // Balance total del mes
  const monthTotalPnl = useMemo(() => {
    return calendarWeeks.reduce((acc, w) => acc + (w.summary.hasData ? w.summary.weekPnl : 0), 0);
  }, [calendarWeeks]);

  const monthTotalTrades = useMemo(() => {
    return calendarWeeks.reduce((acc, w) => acc + (w.summary.hasData ? w.summary.weekTrades : 0), 0);
  }, [calendarWeeks]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 overflow-x-auto">
      {/* Cabecera del Calendario */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Trading Calendar</h3>
          <p className="text-xs text-slate-400 mt-0.5">Distribución mensual, balances semanales y estado BE</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Balance del Mes */}
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Balance Mensual</span>
            <span className={`text-sm font-black ${monthTotalPnl > 30 ? 'text-emerald-600' : monthTotalPnl < -20 ? 'text-rose-600' : 'text-slate-600'}`}>
              {monthTotalPnl >= 0 ? `+$${monthTotalPnl.toFixed(2)}` : `-$${Math.abs(monthTotalPnl).toFixed(2)}`}
              <span className="text-[11px] font-normal text-slate-400 ml-1">({monthTotalTrades} trds)</span>
            </span>
          </div>

          {/* Navegación de Mes */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-1">
            <button onClick={handlePrevMonth} className="p-1 hover:bg-slate-200 rounded text-slate-600">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-700 px-2 min-w-[120px] text-center">
              {monthNames[month]} {year}
            </span>
            <button onClick={handleNextMonth} className="p-1 hover:bg-slate-200 rounded text-slate-600">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Leyenda de Umbrales */}
      <div className="flex items-center gap-4 text-[10px] text-slate-400 mb-3 border-b border-slate-100 pb-2">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Profit (&gt; +$30)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400"></span> Breakeven (-$20 a +$30)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Pérdida (&lt; -$20)</span>
      </div>

      {/* Grid Calendario */}
      <div className="min-w-[650px]">
        {/* Nombres de los días */}
        <div className="grid grid-cols-8 gap-1.5 text-center mb-2">
          {['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'].map(d => (
            <div key={d} className="text-[10px] font-bold text-slate-400 py-1">{d}</div>
          ))}
          <div className="text-[10px] font-bold text-indigo-700 bg-indigo-50 rounded py-1">SEMANA</div>
        </div>

        {/* Semanas */}
        {calendarWeeks.map((weekItem, wIdx) => (
          <div key={wIdx} className="grid grid-cols-8 gap-1.5 mb-1.5">
            {weekItem.days.map((cell, dIdx) => {
              if (!cell) {
                return <div key={dIdx} className="h-20 bg-slate-50/40 rounded-lg border border-slate-100/50" />;
              }

              const { dayNumber, data } = cell;

              if (!data) {
                // Día del mes sin trades registrados (vacío pero con su fecha)
                return (
                  <div key={dIdx} className="h-20 p-1.5 rounded-lg border border-slate-100 bg-white flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-slate-300">{dayNumber}</span>
                  </div>
                );
              }

              // Estilos según el umbral (>30 Profit, <-20 Loss, o Breakeven)
              const status = data.dayStatus;
              let bgBorderClass = 'bg-slate-50 border-slate-200';
              let textPnlClass = 'text-slate-600';

              if (status === 'WIN') {
                bgBorderClass = 'bg-emerald-50/60 border-emerald-300';
                textPnlClass = 'text-emerald-600';
              } else if (status === 'LOSS') {
                bgBorderClass = 'bg-rose-50/60 border-rose-300';
                textPnlClass = 'text-rose-600';
              } else {
                // Breakeven
                bgBorderClass = 'bg-amber-50/50 border-amber-200';
                textPnlClass = 'text-amber-700';
              }

              return (
                <div key={dIdx} className={`h-20 p-1.5 rounded-lg border flex flex-col justify-between transition-all ${bgBorderClass}`}>
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] font-bold text-slate-700">{dayNumber}</span>
                    <span className={`text-[11px] font-black ${textPnlClass}`}>
                      {data.netPnl >= 0 ? `+$${data.netPnl.toFixed(0)}` : `-$${Math.abs(data.netPnl).toFixed(0)}`}
                    </span>
                  </div>
                  <div className="flex justify-between items-end text-[9px] text-slate-500 font-medium">
                    <span>{data.totalTrades} trd</span>
                    <span className="font-bold">{status === 'BE' ? 'BE' : `${data.winRate.toFixed(0)}% W`}</span>
                  </div>
                </div>
              );
            })}

            {/* Columna de Resumen Semanal */}
            <div className={`h-20 rounded-lg border flex flex-col justify-center items-center p-1 ${
              !weekItem.summary.hasData 
                ? 'bg-slate-50/50 border-slate-100 text-slate-300'
                : weekItem.summary.status === 'WIN' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                : weekItem.summary.status === 'LOSS'
                ? 'bg-rose-50 border-rose-200 text-rose-700'
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Total Sem.</span>
              <span className="text-xs font-black">
                {weekItem.summary.hasData
                  ? (weekItem.summary.weekPnl >= 0 ? `+$${weekItem.summary.weekPnl.toFixed(0)}` : `-$${Math.abs(weekItem.summary.weekPnl).toFixed(0)}`)
                  : '-'}
              </span>
              <span className="text-[9px] text-slate-400 font-medium">
                {weekItem.summary.hasData ? `${weekItem.summary.weekTrades} trd` : ''}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
