import React, { useMemo, useState, useEffect, useRef } from 'react';
import { 
  LineChart, Line, BarChart, Bar, AreaChart, Area, RadarChart, PolarGrid, 
  PolarAngleAxis, PolarRadiusAxis, Radar, ScatterChart, Scatter, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, Cell, ZAxis
} from 'recharts';
import { 
  ArrowUpRight, ArrowDownRight, Activity, Target, TrendingUp, 
  Clock, CalendarDays, Upload, X, Image as ImageIcon, Loader2, CheckCircle2,
  ChevronLeft, ChevronRight, Calendar, Settings, Trash2, KeyRound, Database
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, collection, onSnapshot, addDoc, deleteDoc } from 'firebase/firestore';

const projectFirebaseConfig = {
  apiKey: "AIzaSyD1ULw8t4rIbyOjcGdjXPWt560Vb0fS5-M",
  authDomain: "dashboard-calendar-86678.firebaseapp.com",
  projectId: "dashboard-calendar-86678",
  storageBucket: "dashboard-calendar-86678.firebasestorage.app",
  messagingSenderId: "508631874357",
  appId: "1:508631874357:web:de5805c75985b563c1ea7c",
  measurementId: "G-R2PY7YEL19"
};

const storedCustomConfig = typeof window !== 'undefined' ? window.localStorage?.getItem('custom_firebase_config') : null;
const activeFirebaseConfig = storedCustomConfig ? JSON.parse(storedCustomConfig) : projectFirebaseConfig;

