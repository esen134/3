/*
Minimal Bybit Spike Watcher server
- Express serves static files from /public
- Opens WebSocket server for clients
- Connects to Bybit v5 public WebSocket and subscribes to kline.{interval}.{symbol} topics
- Detects simple spikes (price % change threshold OR volume >> avg) on confirmed candles
*/
require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fetch = require('node-fetch');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const PAIRS = (process.env.PAIRS || 'BTCUSDT,ETHUSDT,BNBUSDT,SOLUSDT,XRPUSDT').split(',').map(s=>s.trim()).filter(Boolean);
const INTERVALS = (process.env.INTERVALS || '1,5').split(',').map(s=>s.trim()).filter(Boolean);

console.log('Starting server with pairs:', PAIRS, 'intervals:', INTERVALS);

app.use(express.static('public'));

// State: candles and simple rolling volume history
const state = {}; // state[symbol] = { interval: { lastCandle, vols: [] } }

function detectSpike(symbol, interval, prev, curr) {
  // simple heuristics: % price change OR volume > avg * multiplier
  if (!prev || !curr) return null;
  const priceChangePct = ((curr.close - prev.close) / prev.close) * 100;
  const vol = curr.volume;
  const st = state[symbol] = state[symbol] || {};
  const iv = st[interval] = st[interval] || { vols: [] };

  iv.vols.push(vol);
  if (iv.vols.length > 30) iv.vols.shift();
  const avgVol = iv.vols.reduce((a,b)=>a+b,0) / iv.vols.length;

  const priceThreshold = 0.6; // percent
  const volMultiplier = 3;

  const isPriceSpike = Math.abs(priceChangePct) >= priceThreshold;
  const isVolSpike = avgVol > 0 && vol >= avgVol * volMultiplier;

  const direction = priceChangePct > 0 ? 'up' : 'down';
  const score = Math.abs(priceChangePct) * (isVolSpike ? 2 : 1);

  const hit = isPriceSpike || isVolSpike;
  if (!hit) return null;
  return { symbol, interval, priceChangePct: Number(priceChangePct.toFixed(4)), vol, avgVol: Number(avgVol.toFixed(2)), direction, score: Number(score.toFixed(4)), ts: Date.now() };
}

let bybitSocket = null;
let reconnectTimer = null;

function connectBybit() {
  // Bybit v5 public endpoint
  const url = 'wss://stream.bybit.com/v5/public';
  console.log('Connecting to Bybit WS...', url);
  bybitSocket = new WebSocket(url);

  bybitSocket.on('open', () => {
    console.log('Bybit WS open — subscribing to topics');
    const topics = [];
    PAIRS.forEach(sym => INTERVALS.forEach(iv => topics.push(`kline.${iv}.${sym}`)));
    const req = { op: 'subscribe', args: topics };
    bybitSocket.send(JSON.stringify(req));
  });

  bybitSocket.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      // kline topic messages: data.topic like 'kline.1.BTCUSDT'
      if (data.topic && data.topic.startsWith('kline')) {
        const parts = data.topic.split('.');
        const interval = parts[1];
        const symbol = parts[2];
        const payload = data.data || [];
        const c = payload[payload.length-1];
        if (!c) return;
        // Only consider confirmed candles (c.confirm === true)
        const curr = { close: Number(c.close), open: Number(c.open), volume: Number(c.vol), start: c.start };
        const st = state[symbol] = state[symbol] || {};
        const prev = st[interval] && st[interval].lastCandle;
        if (prev && c.confirm === true) {
          const spike = detectSpike(symbol, interval, prev, curr);
          if (spike) broadcast({ type: 'spike', payload: spike });
        }
        // save current as lastCandle (note: we save regardless of confirm to keep latest)
        st[interval] = st[interval] || {};
        st[interval].lastCandle = curr;
      } else if (data.type === 'response' && data.success === false) {
        console.warn('Bybit response error', data);
      }
    } catch (e) {
      // ignore parse errors
    }
  });

  bybitSocket.on('close', () => {
    console.log('Bybit WS closed, will reconnect in 2s');
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connectBybit, 2000);
  });

  bybitSocket.on('error', (err) => {
    console.error('Bybit WS error', err && err.message);
    try { bybitSocket.close(); } catch(e){}
  });
}

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) {
      c.send(msg);
    }
  });
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'hello', ts: Date.now(), pairs: PAIRS }));
});

// Start server
server.listen(PORT, () => {
  console.log('Listening on port', PORT);
  connectBybit();
});
