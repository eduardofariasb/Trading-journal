import React, { useState, useEffect } from 'react';
import { X, ClipboardPaste, Upload, AlertCircle } from 'lucide-react';
import { calculateTradeR } from '../utils/metrics';

export default function TradeEntryModal({ isOpen, onClose, onSaveTrades, accounts = [], activeAccountId }) {
  const [activeTab, setActiveTab] = useState('manual');
  const [selectedAccount, setSelectedAccount] = useState('');

  // Sincronización obligatoria al abrir el modal o cambiar de cuenta
  useEffect(() => {
    if (isOpen && accounts.length > 0) {
      if (activeAccountId && activeAccountId !== 'all') {
        setSelectedAccount(activeAccountId);
      } else {
        setSelectedAccount(accounts[0].accountId);
      }
    }
  }, [isOpen, activeAccountId, accounts]);

  const [manualForm, setManualForm] = useState({
    symbol: 'NQ',
    direction: 'LONG',
    date: new Date().toISOString().split('T')[0],
    entryTime: '09:30',
    exitTime: '09:45',
    quantity: 1,
    entryPrice: '',
    exitPrice: '',
    stopLoss: '',
    slPoints: '',
    takeProfit: '',
    netPnl: ''
  });

  const [jsonText, setJsonText] = useState('');
  const [jsonPreview, setJsonPreview] = useState([]);
  const [jsonError, setJsonError] = useState('');

  if (!isOpen) return null;

  const targetAccountId = selectedAccount || accounts[0]?.accountId || 'acc_principal';

  const handleManualSlPointsChange = (ptsVal) => {
    const entry = Number(manualForm.entryPrice);
    if (!ptsVal || isNaN(ptsVal) || !entry) {
      setManualForm(prev => ({ ...prev, slPoints: ptsVal, stopLoss: '' }));
      return;
    }
    const pts = Math.abs(Number(ptsVal));
    const isLong = manualForm.direction === 'LONG';
    const computedSl = isLong ? (entry - pts) : (entry + pts);
    setManualForm(prev => ({
      ...prev,
      slPoints: ptsVal,
      stopLoss: Number(computedSl.toFixed(2))
    }));
  };

  const handleManualPriceSlChange = (priceVal) => {
    const entry = Number(manualForm.entryPrice);
    if (!priceVal || isNaN(priceVal) || !entry) {
      setManualForm(prev => ({ ...prev, stopLoss: priceVal, slPoints: '' }));
      return;
    }
    const sl = Number(priceVal);
    const pts = Math.abs(entry - sl);
    setManualForm(prev => ({
      ...prev,
      stopLoss: priceVal,
      slPoints: Number(pts.toFixed(2))
    }));
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const trade = {
      ...manualForm,
      accountId: targetAccountId,
      entryTime: `${manualForm.date} ${manualForm.entryTime}`,
      exitTime: `${manualForm.date} ${manualForm.exitTime}`,
      quantity: Number(manualForm.quantity) || 1,
      entryPrice: Number(manualForm.entryPrice) || 0,
      exitPrice: Number(manualForm.exitPrice) || 0,
      stopLoss: manualForm.stopLoss !== '' ? Number(manualForm.stopLoss) : null,
      takeProfit: manualForm.takeProfit ? Number(manualForm.takeProfit) : null,
      netPnl: Number(manualForm.netPnl) || 0,
    };
    trade.rMultiple = calculateTradeR(trade);
    onSaveTrades([trade]);
    onClose();
  };

  const handleParseJson = () => {
    setJsonError('');
    try {
      const match = jsonText.match(/\[[\s\S]*\]/) || jsonText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No se detectó un formato JSON válido.");
      const parsed = JSON.parse(match[0]);
      const rawList = Array.isArray(parsed) ? parsed : [parsed];

      const formatted = rawList.map((item) => {
        const date = item.date || (item.entryTime ? item.entryTime.split(' ')[0] : new Date().toISOString().split('T')[0]);
        const entryPrice = Number(item.entryPrice || item.entry || 0);
        const exitPrice = Number(item.exitPrice || item.exit || 0);
        const direction = (item.direction || item.side || 'LONG').toUpperCase();
        
        let stopLoss = item.stopLoss !== null && item.stopLoss !== undefined && item.stopLoss !== '' ? Number(item.stopLoss) : '';
        let slPoints = '';

        if (stopLoss !== '' && entryPrice) {
          slPoints = Number(Math.abs(entryPrice - stopLoss).toFixed(2));
        }

        const trade = {
          symbol: item.symbol || item.ticker || 'MNQ',
          direction,
          date,
          entryTime: item.entryTime || `${date} 09:30`,
          exitTime: item.exitTime || `${date} 10:00`,
          quantity: Number(item.quantity || item.contracts || 1),
          entryPrice,
          exitPrice,
          stopLoss,
          slPoints,
          takeProfit: item.takeProfit ? Number(item.takeProfit) : null,
          netPnl: Number(item.netPnl ?? item.pnl ?? 0),
          accountId: targetAccountId
        };

        trade.rMultiple = trade.stopLoss !== '' ? calculateTradeR(trade) : null;
        return trade;
      });

      setJsonPreview(formatted);
    } catch {
      setJsonError("Error al procesar JSON. Verifica la sintaxis.");
    }
  };

  const handleUpdateSlPoints = (index, pointsValue) => {
    setJsonPreview(prev => {
      const updated = [...prev];
      const trade = { ...updated[index] };
      trade.slPoints = pointsValue;

      if (pointsValue !== '' && !isNaN(pointsValue) && trade.entryPrice) {
        const pts = Math.abs(Number(pointsValue));
        const isLong = trade.direction === 'LONG';
        const computedSl = isLong ? (trade.entryPrice - pts) : (trade.entryPrice + pts);
        trade.stopLoss = Number(computedSl.toFixed(2));
        trade.rMultiple = calculateTradeR(trade);
      } else {
        trade.stopLoss = '';
        trade.rMultiple = null;
      }

      updated[index] = trade;
      return updated;
    });
  };

  const handleUpdatePriceSl = (index, priceValue) => {
    setJsonPreview(prev => {
      const updated = [...prev];
      const trade = { ...updated[index] };
      trade.stopLoss = priceValue;

      if (priceValue !== '' && !isNaN(priceValue) && trade.entryPrice) {
        const sl = Number(priceValue);
        const pts = Math.abs(trade.entryPrice - sl);
        trade.slPoints = Number(pts.toFixed(2));
        trade.rMultiple = calculateTradeR({ ...trade, stopLoss: sl });
      } else {
        trade.slPoints = '';
        trade.rMultiple = null;
      }

      updated[index] = trade;
      return updated;
    });
  };

  const handleSaveImportedTrades = () => {
    const finalAccountId = selectedAccount || accounts[0]?.accountId || 'acc_principal';
    const sanitizedTrades = jsonPreview.map(t => ({
      ...t,
      accountId: finalAccountId,
      stopLoss: t.stopLoss === '' ? null : Number(t.stopLoss),
      rMultiple: t.rMultiple !== null ? Number(t.rMultiple) : null
    }));
    onSaveTrades(sanitizedTrades);
    setJsonText('');
    setJsonPreview([]);
    onClose();
  };

  const handleCsvUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const lines = text.split('\n').filter(l => l.trim().length > 0);
      if (lines.length < 2) return;

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const trades = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row = {};
        headers.forEach((h, idx) => row[h] = values[idx]);

        const date = row.date || new Date().toISOString().split('T')[0];
        const entryPrice = Number(row.entryprice || row.entry || 0);
        const exitPrice = Number(row.exitprice || row.exit || 0);
        let stopLoss = row.stoploss ? Number(row.stoploss) : '';
        let slPoints = '';

        if (stopLoss !== '' && entryPrice) {
          slPoints = Number(Math.abs(entryPrice - stopLoss).toFixed(2));
        }

        const trade = {
          symbol: row.symbol || row.ticker || 'MNQ',
          direction: (row.direction || row.side || 'LONG').toUpperCase(),
          date,
          entryTime: row.entrytime || `${date} 09:30`,
          exitTime: row.exittime || `${date} 10:00`,
          quantity: Number(row.quantity || row.qty || 1),
          entryPrice,
          exitPrice,
          stopLoss,
          slPoints,
          takeProfit: row.takeprofit ? Number(row.takeprofit) : null,
          netPnl: Number(row.netpnl || row.pnl || 0),
          accountId: targetAccountId
        };
        trade.rMultiple = trade.stopLoss !== '' ? calculateTradeR(trade) : null;
        trades.push(trade);
      }
      setJsonPreview(trades);
      setActiveTab('json');
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-800">Registrar Operaciones Individuales</h2>
            <p className="text-xs text-slate-400">Datos atómicos para ratios R y ventanas horarias.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 pt-4 pb-2 bg-slate-50 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Destino:</span>
            <select 
              value={selectedAccount || (accounts[0]?.accountId || '')} 
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="text-xs font-semibold bg-white border border-slate-200 rounded-lg p-1.5 outline-none text-slate-800"
            >
              {accounts.map(a => <option key={a.accountId} value={a.accountId}>{a.name}</option>)}
            </select>
          </div>

          <div className="flex bg-slate-200/60 p-1 rounded-lg text-xs font-semibold text-slate-600">
            <button 
              type="button" 
              onClick={() => setActiveTab('manual')} 
              className={`px-3 py-1 rounded-md transition-all ${activeTab === 'manual' ? 'bg-white text-slate-800 shadow-xs' : 'hover:text-slate-900'}`}
            >
              Manual
            </button>
            <button 
              type="button" 
              onClick={() => setActiveTab('json')} 
              className={`px-3 py-1 rounded-md transition-all ${activeTab === 'json' ? 'bg-white text-slate-800 shadow-xs' : 'hover:text-slate-900'}`}
            >
              Pegar JSON (IA)
            </button>
            <button 
              type="button" 
              onClick={() => setActiveTab('csv')} 
              className={`px-3 py-1 rounded-md transition-all ${activeTab === 'csv' ? 'bg-white text-slate-800 shadow-xs' : 'hover:text-slate-900'}`}
            >
              Importar CSV
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Activo / Ticker</label>
                  <input type="text" value={manualForm.symbol} onChange={e => setManualForm({ ...manualForm, symbol: e.target.value.toUpperCase() })} className="w-full p-2 border rounded-lg uppercase font-bold" required />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Dirección</label>
                  <select value={manualForm.direction} onChange={e => setManualForm({ ...manualForm, direction: e.target.value })} className="w-full p-2 border rounded-lg font-bold">
                    <option value="LONG">LONG (Compra)</option>
                    <option value="SHORT">SHORT (Venta)</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">Contratos / Lotes</label>
                  <input type="number" step="any" value={manualForm.quantity} onChange={e => setManualForm({ ...manualForm, quantity: e.target.value })} className="w-full p-2 border rounded-lg" required />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Fecha</label>
                  <input type="date" value={manualForm.date} onChange={e => setManualForm({ ...manualForm, date: e.target.value })} className="w-full p-2 border rounded-lg" required />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Hora Entrada</label>
                  <input type="time" value={manualForm.entryTime} onChange={e => setManualForm({ ...manualForm, entryTime: e.target.value })} className="w-full p-2 border rounded-lg" required />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Hora Salida</label>
                  <input type="time" value={manualForm.exitTime} onChange={e => setManualForm({ ...manualForm, exitTime: e.target.value })} className="w-full p-2 border rounded-lg" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                <div>
                  <label className="font-semibold block mb-1">Precio Entrada</label>
                  <input type="number" step="any" value={manualForm.entryPrice} onChange={e => setManualForm({ ...manualForm, entryPrice: e.target.value })} className="w-full p-2 border rounded-lg font-mono" required />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Precio Salida</label>
                  <input type="number" step="any" value={manualForm.exitPrice} onChange={e => setManualForm({ ...manualForm, exitPrice: e.target.value })} className="w-full p-2 border rounded-lg font-mono" required />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="font-semibold block mb-1 text-slate-600">SL en Puntos (pts)</label>
                  <input 
                    type="number" 
                    step="any" 
                    value={manualForm.slPoints} 
                    onChange={e => handleManualSlPointsChange(e.target.value)} 
                    className="w-full p-2 border rounded-lg font-mono text-rose-600 font-bold" 
                    placeholder="Ej: 20" 
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1 text-slate-500">Precio Stop Loss</label>
                  <input 
                    type="number" 
                    step="any" 
                    value={manualForm.stopLoss} 
                    onChange={e => handleManualPriceSlChange(e.target.value)} 
                    className="w-full p-2 border rounded-lg text-rose-600 font-mono" 
                    placeholder="Calculado auto" 
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1 text-slate-500">Take Profit</label>
                  <input type="number" step="any" value={manualForm.takeProfit} onChange={e => setManualForm({ ...manualForm, takeProfit: e.target.value })} className="w-full p-2 border rounded-lg text-emerald-600 font-mono" placeholder="Opcional" />
                </div>
                <div>
                  <label className="font-semibold block mb-1 text-slate-800">Net P&L ($)</label>
                  <input type="number" step="any" value={manualForm.netPnl} onChange={e => setManualForm({ ...manualForm, netPnl: e.target.value })} className="w-full p-2 border rounded-lg font-bold text-slate-900" placeholder="0.00" required />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={onClose} className="px-4 py-2 text-slate-500 font-semibold">Cancelar</button>
                <button type="submit" className="px-5 py-2 font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm">Guardar Trade</button>
              </div>
            </form>
          )}

          {activeTab === 'json' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-600">Pega el JSON generado por tu captura:</span>
                  <button onClick={handleParseJson} className="font-bold text-blue-600 hover:underline">Procesar y Previsualizar</button>
                </div>
                <textarea 
                  rows="3" 
                  value={jsonText} 
                  onChange={e => setJsonText(e.target.value)} 
                  placeholder='[{"symbol":"MNQ","direction":"LONG", ...}]'
                  className="w-full text-xs font-mono p-3 bg-slate-50 border rounded-lg outline-none"
                />
                {jsonError && <p className="text-xs text-rose-600 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5"/> {jsonError}</p>}
              </div>

              {jsonPreview.length > 0 && (
                <div className="space-y-3 pt-2 border-t">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-xs font-bold text-slate-700">Trades detectados ({jsonPreview.length})</span>
                      <p className="text-[11px] text-slate-400">Se guardarán en: <strong className="text-slate-700">{accounts.find(a=>a.accountId===targetAccountId)?.name || targetAccountId}</strong></p>
                    </div>
                    <button 
                      type="button" 
                      onClick={handleSaveImportedTrades} 
                      className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                      Importar {jsonPreview.length} Operaciones
                    </button>
                  </div>

                  <div className="max-h-60 overflow-y-auto border rounded-xl text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 text-slate-500 border-b sticky top-0">
                        <tr>
                          <th className="p-2.5 font-semibold">Hora</th>
                          <th className="p-2.5 font-semibold">Activo</th>
                          <th className="p-2.5 font-semibold">L/S</th>
                          <th className="p-2.5 font-semibold">Entrada</th>
                          <th className="p-2.5 font-semibold">Salida</th>
                          <th className="p-2.5 font-semibold w-24">SL (Pts)</th>
                          <th className="p-2.5 font-semibold w-28">Precio SL</th>
                          <th className="p-2.5 font-semibold">P&L</th>
                          <th className="p-2.5 font-semibold">R</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {jsonPreview.map((t, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/70">
                            <td className="p-2.5 text-slate-500">{t.entryTime.substring(11, 16) || t.entryTime}</td>
                            <td className="p-2.5 font-bold">{t.symbol}</td>
                            <td className={`p-2.5 font-bold ${t.direction === 'LONG' ? 'text-blue-600' : 'text-amber-600'}`}>{t.direction}</td>
                            <td className="p-2.5 font-mono text-slate-600">{t.entryPrice}</td>
                            <td className="p-2.5 font-mono text-slate-600">{t.exitPrice}</td>
                            <td className="p-1.5">
                              <input 
                                type="number" 
                                step="any"
                                value={t.slPoints}
                                onChange={(e) => handleUpdateSlPoints(idx, e.target.value)}
                                placeholder="Pts"
                                className="w-full p-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold text-rose-600 focus:border-rose-400 outline-none bg-rose-50/30"
                              />
                            </td>
                            <td className="p-1.5">
                              <input 
                                type="number" 
                                step="any"
                                value={t.stopLoss}
                                onChange={(e) => handleUpdatePriceSl(idx, e.target.value)}
                                placeholder="Precio SL"
                                className="w-full p-1.5 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 focus:border-blue-400 outline-none"
                              />
                            </td>
                            <td className={`p-2.5 font-bold ${t.netPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {t.netPnl >= 0 ? `+$${t.netPnl}` : `-$${Math.abs(t.netPnl)}`}
                            </td>
                            <td className="p-2.5 font-mono font-bold text-slate-700">
                              {t.rMultiple !== null ? (
                                <span className={t.rMultiple >= 1 ? 'text-emerald-600' : t.rMultiple > 0 ? 'text-blue-600' : 'text-rose-600'}>
                                  {t.rMultiple > 0 ? `+${t.rMultiple}R` : `${t.rMultiple}R`}
                                </span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'csv' && (
            <div className="py-8 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
              <Upload className="w-8 h-8 text-slate-400 mb-2" />
              <p className="text-xs font-bold text-slate-700">Arrastra tu archivo CSV o selecciónalo</p>
              <p className="text-[10px] text-slate-400 mt-1 mb-4">Cabeceras: date, symbol, direction, entryPrice, exitPrice, stopLoss, netPnl</p>
              <label className="cursor-pointer bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold px-4 py-2 rounded-lg shadow-xs">
                Seleccionar CSV
                <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