const app = initializeApp(activeFirebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'trading-journal-prod';

// --- CONTEXT ---
const DashboardContext = React.createContext({});

// --- MOCK DATA (Fallback cuando aún no hay registros) ---
const themeColors = {
  emerald: '#10B981',
  coral: '#EF4444',
  gray: '#9CA3AF',
  lightGray: '#F3F4F6'
};

const defaultDailyPnLData = [
  { day: '1', date: '2026-09-01', pnl: 250, cumulative: 250, trades: 4, winRate: 75 },
  { day: '2', date: '2026-09-02', pnl: -120, cumulative: 130, trades: 3, winRate: 33 },
  { day: '3', date: '2026-09-03', pnl: 400, cumulative: 530, trades: 5, winRate: 80 },
];

const radarData = [
  { subject: 'Disciplina', score: 85, fullMark: 100 },
  { subject: 'Entrada', score: 70, fullMark: 100 },
  { subject: 'Salida', score: 92, fullMark: 100 },
  { subject: 'Gestión Riesgo', score: 95, fullMark: 100 },
  { subject: 'Paciencia', score: 78, fullMark: 100 },
];

const scatterDurationData = [
  { duration: 12, pnl: 210, isWin: true }, { duration: 25, pnl: -80, isWin: false },
  { duration: 45, pnl: -200, isWin: false }, { duration: 55, pnl: 600, isWin: true },
];

const scatterTimeData = [
  { time: 9.5, pnl: 300, isWin: true }, { time: 10.5, pnl: -200, isWin: false },
  { time: 14.5, pnl: 250, isWin: true }, { time: 15.2, pnl: -300, isWin: false },
];

const analyzeScreenshot = async (base64Data, customApiKey = "") => {
  const apiKey = customApiKey || (typeof window !== 'undefined' ? window.localStorage?.getItem('gemini_api_key') : "") || "";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  const payload = {
      contents: [{
          role: "user",
          parts: [
              { text: "Act as an expert trading data extractor. I am providing a screenshot of a trading platform daily summary (like NinjaTrader or Tradovate). Extract the following metrics:\n1. Date (look for things like 'Sep, 11', format as YYYY-MM-DD).\n2. Net PnL (Net profit/loss, usually a green or red number after fees. If only Gross PnL and Fees are visible, calculate Net PnL = Gross + Fees).\n3. Total Trades.\n4. Winning Trade %.\n5. Avg. Winning Trade.\n6. Avg. Losing Trade.\n\nReturn strictly a JSON object matching this schema exactly. Remove currency symbols and % signs, keep only numbers." },
              { inlineData: { mimeType: "image/png", data: base64Data.split(',')[1] } }
          ]
      }],
      generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
              type: "OBJECT",
              properties: {
                  date: { type: "STRING", description: "YYYY-MM-DD format" },
                  netPnl: { type: "NUMBER" },
                  totalTrades: { type: "INTEGER" },
                  winRate: { type: "NUMBER" },
                  avgWin: { type: "NUMBER" },
                  avgLoss: { type: "NUMBER" }
              },
              required: ["date", "netPnl", "totalTrades", "winRate", "avgWin", "avgLoss"]
          }
      }
  };

  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await res.json();
  if (!data.candidates || data.candidates.length === 0) throw new Error("Could not extract data");
  return JSON.parse(data.candidates[0].content.parts[0].text);
};

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5 ${className}`}>
    {children}
  </div>
);

const CardTitle = ({ title, subtitle, icon: Icon }) => (
  <div className="flex items-center justify-between mb-4">
    <div>
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</h3>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
    {Icon && <Icon className="w-4 h-4 text-gray-400" />}
  </div>
);

const SemiCircleGauge = ({ value, max, label, prefix = "", suffix = "", color = themeColors.emerald }) => {
  const percentage = Math.min((value / max) * 100, 100);
  const radius = 36;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center relative h-24">
      <svg width="100" height="55" viewBox="0 0 100 55" className="overflow-visible">
        <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke={themeColors.lightGray} strokeWidth="10" strokeLinecap="round" />
        <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute bottom-1 text-center flex flex-col items-center">
        <span className="text-xl font-bold text-gray-800">{prefix}{value}{suffix}</span>
        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</span>
      </div>
    </div>
  );
};

const KpiRow = () => {
  const { chartData, rawData } = React.useContext(DashboardContext);
  
  const isReal = rawData.length > 0;
  const netPnl = chartData.reduce((sum, day) => sum + day.pnl, 0);
  
  const totalTrades = chartData.reduce((sum, day) => sum + day.trades, 0);
  const totalWins = chartData.reduce((sum, day) => sum + (day.trades * (day.winRate / 100)), 0);
  const aggregateWinRate = totalTrades > 0 ? Math.round((totalWins / totalTrades) * 100) : 0;
  
  const winDays = chartData.filter(d => d.pnl > 0).length;
  const dayWinRate = chartData.length > 0 ? Math.round((winDays / chartData.length) * 100) : 0;

  const avgWin = isReal ? (rawData.reduce((sum, d) => sum + d.avgWin, 0) / rawData.length) : 350.50;
  const avgLoss = isReal ? (Math.abs(rawData.reduce((sum, d) => sum + d.avgLoss, 0) / rawData.length)) : 145.20;
  const profitFactor = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : 0;
  
  const avgWinWidth = Math.min((avgWin / (avgWin + avgLoss)) * 100, 100);
  const avgLossWidth = 100 - avgWinWidth;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      <Card>
        <CardTitle title="Net P&L" subtitle={isReal ? "Datos Reales" : "Datos Demo"} icon={Activity} />
        <div className="flex items-end justify-between mt-2">
          <div>
            <span className={`text-3xl font-bold ${netPnl >= 0 ? 'text-emerald-500' : 'text-coral-500'}`}>
              {netPnl >= 0 ? '+' : ''}${netPnl.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 2})}
            </span>
          </div>
        </div>
        <div className="h-12 mt-2 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData.slice(-7)}>
              <Line type="monotone" dataKey="cumulative" stroke={themeColors.emerald} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="flex flex-col">
        <CardTitle title="Trade Win %" icon={Target} />
        <div className="flex-grow flex items-center justify-center">
          <SemiCircleGauge value={aggregateWinRate} max={100} suffix="%" label="Win Rate" />
        </div>
      </Card>

      <Card className="flex flex-col">
        <CardTitle title="Profit Factor" icon={TrendingUp} />
        <div className="flex-grow flex items-center justify-center">
          <SemiCircleGauge value={profitFactor} max={5} label="Gross Win/Loss" color="#3B82F6" />
        </div>
      </Card>

      <Card className="flex flex-col">
        <CardTitle title="Day Win %" icon={CalendarDays} />
        <div className="flex-grow flex items-center justify-center">
          <SemiCircleGauge value={dayWinRate} max={100} suffix="%" label="Días Positivos" />
        </div>
      </Card>

      <Card>
        <CardTitle title="Avg Win / Loss" icon={Activity} />
        <div className="mt-4">
          <div className="flex justify-between text-sm font-semibold mb-2">
            <span className="text-emerald-500">+${avgWin.toFixed(2)}</span>
            <span className="text-coral-500">-${avgLoss.toFixed(2)}</span>
          </div>
          <div className="w-full h-3 flex rounded-full overflow-hidden mb-2 bg-gray-100">
            <div className="bg-emerald-500 h-full transition-all" style={{ width: `${avgWinWidth}%` }}></div>
            <div className="bg-coral-500 h-full transition-all" style={{ width: `${avgLossWidth}%` }}></div>
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 uppercase tracking-wider">
            <span>Avg Ganador</span>
            <span>Avg Perdedor</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

const MainChartsRow = () => {
  const { chartData } = React.useContext(DashboardContext);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      <Card>
        <CardTitle title="Trade Score" subtitle="Evaluación operativa" />
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
              <PolarGrid stroke={themeColors.lightGray} />
              <PolarAngleAxis dataKey="subject" tick={{ fill: themeColors.gray, fontSize: 11, fontWeight: 500 }} />
              <Radar name="Score" dataKey="score" stroke={themeColors.emerald} fill={themeColors.emerald} fillOpacity={0.3} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <CardTitle title="Daily P&L" subtitle="Resultado neto diario" />
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={themeColors.lightGray} />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: themeColors.gray, fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: themeColors.gray, fontSize: 10 }} />
              <Tooltip 
                cursor={{ fill: 'transparent' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                formatter={(value) => [`$${value}`, 'P&L']}
              />
              <Bar dataKey="pnl" radius={[4, 4, 4, 4]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? themeColors.emerald : themeColors.coral} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <CardTitle title="Cumulative P&L" subtitle="Curva de capital acumulado" />
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={themeColors.emerald} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={themeColors.emerald} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={themeColors.lightGray} />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: themeColors.gray, fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: themeColors.gray, fontSize: 10 }} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                formatter={(value) => [`$${value}`, 'Capital']}
              />
              <Area type="monotone" dataKey="cumulative" stroke={themeColors.emerald} strokeWidth={3} fillOpacity={1} fill="url(#colorCumulative)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};

const BottomRow = () => {
  const { chartData, rawData, allTrades, dateFilter, onDeleteTrade } = React.useContext(DashboardContext);
  
  const [viewDate, setViewDate] = useState(() => {
    const source = allTrades && allTrades.length > 0 ? allTrades : chartData;
    if (source && source.length > 0) {
      const lastDate = source[source.length - 1].date;
      if (lastDate) {
         const [y, m] = lastDate.split('-');
         return new Date(parseInt(y), parseInt(m) - 1, 1); 
      }
    }
    return new Date();
  });

  useEffect(() => {
    if (dateFilter && dateFilter !== 'all') {
      const [y, m] = dateFilter.split('-');
      setViewDate(new Date(parseInt(y), parseInt(m) - 1, 1));
    } else if (allTrades && allTrades.length > 0) {
      const lastDate = allTrades[allTrades.length - 1].date;
      if (lastDate) {
        const [y, m] = lastDate.split('-');
        setViewDate(new Date(parseInt(y), parseInt(m) - 1, 1));
      }
    }
  }, [dateFilter, allTrades?.length]);

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const calendarWeeks = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    let startDayIndex = firstDay.getDay() - 1;
    if (startDayIndex === -1) startDayIndex = 6; 

    const weeks = [];
    let currentWeek = [];
    let weekSummary = { pnl: 0, trades: 0 };

    for (let i = 0; i < startDayIndex; i++) {
      currentWeek.push({ isEmpty: true });
    }

    const sourceData = (allTrades && allTrades.length > 0) ? allTrades : chartData;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayData = sourceData.find(t => t.date === dateStr) || {};
      
      const pnlVal = dayData.netPnl !== undefined ? dayData.netPnl : (dayData.pnl || 0);
      const tradesVal = dayData.totalTrades !== undefined ? dayData.totalTrades : (dayData.trades || 0);
      const winRateVal = dayData.winRate || 0;

      currentWeek.push({
        id: dayData.id,
        date: d,
        dateStr,
        pnl: pnlVal,
        trades: tradesVal,
        winRate: winRateVal,
        isEmpty: false,
        hasRealRecord: Boolean(dayData.id)
      });

      weekSummary.pnl += pnlVal;
      weekSummary.trades += tradesVal;

      if (currentWeek.length === 7) {
        weeks.push({ days: currentWeek, summary: weekSummary });
        currentWeek = [];
        weekSummary = { pnl: 0, trades: 0 };
      }
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({ isEmpty: true });
      }
      weeks.push({ days: currentWeek, summary: weekSummary });
    }

    return weeks;
  }, [allTrades, chartData, viewDate]);

  const overtradingData = useMemo(() => {
    if (!rawData || rawData.length === 0) return scatterTimeData;
    
    return rawData.map(day => ({
      trades: day.totalTrades,
      pnl: day.netPnl,
      isWin: day.netPnl >= 0,
      date: day.date
    }));
  }, [rawData]);

  const profitFactorData = useMemo(() => {
    if (!rawData || rawData.length === 0) return scatterDurationData;
    
    return rawData.filter(day => day.avgLoss !== 0).map(day => {
       const profitFactor = Math.abs(day.avgWin / day.avgLoss);
       return {
         profitFactor: parseFloat(profitFactor.toFixed(2)),
         winRate: day.winRate,
         isWin: day.netPnl >= 0,
         date: day.date
       };
    });
  }, [rawData]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Trading Calendar</h3>
            <p className="text-xs text-gray-400 mt-0.5">Desempeño mensual exacto</p>
          </div>
          <div className="flex items-center gap-2 bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-100">
            <button 
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} 
              className="p-1 hover:bg-white hover:shadow-sm rounded transition-all"
            >
              <ChevronLeft className="w-4 h-4 text-gray-500"/>
            </button>
            <span className="text-sm font-bold text-gray-700 min-w-[140px] text-center">
              {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <button 
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} 
              className="p-1 hover:bg-white hover:shadow-sm rounded transition-all"
            >
              <ChevronRight className="w-4 h-4 text-gray-500"/>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-8 gap-2 mb-2 text-center">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
            <div key={d} className="text-xs font-bold text-gray-400 uppercase">{d}</div>
          ))}
          <div className="text-xs font-bold text-gray-500 uppercase bg-gray-50 rounded py-1">Semana</div>
        </div>

        <div className="flex flex-col gap-2">
          {calendarWeeks.map((week, wIdx) => (
            <div key={`week-${wIdx}`} className="grid grid-cols-8 gap-2">
              {week.days.map((day, dIdx) => {
                if (day.isEmpty) {
                  return <div key={`empty-${wIdx}-${dIdx}`} className="p-2 h-24 rounded-lg bg-transparent"></div>;
                }

                return (
                  <div key={`day-${wIdx}-${dIdx}`} className={`p-2 h-24 border rounded-lg flex flex-col justify-between transition-all group relative
                    ${day.trades > 0 && day.pnl >= 0 ? 'bg-emerald-50/50 border-emerald-100 hover:bg-emerald-50' : ''} 
                    ${day.trades > 0 && day.pnl < 0 ? 'bg-red-50/50 border-coral-100 hover:bg-red-50' : ''}
                    ${day.trades === 0 ? 'bg-gray-50/30 border-gray-100' : ''}
                  `}>
                    <div className="flex justify-between items-start">
                      <span className={`text-xs font-medium ${day.trades > 0 ? 'text-gray-800' : 'text-gray-400'}`}>
                        {day.date}
                      </span>
                      {day.trades > 0 && (
                        <div className="flex items-center gap-1">
                          <span className={`text-xs font-bold ${day.pnl >= 0 ? 'text-emerald-600' : 'text-coral-500'}`}>
                            {day.pnl >= 0 ? '+' : ''}{day.pnl}
                          </span>
                          {day.hasRealRecord && onDeleteTrade && (
                            <button
                              onClick={() => onDeleteTrade(day.id)}
                              title="Eliminar este registro"
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-red-600 text-gray-400"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {day.trades > 0 && (
                      <div className="flex justify-between items-end mt-auto">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-gray-500">{day.trades} Trades</span>
                        </div>
                        <div className="text-[10px] font-semibold text-gray-600 bg-white px-1.5 py-0.5 rounded shadow-sm border border-gray-100">
                          {day.winRate}% W
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              
              <div className={`p-2 h-24 rounded-lg flex flex-col justify-center items-center border-l-2
                ${week.summary.trades === 0 ? 'bg-gray-50/30 border-gray-100' : 
                  (week.summary.pnl >= 0 ? 'bg-emerald-50/30 border-emerald-200' : 'bg-red-50/30 border-coral-200')}
              `}>
                <span className="text-[10px] text-gray-500 uppercase font-semibold mb-1">P&L Neto</span>
                {week.summary.trades > 0 ? (
                  <>
                    <span className={`text-sm font-bold ${week.summary.pnl >= 0 ? 'text-emerald-600' : 'text-coral-500'}`}>
                      {week.summary.pnl >= 0 ? '+' : ''}${Math.abs(week.summary.pnl).toFixed(0)}
                    </span>
                    <span className="text-[10px] text-gray-400 mt-1">{week.summary.trades} trd</span>
                  </>
                ) : (
                  <span className="text-sm font-bold text-gray-300">$0</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-col gap-6">
        <Card className="flex-1">
          <CardTitle title="Overtrading Analysis" subtitle="Total Trades vs P&L" icon={Activity} />
          <div className="h-48 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={themeColors.lightGray} />
                <XAxis type="number" dataKey="trades" name="Trades" axisLine={false} tickLine={false} tick={{ fill: themeColors.gray, fontSize: 10 }} />
                <YAxis type="number" dataKey="pnl" name="P&L" unit="$" axisLine={false} tickLine={false} tick={{ fill: themeColors.gray, fontSize: 10 }} />
                <ZAxis type="number" range={[50, 50]} />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }} 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  formatter={(value, name) => [name === 'pnl' ? `$${value}` : value, name === 'pnl' ? 'P&L' : 'Trades']}
                  labelFormatter={() => ''}
                />
                <Scatter data={overtradingData} shape="circle">
                  {overtradingData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.isWin ? themeColors.emerald : themeColors.coral} fillOpacity={0.7} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-gray-400 mt-2 text-center">¿Pierdes dinero cuando realizas demasiados trades en el día?</p>
        </Card>

        <Card className="flex-1">
          <CardTitle title="Calidad vs Win Rate" subtitle="Profit Factor vs Win %" icon={Target} />
          <div className="h-48 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={themeColors.lightGray} />
                <XAxis type="number" dataKey="profitFactor" name="Profit Factor" axisLine={false} tickLine={false} tick={{ fill: themeColors.gray, fontSize: 10 }} domain={[0, 'auto']} />
                <YAxis type="number" dataKey="winRate" name="Win Rate" unit="%" axisLine={false} tickLine={false} tick={{ fill: themeColors.gray, fontSize: 10 }} domain={[0, 100]} />
                <ZAxis type="number" range={[50, 50]} />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }} 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  formatter={(value, name) => [name === 'winRate' ? `${value}%` : value, name === 'winRate' ? 'Win Rate' : 'Profit Factor']}
                  labelFormatter={() => ''}
                />
                <Scatter data={profitFactorData} shape="circle">
                  {profitFactorData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.isWin ? themeColors.emerald : themeColors.coral} fillOpacity={0.7} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
           <p className="text-[10px] text-gray-400 mt-2 text-center">Un alto Win % no compensa si tus pérdidas promedio son gigantes.</p>
        </Card>
      </div>
    </div>
  );
};

const SettingsModal = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState(() => (typeof window !== 'undefined' ? window.localStorage?.getItem('gemini_api_key') || '' : ''));
  const [customFirebase, setCustomFirebase] = useState(() => (typeof window !== 'undefined' ? window.localStorage?.getItem('custom_firebase_config') || '' : ''));
  const [savedMessage, setSavedMessage] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('gemini_api_key', apiKey.trim());
      if (customFirebase.trim()) {
        window.localStorage.setItem('custom_firebase_config', customFirebase.trim());
      } else {
        window.localStorage.removeItem('custom_firebase_config');
      }
    }
    setSavedMessage(true);
    setTimeout(() => {
      setSavedMessage(false);
      onClose();
      window.location.reload();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden p-6 space-y-4">
        <div className="flex justify-between items-center border-b pb-3">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-500" /> Configurar Producción y Llaves
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs text-gray-600">
          <div>
            <label className="font-semibold block mb-1 text-gray-700 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-blue-500" /> Google Gemini API Key (Gratis)
            </label>
            <input
              type="password"
              placeholder="AIzaSy..."
              className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono text-xs"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="text-[10px] text-gray-400 mt-1">Obtén tu clave gratis en Google AI Studio (aistudio.google.com).</p>
          </div>

          <div>
            <label className="font-semibold block mb-1 text-gray-700 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-amber-500" /> Firebase Config JSON (Opcional)
            </label>
            <textarea
              rows={4}
              placeholder='{"apiKey": "...", "authDomain": "...", "projectId": "..."}'
              className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono text-[11px]"
              value={customFirebase}
              onChange={(e) => setCustomFirebase(e.target.value)}
            />
            <p className="text-[10px] text-gray-400 mt-1">Pega la configuración de tu propio proyecto en firebase.google.com para tener tu propia base de datos permanente.</p>
          </div>
        </div>

        {savedMessage && (
          <div className="p-2 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded text-center">
            ¡Configuración guardada! Reiniciando...
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t">
          <button onClick={onClose} className="px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700">
            Cerrar
          </button>
          <button onClick={handleSave} className="px-4 py-2 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
};

const UploadModal = ({ isOpen, onClose, onSave, userId }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(null);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleFileSelect = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setFormData(null);
      setError(null);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result);
      reader.readAsDataURL(selected);
    }
  };

  const handleAnalyze = async () => {
    if (!preview) return;
    setLoading(true);
    setError(null);
    try {
      const data = await analyzeScreenshot(preview);
      setFormData(data);
    } catch (err) {
      console.error(err);
      setError("Fallo al analizar la imagen. Intenta con una captura más clara o revisa tu clave de Gemini.");
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!formData || !userId) return;
    try {
      setLoading(true);
      const collectionRef = collection(db, 'artifacts', appId, 'users', userId, 'trading_days');
      await addDoc(collectionRef, {
        ...formData,
        createdAt: new Date().toISOString()
      });
      onSave();
    } catch(err) {
      console.error("Save error:", err);
      setError("No se pudo guardar en la base de datos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="font-semibold text-gray-700 flex items-center gap-2">
            <Upload className="w-5 h-5 text-emerald-500" />
            Subir Captura Diaria
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          {!preview ? (
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-gray-50 transition-colors relative">
              <input type="file" accept="image/*" onChange={handleFileSelect} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              <ImageIcon className="w-10 h-10 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-700">Haz clic o arrastra tu captura aquí</p>
              <p className="text-xs text-gray-400 mt-1">Soporta PNG, JPG</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-lg overflow-hidden border">
                <img src={preview} alt="Preview" className="w-full h-auto object-contain max-h-48" />
                <button onClick={() => {setPreview(null); setFormData(null);}} className="absolute top-2 right-2 bg-slate-900/60 p-1.5 rounded-full text-white hover:bg-slate-900/80">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {!formData && !loading && (
                <button onClick={handleAnalyze} className="w-full py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 flex items-center justify-center gap-2">
                  <span>Analizar con Inteligencia Artificial</span>
                </button>
              )}

              {loading && (
                <div className="flex flex-col items-center justify-center py-6 text-emerald-600">
                  <Loader2 className="w-8 h-8 animate-spin mb-2" />
                  <p className="text-sm font-medium">Procesando imagen con Gemini...</p>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 text-center">
                  {error}
                </div>
              )}

              {formData && (
                <div className="bg-emerald-50/30 border border-emerald-100 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wide flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Revisa y edita los datos
                    </h4>
                  </div>
                  <p className="text-[10px] text-gray-500 mb-3">Asegúrate de que la fecha coincida con la de tu sesión operativa.</p>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex flex-col">
                      <span className="text-gray-600 text-xs mb-1 font-medium">Fecha</span>
                      <input 
                        type="date" 
                        className="p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" 
                        value={formData.date || ''} 
                        onChange={e => setFormData({...formData, date: e.target.value})} 
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-gray-600 text-xs mb-1 font-medium">Net P&L ($)</span>
                      <input 
                        type="number" step="0.01" 
                        className={`p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-semibold ${formData.netPnl >= 0 ? 'text-emerald-600' : 'text-red-500'}`} 
                        value={formData.netPnl || 0} 
                        onChange={e => setFormData({...formData, netPnl: parseFloat(e.target.value)})} 
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-gray-600 text-xs mb-1 font-medium">Total Trades</span>
                      <input 
                        type="number" 
                        className="p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" 
                        value={formData.totalTrades || 0} 
                        onChange={e => setFormData({...formData, totalTrades: parseInt(e.target.value) || 0})} 
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-gray-600 text-xs mb-1 font-medium">Win Rate (%)</span>
                      <input 
                        type="number" step="0.1" 
                        className="p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" 
                        value={formData.winRate || 0} 
                        onChange={e => setFormData({...formData, winRate: parseFloat(e.target.value) || 0})} 
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-gray-600 text-xs mb-1 font-medium">Avg Win ($)</span>
                      <input 
                        type="number" step="0.01" 
                        className="p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-emerald-600" 
                        value={formData.avgWin || 0} 
                        onChange={e => setFormData({...formData, avgWin: parseFloat(e.target.value) || 0})} 
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-gray-600 text-xs mb-1 font-medium">Avg Loss ($)</span>
                      <input 
                        type="number" step="0.01" 
                        className="p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-red-500" 
                        value={formData.avgLoss || 0} 
                        onChange={e => setFormData({...formData, avgLoss: parseFloat(e.target.value) || 0})} 
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        {formData && (
          <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
            <button onClick={() => {setPreview(null); setFormData(null);}} className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={loading} className="px-5 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 transition-colors disabled:opacity-50 flex items-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Guardar en el Journal
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const App = () => {
  const [user, setUser] = useState(null);
  const [realTrades, setRealTrades] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');
  const [authErrorMsg, setAuthErrorMsg] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        setAuthErrorMsg(null);
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          try {
            await signInWithCustomToken(auth, __initial_auth_token);
            return;
          } catch (tokenErr) {
            console.warn("Token previo no coincide. Iniciando sesión anónima...", tokenErr);
          }
        }
        await signInAnonymously(auth);
      } catch (e) {
        console.error("Auth error", e);
        if (e.code === 'auth/admin-restricted-operation' || e.message?.includes('admin-restricted-operation')) {
          setAuthErrorMsg("Habilita el proveedor 'Anónimo' en tu Firebase Console (Authentication > Sign-in method) para permitir guardar datos.");
        } else {
          setAuthErrorMsg(e.message || "Error al autenticar en Firebase.");
        }
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const collectionRef = collection(db, 'artifacts', appId, 'users', user.uid, 'trading_days');
    const unsubscribe = onSnapshot(collectionRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => a.date.localeCompare(b.date));
      setRealTrades(data);
    }, (error) => console.error("Firestore error:", error));
    
    return () => unsubscribe();
  }, [user]);

  const handleDeleteTrade = async (docId) => {
    if (!user || !docId) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'trading_days', docId);
      await deleteDoc(docRef);
    } catch (err) {
      console.error("Error deleting record:", err);
    }
  };

  const availableMonths = useMemo(() => {
    if (!realTrades || realTrades.length === 0) return [];
    const months = new Set(realTrades.map(t => t.date.substring(0, 7)));
    return Array.from(months).sort().reverse();
  }, [realTrades]);

  const filteredTrades = useMemo(() => {
    if (dateFilter === 'all') return realTrades;
    return realTrades.filter(t => t.date.startsWith(dateFilter));
  }, [realTrades, dateFilter]);

  const chartData = useMemo(() => {
    if (filteredTrades.length === 0) {
      if (realTrades.length === 0) return defaultDailyPnLData;
      return [];
    }
    
    let cumulative = 0;
    return filteredTrades.map((t, i) => {
      cumulative += t.netPnl;
      return {
        id: t.id,
        day: (i + 1).toString(),
        date: t.date,
        pnl: t.netPnl,
        cumulative: cumulative,
        trades: t.totalTrades,
        winRate: t.winRate
      };
    });
  }, [filteredTrades, realTrades.length]);

  const formatMonthStr = (yyyy_mm) => {
    const [y, m] = yyyy_mm.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, 1);
    return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());
  };

  return (
    <DashboardContext.Provider value={{ 
      chartData, 
      rawData: filteredTrades, 
      allTrades: realTrades, 
      dateFilter,
      onDeleteTrade: handleDeleteTrade
    }}>
      <div className="min-h-screen bg-[#F8FAFC] text-slate-800 p-4 md:p-8 font-sans">
        <div className="max-w-[1600px] mx-auto">
          
          <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Trading Journal Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                {realTrades.length > 0 ? (
                  <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-4 h-4"/> Sincronizado en tiempo real</span>
                ) : (
                  "Mostrando datos de demostración. ¡Sube tu primera captura!"
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {realTrades.length > 0 && (
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2.5 shadow-sm">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <select
                    className="bg-transparent border-none text-sm font-medium text-gray-700 focus:outline-none cursor-pointer"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                  >
                    <option value="all">Histórico Completo</option>
                    {availableMonths.map(m => (
                      <option key={m} value={m}>{formatMonthStr(m)}</option>
                    ))}
                  </select>
                </div>
              )}
              <button 
                onClick={() => setIsSettingsOpen(true)}
                title="Configuración de Credenciales"
                className="p-2.5 bg-white border border-gray-200 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 shadow-sm transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2.5 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 shadow-sm transition-colors flex items-center gap-2"
              >
                <Upload className="w-4 h-4" /> Subir Captura
              </button>
            </div>
          </header>

          {authErrorMsg && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm flex items-center justify-between">
              <div>
                <strong>Aviso de autenticación:</strong> {authErrorMsg}
              </div>
              <button 
                onClick={() => setAuthErrorMsg(null)}
                className="ml-4 text-amber-600 hover:text-amber-800 font-bold text-xs uppercase"
              >
                Cerrar
              </button>
            </div>
          )}

          <main>
            <KpiRow />
            <MainChartsRow />
            <BottomRow />
          </main>
          
        </div>
      </div>

      <UploadModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={() => setIsModalOpen(false)}
        userId={user?.uid}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </DashboardContext.Provider>
  );
};

export default App;
