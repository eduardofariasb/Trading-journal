import React, { useMemo, useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, AreaChart, Area, RadarChart, PolarGrid, 
  PolarAngleAxis, PolarRadiusAxis, Radar, ScatterChart, Scatter, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { 
  ArrowUpRight, Activity, Target, TrendingUp, 
  CalendarDays, Upload, X, Image as ImageIcon, Loader2, CheckCircle2,
  ChevronLeft, ChevronRight, Calendar, Settings, Trash2, KeyRound, Database,
  Wallet, DollarSign, Award, CalendarClock, Edit3, ShieldCheck, Sparkles,
  BarChart2, ClipboardPaste, Copy, FileText, AlertTriangle
} from 'lucide-react';

import { auth, db, appId } from './services/firebaseConfig';

// Nuevos imports de la arquitectura modular
import { 
  calculateTradingStats, 
  calculateEconomicStats, 
  aggregateDailyTradingData, 
  normalizeTradingRecord 
} from './utils/metrics';

import EconomicPerformance from './components/EconomicPerformance';
// import { transitionToFunded, resetAccountCycle } from './services/dbServices'; // (Descomenta esto cuando vayas a usar estas funciones en tus botones/modales)

const DashboardContext = React.createContext({});

const themeColors = {
  emerald: '#10B981',
  coral: '#EF4444',
  gray: '#9CA3AF',
  lightGray: '#F3F4F6'
};

const demoTrades = [
  { id: '1', date: '2026-08-17', netPnl: -235, totalTrades: 3, winRate: 0, account: 'Cuenta Principal', avgWin: 0, avgLoss: -235 },
  { id: '2', date: '2026-08-18', netPnl: -434, totalTrades: 11, winRate: 36, account: 'Cuenta Principal', avgWin: 120, avgLoss: -75 },
  { id: '3', date: '2026-08-19', netPnl: 306.5, totalTrades: 30, winRate: 46.67, account: 'Cuenta Principal', avgWin: 80, avgLoss: -60 },
  { id: '4', date: '2026-08-20', netPnl: -923, totalTrades: 24, winRate: 37.5, account: 'Cuenta Principal', avgWin: 150, avgLoss: -110 },
  { id: '5', date: '2026-08-21', netPnl: 311, totalTrades: 1, winRate: 100, account: 'Cuenta Principal', avgWin: 311, avgLoss: 0 },
  { id: '6', date: '2026-08-24', netPnl: 0, totalTrades: 5, winRate: 40, account: 'Cuenta Principal', avgWin: 100, avgLoss: -100 },
  { id: '7', date: '2026-08-25', netPnl: -197.5, totalTrades: 8, winRate: 25, account: 'Cuenta Principal', avgWin: 100, avgLoss: -80 },
  { id: '8', date: '2026-08-26', netPnl: 583, totalTrades: 2, winRate: 100, account: 'Cuenta Principal', avgWin: 291.5, avgLoss: 0 },
  { id: '9', date: '2026-08-27', netPnl: 374.5, totalTrades: 1, winRate: 100, account: 'Cuenta Principal', avgWin: 374.5, avgLoss: 0 },
  { id: '10', date: '2026-08-28', netPnl: -164, totalTrades: 3, winRate: 33.33, account: 'Cuenta Principal', avgWin: 80, avgLoss: -122 },
  { id: '11', date: '2026-08-31', netPnl: 608, totalTrades: 1, winRate: 100, account: 'Cuenta Principal', avgWin: 608, avgLoss: 0 },
  { id: '0', date: '2026-07-31', netPnl: 2800, totalTrades: 10, winRate: 60, account: 'Cuenta Principal', avgWin: 450, avgLoss: -150 }
];

const demoAccountsMeta = {
  'Cuenta Principal': {
    type: 'funded',
    targetProfit: 3000,
    purchaseDate: '2026-07-01',
    expirationDate: '2026-11-24',
    initialBalance: 50000,
    accountCost: 150, // Costo simulado para ver la métrica financiera
    totalPayouts: 1500 // Retiros simulados para ver la métrica financiera
  }
};

const radarData = [
  { subject: 'Disciplina', score: 85, fullMark: 100 },
  { subject: 'Entrada', score: 70, fullMark: 100 },
  { subject: 'Salida', score: 92, fullMark: 100 },
  { subject: 'Gestión Riesgo', score: 95, fullMark: 100 },
  { subject: 'Paciencia', score: 78, fullMark: 100 },
];

const parsePastedTradingData = (text) => {
  if (!text || typeof text !== 'string') return null;

  try {
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed && typeof parsed === 'object') {
        const todayStr = new Date().toISOString().split('T')[0];
        return {
          date: parsed.date || todayStr,
          netPnl: Number(parsed.netPnl ?? parsed.pnl ?? parsed.net_pnl ?? 0),
          totalTrades: parseInt(parsed.totalTrades ?? parsed.trades ?? parsed.total_trades ?? 0, 10),
          winRate: Number(parsed.winRate ?? parsed.win_rate ?? parsed.winrate ?? 0),
          avgWin: Number(parsed.avgWin ?? parsed.avg_win ?? 0),
          avgLoss: Number(parsed.avgLoss ?? parsed.avg_loss ?? 0)
        };
      }
    }
  } catch {}

  const extractNum = (regex) => {
    const m = text.match(regex);
    if (!m) return null;
    const clean = m[1].replace(/\$/g, '').replace(/,/g, '').trim();
    const val = parseFloat(clean);
    return isNaN(val) ? null : val;
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})/) || text.match(/(\d{2}\/\d{2}\/\d{4})/);
  let extractedDate = todayStr;
  if (dateMatch) {
    if (dateMatch[1].includes('/')) {
      const [d, m, y] = dateMatch[1].split('/');
      extractedDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    } else {
      extractedDate = dateMatch[1];
    }
  }

  return {
    date: extractedDate,
    netPnl: extractNum(/(?:net\s*pnl|pnl\s*neto|resultado|profit|net\s*profit|ganancia\s*neta)[\s:=]+([+-]?\$?[\d,.-]+)/i) ?? 0,
    totalTrades: Math.round(extractNum(/(?:total\s*trades|trades|operaciones|total\s*operaciones)[\s:=]+(\d+)/i) ?? 0),
    winRate: extractNum(/(?:win\s*rate|tasa\s*de\s*acierto|winning\s*%|efectividad)[\s:=]+([\d,.-]+)/i) ?? 0,
    avgWin: extractNum(/(?:avg\s*win|ganancia\s*promedio|average\s*win)[\s:=]+([+-]?\$?[\d,.-]+)/i) ?? 0,
    avgLoss: extractNum(/(?:avg\s*loss|p[eé]rdida\s*promedio|average\s*loss)[\s:=]+([+-]?\$?[\d,.-]+)/i) ?? 0
  };
};

