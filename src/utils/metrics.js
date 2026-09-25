// src/utils/metrics.js

/**
 * Calcula el múltiplo R de un trade individual basado en puntos
 */
export function calculateTradeR(trade) {
  const { entryPrice, exitPrice, stopLoss, direction } = trade;
  if (!entryPrice || !exitPrice || !stopLoss) return null;

  const riskPoints = Math.abs(entryPrice - stopLoss);
  if (riskPoints <= 0) return null;

  const isLong = direction.toUpperCase() === 'LONG';
  const gainedPoints = isLong ? (exitPrice - entryPrice) : (entryPrice - exitPrice);

  return Number((gainedPoints / riskPoints).toFixed(2));
}

/**
 * Agrega trades individuales en días operativos para el Calendario y Gráficos diarios
 */
export function aggregateTradesToDaily(trades = []) {
  const map = new Map();

  for (const t of trades) {
    const key = `${t.accountId}_${t.date}`;
    if (!map.has(key)) {
      map.set(key, {
        date: t.date,
        accountId: t.accountId,
        cycleId: t.cycleId,
        netPnl: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        grossWin: 0,
        grossLoss: 0,
        trades: []
      });
    }

    const day = map.get(key);
    day.netPnl += t.netPnl;
    day.totalTrades += 1;
    day.trades.push(t);

    if (t.netPnl > 0) {
      day.winningTrades += 1;
      day.grossWin += t.netPnl;
    } else if (t.netPnl < 0) {
      day.losingTrades += 1;
      day.grossLoss += Math.abs(t.netPnl);
    }
  }

  return Array.from(map.values()).map(d => ({
    ...d,
    winRate: d.totalTrades > 0 ? (d.winningTrades / d.totalTrades) * 100 : 0,
    avgWin: d.winningTrades > 0 ? d.grossWin / d.winningTrades : 0,
    avgLoss: d.losingTrades > 0 ? d.grossLoss / d.losingTrades : 0
  })).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Métricas generales calculadas a partir de trades atómicos reales
 */
export function calculateTradingStats(trades = []) {
  if (!trades || trades.length === 0) {
    return {
      hasData: false,
      netPnl: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      grossWin: 0,
      grossLoss: 0,
      profitFactor: null,
      avgWin: 0,
      avgLoss: 0,
      avgR: null,
      maxR: null,
      tradingDaysCount: 0,
      maxDrawdown: 0
    };
  }

  let netPnl = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let grossWin = 0;
  let grossLoss = 0;
  let sumR = 0;
  let countR = 0;
  let maxR = -Infinity;

  for (const t of trades) {
    netPnl += t.netPnl;
    if (t.netPnl > 0) {
      winningTrades += 1;
      grossWin += t.netPnl;
    } else if (t.netPnl < 0) {
      losingTrades += 1;
      grossLoss += Math.abs(t.netPnl);
    }

    if (t.rMultiple !== null && !isNaN(t.rMultiple)) {
      sumR += t.rMultiple;
      countR += 1;
      if (t.rMultiple > maxR) maxR = t.rMultiple;
    }
  }

  const totalTrades = trades.length;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  
  let profitFactor = null;
  if (grossLoss > 0) profitFactor = grossWin / grossLoss;
  else if (grossWin > 0) profitFactor = Infinity;

  // Max Drawdown trade a trade
  let peak = 0;
  let runningPnl = 0;
  let maxDrawdown = 0;
  const sorted = [...trades].sort((a, b) => a.entryTime.localeCompare(b.entryTime));
  for (const t of sorted) {
    runningPnl += t.netPnl;
    if (runningPnl > peak) peak = runningPnl;
    const dd = peak - runningPnl;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const dailyAgg = aggregateTradesToDaily(trades);

  return {
    hasData: totalTrades > 0,
    netPnl,
    totalTrades,
    winningTrades,
    losingTrades,
    winRate,
    grossWin,
    grossLoss,
    profitFactor,
    avgWin: winningTrades > 0 ? grossWin / winningTrades : 0,
    avgLoss: losingTrades > 0 ? grossLoss / losingTrades : 0,
    avgR: countR > 0 ? Number((sumR / countR).toFixed(2)) : null,
    maxR: countR > 0 && maxR !== -Infinity ? maxR : null,
    tradingDaysCount: dailyAgg.length,
    maxDrawdown
  };
}

/**
 * Métrica 1: Desempeño por franja horaria (Hora de entrada)
 */
export function calculateHourlyPerformance(trades = []) {
  const hourMap = {};

  for (const t of trades) {
    let hour = '09:00';
    if (t.entryTime) {
      // Extrae la hora ya sea "2026-09-24 09:35" o "09:35"
      const match = t.entryTime.match(/(\d{1,2}):\d{2}/);
      if (match) {
        hour = `${match[1].padStart(2, '0')}:00`;
      }
    }

    if (!hourMap[hour]) {
      hourMap[hour] = { hour, netPnl: 0, trades: 0, wins: 0 };
    }

    hourMap[hour].netPnl += t.netPnl;
    hourMap[hour].trades += 1;
    if (t.netPnl > 0) hourMap[hour].wins += 1;
  }

  return Object.values(hourMap)
    .sort((a, b) => a.hour.localeCompare(b.hour))
    .map(h => ({
      ...h,
      winRate: h.trades > 0 ? Math.round((h.wins / h.trades) * 100) : 0
    }));
}

/**
 * Finanzas y flujo de caja (inmune a variaciones operativas)
 */
export function calculateEconomicStats(tradingPnl, transactions = []) {
  const COST_TYPES = new Set(['account_cost', 'reset_fee', 'activation_fee', 'platform_fee', 'other_expense']);
  let totalCosts = 0;
  let totalPayouts = 0;

  for (const tx of transactions) {
    const amt = Math.abs(Number(tx.amount) || 0);
    if (COST_TYPES.has(tx.type)) totalCosts += amt;
    else if (tx.type === 'payout') totalPayouts += amt;
  }

  return {
    tradingPnl,
    totalCosts,
    totalPayouts,
    capitalRetenido: tradingPnl - totalPayouts,
    balanceEconomicoCaja: totalPayouts - totalCosts,
    valorEconomicoGenerado: tradingPnl - totalCosts
  };
}
