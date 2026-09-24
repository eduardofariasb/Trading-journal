// src/utils/metrics.js

/**
 * Normaliza los registros de la base de datos para garantizar compatibilidad
 * con la nueva estructura de IDs estables (accountId, cycleId) y métricas derivadas.
 */
export function normalizeTradingRecord(docData, accountsMap = {}, defaultCycleMap = {}) {
  const id = docData.id;
  
  // Resolución de cuenta: si no hay accountId, buscar por nombre o asignar fallback
  let accountId = docData.accountId;
  if (!accountId && docData.account) {
    const matchedAccount = Object.values(accountsMap).find(a => a.name === docData.account);
    accountId = matchedAccount ? matchedAccount.accountId : `acc_legacy_${docData.account.replace(/\s+/g, '_').toLowerCase()}`;
  }
  
  const totalTrades = Number(docData.totalTrades || docData.trades || 0);
  const winRate = Number(docData.winRate || 0);
  
  // Derivación matemática de wins/losses si no estaban explícitos en registros antiguos
  let winningTrades = Number(docData.winningTrades);
  let losingTrades = Number(docData.losingTrades);
  if (isNaN(winningTrades) || isNaN(losingTrades)) {
    winningTrades = Math.round((totalTrades * winRate) / 100);
    losingTrades = Math.max(0, totalTrades - winningTrades);
  }

  return {
    id,
    tradingDayId: id,
    accountId: accountId || 'acc_default',
    cycleId: docData.cycleId || defaultCycleMap[accountId] || `cycle_legacy_${accountId}`,
    date: docData.date || new Date().toISOString().split('T')[0],
    netPnl: Number(docData.netPnl !== undefined ? docData.netPnl : (docData.pnl || 0)),
    totalTrades,
    winningTrades,
    losingTrades,
    winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
    avgWin: Math.max(0, Number(docData.avgWin || 0)),
    avgLoss: Math.abs(Number(docData.avgLoss || 0)),
    tradeScore: docData.tradeScore || null,
    notes: docData.notes || '',
    createdAt: docData.createdAt || null
  };
}

/**
 * Agrupa múltiples registros/sesiones del mismo día para la misma cuenta y ciclo.
 * Suma P&L y calcula promedios ponderados reales.
 */
export function aggregateDailyTradingData(records) {
  const map = new Map();

  for (const item of records) {
    const key = `${item.accountId}_${item.date}`;
    if (!map.has(key)) {
      map.set(key, {
        date: item.date,
        accountId: item.accountId,
        cycleId: item.cycleId,
        netPnl: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        weightedWinSum: 0,
        weightedLossSum: 0,
        sessions: 0
      });
    }

    const current = map.get(key);
    current.netPnl += item.netPnl;
    current.totalTrades += item.totalTrades;
    current.winningTrades += item.winningTrades;
    current.losingTrades += item.losingTrades;
    current.weightedWinSum += (item.winningTrades * item.avgWin);
    current.weightedLossSum += (item.losingTrades * item.avgLoss);
    current.sessions += 1;
  }

  return Array.from(map.values()).map(day => ({
    ...day,
    winRate: day.totalTrades > 0 ? (day.winningTrades / day.totalTrades) * 100 : 0,
    avgWin: day.winningTrades > 0 ? day.weightedWinSum / day.winningTrades : 0,
    avgLoss: day.losingTrades > 0 ? day.weightedLossSum / day.losingTrades : 0,
  })).sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * Calcula las estadísticas globales de trading de un conjunto de registros.
 * Calcula el Profit Factor y los promedios ganadores/perdedores ponderados.
 */
export function calculateTradingStats(records) {
  if (!records || records.length === 0) {
    return { 
      hasData: false, 
      netPnl: 0, 
      totalTrades: 0, 
      winningTrades: 0, 
      losingTrades: 0, 
      winRate: 0, 
      profitFactor: null, 
      avgWin: 0, 
      avgLoss: 0, 
      tradingDaysCount: 0, 
      maxDrawdown: 0 
    };
  }

  const dailyAggregated = aggregateDailyTradingData(records);
  let netPnl = 0, totalTrades = 0, winningTrades = 0, losingTrades = 0;
  let totalGrossWin = 0, totalGrossLoss = 0;

  for (const r of records) {
    netPnl += r.netPnl;
    totalTrades += r.totalTrades;
    winningTrades += r.winningTrades;
    losingTrades += r.losingTrades;
    totalGrossWin += (r.winningTrades * r.avgWin);
    totalGrossLoss += (r.losingTrades * r.avgLoss);
  }

  let profitFactor = null;
  if (totalGrossLoss > 0) profitFactor = totalGrossWin / totalGrossLoss;
  else if (totalGrossWin > 0) profitFactor = Infinity;

  // Cálculo de Max Drawdown basado en la curva de equity diaria
  let peak = 0, runningPnl = 0, maxDrawdown = 0;
  for (const d of dailyAggregated) {
    runningPnl += d.netPnl;
    if (runningPnl > peak) peak = runningPnl;
    const dd = peak - runningPnl;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  return {
    hasData: totalTrades > 0 || dailyAggregated.length > 0,
    netPnl,
    totalTrades,
    winningTrades,
    losingTrades,
    winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
    profitFactor,
    avgWin: winningTrades > 0 ? totalGrossWin / winningTrades : 0,
    avgLoss: losingTrades > 0 ? totalGrossLoss / losingTrades : 0,
    tradingDaysCount: dailyAggregated.length,
    maxDrawdown
  };
}

/**
 * Calcula el estado económico aislando el P&L de trading del flujo de caja.
 */
export function calculateEconomicStats(tradingPnl, transactions = []) {
  const COST_TYPES = new Set(['account_cost', 'reset_fee', 'activation_fee', 'platform_fee', 'other_expense']);
  let totalCosts = 0, totalPayouts = 0, otherIncome = 0;

  for (const tx of transactions) {
    const amt = Math.abs(Number(tx.amount) || 0);
    if (COST_TYPES.has(tx.type)) {
      totalCosts += amt;
    } else if (tx.type === 'payout') {
      totalPayouts += amt;
    } else if (tx.type === 'other_income') {
      otherIncome += amt;
    }
  }

  return {
    tradingPnl,
    totalCosts,
    totalPayouts,
    capitalRetenido: tradingPnl - totalPayouts,
    balanceEconomicoCaja: totalPayouts - totalCosts + otherIncome,
    valorEconomicoGenerado: tradingPnl - totalCosts + otherIncome
  };
}