const AccountConfigModal = ({ isOpen, onClose, accountName, initialMeta, onSave, onRename, onDelete, onReset }) => {
  const [type, setType] = useState('eval');
  const [targetProfit, setTargetProfit] = useState(3000);
  const [purchaseDate, setPurchaseDate] = useState('2026-09-01');
  const [expirationDate, setExpirationDate] = useState('2026-09-30');
  const [initialBalance, setInitialBalance] = useState(50000);
  const [accountCost, setAccountCost] = useState(0);
  const [totalPayouts, setTotalPayouts] = useState(0);
  const [newName, setNewName] = useState('');
  const [confirmAction, setConfirmAction] = useState(null); // null | 'reset' | 'delete'

  useEffect(() => {
    if (initialMeta) {
      setType(initialMeta.type || 'eval');
      setTargetProfit(initialMeta.targetProfit || 3000);
      setPurchaseDate(initialMeta.purchaseDate || '2026-09-01');
      setExpirationDate(initialMeta.expirationDate || '2026-09-30');
      setInitialBalance(initialMeta.initialBalance || 50000);
      setAccountCost(initialMeta.accountCost || 0);
      setTotalPayouts(initialMeta.totalPayouts || 0);
      setNewName(accountName === 'all' ? '' : accountName);
    }
  }, [initialMeta, accountName, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ 
      type, 
      targetProfit: Number(targetProfit) || 0, 
      purchaseDate, 
      expirationDate, 
      initialBalance: Number(initialBalance) || 0, 
      accountCost: Number(accountCost) || 0, 
      totalPayouts: Number(totalPayouts) || 0 
    });
    
    if (newName && newName !== accountName && accountName !== 'all') {
      onRename(accountName, newName);
    }
    onClose();
  };

  const executeConfirm = () => {
    if (confirmAction === 'reset') onReset(accountName);
    if (confirmAction === 'delete') onDelete(accountName);
    setConfirmAction(null);
    onClose();
  };

  if (confirmAction) {
    return (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center space-y-4 border border-slate-100">
          <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-2">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-slate-800">¿Estás seguro?</h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            {confirmAction === 'reset' 
              ? `Esto borrará todo el historial de trades de la cuenta "${accountName}". Sus fechas y metadatos se mantendrán, pero el balance empezará desde cero.`
              : `Esto eliminará permanentemente la cuenta "${accountName}", toda su configuración y todos sus trades. Esta acción no se puede deshacer.`}
          </p>
          <div className="flex gap-3 pt-4 mt-2 border-t border-slate-100">
            <button onClick={() => setConfirmAction(null)} className="flex-1 py-2.5 rounded-xl font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors shadow-sm">
              Cancelar
            </button>
            <button onClick={executeConfirm} className="flex-1 py-2.5 rounded-xl font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm">
              Sí, {confirmAction === 'reset' ? 'Borrar Historial' : 'Eliminar'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden p-6 space-y-4">
        <div className="flex justify-between items-center border-b pb-3">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-emerald-600" />
            Configurar: <span className="text-emerald-600">{accountName === 'all' ? 'General' : accountName}</span>
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setType('eval')} className={`py-2 px-3 rounded-lg font-bold border transition-all ${type === 'eval' ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-2xs' : 'bg-white border-gray-200 text-slate-500 hover:bg-slate-50'}`}>🎯 Evaluación</button>
            <button type="button" onClick={() => setType('funded')} className={`py-2 px-3 rounded-lg font-bold border transition-all ${type === 'funded' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-2xs' : 'bg-white border-gray-200 text-slate-500 hover:bg-slate-50'}`}>🏆 Fondeada</button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="font-semibold block mb-1">Fecha de Compra</label><input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" required /></div>
            <div><label className="font-semibold block mb-1">Fecha de Vencimiento</label><input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" required /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="font-semibold block mb-1">Profit Target ($)</label><input type="number" value={targetProfit} onChange={(e) => setTargetProfit(e.target.value)} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" required /></div>
            <div><label className="font-semibold block mb-1">Balance Inicial ($)</label><input type="number" value={initialBalance} onChange={(e) => setInitialBalance(e.target.value)} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" /></div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t">
            <div><label className="font-semibold block mb-1 text-slate-700">Costo / Reset ($)</label><input type="number" value={accountCost} onChange={(e) => setAccountCost(e.target.value)} className="w-full p-2 border rounded-lg text-red-600 font-semibold focus:ring-2 focus:ring-red-500 outline-none" placeholder="Ej: 49.99" /></div>
            <div><label className="font-semibold block mb-1 text-slate-700">Retiros / Payouts ($)</label><input type="number" value={totalPayouts} onChange={(e) => setTotalPayouts(e.target.value)} className="w-full p-2 border rounded-lg text-emerald-600 font-semibold focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Ej: 1500" /></div>
          </div>

          {accountName !== 'all' && (
            <div className="pt-4 mt-4 border-t border-slate-100 space-y-3">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Gestión Avanzada</h3>
              <div>
                <label className="font-semibold block mb-1">Renombrar Cuenta</label>
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nuevo nombre..." />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmAction('reset')} className="flex-1 py-2 bg-amber-50 text-amber-700 border border-amber-200 font-semibold rounded-lg hover:bg-amber-100 transition-colors shadow-2xs">Limpiar Historial</button>
                <button type="button" onClick={() => setConfirmAction('delete')} className="flex-1 py-2 bg-red-50 text-red-700 border border-red-200 font-semibold rounded-lg hover:bg-red-100 transition-colors shadow-2xs">Eliminar Cuenta</button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700">Cancelar</button>
            <button type="submit" className="px-5 py-2 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm transition-colors">Guardar Cambios</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Card = ({ children, className = "" }) => <div className={`bg-white rounded-xl shadow-sm border border-slate-100 p-5 ${className}`}>{children}</div>;

const CardTitle = ({ title, subtitle, icon: Icon }) => (
  <div className="flex items-center justify-between mb-3">
    <div>
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</h3>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
    {Icon && <Icon className="w-4 h-4 text-slate-400" />}
  </div>
);

const SemiCircleGauge = ({ value, max, label, prefix = "", suffix = "", color = themeColors.emerald }) => {
  const percentage = Math.min((value / max) * 100, 100);
  const strokeDashoffset = (Math.PI * 36) - (percentage / 100) * (Math.PI * 36);

  return (
    <div className="flex flex-col items-center justify-center relative h-24">
      <svg width="100" height="55" viewBox="0 0 100 55" className="overflow-visible">
        <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke={themeColors.lightGray} strokeWidth="10" strokeLinecap="round" />
        <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={Math.PI * 36} strokeDashoffset={strokeDashoffset} className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute bottom-1 text-center flex flex-col items-center">
        <span className="text-xl font-bold text-slate-800">{prefix}{value}{suffix}</span>
        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">{label}</span>
      </div>
    </div>
  );
};

const getRemainingTradingDays = (targetDateStr) => {
  if (!targetDateStr || typeof targetDateStr !== 'string') return 0;
  const parts = targetDateStr.split('-').map(Number);
  const targetDate = new Date(parts[0], parts[1] - 1, parts[2]);
  targetDate.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (targetDate < today) return 0;
  let count = 0; const cur = new Date(today);
  while (cur <= targetDate) {
    if (cur.getDay() !== 0 && cur.getDay() !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

const getCalendarDaysLeft = (targetDateStr) => {
  if (!targetDateStr || typeof targetDateStr !== 'string') return 0;
  const parts = targetDateStr.split('-').map(Number);
  const targetDate = new Date(parts[0], parts[1] - 1, parts[2]);
  targetDate.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24)));
};

const PropFirmTracker = ({ activeAccount, accountMeta, onEditAccount, netPnl }) => {
  const isAll = activeAccount === 'all';
  const meta = accountMeta || { type: 'eval', targetProfit: 3000, purchaseDate: '2026-09-01', expirationDate: '2026-09-30', initialBalance: 50000, accountCost: 0, totalPayouts: 0 };
  const isFunded = meta.type === 'funded';
  const target = Number(meta.targetProfit) || 3000;
  const currentPnl = Number(netPnl) || 0;
  const remainingPnl = Math.max(0, target - currentPnl);
  const tradingDaysLeft = getRemainingTradingDays(meta.expirationDate);
  const calDaysLeft = getCalendarDaysLeft(meta.expirationDate);
  const requiredDailyAvg = (!isFunded && tradingDaysLeft > 0) ? (remainingPnl / tradingDaysLeft) : 0;
  const progressPercent = Math.min(100, Math.max(0, Math.round((currentPnl / target) * 100)));

  const cost = Number(meta.accountCost) || 0;
  const payouts = Number(meta.totalPayouts) || 0;
  const netBalance = payouts - cost;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mb-6 transition-all">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${isFunded ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
            {isFunded ? <ShieldCheck className="w-6 h-6" /> : <Award className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">{isAll ? "Vista Consolidada (Todas las cuentas)" : `Cuenta: ${String(activeAccount)}`}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${isFunded ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {isFunded ? "🏆 Fondeada" : "🎯 Evaluación"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Compra: {String(meta?.purchaseDate)} • Vence / Renueva: {String(meta?.expirationDate)}</p>
          </div>
        </div>
        <button onClick={onEditAccount} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors shadow-xs">
          <Edit3 className="w-3.5 h-3.5 text-blue-600" /> Configurar Fechas y Metas
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg border border-slate-200 text-blue-600 shadow-2xs"><CalendarClock className="w-5 h-5" /></div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Tiempo Restante</span>
            <div className="flex items-baseline gap-1 mt-0.5"><span className="text-lg font-black text-slate-800">{calDaysLeft}</span><span className="text-xs text-slate-500">días ({tradingDaysLeft} op.)</span></div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg border border-slate-200 text-emerald-600 shadow-2xs"><Target className="w-5 h-5" /></div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center"><span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{isFunded ? "Buffer de Retiro" : "Target de Paso"}</span><span className="text-xs font-bold text-emerald-600">{progressPercent}%</span></div>
            <div className="text-sm font-black text-slate-800 mt-0.5">${currentPnl.toFixed(0)} <span className="text-xs text-slate-400 font-normal">/ ${target.toLocaleString()}</span></div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden"><div className="bg-emerald-500 h-full rounded-full transition-all duration-700" style={{ width: `${progressPercent}%` }} /></div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg border border-slate-200 text-purple-600 shadow-2xs"><DollarSign className="w-5 h-5" /></div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">{isFunded ? "Capital Generado" : "Falta para Pasar"}</span>
            <span className={`text-lg font-black ${remainingPnl === 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
              {remainingPnl === 0 ? "¡Objetivo Cumplido! 🎉" : `$${remainingPnl.toLocaleString()}`}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg border border-emerald-200 text-emerald-600 shadow-2xs"><Sparkles className="w-5 h-5" /></div>
          <div>
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">{isFunded ? "Rendimiento Fondeada" : "Promedio Necesario"}</span>
            {isFunded ? <span className="text-xs font-semibold text-emerald-700">En fase de cobro y retiros</span> : remainingPnl === 0 ? <span className="text-xs font-bold text-emerald-600">¡Prueba superada!</span> : <span className="text-lg font-black text-emerald-600">+${requiredDailyAvg.toFixed(1)} <span className="text-xs font-medium text-emerald-700">/día</span></span>}
          </div>
        </div>

        <div className={`p-3.5 rounded-xl border flex items-center gap-3 ${netBalance >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
          <div className={`p-2 bg-white rounded-lg border shadow-2xs ${netBalance >= 0 ? 'text-emerald-600 border-emerald-200' : 'text-red-500 border-red-200'}`}>
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Balance Económico</span>
            <span className={`text-lg font-black leading-tight ${netBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {netBalance >= 0 ? `+$${netBalance.toLocaleString()}` : `-$${Math.abs(netBalance).toLocaleString()}`}
            </span>
            <span className="text-[10px] text-slate-500 block font-medium">Costos: ${cost} | Retiros: ${payouts}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [user, setUser] = useState(null);
  const [realTrades, setRealTrades] = useState([]);
  const [accountsMeta, setAccountsMeta] = useState({});
  const [isAccountConfigOpen, setIsAccountConfigOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedAccount, setSelectedAccount] = useState('all');
  
  // Use a ref to prevent overwriting mock data initially if firebase connects but is empty
  const [hasLoadedFirebase, setHasLoadedFirebase] = useState(false);

  useEffect(() => {
    signInAnonymously(auth).catch(e => console.error(e));
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubMeta = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'accounts_meta'), (snap) => {
      const metas = {}; 
      snap.docs.forEach(d => metas[d.id] = d.data()); 
      if (!snap.empty) setAccountsMeta(metas);
      else setAccountsMeta(demoAccountsMeta); // Fallback to demo
    });

    const unsubTrades = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'trading_days'), (snap) => {
      if (snap.empty && !hasLoadedFirebase) {
        setRealTrades(demoTrades); // Load demo data from screenshot
      } else {
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        data.sort((a, b) => a.date.localeCompare(b.date));
        setRealTrades(data);
      }
      setHasLoadedFirebase(true);
    });

    return () => { unsubMeta(); unsubTrades(); };
  }, [user, hasLoadedFirebase]);

  const handleSaveAccountMeta = async (newMeta) => {
    if (!user) return;
    const accountKey = selectedAccount === 'all' ? 'Cuenta Principal' : selectedAccount;
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'accounts_meta', accountKey), { ...newMeta, updatedAt: new Date().toISOString() }, { merge: true });
    // Update local immediately for faster feedback
    setAccountsMeta(prev => ({ ...prev, [accountKey]: newMeta }));
  };

  const handleRenameAccount = async (oldName, newName) => {
    if (!user || oldName === newName || !newName.trim()) return;
    const batch = writeBatch(db);
    const tradesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'trading_days');
    const q = query(tradesRef, where("account", "==", oldName));
    const snapshot = await getDocs(q);
    snapshot.forEach(docSnap => batch.update(docSnap.ref, { account: newName }));
    
    if (accountsMeta[oldName]) {
      batch.set(doc(db, 'artifacts', appId, 'users', user.uid, 'accounts_meta', newName), { ...accountsMeta[oldName], updatedAt: new Date().toISOString() });
      batch.delete(doc(db, 'artifacts', appId, 'users', user.uid, 'accounts_meta', oldName));
    }
    await batch.commit();
    setSelectedAccount(newName);
  };

  const handleDeleteAccount = async (accountName) => {
    if (!user) return;
    const batch = writeBatch(db);
    const tradesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'trading_days');
    const snapshot = await getDocs(query(tradesRef, where("account", "==", accountName)));
    snapshot.forEach(docSnap => batch.delete(docSnap.ref));
    batch.delete(doc(db, 'artifacts', appId, 'users', user.uid, 'accounts_meta', accountName));
    await batch.commit();
    setSelectedAccount('all');
  };

  const handleResetAccountData = async (accountName) => {
    if (!user) return;
    const batch = writeBatch(db);
    const tradesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'trading_days');
    const snapshot = await getDocs(query(tradesRef, where("account", "==", accountName)));
    snapshot.forEach(docSnap => batch.delete(docSnap.ref)); // We only delete the trades, the meta (Cost, payouts, target) stays
    await batch.commit();
    
    // Fallback visually if it was demo data
    if (realTrades === demoTrades) {
      setRealTrades([]);
    }
  };

  const handleDeleteTrade = async (docId) => { 
    if (user && docId.length > 5) { // Ensure it's a real firestore ID, not a demo ID
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'trading_days', docId)); 
    } else {
      setRealTrades(prev => prev.filter(t => t.id !== docId));
    }
  };

  const existingAccounts = useMemo(() => Array.from(new Set(realTrades.map(t => t.account || 'Cuenta Principal'))), [realTrades]);
  const accountFilteredTrades = useMemo(() => selectedAccount === 'all' ? realTrades : realTrades.filter(t => (t.account || 'Cuenta Principal') === selectedAccount), [realTrades, selectedAccount]);
  const filteredTrades = useMemo(() => dateFilter === 'all' ? accountFilteredTrades : accountFilteredTrades.filter(t => t.date.startsWith(dateFilter)), [accountFilteredTrades, dateFilter]);

  const chartData = useMemo(() => {
    const grouped = new Map();
    filteredTrades.forEach(item => {
      if (!grouped.has(item.date)) {
        grouped.set(item.date, { date: item.date, pnl: item.netPnl, trades: item.totalTrades, winTrades: item.totalTrades * ((item.winRate || 0) / 100), avgWin: item.avgWin || 0, avgLoss: item.avgLoss || 0 });
      } else {
        const c = grouped.get(item.date);
        c.pnl += item.netPnl; 
        c.trades += item.totalTrades; 
        c.winTrades += item.totalTrades * ((item.winRate || 0) / 100);
      }
    });
    let cum = 0;
    return Array.from(grouped.values()).sort((a,b)=>a.date.localeCompare(b.date)).map((d, i) => { 
      cum += d.pnl; 
      return { ...d, day: (i+1).toString(), cumulative: cum, winRate: d.trades > 0 ? Math.round((d.winTrades/d.trades)*100) : 0 }; 
    });
  }, [filteredTrades]);

  const activeMetaKey = selectedAccount === 'all' ? 'Cuenta Principal' : selectedAccount;

  return (
    <DashboardContext.Provider value={{ chartData, rawData: filteredTrades, allTrades: realTrades, dateFilter, selectedAccount, onDeleteTrade: handleDeleteTrade }}>
      <div className="min-h-screen bg-[#F8FAFC] text-slate-800 p-4 md:p-8 font-sans">
        <div className="max-w-[1600px] mx-auto">
          <header className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Trading Journal Dashboard</h1>
              <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600"/> Sincronizado en tiempo real
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
                <Wallet className="w-4 h-4 text-blue-500" />
                <select className="bg-transparent border-none text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer" value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)}>
                  <option value="all">Consolidado General</option>
                  {existingAccounts.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
          </header>
          
          <main>
            <PropFirmTracker 
              activeAccount={selectedAccount} 
              accountMeta={accountsMeta[activeMetaKey]} 
              netPnl={chartData.reduce((s, d) => s + d.pnl, 0)} 
              onEditAccount={() => setIsAccountConfigOpen(true)} 
            />
            
            {/* KPI ROW */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              <Card>
                <CardTitle title="Net P&L" subtitle="Resultado Acumulado" icon={Activity} />
                <div className="flex flex-col justify-between h-24">
                  <div>
                    <div className={`text-2xl font-black ${chartData.reduce((a,c)=>a+c.pnl,0) >= 0 ? 'text-emerald-600' : 'text-coral-500'}`}>
                      {chartData.reduce((a,c)=>a+c.pnl,0) >= 0 ? `+$${chartData.reduce((a,c)=>a+c.pnl,0).toLocaleString()}` : `-$${Math.abs(chartData.reduce((a,c)=>a+c.pnl,0)).toLocaleString()}`}
                    </div>
                  </div>
                </div>
              </Card>
              <Card><CardTitle title="Trade Win %" icon={Target} /><SemiCircleGauge value={36} max={100} label="Win Rate" suffix="%" color={themeColors.emerald} /></Card>
              <Card><CardTitle title="Profit Factor" icon={TrendingUp} /><SemiCircleGauge value={1.7} max={5} label="Gross Win/Loss" color="#3B82F6" /></Card>
              <Card><CardTitle title="Day Win %" icon={CalendarDays} /><SemiCircleGauge value={57} max={100} label="Días Positivos" suffix="%" color={themeColors.emerald} /></Card>
              <Card>
                <CardTitle title="Avg Win / Loss" icon={ArrowUpRight} />
                <div className="flex justify-between items-baseline mb-2"><span className="text-sm font-bold text-emerald-600">+$254.69</span><span className="text-sm font-bold text-coral-500">-$78.41</span></div>
                <div className="w-full bg-coral-100 h-2 rounded-full overflow-hidden flex"><div className="bg-emerald-500 h-full" style={{ width: `76%` }} /><div className="bg-coral-500 h-full" style={{ width: `24%` }} /></div>
              </Card>
            </div>

            {/* CHARTS ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              <Card><CardTitle title="Trade Score" subtitle="Evaluación operativa" icon={Award} /><div className="h-64"><ResponsiveContainer><RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%"><PolarGrid /><PolarAngleAxis dataKey="subject" tick={{fontSize: 11, fill: '#64748B'}} /><PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} /><Radar dataKey="score" stroke={themeColors.emerald} fill={themeColors.emerald} fillOpacity={0.4} /></RadarChart></ResponsiveContainer></div></Card>
              <Card><CardTitle title="Daily P&L" subtitle="Resultado neto diario" icon={BarChart2} /><div className="h-64"><ResponsiveContainer><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" /><XAxis dataKey="day" fontSize={11} stroke="#94A3B8" tickLine={false} /><YAxis fontSize={11} stroke="#94A3B8" tickLine={false} tickFormatter={v=>`$${v}`} /><Tooltip contentStyle={{borderRadius:'8px', border:'none', boxShadow:'0 4px 6px -1px rgb(0 0 0 / 0.1)'}} /><Bar dataKey="pnl" radius={[4,4,0,0]}>{chartData.map((e, i) => <Cell key={i} fill={e.pnl >= 0 ? themeColors.emerald : themeColors.coral} />)}</Bar></BarChart></ResponsiveContainer></div></Card>
              <Card><CardTitle title="Cumulative P&L" subtitle="Curva de capital acumulado" icon={TrendingUp} /><div className="h-64"><ResponsiveContainer><AreaChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" /><XAxis dataKey="day" fontSize={11} stroke="#94A3B8" tickLine={false} /><YAxis fontSize={11} stroke="#94A3B8" tickLine={false} tickFormatter={v=>`$${v}`} /><Tooltip contentStyle={{borderRadius:'8px', border:'none', boxShadow:'0 4px 6px -1px rgb(0 0 0 / 0.1)'}} /><Area type="monotone" dataKey="cumulative" stroke={themeColors.emerald} strokeWidth={2.5} fill={themeColors.emerald} fillOpacity={0.15} /></AreaChart></ResponsiveContainer></div></Card>
            </div>

            {/* BOTTOM CALENDAR ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2 overflow-x-auto">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Trading Calendar</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Desempeño mensual exacto</p>
                  </div>
                  <div className="flex items-center gap-2 font-bold text-slate-700 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                    Agosto de 2026
                  </div>
                </div>
                <div className="min-w-[550px]">
                  <div className="grid grid-cols-8 gap-1.5 text-center mb-2">
                    {['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'].map(d => <div key={d} className="text-[10px] font-bold text-slate-400 py-1">{d}</div>)}
                    <div className="text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded py-1">SEMANA</div>
                  </div>
                  
                  {/* Simulate August 2026 calendar strictly from the image */}
                  {[
                    [null, null, null, null, null, {d:1}, {d:2}, {sum:0, trd:0}],
                    [{d:3}, {d:4}, {d:5}, {d:6}, {d:7}, {d:8}, {d:9}, {sum:0, trd:0}],
                    [{d:10}, {d:11}, {d:12}, {d:13}, {d:14}, {d:15}, {d:16}, {sum:0, trd:0}],
                    [{d:17, pnl:-235, trd:3, w:0}, {d:18, pnl:-434, trd:11, w:36}, {d:19, pnl:306.5, trd:30, w:46.67}, {d:20, pnl:-923, trd:24, w:37.5}, {d:21, pnl:311, trd:1, w:100}, {d:22}, {d:23}, {sum:-974.5, trd:69}],
                    [{d:24, pnl:0, trd:5, w:40}, {d:25, pnl:-197.5, trd:8, w:25}, {d:26, pnl:583, trd:2, w:100}, {d:27, pnl:374.5, trd:1, w:100}, {d:28, pnl:-164, trd:3, w:33.33}, {d:29}, {d:30}, {sum:596, trd:19}],
                    [{d:31, pnl:608, trd:1, w:100}, null, null, null, null, null, null, {sum:608, trd:1}]
                  ].map((week, i) => (
                    <div key={i} className="grid grid-cols-8 gap-1.5 mb-1.5">
                      {week.map((cell, j) => {
                        if (j === 7) return (
                          <div key={j} className={`h-16 rounded-lg flex flex-col justify-center items-center ${cell.sum > 0 ? 'bg-emerald-50 text-emerald-600' : cell.sum < 0 ? 'bg-coral-50 text-coral-600' : 'bg-slate-50 text-slate-400'}`}>
                            <span className="text-[9px] font-bold uppercase">P&L Neto</span>
                            <span className="text-xs font-black">{cell.sum > 0 ? `+${cell.sum}` : cell.sum}</span>
                            <span className="text-[9px] font-medium text-slate-500">{cell.trd} trd</span>
                          </div>
                        );
                        if (!cell) return <div key={j} className="h-16 bg-slate-50/50 rounded-lg border border-slate-100/60" />;
                        return (
                          <div key={j} className={`h-16 p-1.5 rounded-lg border flex flex-col justify-between ${cell.pnl !== undefined ? (cell.pnl >= 0 ? 'bg-emerald-50/40 border-emerald-200' : 'bg-coral-50/40 border-coral-200') : 'bg-white border-slate-100'}`}>
                            <div className="flex justify-between items-start">
                              <span className="text-[11px] font-bold text-slate-700">{cell.d}</span>
                              {cell.pnl !== undefined && <span className={`text-[11px] font-black ${cell.pnl >= 0 ? 'text-emerald-600' : 'text-coral-500'}`}>{cell.pnl >= 0 ? `+${cell.pnl}` : cell.pnl}</span>}
                            </div>
                            {cell.pnl !== undefined && (
                              <div className="flex justify-between text-[9px] text-slate-500">
                                <span>{cell.trd} Trd</span>
                                <span>{cell.w}% W</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </Card>
              <Card>
                <CardTitle title="Overtrading Analysis" subtitle="Total Trades vs P&L" icon={TrendingUp} />
                <div className="h-64"><ResponsiveContainer>
                  <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis type="number" dataKey="trades" name="Trades" stroke="#94A3B8" fontSize={11} label={{ value: 'Total Trades', position: 'insideBottom', offset: -10, fontSize: 10, fill: '#94A3B8' }}/>
                    <YAxis type="number" dataKey="pnl" name="P&L" stroke="#94A3B8" fontSize={11} tickFormatter={v=>`$${v}`} />
                    <Tooltip cursor={{strokeDasharray:'3 3'}} content={({payload}) => payload?.length ? <div className="bg-white p-2 rounded shadow border text-xs"><p className="font-bold">Trades: {payload[0].payload.trades}</p><p className={payload[0].payload.pnl>=0?'text-emerald-600':'text-coral-500'}>P&L: ${payload[0].payload.pnl}</p></div> : null}/>
                    <Scatter data={filteredTrades.map(r=>({trades:r.totalTrades, pnl:r.netPnl, isWin:r.netPnl>=0}))}>
                      {filteredTrades.map((e, i) => <Cell key={i} fill={e.netPnl >= 0 ? themeColors.emerald : themeColors.coral} />)}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer></div>
              </Card>
            </div>
          </main>
        </div>
      </div>
      
      <AccountConfigModal 
        isOpen={isAccountConfigOpen} 
        onClose={() => setIsAccountConfigOpen(false)} 
        accountName={selectedAccount} 
        initialMeta={accountsMeta[activeMetaKey]} 
        onSave={handleSaveAccountMeta} 
        onRename={handleRenameAccount} 
        onDelete={handleDeleteAccount} 
        onReset={handleResetAccountData} 
      />
    </DashboardContext.Provider>
  );
};

export default App;
