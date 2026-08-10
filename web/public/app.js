// Clawd Automation — Fly machine client dashboard
// Zero-dependency ES module. Talks to web/server.mjs via the API + SSE.

const $ = (sel) => document.querySelector(sel);

const grid = $('#module-grid');
const pill = $('#connection-pill');
const runBadge = $('#run-state');
const runBtn = $('#run-btn');
const stopBtn = $('#stop-btn');
const logBox = $('#loop-log');
const journalList = $('#journal-list');
const tickCount = $('#tick-count');
const form = $('#run-form');

// ─── Modules ────────────────────────────────────────────────────────────────

function detailText(detail) {
  if (detail == null) return '';
  if (typeof detail === 'string') return detail;
  if (typeof detail === 'boolean') return detail ? 'present' : '';
  const parts = [];
  if (detail.package) parts.push(detail.package);
  if (detail.cargo) parts.push(detail.cargo);
  if (detail.programId) parts.push(`program: ${detail.programId}`);
  if (detail.present !== undefined && typeof detail.present !== 'boolean') {
    parts.push(`${detail.present}/${detail.total ?? ''}`.replace(/\/$/, ''));
  }
  if (detail.keys) {
    const set = detail.keys.filter((k) => k.set).length;
    parts.push(`keys ${set}/${detail.keys.length}`);
  }
  if (detail.operations?.length) parts.push(`ops: ${detail.operations.length}`);
  if (detail.seats?.length && detail.seats.length > 1) parts.push(`${detail.seats.length} seats`);
  if (detail.personas?.length) parts.push(`${detail.personas.length} personas`);
  if (detail.jsonl !== undefined) parts.push(`${detail.jsonl} jsonl · ${detail.md} md`);
  if (detail.scripts?.length) parts.push(`${detail.scripts.length} scripts`);
  if (detail.agentBridgeConfigured !== undefined) {
    parts.push(
      `bridge ${detail.agentBridgeConfigured ? (detail.agentBridgeKeyPresent ? 'key+url' : 'url') : 'off'}`,
    );
  }
  if (detail.liveProxyConfigured) parts.push('live proxy');
  if (detail.port) parts.push(`port ${detail.port}`);
  return parts.join(' · ');
}

function renderModules(data) {
  grid.innerHTML = '';
  if (!data.modules || !data.modules.length) {
    grid.innerHTML = '<div class="loading">no modules returned</div>';
    return;
  }
  for (const mod of data.modules) {
    const ok = Boolean(mod.ok);
    const card = document.createElement('div');
    card.className = `module-card ${ok ? 'ok' : 'missing'}`;

    const head = document.createElement('div');
    head.className = 'module-card-head';
    const title = document.createElement('h3');
    title.textContent = mod.name;
    const dot = document.createElement('span');
    dot.className = `dot ${ok ? 'ok' : 'missing'}`;
    head.append(title, dot);

    const role = document.createElement('p');
    role.textContent = mod.role;

    const detail = document.createElement('div');
    detail.className = 'module-detail';
    detail.textContent = detailText(mod.detail) || (ok ? 'ok' : 'missing');

    const link = document.createElement('a');
    link.className = 'module-link';
    link.href = `/module/${encodeURIComponent(mod.id)}/README.md`;
    link.target = '_blank';
    link.textContent = `open ${mod.path}/`;

    card.append(head, role, detail, link);
    grid.appendChild(card);
  }
}

async function refreshModules() {
  try {
    const res = await fetch('/api/modules');
    const data = await res.json();
    renderModules(data);
    pill.textContent = `connected · ${data.root}`;
    pill.className = 'status-pill on';
  } catch (err) {
    grid.innerHTML = `<div class="loading">failed to probe modules: ${err.message}</div>`;
    pill.textContent = 'offline';
    pill.className = 'status-pill off';
  }
}

// ─── Journal ────────────────────────────────────────────────────────────────

function fmtLamports(v) {
  if (v == null) return '';
  const sol = v / 1e9;
  return sol.toFixed(4) + ' SOL';
}

