// ooda/web/public/app.js — dashboard client (no build step, no dependencies)

const MAX_HISTORY = 400;
const MAX_FEED_ROWS = 150;

const $ = (id) => document.getElementById(id);

const els = {
  conn: $('conn-badge'),
  runStatus: $('run-status'),
  runForm: $('run-form'),
  runError: $('run-error'),
  btnRun: $('btn-run'),
  btnStop: $('btn-stop'),
  fTicks: $('f-ticks'),
  fSleep: $('f-sleep'),
  fSeed: $('f-seed'),
  fLlm: $('f-llm'),
  fGoblin: $('f-goblin'),
  configList: $('config-list'),
  journalPath: $('journal-path'),
  statPrice: $('stat-price'),
  statPnl: $('stat-pnl'),
  statCash: $('stat-cash'),
  statPositions: $('stat-positions'),
  statLosses: $('stat-losses'),
  statTick: $('stat-tick'),
  chart: $('price-chart'),
  positionsBody: document.querySelector('#positions-table tbody'),
  positionsEmpty: $('positions-empty'),
  feed: $('feed'),
};

const state = {
  history: [], // { tick, price }
  lastView: null,
};

// ─── formatting helpers ─────────────────────────────────────────────────────

function fmtLamports(n) {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toLocaleString()}`;
}

function fmtPrice(n) {
  if (n === undefined || n === null) return '—';
  return `$${(n / 1000).toFixed(3)}`;
}

function fmtTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toTimeString().slice(0, 8);
  } catch {
    return '';
  }
}

// ─── stats ──────────────────────────────────────────────────────────────────

function updateStats(view) {
  els.statPrice.textContent = fmtPrice(view.price);
  els.statPnl.textContent = fmtLamports(view.total_pnl_lamports);
  els.statPnl.className = 'stat-value ' + (view.total_pnl_lamports >= 0 ? 'up' : 'down');
  els.statCash.textContent = view.cash_lamports?.toLocaleString() ?? '—';
  els.statPositions.textContent = String(view.positions ?? 0);
  els.statLosses.textContent = String(view.consecutive_losses ?? 0);
  els.statLosses.className = 'stat-value ' + (view.consecutive_losses > 0 ? 'down' : '');
  els.statTick.textContent = String(view.tick ?? '—');
}

// ─── positions table ────────────────────────────────────────────────────────

function updatePositions(view) {
  const positions = view.positions_detail;
  els.positionsBody.innerHTML = '';
  if (!positions || positions.length === 0) {
    els.positionsEmpty.style.display = 'block';
    return;
  }
  els.positionsEmpty.style.display = 'none';
  for (const p of positions) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.id}</td>
      <td class="side-${p.side}">${p.side}</td>
      <td>${fmtPrice(p.entry_price)}</td>
      <td>${p.size_lamports.toLocaleString()}</td>
      <td>t${p.opened_at_tick}</td>
    `;
    els.positionsBody.appendChild(tr);
  }
}

// ─── decision feed ──────────────────────────────────────────────────────────

