// Minimal frontend: connects to server WS and displays spike cards.
// It keeps most recent up-cards and down-cards and moves duplicates to top.
(function(){
  const upEl = document.getElementById('up');
  const downEl = document.getElementById('down');
  const statusEl = document.getElementById('status');

  const useWss = (location.protocol === 'https:') || (window.FORCE_WSS === true);
  const wsProto = useWss ? 'wss' : 'ws';
  const host = location.host;
  const wsUrl = wsProto + '://' + host;
  const socket = new WebSocket(wsUrl);

  const upCards = []; // newest first
  const downCards = [];

  function render() {
    // render up: show up to 60 cards (spread across 3 columns CSS grid auto-positions)
    upEl.innerHTML = '';
    upCards.slice(0, 60).forEach(c => {
      const d = document.createElement('div'); d.className='card';
      d.innerHTML = '<div class="symbol">'+c.symbol+'</div>' +
                    '<div class="small">'+c.interval+'m • '+(c.priceChangePct.toFixed(3))+'%</div>' +
                    '<div class="small">vol '+Math.round(c.vol)+' (avg '+Math.round(c.avgVol)+')</div>' +
                    '<div class="small">score '+(c.score.toFixed(3))+'</div>';
      upEl.appendChild(d);
    });
    downEl.innerHTML = '';
    downCards.slice(0, 100).forEach(c => {
      const d = document.createElement('div'); d.className='card';
      d.innerHTML = '<div class="symbol">'+c.symbol+'</div>' +
                    '<div class="small">'+c.interval+'m • '+(c.priceChangePct.toFixed(3))+'%</div>' +
                    '<div class="small">vol '+Math.round(c.vol)+'</div>';
      downEl.appendChild(d);
    });
  }

  function pushCard(arr, card) {
    // remove previous with same symbol
    const idx = arr.findIndex(x=>x.symbol===card.symbol);
    if (idx !== -1) arr.splice(idx,1);
    arr.unshift(card);
  }

  socket.onopen = () => {
    statusEl.textContent = 'Connected to server — waiting for spikes...';
  };
  socket.onclose = () => {
    statusEl.textContent = 'Disconnected from server';
  };
  socket.onerror = (e) => {
    statusEl.textContent = 'WebSocket error';
  };
  socket.onmessage = (m) => {
    try {
      const msg = JSON.parse(m.data);
      if (msg.type === 'hello') {
        statusEl.textContent = 'Watching pairs: ' + (msg.pairs || []).join(',');
      } else if (msg.type === 'spike') {
        const p = msg.payload;
        p.ts = p.ts || Date.now();
        if (p.direction === 'up') {
          pushCard(upCards, p);
        } else {
          pushCard(downCards, p);
        }
        // Keep arrays bounded
        if (upCards.length > 500) upCards.length = 500;
        if (downCards.length > 500) downCards.length = 500;
        render();
      }
    } catch (e) {
      console.error('msg parse', e);
    }
  };
})();
