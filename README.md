# Bybit Spike Watcher — Minimal Archive

This archive contains a minimal Node.js app that:
- Connects to Bybit public WebSocket (v5 public stream),
- Subscribes to kline intervals for a small list of symbols,
- Detects simple price/volume "spikes" and broadcasts spike events to connected browsers via WebSocket,
- Serves a static frontend (`/public/index.html`) which shows cards in 3 columns for upwards spikes and 1 column for downward spikes.

## What is included
- server.js — Node.js server (Express + ws).
- public/index.html + public/main.js — Minimal frontend (no build step).
- package.json — dependencies and start script.
- .env.example — example environment variables.

## Quick start (on your web hosting)
1. Copy files to your host.
2. `npm install`
3. Copy `.env.example` to `.env` and edit if you want.
4. `npm start`
5. Open `http://your-host:PORT/` in a browser.

Notes:
- The app uses Bybit public websockets. Make sure the host can reach `wss://stream.bybit.com/v5/public`.
- If you want to watch more symbols, set `PAIRS` in `.env` (comma-separated). For many pairs you should shard or use multiple processes to avoid connection limits.
- This is a minimal, educational example. For production use consider TLS (HTTPS/WSS), authentication, rate limits, and horizontal scaling.

If you want, I can:
- Produce a Dockerfile + docker-compose.
- Replace the default static pair list with dynamic retrieval of all Bybit futures symbols.
- Add configuration UI to tweak detection thresholds.