function appendFeedRow(view) {
  const dec = view.decision;
  const action = dec?.action ?? '?';
  const reason = view.violation
    ? `${dec?.reason ?? ''}  ⚠ ${view.violation}`
    : (dec?.reason ?? '');

  const row = document.createElement('div');
  row.className = 'feed-row';
  row.innerHTML = `
    <span class="t">${fmtTime(view.now)}</span>
    <span>t${view.tick}</span>
    <span class="action-${action}">${action}</span>
    <span class="reason" title="${escapeAttr(reason)}">${escapeHtml(reason)}</span>
    <span class="pnl outcome-${view.outcome}">${view.outcome === 'applied' && view.pnl !== undefined ? fmtLamports(view.pnl) : view.outcome}</span>
  `;
  els.feed.appendChild(row);
  while (els.feed.children.length > MAX_FEED_ROWS) {
    els.feed.removeChild(els.feed.firstChild);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

// ─── price chart (canvas, no libs) ─────────────────────────────────────────

function redrawChart() {
  const canvas = els.chart;
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || canvas.parentElement.clientWidth;
  const cssHeight = 220;
  if (canvas.width !== cssWidth * dpr || canvas.height !== cssHeight * dpr) {
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const points = state.history.filter((p) => p.price !== null);
  if (points.length < 2) {
    ctx.fillStyle = '#8b8fa3';
    ctx.font = '12px monospace';
    ctx.fillText('waiting for ticks…', 12, cssHeight / 2);
    return;
  }

  const prices = points.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const padY = 16;
  const x = (i) => (i / (points.length - 1)) * (cssWidth - 12) + 6;
  const y = (v) => cssHeight - padY - ((v - min) / range) * (cssHeight - padY * 2);

  ctx.beginPath();
  ctx.moveTo(x(0), y(points[0].price));
  for (let i = 1; i < points.length; i++) ctx.lineTo(x(i), y(points[i].price));
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.lineTo(x(points.length - 1), cssHeight);
  ctx.lineTo(x(0), cssHeight);
  ctx.closePath();
  ctx.fillStyle = 'rgba(34, 211, 238, 0.08)';
  ctx.fill();

  ctx.fillStyle = '#facc15';
  const last = points[points.length - 1];
  ctx.beginPath();
  ctx.arc(x(points.length - 1), y(last.price), 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#8b8fa3';
  ctx.font = '10px monospace';
  ctx.fillText(fmtPrice(max), 4, 10);
  ctx.fillText(fmtPrice(min), 4, cssHeight - 4);
}

// ─── run controls ───────────────────────────────────────────────────────────

function setRunStatus(runState) {
  const map = {
    idle: ['idle', 'run-idle'],
    running: ['running', 'run-running'],
    done: ['done', 'run-done'],
    killswitch: ['killswitch', 'run-killswitch'],
    error: ['error', 'run-error'],
  };
  const [label, cls] = map[runState] ?? map.idle;
  els.runStatus.textContent = label;
  els.runStatus.className = `run-status ${cls}`;
  const running = runState === 'running';
  els.btnRun.disabled = running;
  els.btnStop.disabled = !running;
}

async function loadConfig() {
  const goblin = els.fGoblin.checked;
  try {
    const res = await fetch(`/api/config?goblin=${goblin ? '1' : '0'}`);
    const cfg = await res.json();
    if (cfg.error) throw new Error(cfg.error);
    els.configList.innerHTML = `
      <dt>mode</dt><dd>${cfg.mode}</dd>
      <dt>network</dt><dd>${cfg.network}</dd>
      <dt>max position (lamports)</dt><dd>${cfg.max_position_size_lamports.toLocaleString()}</dd>
      <dt>killswitch (losses)</dt><dd>${cfg.loss_killswitch_consecutive}</dd>
    `;
  } catch (err) {
    els.configList.innerHTML = `<dt>error</dt><dd>${escapeHtml(String(err))}</dd>`;
  }
}

els.fGoblin.addEventListener('change', loadConfig);

els.runForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  els.runError.textContent = '';
  const body = {
    ticks: Number(els.fTicks.value),
    sleep: Number(els.fSleep.value),
    seed: Number(els.fSeed.value),
    llm: els.fLlm.checked,
    goblin: els.fGoblin.checked,
  };
  const res = await fetch('/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await res.json();
  if (!result.ok) {
    els.runError.textContent = result.error ?? 'failed to start run';
  }
});

els.btnStop.addEventListener('click', async () => {
  await fetch('/api/stop', { method: 'POST' });
});

// ─── SSE stream with rAF-batched rendering ─────────────────────────────────

let pending = [];
let flushScheduled = false;

function scheduleFlush() {
  if (flushScheduled) return;
  flushScheduled = true;
  requestAnimationFrame(flush);
}

function flush() {
  flushScheduled = false;
  if (pending.length === 0) return;
  const batch = pending;
  pending = [];

  // Avoid flooding the DOM feed on very fast runs (e.g. goblin sleep=0):
  // render at most the last 60 ticks of a large batch, with a skip marker.
  const toRender = batch.length > 60
    ? [{ skipped: batch.length - 60 }, ...batch.slice(-60)]
    : batch;

  for (const view of toRender) {
    if (view.skipped) {
      const row = document.createElement('div');
      row.className = 'feed-row';
      row.innerHTML = `<span class="t"></span><span></span><span></span><span class="reason" style="color:var(--text-dim)">… ${view.skipped} ticks …</span><span></span>`;
      els.feed.appendChild(row);
      continue;
    }
    appendFeedRow(view);
  }

  for (const view of batch) {
    state.history.push({ tick: view.tick, price: view.price });
  }
  while (state.history.length > MAX_HISTORY) state.history.shift();

  const last = batch[batch.length - 1];
  state.lastView = last;
  updateStats(last);
  updatePositions(last);
  redrawChart();
}

function connectStream() {
  const es = new EventSource('/api/stream');

  es.onopen = () => {
    els.conn.textContent = 'live';
    els.conn.className = 'badge badge-on';
  };
  es.onerror = () => {
    els.conn.textContent = 'reconnecting…';
    els.conn.className = 'badge badge-off';
  };

  es.addEventListener('tick', (e) => {
    pending.push(JSON.parse(e.data));
    scheduleFlush();
  });
  es.addEventListener('status', (e) => {
    const data = JSON.parse(e.data);
    setRunStatus(data.state);
  });
  es.addEventListener('run-start', () => {
    els.runError.textContent = '';
  });
}

// ─── boot ───────────────────────────────────────────────────────────────────

async function boot() {
  window.addEventListener('resize', () => redrawChart());

  try {
    const statusRes = await fetch('/api/status');
    const status = await statusRes.json();
    els.journalPath.textContent = status.journalPath ?? '—';
    setRunStatus(status.state ?? 'idle');
  } catch { /* server not reachable yet */ }

  await loadConfig();

  try {
    const journalRes = await fetch('/api/journal?n=300');
    const entries = await journalRes.json();
    for (const view of entries) {
      state.history.push({ tick: view.tick, price: view.price });
      appendFeedRow(view);
    }
    while (state.history.length > MAX_HISTORY) state.history.shift();
    if (entries.length > 0) {
      const last = entries[entries.length - 1];
      state.lastView = last;
      updateStats(last);
      updatePositions(last);
    }
    redrawChart();
  } catch { /* no journal yet */ }

  connectStream();
}

boot();
