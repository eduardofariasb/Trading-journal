import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';

export default function HourlyPerformanceChart({ data = [] }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-xs text-slate-400">
        Sin datos suficientes para desglosar por hora operativa.
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
          <XAxis dataKey="hour" fontSize={11} stroke="#94A3B8" tickLine={false} />
          <YAxis fontSize={11} stroke="#94A3B8" tickLine={false} tickFormatter={v => `$${v}`} />
          <Tooltip 
            content={({ payload }) => {
              if (!payload || !payload.length) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-white p-2.5 rounded-lg shadow-md border border-slate-100 text-xs">
                  <p className="font-bold text-slate-800">{d.hour}</p>
                  <p className={`font-black ${d.netPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    P&L: {d.netPnl >= 0 ? `+$${d.netPnl.toFixed(2)}` : `-$${Math.abs(d.netPnl).toFixed(2)}`}
                  </p>
                  <p className="text-slate-500 font-medium mt-0.5">{d.trades} trades ({d.winRate}% Win)</p>
                </div>
              );
            }}
          />
          <Bar dataKey="netPnl" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.netPnl >= 0 ? '#10B981' : '#EF4444'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
