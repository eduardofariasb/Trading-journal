import React, { useMemo, useState, useEffect } from 'react';
import { 
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  ScatterChart, Scatter
} from 'recharts';
import { 
  ArrowUpRight, Activity, Target, TrendingUp, 
  CalendarDays, CheckCircle2, Calendar, 
  Wallet, DollarSign, Award, CalendarClock, Edit3, ShieldCheck, Sparkles,
  BarChart2, AlertTriangle, PlusCircle, Clock, X
} from 'lucide-react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { doc, collection, onSnapshot, setDoc, writeBatch, query, where, getDocs, serverTimestamp } from 'firebase/firestore';

import { auth, db, appId } from './services/firebaseConfig';
import { 
  calculateTradingStats, 
  calculateEconomicStats, 
  aggregateTradesToDaily, 
  calculateHourlyPerformance 
} from './utils/metrics';

import EconomicPerformance from './components/EconomicPerformance';
import TradeEntryModal from './components/TradeEntryModal';
import HourlyPerformanceChart from './components/HourlyPerformanceChart';
import TradingCalendar from './components/TradingCalendar';

const themeColors = {
  emerald: '#10B981',
  coral: '#EF4444',
  gray: '#9CA3AF',
  lightGray: '#F3F4F6'
};

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-slate-100 p-5 ${className}`}>
    {children}
  </div>
);

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
  const percentage = isNaN(value) ? 0 : Math.min((value / max) * 100, 100);
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

const AccountConfigModal = ({ isOpen, onClose, currentAccount, onSave, onRename, onDelete, onReset }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState('eval');
  const [targetProfit, setTargetProfit] = useState(3000);
  const [purchaseDate, setPurchaseDate] = useState('2026-09-01');
  const [expirationDate, setExpirationDate] = useState('2026-09-30');
  const [initialBalance, setInitialBalance] = useState(50000);
  const [accountCost, setAccountCost] = useState(0);
  const [totalPayouts, setTotalPayouts] = useState(0);
  const [confirmAction, setConfirmAction] = useState(null);

  useEffect(() => {
    if (currentAccount) {
      setName(currentAccount.name || '');
      setType(currentAccount.type || 'eval');
      setTargetProfit(currentAccount.targetProfit || 3000);
      setPurchaseDate(currentAccount.purchaseDate || new Date().toISOString().split('T')[0]);
      setExpirationDate(currentAccount.expirationDate || new Date().toISOString().split('T')[0]);
      setInitialBalance(currentAccount.initialBalance || 50000);
      setAccountCost(currentAccount.accountCost || 0);
      setTotalPayouts(currentAccount.totalPayouts || 0);
    }
  }, [currentAccount, isOpen]);

  if (!isOpen || !currentAccount) return null;

  const isAll = currentAccount.accountId === 'all';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isAll && name.trim() && name !== currentAccount.name) {
      onRename(currentAccount.accountId, name.trim());
    }
    onSave(currentAccount.accountId, { 
      name: isAll ? 'Consolidado General' : name.trim(),
      type, 
      targetProfit: Number(targetProfit) || 0, 
      purchaseDate, 
      expirationDate, 
      initialBalance: Number(initialBalance) || 0, 
      accountCost: Number(accountCost) || 0, 
      totalPayouts: Number(totalPayouts) || 0 
    });
    onClose();
  };

  const executeConfirm = () => {
    if (confirmAction === 'reset') onReset(currentAccount.accountId);
    if (confirmAction === 'delete') onDelete(currentAccount.accountId);
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
              ? `Esto archivará el ciclo actual de "${currentAccount.name}". Las métricas iniciarán desde cero.`
              : `Esto eliminará permanentemente la cuenta "${currentAccount.name}" y todos sus trades.`}
          </p>
          <div className="flex gap-3 pt-4 mt-2 border-t border-slate-100">
            <button type="button" onClick={() => setConfirmAction(null)} className="flex-1 py-2.5 rounded-xl font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200">Cancelar</button>
            <button type="button" onClick={executeConfirm} className="flex-1 py-2.5 rounded-xl font-semibold bg-red-600 text-white hover:bg-red-700">Confirmar</button>
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
            <Edit3 className="w-5 h-5 text-emerald-600" /> Configuración de Cuenta
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {!isAll && (
            <div>
              <label className="font-semibold block mb-1">Nombre de la Cuenta</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" required />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setType('eval')} className={`py-2 px-3 rounded-lg font-bold border transition-all ${type === 'eval' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-200 text-slate-500'}`}>🎯 Evaluación</button>
            <button type="button" onClick={() => setType('funded')} className={`py-2 px-3 rounded-lg font-bold border transition-all ${type === 'funded' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-gray-200 text-slate-500'}`}>🏆 Fondeada</button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">Fecha de Compra</label>
              <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="w-full p-2 border rounded-lg" required />
            </div>
            <div>
              <label className="font-semibold block mb-1">Vencimiento / Renovación</label>
              <input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} className="w-full p-2 border rounded-lg" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">Profit Target ($)</label>
              <input type="number" value={targetProfit} onChange={(e) => setTargetProfit(e.target.value)} className="w-full p-2 border rounded-lg" required />
            </div>
            <div>
              <label className="font-semibold block mb-1">Balance Inicial ($)</label>
              <input type="number" value={initialBalance} onChange={(e) => setInitialBalance(e.target.value)} className="w-full p-2 border rounded-lg" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t">
            <div>
              <label className="font-semibold block mb-1">Costos / Resets Pagados ($)</label>
              <input type="number" value={accountCost} onChange={(e) => setAccountCost(e.target.value)} className="w-full p-2 border rounded-lg text-red-600 font-semibold" />
            </div>
            <div>
              <label className="font-semibold block mb-1">Retiros / Payouts Cobrados ($)</label>
              <input type="number" value={totalPayouts} onChange={(e) => setTotalPayouts(e.target.value)} className="w-full p-2 border rounded-lg text-emerald-600 font-semibold" />
            </div>
          </div>

          {!isAll && (
            <div className="pt-3 border-t border-slate-100 flex gap-2">
              <button type="button" onClick={() => setConfirmAction('reset')} className="flex-1 py-2 bg-amber-50 text-amber-700 border border-amber-200 font-semibold rounded-lg hover:bg-amber-100">Reiniciar Ciclo</button>
              <button type="button" onClick={() => setConfirmAction('delete')} className="flex-1 py-2 bg-red-50 text-red-700 border border-red-200 font-semibold rounded-lg hover:bg-red-100">Eliminar Cuenta</button>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-500">Cancelar</button>
            <button type="submit" className="px-5 py-2 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Guardar Cambios</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const PropFirmTracker = ({ currentAccount, netPnl, onEditAccount }) => {
  const isAll = !currentAccount || currentAccount.accountId === 'all';
  const meta = currentAccount || { type: 'eval', targetProfit: 3000, purchaseDate: '2026-09-01', expirationDate: '2026-09-30', initialBalance: 50000, accountCost: 0, totalPayouts: 0 };
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
              <h2 className="text-base font-bold text-slate-900">{isAll ? "Vista Consolidada" : `Cuenta: ${meta.name}`}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${isFunded ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {isFunded ? "🏆 Fondeada" : "🎯 Evaluación"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Compra: {String(meta?.purchaseDate)} • Vence: {String(meta?.expirationDate)}</p>
          </div>
        </div>
        <button onClick={onEditAccount} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors">
          <Edit3 className="w-3.5 h-3.5 text-blue-600" /> Configurar Cuenta y Metas
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg border border-slate-200 text-blue-600 shadow-2xs"><CalendarClock className="w-5 h-5" /></div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Tiempo Restante</span>
            <div className="flex items-baseline gap-1 mt-0.5"><span className="text-lg font-black text-slate-800">{calDaysLeft}</span><span className="text-xs text-slate-500">días</span></div>
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
            <span className={`text-lg font-black ${remainingPnl <= 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
              {remainingPnl <= 0 ? "¡Cumplido! 🎉" : `$${remainingPnl.toLocaleString()}`}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg border border-emerald-200 text-emerald-600 shadow-2xs"><Sparkles className="w-5 h-5" /></div>
          <div>
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">{isFunded ? "Rendimiento Fondeada" : "Promedio Necesario"}</span>
            {isFunded ? <span className="text-xs font-semibold text-emerald-700">En fase de retiros</span> : remainingPnl <= 0 ? <span className="text-xs font-bold text-emerald-600">¡Superada!</span> : <span className="text-lg font-black text-emerald-600">+${requiredDailyAvg.toFixed(1)} <span className="text-xs font-medium text-emerald-700">/día</span></span>}
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [trades, setTrades] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [isAccountConfigOpen, setIsAccountConfigOpen] = useState(false);
  const [isTradeEntryOpen, setIsTradeEntryOpen] = useState(false);

  useEffect(() => {
    signInAnonymously(auth).catch(e => console.error(e));
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;

    const unsubAccounts = onSnapshot(collection(db, 'artifacts', appId, 'users', uid, 'accounts'), (snap) => {
      let accs = snap.docs.map(d => ({ accountId: d.id, ...d.data() }));
      if (accs.length === 0) {
        const defaultAcc = {
          accountId: 'acc_principal',
          name: 'Cuenta Principal',
          type: 'funded',
          targetProfit: 3000,
          purchaseDate: '2026-07-01',
          expirationDate: '2026-11-24',
          initialBalance: 50000,
          accountCost: 150,
          totalPayouts: 1500,
          activeCycleId: 'cycle_1'
        };
        setDoc(doc(db, 'artifacts', appId, 'users', uid, 'accounts', defaultAcc.accountId), defaultAcc);
        accs = [defaultAcc];
      }
      setAccounts(accs);
    });

    const unsubTrades = onSnapshot(collection(db, 'artifacts', appId, 'users', uid, 'trades'), (snap) => {
      const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      records.sort((a, b) => (a.entryTime || a.date).localeCompare(b.entryTime || b.date));
      setTrades(records);
    });

    return () => { unsubAccounts(); unsubTrades(); };
  }, [user]);

  const activeAccount = useMemo(() => {
    if (selectedAccountId === 'all') {
      const totalCosts = accounts.reduce((s, a) => s + (Number(a.accountCost) || 0), 0);
      const totalPayouts = accounts.reduce((s, a) => s + (Number(a.totalPayouts) || 0), 0);
      const targetProfit = accounts.reduce((s, a) => s + (Number(a.targetProfit) || 0), 0);
      return {
        accountId: 'all',
        name: 'Consolidado General',
        type: 'funded',
        targetProfit,
        accountCost: totalCosts,
        totalPayouts: totalPayouts,
        purchaseDate: 'N/A',
        expirationDate: 'N/A'
      };
    }
    return accounts.find(a => a.accountId === selectedAccountId) || accounts[0] || null;
  }, [accounts, selectedAccountId]);

  const handleSaveAccount = async (accId, updatedData) => {
    if (!user) return;
    if (accId === 'all') {
      const targetId = accounts[0]?.accountId;
      if (targetId) {
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'accounts', targetId), updatedData, { merge: true });
      }
    } else {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'accounts', accId), updatedData, { merge: true });
    }
  };

  const handleRenameAccount = async (accId, newName) => {
    if (!user || accId === 'all') return;
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'accounts', accId), { name: newName }, { merge: true });
  };

  const handleDeleteAccount = async (accId) => {
    if (!user || accId === 'all') return;
    const batch = writeBatch(db);
    batch.delete(doc(db, 'artifacts', appId, 'users', user.uid, 'accounts', accId));
    const tradesQuery = query(collection(db, 'artifacts', appId, 'users', user.uid, 'trades'), where("accountId", "==", accId));
    const snap = await getDocs(tradesQuery);
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
    setSelectedAccountId('all');
  };

  const handleResetAccountCycle = async (accId) => {
    if (!user || accId === 'all') return;
    const batch = writeBatch(db);
    const tradesQuery = query(collection(db, 'artifacts', appId, 'users', user.uid, 'trades'), where("accountId", "==", accId));
    const snap = await getDocs(tradesQuery);
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
  };

  const handleSaveTradesBatch = async (newTrades) => {
    if (!user) return;
    const batch = writeBatch(db);
    newTrades.forEach(t => {
      const ref = doc(collection(db, 'artifacts', appId, 'users', user.uid, 'trades'));
      batch.set(ref, {
        ...t,
        createdAt: serverTimestamp()
      });
    });
    await batch.commit();
  };

  const handleCreateNewAccount = async () => {
    if (!user) return;
    const newId = `acc_${Date.now()}`;
    const newAccount = {
      accountId: newId,
      name: `Nueva Cuenta #${accounts.length + 1}`,
      type: 'eval',
      targetProfit: 3000,
      purchaseDate: new Date().toISOString().split('T')[0],
      expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      initialBalance: 50000,
      accountCost: 150,
      totalPayouts: 0,
      activeCycleId: `cycle_${Date.now()}`
    };
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'accounts', newId), newAccount);
    setSelectedAccountId(newId);
  };

  const accountTrades = useMemo(() => {
    if (selectedAccountId === 'all') return trades;
    return trades.filter(r => r.accountId === selectedAccountId);
  }, [trades, selectedAccountId]);

  const filteredTrades = useMemo(() => {
    if (dateFilter === 'all') return accountTrades;
    return accountTrades.filter(r => r.date.startsWith(dateFilter));
  }, [accountTrades, dateFilter]);

  const cycleStats = calculateTradingStats(accountTrades);
  const analyticalStats = calculateTradingStats(filteredTrades);

  const currentMeta = activeAccount || {};
  const simulatedTransactions = useMemo(() => [
    { type: 'account_cost', amount: currentMeta.accountCost || 0 },
    { type: 'payout', amount: currentMeta.totalPayouts || 0 }
  ], [currentMeta]);

  const economicStats = calculateEconomicStats(analyticalStats.netPnl, simulatedTransactions);

  const dailyAggregated = useMemo(() => aggregateTradesToDaily(filteredTrades), [filteredTrades]);
  const hourlyData = useMemo(() => calculateHourlyPerformance(filteredTrades), [filteredTrades]);

  const chartData = useMemo(() => {
    let cum = 0;
    return dailyAggregated.map((d, i) => { 
      cum += d.netPnl; 
      return { 
        ...d, 
        day: (i + 1).toString(), 
        pnl: d.netPnl,
        trades: d.totalTrades,
        cumulative: cum 
      }; 
    });
  }, [dailyAggregated]);

  const dayWinPercent = dailyAggregated.length > 0 
    ? (dailyAggregated.filter(d => d.netPnl > 0).length / dailyAggregated.length * 100) 
    : 0;

  const totalAvg = (analyticalStats.avgWin + analyticalStats.avgLoss) || 1;
  const avgWinWidth = (analyticalStats.avgWin / totalAvg) * 100;
  const avgLossWidth = 100 - avgWinWidth;

  const availableMonths = useMemo(() => {
    const months = new Set(trades.map(t => t.date.substring(0, 7)));
    return Array.from(months).sort().reverse();
  }, [trades]);

  return (
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
            <button 
              onClick={() => setIsTradeEntryOpen(true)} 
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4" /> Registrar Trades
            </button>

            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
              <Wallet className="w-4 h-4 text-blue-500" />
              <select 
                className="bg-transparent border-none text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer" 
                value={selectedAccountId} 
                onChange={(e) => setSelectedAccountId(e.target.value)}
              >
                <option value="all">Consolidado General</option>
                {accounts.map(a => <option key={a.accountId} value={a.accountId}>{a.name}</option>)}
              </select>
            </div>

            <button 
              onClick={handleCreateNewAccount} 
              title="Crear Nueva Cuenta"
              className="p-2 bg-white border border-gray-200 hover:bg-slate-50 rounded-lg text-slate-600 shadow-sm"
            >
              <PlusCircle className="w-4 h-4 text-slate-600" />
            </button>

            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
              <Calendar className="w-4 h-4 text-slate-500" />
              <select 
                className="bg-transparent border-none text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer" 
                value={dateFilter} 
                onChange={(e) => setDateFilter(e.target.value)}
              >
                <option value="all">Historial Completo</option>
                {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
        </header>

        <main>
          <PropFirmTracker 
            currentAccount={activeAccount} 
            netPnl={cycleStats.netPnl} 
            onEditAccount={() => setIsAccountConfigOpen(true)} 
          />

          <EconomicPerformance stats={economicStats} />

          {/* KPI ROW con R-Múltiplo Real */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
            <Card>
              <CardTitle title="Net P&L" subtitle="Resultado Operativo" icon={Activity} />
              <div className="flex flex-col justify-between h-24">
                <div className={`text-2xl font-black mt-2 ${analyticalStats.netPnl >= 0 ? 'text-emerald-600' : 'text-coral-500'}`}>
                  {analyticalStats.netPnl >= 0 
                    ? `+$${analyticalStats.netPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}` 
                    : `-$${Math.abs(analyticalStats.netPnl).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                </div>
                <span className="text-xs text-slate-400 font-medium">{analyticalStats.totalTrades} operaciones</span>
              </div>
            </Card>

            <Card>
              <CardTitle title="Trade Win %" icon={Target} />
              <SemiCircleGauge value={analyticalStats.winRate.toFixed(1)} max={100} label="Win Rate" suffix="%" color={themeColors.emerald} />
            </Card>

            <Card>
              <CardTitle title="Profit Factor" icon={TrendingUp} />
              <SemiCircleGauge value={analyticalStats.profitFactor === Infinity ? 5 : (analyticalStats.profitFactor || 0).toFixed(2)} max={5} label="Gross Win/Loss" color="#3B82F6" />
            </Card>

            <Card>
              <CardTitle title="Day Win %" icon={CalendarDays} />
              <SemiCircleGauge value={dayWinPercent.toFixed(1)} max={100} label="Días Positivos" suffix="%" color={themeColors.emerald} />
            </Card>

            <Card>
              <CardTitle title="R-Múltiplo Prom." subtitle="Riesgo / Retorno" icon={Award} />
              <div className="flex flex-col justify-between h-24">
                <div className={`text-2xl font-black mt-2 ${analyticalStats.avgR && analyticalStats.avgR >= 1 ? 'text-emerald-600' : 'text-slate-800'}`}>
                  {analyticalStats.avgR !== null ? `${analyticalStats.avgR}R` : 'N/A'}
                </div>
                <span className="text-xs text-slate-400 font-medium">
                  Mejor: {analyticalStats.maxR !== null ? `+${analyticalStats.maxR}R` : '-'}
                </span>
              </div>
            </Card>

            <Card>
              <CardTitle title="Avg Win / Loss" icon={ArrowUpRight} />
              <div className="flex justify-between items-baseline mt-4 mb-3">
                <span className="text-sm font-bold text-emerald-600">+${analyticalStats.avgWin.toFixed(2)}</span>
                <span className="text-sm font-bold text-coral-500">-${analyticalStats.avgLoss.toFixed(2)}</span>
              </div>
              <div className="w-full bg-coral-100 h-2 rounded-full overflow-hidden flex">
                <div className="bg-emerald-500 h-full transition-all" style={{ width: `${isNaN(avgWinWidth) ? 50 : avgWinWidth}%` }} />
                <div className="bg-coral-500 h-full transition-all" style={{ width: `${isNaN(avgLossWidth) ? 50 : avgLossWidth}%` }} />
              </div>
            </Card>
          </div>

          {/* Gráficos Principales */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardTitle title="P&L por Franja Horaria" subtitle="Rendimiento por hora de entrada" icon={Clock} />
              <HourlyPerformanceChart data={hourlyData} />
            </Card>

            <Card>
              <CardTitle title="Daily P&L" subtitle="Resultado neto diario" icon={BarChart2} />
              <div className="h-64">
                {chartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">Sin datos para graficar</div>
                ) : (
                  <ResponsiveContainer>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="date" fontSize={10} stroke="#94A3B8" tickLine={false} />
                      <YAxis fontSize={11} stroke="#94A3B8" tickLine={false} tickFormatter={v => `$${v}`} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                        {chartData.map((e, i) => <Cell key={i} fill={e.pnl >= 0 ? themeColors.emerald : themeColors.coral} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card>
              <CardTitle title="Cumulative P&L" subtitle="Curva de capital acumulado" icon={TrendingUp} />
              <div className="h-64">
                {chartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">Sin datos para graficar</div>
                ) : (
                  <ResponsiveContainer>
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="date" fontSize={10} stroke="#94A3B8" tickLine={false} />
                      <YAxis fontSize={11} stroke="#94A3B8" tickLine={false} tickFormatter={v => `$${v}`} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Area type="monotone" dataKey="cumulative" stroke={themeColors.emerald} strokeWidth={2.5} fill={themeColors.emerald} fillOpacity={0.15} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>

          {/* Calendario Dinámico y Overtrading */}
<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
  <div className="lg:col-span-2">
    <TradingCalendar dailyData={dailyAggregated} />
  </div>

  <Card>
    <CardTitle title="Overtrading Analysis" subtitle="Total Trades vs P&L" icon={TrendingUp} />
    <div className="h-64">
      {dailyAggregated.length === 0 ? (
        <div className="h-full flex items-center justify-center text-xs text-slate-400">Sin datos de sobreoperativa</div>
      ) : (
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis type="number" dataKey="totalTrades" name="Trades" stroke="#94A3B8" fontSize={11} />
            <YAxis type="number" dataKey="netPnl" name="P&L" stroke="#94A3B8" fontSize={11} tickFormatter={v => `$${v}`} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            <Scatter data={dailyAggregated}>
              {dailyAggregated.map((e, i) => (
                <Cell 
                  key={i} 
                  fill={e.dayStatus === 'WIN' ? themeColors.emerald : e.dayStatus === 'LOSS' ? themeColors.coral : '#F59E0B'} 
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      )}
    </div>
  </Card>
</div>

            <Card>
              <CardTitle title="Overtrading Analysis" subtitle="Total Trades vs P&L" icon={TrendingUp} />
              <div className="h-64">
                {dailyAggregated.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">Sin datos de sobreoperativa</div>
                ) : (
                  <ResponsiveContainer>
                    <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis type="number" dataKey="totalTrades" name="Trades" stroke="#94A3B8" fontSize={11} />
                      <YAxis type="number" dataKey="netPnl" name="P&L" stroke="#94A3B8" fontSize={11} tickFormatter={v => `$${v}`} />
                      <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                      <Scatter data={dailyAggregated}>
                        {dailyAggregated.map((e, i) => <Cell key={i} fill={e.netPnl >= 0 ? themeColors.emerald : themeColors.coral} />)}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>
        </main>
      </div>

      <AccountConfigModal 
        isOpen={isAccountConfigOpen} 
        onClose={() => setIsAccountConfigOpen(false)} 
        currentAccount={activeAccount} 
        onSave={handleSaveAccount} 
        onRename={handleRenameAccount} 
        onDelete={handleDeleteAccount} 
        onReset={handleResetAccountCycle} 
      />

      <TradeEntryModal 
        isOpen={isTradeEntryOpen} 
        onClose={() => setIsTradeEntryOpen(false)} 
        onSaveTrades={handleSaveTradesBatch} 
        accounts={accounts} 
        activeAccountId={selectedAccountId} 
      />
    </div>
  );
}
