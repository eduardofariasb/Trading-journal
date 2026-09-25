// src/utils/metrics.js

// Umbrales configurables
export const THRESHOLDS = {
  TRADE_WIN: 15,
  TRADE_LOSS: -15,
  DAY_WIN: 30,
  DAY_LOSS: -20
};

export function getTradeStatus(netPnl) {
  if (netPnl > THRESHOLDS.TRADE_WIN) return 'WIN';
  if (netPnl < THRESHOLDS.TRADE_LOSS) return 'LOSS';
  return 'BE';
}

export function getDayStatus(netPnl) {
  if (netPnl > THRESHOLDS.DAY_WIN) return 'WIN';
  if (netPnl < THRESHOLDS.DAY_LOSS) return 'LOSS';
  return 'BE';
}

export function calculateTradeR(trade) {
  const { entryPrice, exitPrice, stopLoss, direction } = trade;
  if (!entryPrice || !exitPrice || !stopLoss) return null;

  const riskPoints = Math.abs(entryPrice - stopLoss);
  if (riskPoints <= 0) return null;

  const isLong = String(direction).toUpperCase() === 'LONG';
  const gainedPoints = isLong ? (exitPrice - entryPrice) : (entryPrice - exitPrice);

  return Number((gainedPoints / riskPoints).toFixed(2));
}

export function aggregateTradesToDaily(trades = []) {
  const map = new Map();

  for (const t of trades) {
    const key = `${t.accountId || 'all'}_${t.date}`;
    if (!map.has(key)) {
      map.set(key, {
        date: t.date,
        accountId: t.accountId,
        cycleId: t.cycleId,
        netPnl: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        beTrades: 0,
        grossWin: 0,
        grossLoss: 0,
        trades: []
      });
    }

    const day = map.get(key);
    day.netPnl += t.netPnl;
    day.totalTrades += 1;
    day.trades.push(t);

    const status = getTradeStatus(t.netPnl);
    if (status === 'WIN') {
      day.winningTrades += 1;
      day.grossWin += t.netPnl;
    } else if (status === 'LOSS') {
      day.losingTrades += 1;
      day.grossLoss += Math.abs(t.netPnl);
    } else {
      day.beTrades += 1;
    }
  }

  return Array.from(map.values()).map(d => ({
    ...d,
    dayStatus: getDayStatus(d.netPnl),
    winRate: d.totalTrades > 0 ? (d.winningTrades / d.totalTrades) * 100 : 0,
    avgWin: d.winningTrades > 0 ? d.grossWin / d.winningTrades : 0,
    avgLoss: d.losingTrades > 0 ? d.grossLoss / d.losingTrades : 0
  })).sort((a, b) => a.date.localeCompare(b.date));
}

export function calculateTradingStats(trades = []) {
  if (!trades || trades.length === 0) {
    return {
      hasData: false,
      netPnl: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      beTrades: 0,
      winRate: 0,
      grossWin: 0,
      grossLoss: 0,
      profitFactor: null,
      avgWin: 0,
      avgLoss: 0,
      avgR: null,
      maxR: null,
      tradingDaysCount: 0,
      winningDaysCount: 0,
      losingDaysCount: 0,
      beDaysCount: 0,
      dayWinRate: 0,
      maxDrawdown: 0
    };
  }

  let netPnl = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let beTrades = 0;
  let grossWin = 0;
  let grossLoss = 0;
  let sumR = 0;
  let countR = 0;
  let maxR = -Infinity;

  for (const t of trades) {
    netPnl += t.netPnl;
    const status = getTradeStatus(t.netPnl);

    if (status === 'WIN') {
      winningTrades += 1;
      grossWin += t.netPnl;
    } else if (status === 'LOSS') {
      losingTrades += 1;
      grossLoss += Math.abs(t.netPnl);
    } else {
      beTrades += 1;
    }

    if (t.rMultiple !== null && !isNaN(t.rMultiple)) {
      sumR += t.rMultiple;
      countR += 1;
      if (t.rMultiple > maxR) maxR = t.rMultiple;
    }
  }

  const totalTrades = trades.length;
  // Win rate basado en trades ganadores reales (> $15)
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  
  let profitFactor = null;
  if (grossLoss > 0) profitFactor = grossWin / grossLoss;
  else if (grossWin > 0) profitFactor = Infinity;

  const dailyAgg = aggregateTradesToDaily(trades);
  const winningDaysCount = dailyAgg.filter(d => d.dayStatus === 'WIN').length;
  const losingDaysCount = dailyAgg.filter(d => d.dayStatus === 'LOSS').length;
  const beDaysCount = dailyAgg.filter(d => d.dayStatus === 'BE').length;
  const dayWinRate = dailyAgg.length > 0 ? (winningDaysCount / dailyAgg.length) * 100 : 0;

  // Max Drawdown
  let peak = 0;
  let runningPnl = 0;
  let maxDrawdown = 0;
  const sorted = [...trades].sort((a, b) => (a.entryTime || a.date).localeCompare(b.entryTime || b.date));
  for (const t of sorted) {
    runningPnl += t.netPnl;
    if (runningPnl > peak) peak = runningPnl;
    const dd = peak - runningPnl;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  return {
    hasData: totalTrades > 0,
    netPnl,
    totalTrades,
    winningTrades,
    losingTrades,
    beTrades,
    winRate,
    grossWin,
    grossLoss,
    profitFactor,
    avgWin: winningTrades > 0 ? grossWin / winningTrades : 0,
    avgLoss: losingTrades > 0 ? grossLoss / losingTrades : 0,
    avgR: countR > 0 ? Number((sumR / countR).toFixed(2)) : null,
    maxR: countR > 0 && maxR !== -Infinity ? maxR : null,
    tradingDaysCount: dailyAgg.length,
    winningDaysCount,
    losingDaysCount,
    beDaysCount,
    dayWinRate,
    maxDrawdown
  };
}

export function calculateHourlyPerformance(trades = []) {
  const hourMap = {};

  for (const t of trades) {
    let hour = '09:00';
    if (t.entryTime) {
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
    if (getTradeStatus(t.netPnl) === 'WIN') hourMap[hour].wins += 1;
  }

  return Object.values(hourMap)
    .sort((a, b) => a.hour.localeCompare(b.hour))
    .map(h => ({
      ...h,
      winRate: h.trades > 0 ? Math.round((h.wins / h.trades) * 100) : 0
    }));
}

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
