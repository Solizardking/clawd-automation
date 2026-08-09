// ooda/web/public/trade.js — live (mainnet) trading client.
//
// This page never sees a private key. The connected wallet (Phantom, via its
// injected provider) signs and broadcasts every transaction itself — this
// script only fetches quotes/unsigned transactions from our own server (which
// proxies DFlow + Helius) and hands the raw bytes to the wallet to sign.

const $ = (id) => document.getElementById(id);

const els = {
  dflowBadge: $('dflow-badge'),
  railsList: $('rails-list'),
  walletStatus: $('wallet-status'),
  btnConnect: $('btn-connect'),
  btnDisconnect: $('btn-disconnect'),
  walletAddress: $('wallet-address'),
  walletBalance: $('wallet-balance'),
  quoteForm: $('quote-form'),
  fInputMint: $('f-input-mint'),
  fOutputMint: $('f-output-mint'),
  fAmount: $('f-amount'),
  fSlippage: $('f-slippage'),
  quotePanel: $('quote-panel'),
  quoteDetails: $('quote-details'),
  quoteError: $('quote-error'),
  btnSignSend: $('btn-sign-send'),
  txPanel: $('tx-panel'),
  txDetails: $('tx-details'),
  feed: $('feed'),
};

const state = {
  connected: false,
  publicKey: null,
  lastOrder: null, // raw /order response, kept for the sign step
};