function renderJournal(entries) {
  journalList.innerHTML = '';
  if (!entries.length) {
    journalList.innerHTML = '<div class="loading">no ticks yet — run the paper loop</div>';
    tickCount.textContent = '0 ticks';
    return;
  }
  tickCount.textContent = `${entries.length} ticks`;
  const recent = entries.slice(-50).reverse();
  for (const e of recent) {
    const el = document.createElement('div');
    el.className = 'journal-entry';
    const no = document.createElement('span');
    no.className = 'tick-no';
    no.textContent = `#${e.tick}`;
    const action = document.createElement('span');
    action.className = 'action';
    const decision = e.decision?.action ?? '—';
    const reason = e.decision?.reason ?? '';
    action.textContent = e.event ? e.event : `${decision}${reason ? ' — ' + reason : ''}`;
    if (e.outcome === 'killswitch') action.classList.add('outcome-kill');
    const pnl = document.createElement('span');
    if (e.total_pnl_lamports !== undefined && e.total_pnl_lamports !== null) {
      pnl.className = `pnl ${e.total_pnl_lamports >= 0 ? 'pos' : 'neg'}`;
      pnl.textContent = fmtLamports(e.total_pnl_lamports);
    }
    el.append(no, action, pnl);
    journalList.appendChild(el);
  }
}

async function loadJournal() {
  try {
    const res = await fetch('/api/journal?n=300');
    const data = await res.json();
    renderJournal(data);
  } catch {
    /* SSE will keep pushing; journal may be unavailable */
  }
}

// ─── SSE ────────────────────────────────────────────────────────────────────

function setRunState(state) {
  runBadge.textContent = state;
  runBadge.className = `run-badge ${state}`;
}

function appendLog(text, kind = '') {
  const line = document.createElement('div');
  line.className = `log-line ${kind ? 'log-' + kind : ''}`;
  line.textContent = text;
  logBox.appendChild(line);
  logBox.scrollTop = logBox.scrollHeight;
  // Keep the log bounded.
  while (logBox.children.length > 200) logBox.removeChild(logBox.firstChild);
}

function connectStream() {
  const es = new EventSource('/api/stream');
  es.addEventListener('status', (ev) => {
    const d = JSON.parse(ev.data);
    setRunState(d.state);
  });
  es.addEventListener('run-start', (ev) => {
    const d = JSON.parse(ev.data);
    appendLog(`run started · ${d.ticks} ticks · goblin=${d.goblin || false}`, 'event');
  });
  es.addEventListener('tick', (ev) => {
    const d = JSON.parse(ev.data);
    appendLog(`#${d.tick} price=${d.candles_last3?.[d.candles_last3.length - 1]?.c ?? '—'} action=${d.decision?.action ?? '—'}`);
    loadJournal();
  });
  es.addEventListener('log', (ev) => {
    const d = JSON.parse(ev.data);
    appendLog(d.line.trim(), 'err');
  });
  es.onerror = () => {
    pill.textContent = 'reconnecting…';
    pill.className = 'status-pill';
  };
  es.onopen = () => {
    pill.textContent = 'stream connected';
    pill.className = 'status-pill on';
  };
}

// ─── Run / stop ─────────────────────────────────────────────────────────────

async function startRun(ev) {
  ev.preventDefault();
  const body = {
    ticks: parseInt($('#ticks').value, 10) || 50,
    sleep: parseFloat($('#sleep').value) || 0,
    seed: parseInt($('#seed').value, 10) || 42,
    llm: $('#llm').checked,
    goblin: $('#goblin').checked,
  };
  runBtn.disabled = true;
  try {
    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok) {
      appendLog(`run rejected: ${data.error}`, 'err');
    } else {
      appendLog(`run started → ticks=${body.ticks} sleep=${body.sleep}s seed=${body.seed} llm=${body.llm} goblin=${body.goblin}`, 'event');
    }
  } catch (err) {
    appendLog(`run request failed: ${err.message}`, 'err');
  } finally {
    runBtn.disabled = false;
  }
}

async function stopRun() {
  try {
    const res = await fetch('/api/stop', { method: 'POST' });
    const data = await res.json();
    appendLog(data.ok ? 'stop signal sent' : `stop failed: ${data.error}`, data.ok ? 'event' : 'err');
  } catch (err) {
    appendLog(`stop request failed: ${err.message}`, 'err');
  }
}

// ─── Boot ───────────────────────────────────────────────────────────────────

form.addEventListener('submit', startRun);
stopBtn.addEventListener('click', stopRun);
$('#refresh-modules').addEventListener('click', refreshModules);

refreshModules();
loadJournal();
connectStream();