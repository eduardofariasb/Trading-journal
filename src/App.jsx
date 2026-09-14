import React, { useMemo, useState, useEffect, useRef } from 'react';
import { 
  LineChart, Line, BarChart, Bar, AreaChart, Area, RadarChart, PolarGrid, 
  PolarAngleAxis, PolarRadiusAxis, Radar, ScatterChart, Scatter, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, Cell, ZAxis
} from 'recharts';
import { 
  ArrowUpRight, ArrowDownRight, Activity, Target, TrendingUp, 
  Clock, CalendarDays, Upload, X, Image as ImageIcon, Loader2, CheckCircle2,
  ChevronLeft, ChevronRight, Calendar, Settings, Trash2, KeyRound, Database,
  Wallet, DollarSign, Layers, Award, Timer, CalendarClock, Edit3, ShieldCheck,
  CheckSquare, AlertCircle, Sparkles
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, collection, onSnapshot, addDoc, setDoc, deleteDoc } from 'firebase/firestore';

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

const DashboardContext = React.createContext({});

const themeColors = {
  emerald: '#10B981',
  coral: '#EF4444',
  gray: '#9CA3AF',
  lightGray: '#F3F4F6'
};

const defaultDailyPnLData = [
  { day: '1', date: '2026-09-01', pnl: 250, cumulative: 250, trades: 4, winRate: 75, account: 'Cuenta Principal' },
  { day: '2', date: '2026-09-02', pnl: -120, cumulative: 130, trades: 3, winRate: 33, account: 'Cuenta Principal' },
  { day: '3', date: '2026-09-03', pnl: 400, cumulative: 530, trades: 5, winRate: 80, account: 'Cuenta Principal' },
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
  { trades: 3, pnl: 250, isWin: true }, { trades: 5, pnl: -120, isWin: false },
  { trades: 7, pnl: 400, isWin: true }, { trades: 10, pnl: -300, isWin: false },
];