function log(kind, msg) {
  const row = document.createElement('div');
  row.className = 'feed-row';
  const time = new Date().toTimeString().slice(0, 8);
  row.innerHTML = `<span class="t">${time}</span><span></span><span class="log-${kind}">${kind}</span><span class="reason">${escapeHtml(msg)}</span><span></span>`;
  els.feed.appendChild(row);
  while (els.feed.children.length > 200) els.feed.removeChild(els.feed.firstChild);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function short(addr) {
  return addr ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : '—';
}

// ─── rails status ───────────────────────────────────────────────────────────

async function loadStatus() {
  try {
    const res = await fetch('/api/live/status');
    const status = await res.json();
    els.dflowBadge.textContent = `dflow: ${status.dflow}`;
    els.dflowBadge.className = 'badge ' + (status.dflow === 'prod' ? 'badge-on' : 'badge-warn');
    els.railsList.innerHTML = `
      <dt>DFlow</dt><dd>${status.dflow}${status.dflowKeyPresent ? '' : ' (no API key — rate limited)'}</dd>
      <dt>Helius RPC</dt><dd>${status.helius ? 'configured' : 'public fallback'}</dd>
    `;
  } catch {
    els.dflowBadge.textContent = 'dflow: offline';
    els.dflowBadge.className = 'badge badge-off';
  }
}

// ─── wallet ─────────────────────────────────────────────────────────────────

function getProvider() {
  return window.phantom?.solana ?? (window.solana?.isPhantom ? window.solana : null);
}

async function connectWallet() {
  const provider = getProvider();
  if (!provider) {
    log('error', 'Phantom not found — install the Phantom browser extension');
    return;
  }
  try {
    const resp = await provider.connect();
    state.connected = true;
    state.publicKey = resp.publicKey.toString();
    onWalletConnected();
    log('ok', `wallet connected: ${state.publicKey}`);
  } catch (err) {
    log('error', `connect rejected: ${err?.message ?? err}`);
  }
}

async function disconnectWallet() {
  const provider = getProvider();
  try {
    await provider?.disconnect();
  } catch { /* ignore */ }
  state.connected = false;
  state.publicKey = null;
  els.walletStatus.textContent = 'not connected';
  els.walletStatus.className = 'run-status run-idle';
  els.walletAddress.textContent = '—';
  els.walletBalance.textContent = '—';
  els.btnConnect.style.display = '';
  els.btnDisconnect.style.display = 'none';
  log('info', 'wallet disconnected');
}

function onWalletConnected() {
  els.walletStatus.textContent = 'connected';
  els.walletStatus.className = 'run-status run-running';
  els.walletAddress.textContent = short(state.publicKey);
  els.walletAddress.title = state.publicKey;
  els.btnConnect.style.display = 'none';
  els.btnDisconnect.style.display = '';
  refreshBalance();
}

async function refreshBalance() {
  if (!state.publicKey) return;
  try {
    const res = await fetch(`/api/live/balance?pubkey=${encodeURIComponent(state.publicKey)}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    els.walletBalance.textContent = `${(data.lamports / 1e9).toFixed(4)} SOL`;
  } catch (err) {
    els.walletBalance.textContent = 'error';
    log('error', `balance fetch failed: ${err.message ?? err}`);
  }
}

els.btnConnect.addEventListener('click', connectWallet);
els.btnDisconnect.addEventListener('click', disconnectWallet);

// ─── mint presets ───────────────────────────────────────────────────────────

document.querySelectorAll('.mint-preset').forEach((btn) => {
  btn.addEventListener('click', () => {
    $(btn.dataset.target).value = btn.dataset.mint;
  });
});

// ─── quote ──────────────────────────────────────────────────────────────────

els.quoteForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  els.quoteError.textContent = '';
  els.btnSignSend.disabled = true;
  state.lastOrder = null;

  const params = new URLSearchParams({
    inputMint: els.fInputMint.value.trim(),
    outputMint: els.fOutputMint.value.trim(),
    amount: els.fAmount.value.trim(),
    slippageBps: els.fSlippage.value.trim() || 'auto',
  });
  if (state.publicKey) params.set('userPublicKey', state.publicKey);

  try {
    const res = await fetch(`/api/live/order?${params.toString()}`);
    const order = await res.json();
    if (!res.ok || order.error) {
      throw new Error(order.error || order.message || `HTTP ${res.status}`);
    }
    state.lastOrder = order;
    renderQuote(order);
    log('info', `quote: ${order.inAmount ?? '?'} -> ${order.outAmount ?? '?'} (impact ${order.priceImpactPct ?? '?'}%)`);
    if (order.transaction && state.connected) {
      els.btnSignSend.disabled = false;
    } else if (!state.connected) {
      log('info', 'connect a wallet to get a signable transaction');
    }
  } catch (err) {
    els.quoteError.textContent = String(err.message ?? err);
    log('error', `quote failed: ${err.message ?? err}`);
  }
});

function renderQuote(order) {
  els.quotePanel.style.display = '';
  els.quoteDetails.innerHTML = `
    <dt>in</dt><dd>${order.inAmount ?? '—'}</dd>
    <dt>out</dt><dd>${order.outAmount ?? '—'}</dd>
    <dt>min out</dt><dd>${order.otherAmountThreshold ?? '—'}</dd>
    <dt>price impact</dt><dd>${order.priceImpactPct ?? '—'}%</dd>
    <dt>slippage bps</dt><dd>${order.slippageBps ?? '—'}</dd>
    <dt>priority fee (lamports)</dt><dd>${order.prioritizationFeeLamports ?? '—'}</dd>
    <dt>signable tx</dt><dd>${order.transaction ? 'yes' : 'no (connect wallet)'}</dd>
  `;
}

// ─── sign & send ────────────────────────────────────────────────────────────

function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

els.btnSignSend.addEventListener('click', async () => {
  const provider = getProvider();
  const order = state.lastOrder;
  if (!provider || !order?.transaction) return;

  els.btnSignSend.disabled = true;
  try {
    log('info', 'deserializing transaction…');
    const { VersionedTransaction } = await import('https://esm.sh/@solana/web3.js@1.98.0');
    const tx = VersionedTransaction.deserialize(base64ToBytes(order.transaction));

    log('info', 'awaiting approval in wallet…');
    const { signature } = await provider.signAndSendTransaction(tx);

    els.txPanel.style.display = '';
    els.txDetails.innerHTML = `
      <dt>signature</dt><dd><a href="https://explorer.solana.com/tx/${signature}" target="_blank" rel="noopener">${short(signature)}</a></dd>
      <dt>status</dt><dd id="tx-status">pending…</dd>
    `;
    log('ok', `sent: ${signature}`);
    pollConfirmation(signature);
    refreshBalance();
  } catch (err) {
    log('error', `sign/send failed: ${err.message ?? err}`);
    els.btnSignSend.disabled = false;
  }
});

async function pollConfirmation(signature) {
  const statusEl = $('tx-status');
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const res = await fetch(`/api/live/confirm?signature=${encodeURIComponent(signature)}`);
      const data = await res.json();
      if (data.err) {
        statusEl.textContent = `failed: ${JSON.stringify(data.err)}`;
        log('error', `tx failed: ${JSON.stringify(data.err)}`);
        return;
      }
      if (data.confirmationStatus === 'confirmed' || data.confirmationStatus === 'finalized') {
        statusEl.textContent = data.confirmationStatus;
        log('ok', `tx ${data.confirmationStatus}`);
        return;
      }
      statusEl.textContent = data.found ? 'processing…' : 'not yet seen…';
    } catch {
      /* transient — keep polling */
    }
  }
  statusEl.textContent = 'timed out — check explorer';
  log('info', 'confirmation poll timed out, check explorer link');
}

// ─── boot ───────────────────────────────────────────────────────────────────

loadStatus();
log('info', 'ready — connect a wallet to trade');