const analyzeScreenshot = async (base64Data, customApiKey = "") => {
  const apiKey = customApiKey || (typeof window !== 'undefined' ? window.localStorage?.getItem('gemini_api_key') : "") || "";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [{
      role: "user",
      parts: [
        { text: "Act as an expert trading data extractor. I am providing a screenshot of a trading platform daily summary (like NinjaTrader or Tradovate). Extract the following metrics:\n1. Date (format as YYYY-MM-DD. If year is missing, assume current year 2026).\n2. Net PnL (Net profit/loss, usually a green or red number after fees. If only Gross PnL and Fees are visible, calculate Net PnL = Gross + Fees).\n3. Total Trades.\n4. Winning Trade %.\n5. Avg. Winning Trade.\n6. Avg. Losing Trade.\n\nReturn strictly a JSON object matching this schema exactly. Remove currency symbols and % signs, keep only numbers." },
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
  <div className="flex items-center justify-between mb-3">
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

// Helper to calculate business / operational days (Mon-Fri)
const getRemainingTradingDays = (targetDateStr) => {
  if (!targetDateStr) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = targetDateStr.split('-').map(Number);
  const targetDate = new Date(y, m - 1, d);
  targetDate.setHours(0, 0, 0, 0);

  if (targetDate < today) return 0;

  let count = 0;
  const cur = new Date(today);
  while (cur <= targetDate) {
    const dayOfWeek = cur.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

const getCalendarDaysLeft = (targetDateStr) => {
  if (!targetDateStr) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = targetDateStr.split('-').map(Number);
  const targetDate = new Date(y, m - 1, d);
  targetDate.setHours(0, 0, 0, 0);

  const diffTime = targetDate - today;
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
};

const PropFirmTracker = ({ activeAccount, accountMeta, onEditAccount, netPnl }) => {
  const isAll = activeAccount === 'all';
  const meta = accountMeta || {
    type: 'eval',
    targetProfit: 3000,
    purchaseDate: '2026-09-01',
    expirationDate: '2026-09-30',
    initialBalance: 50000
  };

  const isFunded = meta.type === 'funded';
  const target = Number(meta.targetProfit) || 3000;
  const currentPnl = Number(netPnl) || 0;
  const remainingPnl = Math.max(0, target - currentPnl);
  
  const tradingDaysLeft = getRemainingTradingDays(meta.expirationDate);
  const calDaysLeft = getCalendarDaysLeft(meta.expirationDate);
  
  const requiredDailyAvg = (!isFunded && tradingDaysLeft > 0) ? (remainingPnl / tradingDaysLeft) : 0;
  const progressPercent = Math.min(100, Math.max(0, Math.round((currentPnl / target) * 100)));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mb-6 transition-all">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${isFunded ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
            {isFunded ? <ShieldCheck className="w-6 h-6" /> : <Award className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                {isAll ? "Meta de Fondeo (Vista Consolidada)" : `Cuenta: ${activeAccount}`}
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                isFunded 
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                  : 'bg-amber-100 text-amber-800 border border-amber-200'
              }`}>
                {isFunded ? "🏆 Cuenta Fondeada" : "🎯 En Prueba de Evaluación"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
              <span>Compra: <strong>{meta.purchaseDate || 'Sin asignar'}</strong></span>
              <span>•</span>
              <span>Vencimiento / Renovación: <strong>{meta.expirationDate || 'Sin asignar'}</strong></span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end lg:self-center">
          <button
            onClick={onEditAccount}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors shadow-xs"
          >
            <Edit3 className="w-3.5 h-3.5 text-blue-600" />
            Configurar Fechas y Metas
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Días restantes */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg border border-slate-200 text-blue-600 shadow-2xs">
            <CalendarClock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Tiempo Restante</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-lg font-black text-slate-800">{calDaysLeft}</span>
              <span className="text-xs text-slate-500">días ({tradingDaysLeft} operativos)</span>
            </div>
          </div>
        </div>

        {/* Target de la prueba */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg border border-slate-200 text-emerald-600 shadow-2xs">
            <Target className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {isFunded ? "Buffer de Retiro" : "Target de Paso"}
              </span>
              <span className="text-xs font-bold text-emerald-600">{progressPercent}%</span>
            </div>
            <div className="text-sm font-black text-slate-800 mt-0.5">
              ${currentPnl.toFixed(0)} <span className="text-xs text-slate-400 font-normal">/ ${target.toLocaleString()}</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1.5">
              <div className="bg-emerald-500 h-full rounded-full transition-all duration-700" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </div>

        {/* Faltante */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg border border-slate-200 text-purple-600 shadow-2xs">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              {isFunded ? "Capital Generado" : "Falta para Pasar"}
            </span>
            <span className={`text-lg font-black ${remainingPnl === 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
              {remainingPnl === 0 ? "¡Objetivo Cumplido! 🎉" : `$${remainingPnl.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 1})}`}
            </span>
          </div>
        </div>

        {/* Promedio diario requerido */}
        <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg border border-emerald-200 text-emerald-600 shadow-2xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
              {isFunded ? "Rendimiento Fondeada" : "Promedio Necesario"}
            </span>
            {isFunded ? (
              <span className="text-xs font-semibold text-emerald-700">En fase de cobro y pagos</span>
            ) : remainingPnl === 0 ? (
              <span className="text-xs font-bold text-emerald-600">¡Prueba superada!</span>
            ) : tradingDaysLeft === 0 ? (
              <span className="text-xs font-bold text-coral-600">Vencida / Renueva</span>
            ) : (
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg font-black text-emerald-600">
                  +${requiredDailyAvg.toFixed(1)}
                </span>
                <span className="text-xs text-emerald-700 font-medium">/día op.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const AccountConfigModal = ({ isOpen, onClose, accountName, initialMeta, onSave }) => {
  const [type, setType] = useState(initialMeta?.type || 'eval');
  const [targetProfit, setTargetProfit] = useState(initialMeta?.targetProfit || 3000);
  const [purchaseDate, setPurchaseDate] = useState(initialMeta?.purchaseDate || '2026-09-01');
  const [expirationDate, setExpirationDate] = useState(initialMeta?.expirationDate || '2026-09-30');
  const [initialBalance, setInitialBalance] = useState(initialMeta?.initialBalance || 50000);

  useEffect(() => {
    if (initialMeta) {
      setType(initialMeta.type || 'eval');
      setTargetProfit(initialMeta.targetProfit || 3000);
      setPurchaseDate(initialMeta.purchaseDate || '2026-09-01');
      setExpirationDate(initialMeta.expirationDate || '2026-09-30');
      setInitialBalance(initialMeta.initialBalance || 50000);
    }
  }, [initialMeta]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      type,
      targetProfit: Number(targetProfit) || 0,
      purchaseDate,
      expirationDate,
      initialBalance: Number(initialBalance) || 0
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden p-6 space-y-4">
        <div className="flex justify-between items-center border-b pb-3">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-800">
              Configurar Cuenta: <span className="text-emerald-600">{accountName === 'all' ? 'General' : accountName}</span>
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Toggle Type */}
          <div>
            <label className="font-semibold block mb-1 text-gray-700">Estado de la Cuenta</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('eval')}
                className={`py-2 px-3 rounded-lg font-bold border text-center transition-all ${
                  type === 'eval'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-xs'
                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                🎯 En Prueba (Challenge)
              </button>
              <button
                type="button"
                onClick={() => setType('funded')}
                className={`py-2 px-3 rounded-lg font-bold border text-center transition-all ${
                  type === 'funded'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs'
                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                🏆 Fondeada (Real / PA)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1 text-gray-700">Fecha de Compra</label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="font-semibold block mb-1 text-gray-700">Fecha de Vencimiento</label>
              <input
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1 text-gray-700">Profit Target ($)</label>
              <input
                type="number"
                value={targetProfit}
                onChange={(e) => setTargetProfit(e.target.value)}
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-semibold text-emerald-600"
                placeholder="Ej: 3000"
                required
              />
            </div>
            <div>
              <label className="font-semibold block mb-1 text-gray-700">Balance Inicial ($)</label>
              <input
                type="number"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="Ej: 50000"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600">
            💡 El sistema calculará automáticamente los <strong>días hábiles operativos</strong> que te quedan antes del vencimiento y la cuota diaria exacta de ganancias para pasar la evaluación.
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-xs"
            >
              Guardar Configuración
            </button>
          </div>
        </form>
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
            <p className="text-[10px] text-gray-400 mt-1">Tu base de datos Firebase ya está configurada automáticamente.</p>
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

const UploadModal = ({ isOpen, onClose, onSave, userId, existingAccounts = [] }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(null);
  const [accountName, setAccountName] = useState('Cuenta Principal');
  const [customAccountInput, setCustomAccountInput] = useState('');
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
    const finalAccount = accountName === 'NEW' ? (customAccountInput.trim() || 'Cuenta Principal') : accountName;
    try {
      setLoading(true);
      const collectionRef = collection(db, 'artifacts', appId, 'users', userId, 'trading_days');
      await addDoc(collectionRef, {
        ...formData,
        account: finalAccount,
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
                <div className="bg-emerald-50/30 border border-emerald-100 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wide flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Revisa y asigna cuenta
                    </h4>
                  </div>
                  
                  {/* Account Selector */}
                  <div className="bg-white p-3 rounded-lg border border-gray-200">
                    <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5 mb-1.5">
                      <Wallet className="w-3.5 h-3.5 text-blue-500" /> Cuenta de Trading
                    </label>
                    <select
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      className="w-full p-2 border border-gray-200 rounded-md text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="Cuenta Principal">Cuenta Principal</option>
                      {existingAccounts.filter(a => a !== 'Cuenta Principal').map(acc => (
                        <option key={acc} value={acc}>{acc}</option>
                      ))}
                      <option value="NEW">+ Agregar nueva cuenta...</option>
                    </select>

                    {accountName === 'NEW' && (
                      <input
                        type="text"
                        placeholder="Ej. Apex 50k #1, Topstep 100k, Personal..."
                        value={customAccountInput}
                        onChange={(e) => setCustomAccountInput(e.target.value)}
                        className="mt-2 w-full p-2 border border-blue-200 rounded-md text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                        autoFocus
                      />
                    )}
                  </div>

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
                        onChange={e => setFormData({...formData, netPnl: parseFloat(e.target.value) || 0})} 
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

const KpiRow = () => {
  const { chartData, rawData } = React.useContext(DashboardContext);

  const stats = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return {
        netPnl: 0,
        winRate: 0,
        profitFactor: 0,
        dayWinRate: 0,
        avgWin: 0,
        avgLoss: 0,
        operatingDays: 0,
        avgDailyPnl: 0
      };
    }

    const netPnl = chartData.reduce((acc, curr) => acc + (Number(curr.pnl) || 0), 0);
    const operatingDays = chartData.filter(d => d.trades > 0 || d.pnl !== 0).length;
    const avgDailyPnl = operatingDays > 0 ? netPnl / operatingDays : 0;

    let totalTrades = 0;
    let winningTrades = 0;
    let grossWin = 0;
    let grossLoss = 0;

    if (rawData && rawData.length > 0) {
      rawData.forEach(trade => {
        const tCount = trade.totalTrades || 0;
        const wRate = (trade.winRate || 0) / 100;
        const wTrades = tCount * wRate;
        totalTrades += tCount;
        winningTrades += wTrades;

        if (trade.netPnl > 0) {
          grossWin += trade.netPnl;
        } else {
          grossLoss += Math.abs(trade.netPnl);
        }
      });
    } else {
      chartData.forEach(d => {
        const tCount = d.trades || 0;
        const wTrades = tCount * ((d.winRate || 0) / 100);
        totalTrades += tCount;
        winningTrades += wTrades;
        if (d.pnl > 0) grossWin += d.pnl;
        else grossLoss += Math.abs(d.pnl);
      });
    }

    const winRate = totalTrades > 0 ? Math.round((winningTrades / totalTrades) * 100) : 0;
    const profitFactor = grossLoss > 0 ? (grossWin / grossLoss).toFixed(2) : grossWin > 0 ? '99.9' : '0.00';
    
    const winningDays = chartData.filter(d => d.pnl > 0).length;
    const dayWinRate = operatingDays > 0 ? Math.round((winningDays / operatingDays) * 100) : 0;

    const avgWin = rawData && rawData.length > 0
      ? (rawData.reduce((acc, curr) => acc + (curr.avgWin || 0), 0) / (rawData.filter(r => r.avgWin > 0).length || 1)).toFixed(2)
      : '350.50';

    const avgLoss = rawData && rawData.length > 0
      ? (rawData.reduce((acc, curr) => acc + Math.abs(curr.avgLoss || 0), 0) / (rawData.filter(r => r.avgLoss !== 0).length || 1)).toFixed(2)
      : '145.20';

    return {
      netPnl,
      winRate,
      profitFactor,
      dayWinRate,
      avgWin,
      avgLoss,
      operatingDays,
      avgDailyPnl
    };
  }, [chartData, rawData]);

  const sparklineData = chartData.map(d => ({ v: d.cumulative }));

  const avgWinNum = Number(stats.avgWin) || 1;
  const avgLossNum = Number(stats.avgLoss) || 1;
  const totalAvg = avgWinNum + avgLossNum;
  const winPercent = Math.round((avgWinNum / totalAvg) * 100);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {/* 1. Net PnL Card */}
      <Card>
        <CardTitle title="Net P&L" subtitle="Resultado Acumulado" icon={Activity} />
        <div className="flex flex-col justify-between h-24">
          <div>
            <div className={`text-2xl font-black ${stats.netPnl >= 0 ? 'text-emerald-600' : 'text-coral-500'}`}>
              {stats.netPnl >= 0 ? `+$${stats.netPnl.toLocaleString()}` : `-$${Math.abs(stats.netPnl).toLocaleString()}`}
            </div>
            <div className="text-[11px] font-semibold text-slate-500 mt-0.5">
              Promedio: <span className={stats.avgDailyPnl >= 0 ? 'text-emerald-600' : 'text-coral-500'}>
                {stats.avgDailyPnl >= 0 ? `+$${stats.avgDailyPnl.toFixed(1)}` : `-$${Math.abs(stats.avgDailyPnl).toFixed(1)}`}
              </span>/día
            </div>
          </div>
          <div className="h-10 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparklineData.length > 0 ? sparklineData : [{ v: 0 }, { v: 100 }]}>
                <Line 
                  type="monotone" 
                  dataKey="v" 
                  stroke={stats.netPnl >= 0 ? themeColors.emerald : themeColors.coral} 
                  strokeWidth={2} 
                  dot={false} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* 2. Trade Win % */}
      <Card>
        <CardTitle title="Trade Win %" subtitle="Tasa de Acierto" icon={Target} />
        <SemiCircleGauge value={stats.winRate} max={100} label="Win Rate" suffix="%" color={themeColors.emerald} />
      </Card>

      {/* 3. Profit Factor */}
      <Card>
        <CardTitle title="Profit Factor" subtitle="Ratio Ganancia/Pérdida" icon={TrendingUp} />
        <SemiCircleGauge value={Number(stats.profitFactor)} max={5} label="Gross Win/Loss" color="#3B82F6" />
      </Card>

      {/* 4. Day Win % */}
      <Card>
        <CardTitle title="Day Win %" subtitle="Días Ganadores" icon={CalendarDays} />
        <SemiCircleGauge value={stats.dayWinRate} max={100} label="Días Positivos" suffix="%" color={themeColors.emerald} />
      </Card>

      {/* 5. Avg Win / Loss */}
      <Card>
        <CardTitle title="Avg Win / Loss" subtitle="Promedio Ganador/Perdedor" icon={ArrowUpRight} />
        <div className="flex flex-col justify-center h-24">
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-sm font-bold text-emerald-600">+${stats.avgWin}</span>
            <span className="text-sm font-bold text-coral-500">-${stats.avgLoss}</span>
          </div>
          <div className="w-full bg-coral-100 h-2 rounded-full overflow-hidden flex">
            <div className="bg-emerald-500 h-full transition-all duration-700" style={{ width: `${winPercent}%` }} />
            <div className="bg-coral-500 h-full transition-all duration-700" style={{ width: `${100 - winPercent}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1 uppercase font-semibold">
            <span>Avg Win</span>
            <span>Avg Loss</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

const MainChartsRow = () => {
  const { chartData } = React.useContext(DashboardContext);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      {/* Columna 1: Radar Chart (Trade Score) */}
      <Card>
        <CardTitle title="Trade Score" subtitle="Evaluación operativa y disciplina" icon={Award} />
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
              <PolarGrid stroke="#E2E8F0" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748B', fontSize: 11 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="Score" dataKey="score" stroke={themeColors.emerald} fill={themeColors.emerald} fillOpacity={0.4} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Columna 2: Daily P&L Bar Chart */}
      <Card>
        <CardTitle title="Daily P&L" subtitle="Resultado neto diario" icon={BarChart} />
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis dataKey="day" stroke="#94A3B8" fontSize={11} tickLine={false} />
              <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip 
                formatter={(val) => [`$${val}`, 'P&L']}
                labelFormatter={(label) => `Día ${label}`}
                contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px' }}
              />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.pnl >= 0 ? themeColors.emerald : themeColors.coral} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Columna 3: Cumulative P&L Area Chart */}
      <Card>
        <CardTitle title="Cumulative P&L" subtitle="Curva de capital acumulado" icon={TrendingUp} />
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="pnlCurveGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={themeColors.emerald} stopOpacity={0.35}/>
                  <stop offset="95%" stopColor={themeColors.emerald} stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis dataKey="day" stroke="#94A3B8" fontSize={11} tickLine={false} />
              <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip 
                formatter={(val) => [`$${val}`, 'Acumulado']}
                labelFormatter={(label) => `Día ${label}`}
                contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px' }}
              />
              <Area 
                type="monotone" 
                dataKey="cumulative" 
                stroke={themeColors.emerald} 
                strokeWidth={2.5} 
                fillOpacity={1} 
                fill="url(#pnlCurveGrad)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};

const BottomRow = () => {
  const { rawData, chartData, onDeleteTrade } = React.useContext(DashboardContext);

  // Derive active display month from first available data point or current date
  const [currentDate, setCurrentDate] = useState(() => {
    if (rawData && rawData.length > 0) {
      const [y, m] = rawData[0].date.split('-').map(Number);
      return new Date(y, m - 1, 1);
    }
    return new Date(2026, 8, 1); // Default to Sept 2026
  });

  // Keep calendar synced if rawData changes
  useEffect(() => {
    if (rawData && rawData.length > 0) {
      const [y, m] = rawData[0].date.split('-').map(Number);
      setCurrentDate(new Date(y, m - 1, 1));
    }
  }, [rawData]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const monthName = currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  // Build calendar matrix (Mon-Sun)
  const calendarData = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();

    // Convert getDay(): 0 (Sun) -> 6, 1 (Mon) -> 0
    let startDayIndex = firstDay.getDay() - 1;
    if (startDayIndex === -1) startDayIndex = 6;

    // Create map from raw data for easy lookup: 'YYYY-MM-DD' => trade summary
    const tradeMap = new Map();
    (rawData && rawData.length > 0 ? rawData : defaultDailyPnLData).forEach(trade => {
      tradeMap.set(trade.date, trade);
    });

    const weeks = [];
    let currentWeek = [];

    // Fill leading empty days
    for (let i = 0; i < startDayIndex; i++) {
      currentWeek.push(null);
    }

    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayData = tradeMap.get(dateStr) || null;

      currentWeek.push({
        day,
        date: dateStr,
        data: dayData
      });

      if (currentWeek.length === 7) {
        // Calculate weekly total
        const weekPnl = currentWeek.reduce((acc, cell) => acc + (cell?.data?.netPnl || cell?.data?.pnl || 0), 0);
        const weekTrades = currentWeek.reduce((acc, cell) => acc + (cell?.data?.totalTrades || cell?.data?.trades || 0), 0);
        weeks.push({ days: currentWeek, totalPnl: weekPnl, totalTrades: weekTrades });
        currentWeek = [];
      }
    }

    // Trailing empty days
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      const weekPnl = currentWeek.reduce((acc, cell) => acc + (cell?.data?.netPnl || cell?.data?.pnl || 0), 0);
      const weekTrades = currentWeek.reduce((acc, cell) => acc + (cell?.data?.totalTrades || cell?.data?.trades || 0), 0);
      weeks.push({ days: currentWeek, totalPnl: weekPnl, totalTrades: weekTrades });
    }

    return weeks;
  }, [year, month, rawData]);

  // Overtrading chart data: total trades vs PnL
  const overtradingScatterData = useMemo(() => {
    const list = rawData && rawData.length > 0 ? rawData : defaultDailyPnLData;
    return list.map(item => {
      const pnl = item.netPnl !== undefined ? item.netPnl : item.pnl;
      const trades = item.totalTrades !== undefined ? item.totalTrades : item.trades;
      return {
        trades: trades || 0,
        pnl: pnl || 0,
        isWin: pnl >= 0
      };
    });
  }, [rawData]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* 2/3 Left: Real Trading Calendar */}
      <Card className="lg:col-span-2 overflow-x-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Trading Calendar</h3>
            <p className="text-xs text-gray-400 mt-0.5">Desempeño mensual exacto</p>
          </div>
          
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-gray-700 min-w-[120px] text-center">
              {capitalizedMonth}
            </span>
            <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="min-w-[550px]">
          {/* Day Headers */}
          <div className="grid grid-cols-8 gap-1.5 mb-1.5 text-center">
            {['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'].map(d => (
              <div key={d} className="text-[10px] font-bold text-gray-400 uppercase py-1">{d}</div>
            ))}
            <div className="text-[10px] font-bold text-emerald-700 uppercase py-1 bg-emerald-50 rounded">SEMANA</div>
          </div>

          {/* Weeks Rows */}
          <div className="space-y-1.5">
            {calendarData.map((week, wIdx) => (
              <div key={`w-${wIdx}`} className="grid grid-cols-8 gap-1.5">
                {week.days.map((cell, dIdx) => {
                  if (!cell) {
                    return <div key={`empty-${wIdx}-${dIdx}`} className="h-16 bg-slate-50/50 rounded-lg border border-slate-100/60" />;
                  }

                  const pnl = cell.data ? (cell.data.netPnl !== undefined ? cell.data.netPnl : cell.data.pnl) : null;
                  const trades = cell.data ? (cell.data.totalTrades !== undefined ? cell.data.totalTrades : cell.data.trades) : null;
                  const winRate = cell.data?.winRate;
                  const isPositive = pnl !== null && pnl >= 0;

                  return (
                    <div 
                      key={`cell-${cell.date}`} 
                      className={`h-16 p-1.5 rounded-lg border flex flex-col justify-between transition-all relative group ${
                        cell.data 
                          ? isPositive 
                            ? 'bg-emerald-50/40 border-emerald-200' 
                            : 'bg-coral-50/40 border-coral-200'
                          : 'bg-white border-slate-100'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-[11px] font-bold text-slate-700">{cell.day}</span>
                        {cell.data && cell.data.id && onDeleteTrade && (
                          <button
                            onClick={() => onDeleteTrade(cell.data.id)}
                            title="Eliminar registro"
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-coral-500 transition-opacity p-0.5"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                        {cell.data && (
                          <span className={`text-[11px] font-black ${isPositive ? 'text-emerald-600' : 'text-coral-500'}`}>
                            {isPositive ? `+${pnl}` : pnl}
                          </span>
                        )}
                      </div>

                      {cell.data && (
                        <div className="flex justify-between text-[9px] text-slate-500">
                          <span>{trades} Trd</span>
                          {winRate !== undefined && <span>{winRate}% W</span>}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Weekly Summary Column */}
                <div className={`h-16 p-1.5 rounded-lg border flex flex-col justify-center items-center text-center ${
                  week.totalPnl > 0 ? 'bg-emerald-50 border-emerald-200' : week.totalPnl < 0 ? 'bg-coral-50 border-coral-200' : 'bg-slate-50 border-slate-100'
                }`}>
                  <span className="text-[9px] font-bold text-slate-400 uppercase">P&L Neto</span>
                  <span className={`text-xs font-black ${week.totalPnl >= 0 ? 'text-emerald-600' : 'text-coral-500'}`}>
                    {week.totalPnl >= 0 ? `+$${week.totalPnl}` : `-$${Math.abs(week.totalPnl)}`}
                  </span>
                  <span className="text-[9px] text-slate-500 font-medium">{week.totalTrades} trd</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* 1/3 Right: Overtrading Analysis Scatter Plot */}
      <Card>
        <CardTitle title="Overtrading Analysis" subtitle="Total Trades vs P&L" icon={TrendingUp} />
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis 
                type="number" 
                dataKey="trades" 
                name="Trades" 
                stroke="#94A3B8" 
                fontSize={11} 
                label={{ value: 'Total Trades', position: 'insideBottom', offset: -10, fontSize: 10, fill: '#94A3B8' }}
              />
              <YAxis 
                type="number" 
                dataKey="pnl" 
                name="P&L" 
                stroke="#94A3B8" 
                fontSize={11} 
                tickFormatter={v => `$${v}`} 
              />
              <Tooltip 
                cursor={{ strokeDasharray: '3 3' }}
                content={({ payload }) => {
                  if (payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100 text-xs">
                        <p className="font-bold text-slate-800">Trades: {data.trades}</p>
                        <p className={`font-semibold ${data.pnl >= 0 ? 'text-emerald-600' : 'text-coral-500'}`}>
                          P&L: ${data.pnl}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter data={overtradingScatterData}>
                {overtradingScatterData.map((entry, index) => (
                  <Cell 
                    key={`scatter-${index}`} 
                    fill={entry.isWin ? themeColors.emerald : themeColors.coral} 
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-slate-400 mt-2 text-center">
          Puntos verdes = Ganadores • Puntos rojos = Perdedores
        </p>
      </Card>
    </div>
  );
};

const App = () => {
  const [user, setUser] = useState(null);
  const [realTrades, setRealTrades] = useState([]);
  const [accountsMeta, setAccountsMeta] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAccountConfigOpen, setIsAccountConfigOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedAccount, setSelectedAccount] = useState('all');
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

  // Listen to accounts metadata (target, dates, status: eval vs funded)
  useEffect(() => {
    if (!user) return;
    const metaColRef = collection(db, 'artifacts', appId, 'users', user.uid, 'accounts_meta');
    const unsubscribe = onSnapshot(metaColRef, (snapshot) => {
      const metas = {};
      snapshot.docs.forEach(docSnap => {
        metas[docSnap.id] = docSnap.data();
      });
      setAccountsMeta(metas);
    }, (error) => console.error("Error loading accounts meta:", error));

    return () => unsubscribe();
  }, [user]);

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

  const handleSaveAccountMeta = async (newMeta) => {
    if (!user) return;
    const accountKey = selectedAccount === 'all' ? 'Cuenta Principal' : selectedAccount;
    try {
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'accounts_meta', accountKey);
      await setDoc(docRef, { ...newMeta, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (err) {
      console.error("Error saving account meta:", err);
    }
  };

  const handleDeleteTrade = async (docId) => {
    if (!user || !docId) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'trading_days', docId);
      await deleteDoc(docRef);
    } catch (err) {
      console.error("Error deleting record:", err);
    }
  };

  const existingAccounts = useMemo(() => {
    if (!realTrades || realTrades.length === 0) return ['Cuenta Principal'];
    const accs = new Set(realTrades.map(t => t.account || 'Cuenta Principal'));
    return Array.from(accs);
  }, [realTrades]);

  const accountFilteredTrades = useMemo(() => {
    if (selectedAccount === 'all') return realTrades;
    return realTrades.filter(t => (t.account || 'Cuenta Principal') === selectedAccount);
  }, [realTrades, selectedAccount]);

  const availableMonths = useMemo(() => {
    if (!accountFilteredTrades || accountFilteredTrades.length === 0) return [];
    const months = new Set(accountFilteredTrades.map(t => t.date.substring(0, 7)));
    return Array.from(months).sort().reverse();
  }, [accountFilteredTrades]);

  const filteredTrades = useMemo(() => {
    if (dateFilter === 'all') return accountFilteredTrades;
    return accountFilteredTrades.filter(t => t.date.startsWith(dateFilter));
  }, [accountFilteredTrades, dateFilter]);

  const chartData = useMemo(() => {
    if (filteredTrades.length === 0) {
      if (realTrades.length === 0) return defaultDailyPnLData;
      return [];
    }

    // Group records occurring on the same date (e.g. across multiple accounts in consolidated view)
    const groupedMap = new Map();
    filteredTrades.forEach(item => {
      if (!groupedMap.has(item.date)) {
        groupedMap.set(item.date, {
          id: item.id,
          date: item.date,
          pnl: item.netPnl,
          trades: item.totalTrades,
          winTrades: item.totalTrades * ((item.winRate || 0) / 100),
          avgWin: item.avgWin || 0,
          avgLoss: item.avgLoss || 0,
          entriesCount: 1
        });
      } else {
        const current = groupedMap.get(item.date);
        current.pnl += item.netPnl;
        current.trades += item.totalTrades;
        current.winTrades += item.totalTrades * ((item.winRate || 0) / 100);
        current.avgWin = (current.avgWin + (item.avgWin || 0)) / 2;
        current.avgLoss = (current.avgLoss + (item.avgLoss || 0)) / 2;
        current.entriesCount += 1;
      }
    });

    const sortedDates = Array.from(groupedMap.keys()).sort();
    let cumulative = 0;

    return sortedDates.map((dStr, i) => {
      const dData = groupedMap.get(dStr);
      cumulative += dData.pnl;
      const calcWinRate = dData.trades > 0 ? Math.round((dData.winTrades / dData.trades) * 100) : 0;
      return {
        id: dData.id,
        day: (i + 1).toString(),
        date: dStr,
        pnl: dData.pnl,
        cumulative: cumulative,
        trades: dData.trades,
        winRate: calcWinRate
      };
    });
  }, [filteredTrades, realTrades.length]);

  const formatMonthStr = (yyyy_mm) => {
    const [y, m] = yyyy_mm.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, 1);
    return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());
  };

  const activeAccountKey = selectedAccount === 'all' ? 'Cuenta Principal' : selectedAccount;
  const currentAccountMeta = accountsMeta[activeAccountKey] || {
    type: 'eval',
    targetProfit: 3000,
    purchaseDate: '2026-09-01',
    expirationDate: '2026-09-30',
    initialBalance: 50000
  };

  const currentAccountNetPnl = chartData.reduce((sum, day) => sum + day.pnl, 0);

  return (
    <DashboardContext.Provider value={{ 
      chartData, 
      rawData: filteredTrades, 
      allTrades: realTrades, 
      dateFilter,
      selectedAccount,
      onDeleteTrade: handleDeleteTrade
    }}>
      <div className="min-h-screen bg-[#F8FAFC] text-slate-800 p-4 md:p-8 font-sans">
        <div className="max-w-[1600px] mx-auto">
          
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Trading Journal Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                {realTrades.length > 0 ? (
                  <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-4 h-4"/> Sincronizado en tiempo real</span>
                ) : (
                  "Mostrando datos de demostración. ¡Sube tu primera captura!"
                )}
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Account Filter */}
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
                <Wallet className="w-4 h-4 text-blue-500" />
                <select
                  className="bg-transparent border-none text-xs font-semibold text-gray-700 focus:outline-none cursor-pointer"
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                >
                  <option value="all">Consolidado (Todas las cuentas)</option>
                  {existingAccounts.map(acc => (
                    <option key={acc} value={acc}>{acc}</option>
                  ))}
                </select>
              </div>

              {/* Month Filter */}
              {realTrades.length > 0 && (
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <select
                    className="bg-transparent border-none text-xs font-semibold text-gray-700 focus:outline-none cursor-pointer"
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
            {/* Prop Firm / Evaluacion de Fondeo Widget */}
            <PropFirmTracker 
              activeAccount={selectedAccount}
              accountMeta={currentAccountMeta}
              netPnl={currentAccountNetPnl}
              onEditAccount={() => setIsAccountConfigOpen(true)}
            />

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
        existingAccounts={existingAccounts}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <AccountConfigModal
        isOpen={isAccountConfigOpen}
        onClose={() => setIsAccountConfigOpen(false)}
        accountName={selectedAccount}
        initialMeta={currentAccountMeta}
        onSave={handleSaveAccountMeta}
      />
    </DashboardContext.Provider>
  );
};

export default App;
