// admin.js — the owner's Admin page (open the site with #admin on the end, password protected).
// Load players people sent in (Netlify CSV or codes), build a tournament at a chosen level, and play it.

// Only the password's fingerprint (SHA-256) is stored here, not the password itself.
const ADMIN_HASH = '28fe6bc09e57d432a9b65aae22edbd85af0505acc5dc32e4791326f5d860e19a';
const ADMIN_PLAYERS = 'tourlife.admin.players';
const ADMIN_EVENTS = 'tourlife.admin.events';
const adminPlayers = () => readJSON(ADMIN_PLAYERS) || [];
const adminEvents = () => readJSON(ADMIN_EVENTS) || [];
let adminTab = 'events';

async function sha256(text) {
  if (!(window.crypto && crypto.subtle)) return sha256Plain(text); // plain http (the local test link) has no crypto.subtle
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
// The same SHA-256 in plain JavaScript, for pages served without https.
function sha256Plain(text) {
  const K = [], H = [], isPrime = n => { for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; };
  for (let n = 2, i = 0; i < 64; n++) if (isPrime(n)) { if (i < 8) H[i] = (Math.pow(n, 1 / 2) % 1) * 2 ** 32 | 0; K[i++] = (Math.pow(n, 1 / 3) % 1) * 2 ** 32 | 0; }
  const bytes = [...new TextEncoder().encode(text)], len = bytes.length * 8;
  bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(i > 3 ? 0 : (len >>> (i * 8)) & 255);
  const rot = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < bytes.length; o += 64) {
    const w = [];
    for (let i = 0; i < 64; i++) {
      if (i < 16) w[i] = (bytes[o + i * 4] << 24) | (bytes[o + i * 4 + 1] << 16) | (bytes[o + i * 4 + 2] << 8) | bytes[o + i * 4 + 3];
      else { const a = w[i - 15], b = w[i - 2]; w[i] = (w[i - 16] + (rot(a, 7) ^ rot(a, 18) ^ (a >>> 3)) + w[i - 7] + (rot(b, 17) ^ rot(b, 19) ^ (b >>> 10))) | 0; }
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    [a, b, c, d, e, f, g, h].forEach((v, i) => { H[i] = (H[i] + v) | 0; });
  }
  return H.map(v => (v >>> 0).toString(16).padStart(8, '0')).join('');
}

// --- Entry point -------------------------------------------------------------------

function openAdmin() {
  showScreen('admin');
  if (sessionStorage.getItem('tourlife.admin') === 'ok') return renderAdmin();
  $('admin').innerHTML = `<div class="card tllock"><h2>Admin</h2>` +
    `<input type="password" id="adPass" class="inp big" placeholder="Password" autocomplete="current-password">` +
    `<button type="button" class="btn" id="adGo">Unlock</button><p class="hint" id="adMsg">This page is for the site owner.</p>` +
    `<button type="button" class="link" id="adLeave">‹ Back to the game</button></div>`;
  const go = async () => {
    if (await sha256($('adPass').value) === ADMIN_HASH) { sessionStorage.setItem('tourlife.admin', 'ok'); renderAdmin(); }
    else $('adMsg').textContent = 'Wrong password.';
  };
  $('adGo').onclick = go;
  $('adLeave').onclick = () => { history.replaceState(null, '', location.pathname); location.reload(); };
  $('adPass').onkeydown = e => { if (e.key === 'Enter') go(); };
  $('adPass').focus();
}

function renderAdmin() {
  const n = adminPlayers().length;
  $('admin').innerHTML = `<header><h1>Admin</h1><p class="sub">Your real players and tournaments.</p></header>` +
    `<div class="seg two tltabs"><button type="button" data-t="events" class="${adminTab === 'events' ? 'on' : ''}">Tournaments</button>` +
    `<button type="button" data-t="players" class="${adminTab === 'players' ? 'on' : ''}">Players (${n})</button></div>` +
    `<div id="adBody"></div><button type="button" class="btn ghost" id="adStudy">🔬 Research Lab (Quick Sim)</button>` +
    `<button type="button" class="link" id="adExit">Back to the game</button>`;
  $('admin').querySelector('.tltabs').onclick = e => {
    const b = e.target.closest('[data-t]');
    if (b) { adminTab = b.dataset.t; renderAdmin(); }
  };
  $('adStudy').onclick = () => openStudy();
  $('adExit').onclick = () => { history.replaceState(null, '', location.pathname); location.reload(); };
  if (adminTab === 'players') renderAdPlayers(); else renderAdEvents();
}

// --- Players -------------------------------------------------------------------------

// Netlify's CSV: a header row, then one row per submission. Handles quotes and commas in fields.
function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}

// Finds every player code in a CSV or pasted text. Returns how many were added or updated.
async function addPlayersFrom(text) {
  const found = [];
  const rows = parseCSV(text);
  const head = (rows[0] || []).map(h => h.trim().toLowerCase());
  const ci = head.indexOf('contact');
  for (const r of rows) {
    for (const cellText of r) {
      for (const code of cellText.match(/TL[01]\.[A-Za-z0-9_-]+/g) || []) found.push({ code, contact: ci >= 0 ? (r[ci] || '').trim() : '' });
    }
  }
  return ingestPlayers(found);
}

// found: [{ code, contact }] → added to (or updating) the player list.
async function ingestPlayers(found) {
  const list = adminPlayers();
  let added = 0, updated = 0, bad = 0;
  for (const f of found) {
    let obj;
    try { obj = await decodeSave(f.code); } catch { bad++; continue; }
    const p = obj.player, id = String(p.created || `${p.name}|${p.nation}`);
    const s = obj.summary || {};
    const rec = { id, player: p, summary: s, contact: f.contact, addedAt: Date.now(), sig: obj.sig };
    const i = list.findIndex(x => x.id === id);
    if (i < 0) { list.push(rec); added++; }
    else if ((s.week || 0) >= (list[i].summary.week || 0)) { list[i] = { ...rec, contact: f.contact || list[i].contact }; updated++; }
  }
  writeJSON(ADMIN_PLAYERS, list);
  return { added, updated, bad, total: found.length };
}

// --- Netlify: get players and publish results straight from here ----------------------
// Uses your Netlify access token, kept in this browser only (never in the site's files).
const NF_KEY = 'tourlife.admin.netlify';
const nfConf = () => readJSON(NF_KEY) || {};

async function nfApi(path, opts = {}) {
  const res = await fetch(`https://api.netlify.com/api/v1${path}`, { ...opts, headers: { Authorization: `Bearer ${nfConf().token}`, ...(opts.headers || {}) } });
  if (!res.ok) throw new Error(res.status === 401 ? 'Netlify said the key is wrong or expired.' : `Netlify error ${res.status}`);
  if (res.status === 204) return null;
  return (res.headers.get('content-type') || '').includes('json') ? res.json() : res.text();
}

async function nfSite() {
  const c = nfConf();
  if (c.site) return c.site;
  const host = location.hostname.endsWith('.netlify.app') ? location.hostname : 'tourlife-gatah.netlify.app';
  const site = await nfApi(`/sites/${host}`);
  writeJSON(NF_KEY, { ...c, site: site.id });
  return site.id;
}

// Everyone who pressed "Join Real Tournaments".
async function fetchNewPlayers() {
  const site = await nfSite();
  const found = [];
  // Netlify's spam filter sometimes catches real players too; anything without a valid player code is
  // ignored anyway, so check both piles.
  const forms = await nfApi(`/sites/${site}/forms`);
  const form = forms.find(f => f.name === 'send-player');
  if (!form) return { added: 0, updated: 0, bad: 0, total: 0 };
  for (const state of ['verified', 'spam']) {
    for (let page = 1; page < 20; page++) {
      const subs = await nfApi(`/forms/${form.id}/submissions?state=${state}&per_page=100&page=${page}`);
      for (const sub of subs) { const d = sub.data || {}; if (d.code && d.code.length > 10) found.push({ code: d.code, contact: (d.contact || '').trim() }); }
      if (subs.length < 100) break;
    }
  }
  return ingestPlayers(found);
}

// GitHub hosting (gatahband.github.io/tourlife): results.json is updated straight in the repository.
const GH_REPO = 'gatahband/tourlife';
async function publishGitHub() {
  const gh = nfConf().gh;
  const api = (path, opts = {}) => fetch(`https://api.github.com/repos/${GH_REPO}${path}`, { ...opts, headers: { Authorization: `Bearer ${gh}`, Accept: 'application/vnd.github+json', ...(opts.headers || {}) } });
  const cur = await api('/contents/results.json');
  const sha = cur.ok ? (await cur.json()).sha : undefined;
  const text = JSON.stringify(publishResults());
  const content = btoa(String.fromCharCode(...new TextEncoder().encode(text)));
  const res = await api('/contents/results.json', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Results from the Admin page', content, sha }) });
  if (!res.ok) throw new Error(res.status === 401 ? 'GitHub said the token is wrong or expired.' : `GitHub error ${res.status}`);
  return true;
}

// Put results.json live: on GitHub if connected, otherwise a Netlify deploy that reuses every current
// file and swaps in the new results.
async function publishLive() {
  if (nfConf().gh) return publishGitHub();
  const site = await nfSite();
  const info = await nfApi(`/sites/${site}`);
  const files = await nfApi(`/deploys/${info.published_deploy.id}/files`);
  const body = JSON.stringify(publishResults());
  const sha = [...new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(body)))].map(b => b.toString(16).padStart(2, '0')).join('');
  const map = Object.fromEntries(files.map(f => [f.id, f.sha]));
  map['/results.json'] = sha;
  const dep = await nfApi(`/sites/${site}/deploys`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: map }) });
  if ((dep.required || []).includes(sha)) await nfApi(`/deploys/${dep.id}/files/results.json`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body });
  for (let i = 0; i < 30; i++) {
    const d = await nfApi(`/deploys/${dep.id}`);
    if (d.state === 'ready') return true;
    if (d.state === 'error') throw new Error('Netlify could not publish it.');
    await new Promise(r => setTimeout(r, 1500));
  }
  return true;
}

// One-time setup: paste a key. GitHub keys (ghp_…) are for sending results; Netlify keys (nfp_…) are for
// collecting players who joined. The box works out which is which.
function connectHtml() {
  const c = nfConf();
  const row = (ok, txt) => `<div class="connrow">${ok ? '✅' : '⬜'} ${txt}</div>`;
  return `<section class="card"><h2>Connect (one time)</h2>` +
    row(!!c.token, 'Netlify key: collects players who press "Join Real Tournaments"') +
    row(!!c.gh, 'GitHub key: sends results out to players') +
    `<input type="password" id="nfKey" class="inp big" placeholder="Paste a Netlify or GitHub key">` +
    `<button type="button" class="btn" id="nfSave">Connect</button><p class="hint" id="nfMsg">Keys are saved on this computer only.</p></section>`;
}
function bindConnect(after) {
  if (!$('nfSave')) return;
  $('nfSave').onclick = async () => {
    const key = $('nfKey').value.trim();
    if (!key) return;
    const c = nfConf();
    if (/^(ghp_|github_pat_)/.test(key)) {
      $('nfMsg').textContent = 'Checking with GitHub…';
      const r = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${key}` } }).catch(() => null);
      if (!r || !r.ok) { $('nfMsg').textContent = '❌ GitHub said that key is wrong or expired.'; return; }
      writeJSON(NF_KEY, { ...c, gh: key });
      return after();
    }
    writeJSON(NF_KEY, { ...c, token: key, site: null });
    $('nfMsg').textContent = 'Checking with Netlify…';
    try { await nfSite(); after(); }
    catch (e) { writeJSON(NF_KEY, c); $('nfMsg').textContent = `❌ ${e.message} (Netlify keys start with nfp_; GitHub keys with ghp_.)`; }
  };
}

function renderAdPlayers() {
  const list = adminPlayers().sort((a, b) => overall(b.player) - overall(a.player));
  const connected = !!nfConf().token;
  $('adBody').innerHTML = (connected && nfConf().gh ? '' : connectHtml()) +
    `<section class="card"><h2>Players who joined</h2>` +
    (connected ? `<button type="button" class="btn huge" id="adFetch">🔄 Get new players</button>` +
      `<p class="hint">Picks up everyone who pressed "Join Real Tournaments" in their game. Sending again just updates their player.</p>` : '') +
    `<details class="paste"><summary>Other ways to add players</summary>` +
    `<label class="btn ghost small filebtn">Open a CSV from Netlify<input type="file" id="adCsv" accept=".csv,.txt,text/csv,text/plain" hidden></label>` +
    `<textarea id="adPaste" class="inp code" rows="3" placeholder="Or paste player codes (TL1.…)"></textarea>` +
    `<button type="button" class="btn small" id="adPasteGo">Add</button>` +
    (connected ? `<button type="button" class="link" id="nfForget">Disconnect from Netlify</button>` : '') + `</details>` +
    `<p class="hint" id="adLoadMsg"></p></section>` +
    `<section class="card"><h2>${list.length} player${list.length === 1 ? '' : 's'}</h2>` +
    (list.length ? `<div class="tllist">${list.map(x => {
      const p = x.player, s = x.summary || {};
      return `<div class="tlrow"><span class="tlname"><b>${flagOf(p.nation)} ${esc(p.name)}</b>` +
        `<small>${esc(x.contact || 'no name given')} · ${s.rank ? `#${s.rank}` : 'Unranked'} · ${s.wins ?? 0}–${s.losses ?? 0}${s.titles ? ` · 🏆 ${s.titles}` : ''}</small>` +
        (suspicious(x).length ? `<small class="sus">⚠️ Looks edited: ${suspicious(x).join('; ')}</small>` : '') + `</span>` +
        `<b class="tlovr">${overall(p).toFixed(1)}</b>` +
        `<button type="button" class="btn small ghost" data-adj="${esc(x.id)}">✏️ Adjust</button>` +
        `<button type="button" class="x inline" data-rm="${esc(x.id)}" aria-label="Remove">×</button></div>`;
    }).join('')}</div>` : '<p class="hint">No players yet.</p>') + `</section>`;
  const report = r => { $('adLoadMsg').textContent = r.total ? `Found ${r.total}: ${r.added} new, ${r.updated} updated${r.bad ? `, ${r.bad} unreadable` : ''}.` : 'No player codes found in that.'; };
  bindConnect(renderAdmin);
  if ($('adFetch')) $('adFetch').onclick = async () => {
    $('adFetch').disabled = true; $('adFetch').textContent = 'Getting players…';
    try { const r = await fetchNewPlayers(); renderAdmin(); report(r); }
    catch (e) { $('adFetch').disabled = false; $('adFetch').textContent = '🔄 Get new players'; $('adLoadMsg').textContent = `❌ ${e.message}`; }
  };
  if ($('nfForget')) $('nfForget').onclick = () => { if (confirm('Disconnect this page from Netlify?')) { writeJSON(NF_KEY, null); renderAdmin(); } };
  $('adCsv').onchange = async e => { const f = e.target.files[0]; if (!f) return; const r = await addPlayersFrom(await f.text()); renderAdmin(); report(r); };
  $('adPasteGo').onclick = async () => { const r = await addPlayersFrom($('adPaste').value); renderAdmin(); report(r); };
  $('adBody').querySelector('.tllist')?.addEventListener('click', e => {
    const a = e.target.closest('[data-adj]');
    if (a) { openAdjust(a.dataset.adj); return; }
    const b = e.target.closest('[data-rm]');
    if (b && confirm('Remove this player?')) { writeJSON(ADMIN_PLAYERS, adminPlayers().filter(x => x.id !== b.dataset.rm)); renderAdmin(); }
  });
}

// --- Adjusting a player (fair play) ---------------------------------------------------------
// The admin can take back progress: stats only, never their record, titles or money. The change goes into
// this list, is published with the results, and the player's own game applies it the next time it opens
// (after saving a safety backup). Every adjustment can be undone.
const ADMIN_CORR = 'tourlife.adCorrections';
const adminCorr = () => readJSON(ADMIN_CORR) || [];
function openAdjust(id, msg = '') {
  const x = adminPlayers().find(y => y.id === id);
  if (!x) return;
  const p = x.player, ovr = overall(p), mine = adminCorr().filter(c => c.pid === id);
  const lower = by => Object.fromEntries(ATTR_KEYS.map(k => [k, Math.round(Math.max(40, (p.attrs[k] ?? 50) - by) * 10) / 10]));
  const opts = [5, 10, 20].map(by => ({ by, attrs: lower(by) })).concat([{ by: 'start', attrs: Object.fromEntries(ATTR_KEYS.map(k => [k, Math.min(p.attrs[k] ?? 50, 50)])) }]);
  const ovrOf = attrs => overall({ ...p, attrs });
  openModal(`<button type="button" class="x" id="mx" aria-label="Close">×</button><h2 class="itop">✏️ Adjust ${esc(p.name)}</h2>` +
    `<p class="big center">Right now: <b>${ovr.toFixed(1)} OVR</b></p>` +
    `<p class="hint center">Only their stats change. Their record, titles, ranking and money stay the same. Their game saves a backup first, and you can undo this any time.</p>` +
    `<label class="lbl" for="adjWhy">Message they'll see</label><input id="adjWhy" class="inp big" maxlength="120" value="Your player was adjusted by the tournament admin for fair play.">` +
    `<div class="tljopts">${opts.map((o, i) => `<button type="button" class="btn ghost" data-o="${i}"><b>${o.by === 'start' ? 'Back To A Starting Player' : `Take Back ${o.by} OVR`}</b><small>${ovr.toFixed(1)} → ${ovrOf(o.attrs).toFixed(1)} OVR</small></button>`).join('')}</div>` +
    (mine.length ? `<button type="button" class="btn ghost" id="adjUndo">↩ Undo The Last Adjustment (back to ${ovrOf(mine[mine.length - 1].from).toFixed(1)} OVR)</button>` : '') +
    `<p class="big center" id="adjMsg">${msg}</p>`);
  $('mx').onclick = closeModal;
  const push = async (attrs, from, note) => {
    const list = adminPlayers(), y = list.find(z => z.id === id);
    y.player = { ...y.player, attrs: { ...attrs } };
    writeJSON(ADMIN_PLAYERS, list);
    writeJSON(ADMIN_CORR, [...adminCorr(), { id: `${id}-${Date.now()}`, pid: id, name: p.name, attrs: { ...attrs }, from: { ...from }, note, at: Date.now() }]);
    let sent = '';
    try { if (nfConf().token || nfConf().gh) { await publishLive(); sent = ' Sent to their game: they get it next time they open TourLife.'; } } catch (e) { sent = ` Saved, but sending failed (${e.message}). Press "Send results to players" to try again.`; }
    if (!sent) sent = ' Press "Send results to players" on the Tournaments tab to send it to their game.';
    renderAdmin();
    openAdjust(id, `✅ Done.${sent}`);
  };
  $('sheet').querySelectorAll('[data-o]').forEach(b => { b.onclick = () => {
    const o = opts[+b.dataset.o];
    if (!confirm(`Change ${p.name} from ${ovr.toFixed(1)} to ${ovrOf(o.attrs).toFixed(1)} OVR?`)) return;
    b.disabled = true; push(o.attrs, p.attrs, $('adjWhy').value.trim());
  }; });
  if ($('adjUndo')) $('adjUndo').onclick = () => {
    const last = mine[mine.length - 1];
    if (!confirm(`Undo the last adjustment for ${p.name}?`)) return;
    push(last.from, p.attrs, 'The tournament admin undid an earlier adjustment to your player.');
  };
}

// --- Tournaments ---------------------------------------------------------------------

const AD_GROUPS = [
  ['Tour', ['GS', 'M1000', 'ATP500', 'ATP250']],
  ['Challenger', ['CH125', 'CH75']],
  ['ITF', ['M25', 'M15']],
];
const AD_NAMES = { GS: 'Gatah Slam', M1000: 'Gatah Masters', ATP500: 'Gatah 500', ATP250: 'Gatah Open', CH125: 'Gatah Challenger', CH75: 'Gatah Challenger', M25: 'Gatah Futures', M15: 'Gatah Futures' };
const roundName = n => ({ 2: 'Final', 4: 'Semi-finals', 8: 'Quarter-finals', 16: 'Round of 16', 32: 'Round of 32' })[n] || `Round of ${n}`;

function renderAdEvents() {
  const evs = adminEvents().sort((a, b) => b.created - a.created);
  const finished = evs.filter(adminDone).length;
  $('adBody').innerHTML = `<div class="shrow adbig"><button type="button" class="btn huge" id="adNew">🏆 New tournament</button>` +
    `<button type="button" class="btn huge ghost" id="adExh">🎾 New one-on-one match</button></div>` +
    (finished ? `<section class="card"><h2>Send results to players</h2><p class="hint">${finished} finished event${finished === 1 ? '' : 's'}. Players see their results (and ranking points from tournaments) next time they open their game.</p>` +
      (nfConf().gh || nfConf().token ? `<button type="button" class="btn" id="adPub">📤 Send results to players</button>` : '') +
      (nfConf().gh ? '' : `<details class="paste"><summary>Connect GitHub to send results (one time)</summary><p class="hint">Paste your GitHub token (the one with "repo" ticked). It's saved on this computer only.</p>` +
        `<input type="password" id="ghKey" class="inp" placeholder="ghp_…"><button type="button" class="btn small" id="ghSave">Connect GitHub</button></details>`) +
      `<button type="button" class="link" id="adPubFile">Save the results file instead</button>` +
      `<p class="hint" id="adPubMsg"></p></section>` : '') +
    `<section class="card"><h2>Your tournaments</h2>` +
    (evs.length ? `<div class="tllist">${evs.map(ev => {
      const champ = ev.rounds.length && ev.rounds[ev.rounds.length - 1].length === 1 && ev.rounds[ev.rounds.length - 1][0].winner;
      const status = champ !== undefined && champ !== false ? `🏆 ${esc(ev.entrants[champ].name)}` : ev.rounds[0][0].winner === undefined ? 'Not started' : 'In progress';
      return `<div class="tlrow click" data-open="${ev.id}"><span class="tlname"><b>${esc(ev.name)}</b>` +
        `<small>${ev.exhibition ? 'One-on-one' : tierLabel(ev.tier)} · ${surfaceLabel(ev.surface)}${ev.indoor ? ' indoor' : ''}${ev.exhibition ? '' : ` · ${ev.size} players · ${ev.entrants.filter(e => e.real).length} real`}</small></span>` +
        `<small class="tlstat">${status}</small><button type="button" class="x inline" data-del="${ev.id}" aria-label="Delete">×</button></div>`;
    }).join('')}</div>` : '<p class="hint">None yet. Make one with the button above.</p>') + `</section>`;
  $('adNew').onclick = () => renderAdNew();
  $('adExh').onclick = () => renderAdExh();
  if ($('adPub')) $('adPub').onclick = async () => {
    $('adPub').disabled = true; $('adPub').textContent = 'Sending…';
    try { await publishLive(); $('adPubMsg').innerHTML = '✅ Sent! Players will see their results next time they open the game.'; $('adPub').textContent = '📤 Send results to players'; $('adPub').disabled = false; }
    catch (e) { $('adPubMsg').textContent = `❌ ${e.message}`; $('adPub').disabled = false; $('adPub').textContent = '📤 Send results to players'; }
  };
  if ($('ghSave')) $('ghSave').onclick = () => { const v = $('ghKey').value.trim(); if (v) { writeJSON(NF_KEY, { ...nfConf(), gh: v }); renderAdmin(); } };
  if ($('adPubFile')) $('adPubFile').onclick = () => {
    download('results.json', JSON.stringify(publishResults()));
    $('adPubMsg').innerHTML = '✅ Saved <b>results.json</b> to your Downloads.';
  };
  $('adBody').querySelector('.tllist')?.addEventListener('click', e => {
    const d = e.target.closest('[data-del]'), o = e.target.closest('[data-open]');
    if (d) { if (confirm('Delete this tournament?')) { writeJSON(ADMIN_EVENTS, adminEvents().filter(x => x.id !== +d.dataset.del)); renderAdmin(); } return; }
    if (o) renderAdDraw(+o.dataset.open);
  });
}

// New tournament: level first (a short list of tiers), then the details, then who's in.
function renderAdNew(st = { tier: null, surface: 'hard', indoor: false, size: 32, name: '', picked: null }) {
  const box = $('adBody');
  if (!st.tier) {
    box.innerHTML = `<section class="card"><h2>1 · Pick the level</h2>` + AD_GROUPS.map(([g, tiers]) =>
      `<h4 class="tlgroup">${g}</h4><div class="tltiers">${tiers.map(t =>
        `<button type="button" class="tltier" data-tier="${t}"><b>${TIERS[t].label}</b><small>Field OVR ~${TIERS[t].level}</small></button>`).join('')}</div>`).join('') +
      `</section><button type="button" class="link" id="adCancel">Cancel</button>`;
    box.onclick = e => { const b = e.target.closest('[data-tier]'); if (b) { box.onclick = null; renderAdNew({ ...st, tier: b.dataset.tier, name: AD_NAMES[b.dataset.tier] }); } };
    $('adCancel').onclick = () => { box.onclick = null; renderAdmin(); };
    return;
  }
  const players = adminPlayers().sort((a, b) => overall(b.player) - overall(a.player));
  if (!st.picked) st.picked = players.filter(x => !suspicious(x).length).map(x => x.id); // flagged players start unticked
  const lvl = TIERS[st.tier].level;
  const fit = o => o >= lvl + 4 ? ['strong', 'Favourite'] : o >= lvl - 3 ? ['ok', 'Fits'] : ['weak', 'Long shot'];
  const seg = (key, opts) => `<div class="seg" style="grid-template-columns:repeat(${opts.length},1fr)" data-key="${key}">${opts.map(([v, l]) =>
    `<button type="button" data-v="${v}" class="${String(st[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const picked = st.picked.filter(id => players.some(x => x.id === id)).length;
  box.innerHTML = `<section class="card"><h2>2 · Details · ${TIERS[st.tier].label} <button type="button" class="link inline" id="adBackTier">change</button></h2>` +
    `<label class="lbl">Name</label><input id="adName" class="inp" maxlength="40" value="${esc(st.name)}">` +
    `<label class="lbl">Surface</label>${seg('surface', [['hard', 'Hard'], ['clay', 'Clay'], ['grass', 'Grass']])}` +
    `<label class="chk tlchk"><input type="checkbox" id="adIndoor" ${st.indoor ? 'checked' : ''}> Indoor</label>` +
    `<label class="lbl">Draw size</label>${seg('size', [[8, '8'], [16, '16'], [32, '32']])}</section>` +
    `<section class="card"><h2>3 · Real players (${picked} picked)</h2>` +
    (players.length ? `<div class="shrow"><button type="button" class="link" id="adAll">All</button><button type="button" class="link" id="adNone">None</button></div>` +
      `<div class="tllist">${players.map(x => {
        const o = overall(x.player), [cls, txt] = fit(o);
        return `<label class="tlrow click"><input type="checkbox" data-pick="${esc(x.id)}" ${st.picked.includes(x.id) ? 'checked' : ''}>` +
          `<span class="tlname"><b>${flagOf(x.player.nation)} ${esc(x.player.name)}${suspicious(x).length ? ' ⚠️' : ''}</b><small>${esc(x.contact || '')}</small></span>` +
          `<b class="tlovr">${o.toFixed(1)}</b><small class="tlfit ${cls}">${txt}</small></label>`;
      }).join('')}</div>` : '<p class="hint">No players loaded yet. Add them in the Players tab.</p>') +
    `<p class="hint">${picked > st.size ? `Too many for a ${st.size} draw: the top ${st.size} by OVR get in.` : `${st.size - Math.min(picked, st.size)} spots filled by computer players at ${TIERS[st.tier].label} level.`} Seeds go by OVR.</p></section>` +
    `<button type="button" class="btn huge" id="adCreate">Make the draw</button><button type="button" class="link" id="adCancel">Cancel</button>`;
  const keep = () => { st.name = $('adName').value.trim() || AD_NAMES[st.tier]; st.indoor = $('adIndoor').checked; };
  box.onclick = e => {
    const b = e.target.closest('.seg [data-v]');
    if (!b) return;
    keep();
    const k = b.parentElement.dataset.key;
    st[k] = k === 'size' ? +b.dataset.v : b.dataset.v;
    renderAdNew(st);
  };
  box.onchange = e => {
    const c = e.target.closest('[data-pick]');
    if (!c) return;
    keep();
    st.picked = c.checked ? [...st.picked, c.dataset.pick] : st.picked.filter(id => id !== c.dataset.pick);
    renderAdNew(st);
  };
  $('adBackTier').onclick = () => { box.onclick = box.onchange = null; renderAdNew({ ...st, tier: null }); };
  if ($('adAll')) $('adAll').onclick = () => { keep(); st.picked = players.map(x => x.id); renderAdNew(st); };
  if ($('adNone')) $('adNone').onclick = () => { keep(); st.picked = []; renderAdNew(st); };
  $('adCancel').onclick = () => { box.onclick = box.onchange = null; renderAdmin(); };
  $('adCreate').onclick = () => {
    keep();
    box.onclick = box.onchange = null;
    const ev = makeAdminEvent(st, players.filter(x => st.picked.includes(x.id)));
    writeJSON(ADMIN_EVENTS, [...adminEvents(), ev]);
    renderAdDraw(ev.id);
  };
}

function realEntrant(x) {
  const p = x.player;
  return { name: p.name, nation: p.nation, attrs: { ...p.attrs }, temperament: p.temperament, fav: p.fav, worst: p.worst,
    hand: p.hand || 'right', backhand: p.backhand || 'two', plan: planOf(p), formSd: 0.02, seed: null,
    real: true, owner: x.contact || '', pid: x.id, orders: p.orders || null, bhGap: p.bhGap };
}

// Seed lines for an 8/16/32 draw (size/4 seeds); everyone else is drawn at random.
function adminDraw(entrants, size) {
  if (size === 2) return [{ a: 0, b: 1 }];
  const lines = Array(size).fill(null);
  const bySeed = s => entrants.findIndex(e => e.seed === s);
  const spots = { 8: [[0], [7]], 16: [[0], [15], [4, 11]], 32: [[0], [31], [8, 23], [7, 15, 16, 24]] }[size];
  let s = 1;
  for (const group of spots) {
    const g = [...group].sort(() => Math.random() - 0.5);
    for (const line of g) lines[line] = bySeed(s++);
  }
  const rest = entrants.map((_, i) => i).filter(i => !lines.includes(i)).sort(() => Math.random() - 0.5);
  for (let i = 0; i < size; i++) if (lines[i] === null || lines[i] < 0) lines[i] = rest.pop();
  const first = [];
  for (let i = 0; i < size; i += 2) first.push({ a: lines[i], b: lines[i + 1] });
  return first;
}

function makeAdminEvent(st, chosen) {
  const real = chosen.sort((a, b) => overall(b.player) - overall(a.player)).slice(0, st.size).map(realEntrant);
  const nations = Object.keys(REGION_OF), used = new Set(real.map(r => r.name));
  const cpu = [];
  while (real.length + cpu.length < st.size) {
    const o = generateOpponent(pick(Math.random, nations), st.tier);
    if (!used.has(o.name)) { used.add(o.name); cpu.push(o); }
  }
  const entrants = [...real, ...cpu];
  [...entrants].sort((a, b) => overall(b) - overall(a)).forEach((p, i) => { p.seed = i < st.size / 4 ? i + 1 : null; });
  return { id: Date.now(), created: Date.now(), name: st.name, tier: st.tier, surface: st.surface, indoor: st.indoor, size: st.size,
    nation: real[0] ? real[0].nation : 'USA', entrants, rounds: [adminDraw(entrants, st.size)] };
}

const ROUND_CODE = { 2: 'F', 4: 'SF', 8: 'QF', 16: 'R16', 32: 'R32' };

// A real player's match, in the same shape as the game's own match records (so stats and stories work).
function realMatchRec(m, side, ps, round) {
  const me = side, op = 1 - side, opp = ps[op];
  return {
    round, won: m.winner === me, score: scoreLine(m, me), real: true,
    opponent: { name: opp.name, nation: opp.nation, seed: opp.seed, age: opp.age, temperament: opp.temperament, hand: opp.hand || 'right', real: !!opp.real },
    plan: planOf(ps[me]), oppPlan: planOf(opp),
    sets: m.sets.map(s => ({ games: [s.games[me], s.games[op]], tb: s.tb && [s.tb[me], s.tb[op]],
      blown: s.blown && { you: s.blown.who === me, lead: s.blown.lead } })),
    stats: m.stats[me], oppStats: m.stats[op],
    moments: m.moments.map(x => ({ set: x.set, who: x.who === me ? 'you' : 'opponent', kind: x.kind, label: x.label, text: x.text, effect: x.effect })),
  };
}

// --- Pre-match comparison (for the stream) ---------------------------------------------------------
// Both players side by side: head-to-head in admin events, this season's numbers, the record and the build.
function adminH2H(ev, a, b) {
  const key = e => e.pid || e.name, ka = key(a), kb = key(b);
  let wa = 0, wb = 0;
  for (const x of adminEvents()) for (const round of x.rounds) for (const s of round) {
    if (s.winner === undefined) continue;
    const A = x.entrants[s.a], B = x.entrants[s.b], W = x.entrants[s.winner];
    if (![key(A), key(B)].includes(ka) || ![key(A), key(B)].includes(kb)) continue;
    if (key(W) === ka) wa++; else wb++;
  }
  return [wa, wb];
}
function openMatchup(ev, slot, onPlay) {
  const ps = [ev.entrants[slot.a], ev.entrants[slot.b]];
  const sum = p => (p.pid && (adminPlayers().find(x => x.id === p.pid) || {}).summary) || null;
  const S = ps.map(sum), N = S.map(s => (s && s.season) || null);
  const [ha, hb] = adminH2H(ev, ps[0], ps[1]);
  const cell = (vals, fmt, better = 'high') => {
    const ok = vals.map(v => typeof v === 'number' && isFinite(v));
    const lead = ok[0] && ok[1] && vals[0] !== vals[1] ? ((vals[0] > vals[1]) === (better === 'high') ? 0 : 1) : -1;
    return vals.map((v, i) => `<td class="${lead === i ? 'lead' : ''}">${ok[i] ? fmt(v) : '–'}</td>`);
  };
  const row = (label, vals, fmt, better) => { const [l, r] = cell(vals, fmt, better); return `<tr>${l}<th>${label}</th>${r}</tr>`; };
  const pct = v => `${(v * 100).toFixed(1)}%`;
  const rec = s => s && s.season ? `${s.season.wins}–${s.season.matches - s.season.wins}` : '–';
  const head = p => `<div class="mu-p"><div class="mu-flag">${flagOf(p.nation)}</div><b>${esc(p.name)}</b>` +
    `<small>${p.real ? '⭐ Real player' : '🤖 Computer'} · ${esc(styleOf(p).name)}</small><span class="mu-ovr">${overall(p).toFixed(1)} <i>OVR</i></span></div>`;
  openModal(`<button type="button" class="x" id="mx" aria-label="Close">×</button><h2 class="itop">📊 Tale Of The Tape</h2>` +
    `<p class="hint center">${esc(ev.name)} · ${roundName(ev.rounds[ev.rounds.length - 1].length * 2)} · ${surfaceLabel(ev.surface)}${ev.indoor ? ' · Indoor' : ''}</p>` +
    `<div class="mu-heads">${head(ps[0])}<div class="mu-vs">VS</div>${head(ps[1])}</div>` +
    `<div class="mu-h2h">Head-To-Head <b>${ha}–${hb}</b>${ha + hb ? '' : ' <small>(first meeting)</small>'}</div>` +
    `<table class="mu-tab"><tbody>` +
    `<tr><td colspan="3" class="mu-sec">This Season</td></tr>` +
    `<tr><td class="${S[0] && S[1] && S[0].season && S[1].season && S[0].season.winRate !== S[1].season.winRate ? (S[0].season.winRate > S[1].season.winRate ? 'lead' : '') : ''}">${rec(S[0])}</td><th>Record</th><td class="${S[0] && S[1] && S[0].season && S[1].season && S[0].season.winRate !== S[1].season.winRate ? (S[1].season.winRate > S[0].season.winRate ? 'lead' : '') : ''}">${rec(S[1])}</td></tr>` +
    SEASON_STATS.map(([k, label, kind]) => row(label, N.map(n => n ? n[k] : null), v => fmtStat(v, kind))).join('') +
    `<tr><td colspan="3" class="mu-sec">Career</td></tr>` +
    row('Ranking', S.map(s => s && s.rank ? s.rank : null), v => `#${v}`, 'low') +
    row('Best Ranking', S.map(s => s && s.bestRank ? s.bestRank : null), v => `#${v}`, 'low') +
    row('Titles', S.map(s => s ? s.titles : null), v => v) +
    row('Career Win Rate', S.map(s => s && s.wins + s.losses ? s.wins / (s.wins + s.losses) : null), pct) +
    `<tr><td colspan="3" class="mu-sec">The Build</td></tr>` +
    ATTRS.map(([k, label]) => row(label, ps.map(p => p.attrs[k]), v => v.toFixed(1))).join('') +
    row('Forehand', ps.map(p => wingRatings({ ...p, isPlayer: p.real }).fh), v => v) + row('Backhand', ps.map(p => wingRatings({ ...p, isPlayer: p.real }).bh), v => v) +
    `</tbody></table>` +
    (N.some(n => !n) && ps.some(p => p.real) ? `<p class="hint center">– means no numbers yet: computer players, or a player who sent their character before season stats were included.</p>` : '') +
    (onPlay ? `<button type="button" class="btn huge" id="muPlay">▶ Play Live</button>` : ''), { wide: true });
  $('mx').onclick = closeModal;
  if ($('muPlay')) $('muPlay').onclick = () => { closeModal(); onPlay(); };
}

// Matches are played one at a time, live. Starting a match fixes its seed and a snapshot of both players
// (so closing and reopening shows the very same match, with no re-rolls); the result is only saved when
// the match has been watched to the end. Computer-only matches can be simmed instantly.
function startSlot(ev, slot) {
  if (!slot.live) {
    const seed = (Math.random() * 4294967296) >>> 0;
    const ps = JSON.parse(JSON.stringify([ev.entrants[slot.a], ev.entrants[slot.b]]));
    ps.forEach((p, i) => applyOrders(p, ps[1 - i])); // each real player's match orders for this opponent
    slot.live = { seed, ps,
      ev: { tier: ev.tier, surface: ev.surface, indoor: !!ev.indoor, weather: ev.weather || null, nation: ev.nation, city: ev.name },
      bestOf: ev.tier === 'GS' && !ev.exhibition ? 5 : 3 };
  }
  return slot.live;
}
// Records the result of a started match: exactly the match the replay engine plays from its seed.
function finishSlot(ev, slot, roundLen) {
  const snap = startSlot(ev, slot), { m, ps } = replayMatch(snap);
  slot.recs = [0, 1].map(i => ps[i].real ? { ...realMatchRec(m, i, ps, ROUND_CODE[roundLen * 2] || 'R32'), replay: { ...snap, side: i } } : null);
  slot.replay = { ...snap, side: 0 };
  slot.winner = m.winner === 0 ? slot.a : slot.b;
  slot.score = scoreLine(m, m.winner);
  slot.stats = [0, 1].map(i => ({ aces: m.stats[i].aces, df: m.stats[i].df, winners: m.stats[i].winners, ue: m.stats[i].ue,
    bp: `${m.stats[i].bpWon}/${m.stats[i].bpChances}`, pts: m.stats[i].points }));
  delete slot.live;
  advanceRound(ev);
}
// When every match in the round has a result, draw up the next round.
function advanceRound(ev) {
  const round = ev.rounds[ev.rounds.length - 1];
  if (round.length < 2 || round.some(s => s.winner === undefined)) return;
  const next = [];
  for (let i = 0; i < round.length; i += 2) next.push({ a: round[i].winner, b: round[i + 1].winner });
  ev.rounds.push(next);
}
const hasReal = (ev, s) => ev.entrants[s.a].real || ev.entrants[s.b].real;
// Sims only the matches with no real player in them (in the current round).
function simCpuMatches(ev) {
  const round = ev.rounds[ev.rounds.length - 1], len = round.length;
  for (const s of round) if (s.winner === undefined && !hasReal(ev, s)) finishSlot(ev, s, len);
}

const adminDone = ev => { const last = ev.rounds[ev.rounds.length - 1]; return last.length === 1 && last[0].winner !== undefined; };

// Everything players need from finished tournaments: for each real player, how far they got, the points
// and their matches. Players' games read this from results.json on the site.
function publishResults() {
  const events = adminEvents().filter(adminDone).map(ev => {
    const first = 5 - Math.log2(ev.size); // a 16 draw starts at the round of 16, and so on
    const results = ev.entrants.map((e, i) => ({ e, i })).filter(({ e }) => e.real).map(({ e, i }) => {
      const recs = [];
      ev.rounds.forEach(round => round.forEach(s => {
        if (s.a === i && s.recs && s.recs[0]) recs.push(s.recs[0]);
        if (s.b === i && s.recs && s.recs[1]) recs.push(s.recs[1]);
      }));
      const wins = recs.filter(x => x.won).length, champ = wins === Math.log2(ev.size);
      const idx = champ ? 5 : first + wins;
      return { pid: e.pid, name: e.name, reached: champ ? 'W' : recs.length ? recs[recs.length - 1].round : '-', points: ev.exhibition ? 0 : POINTS[ev.tier][idx], matches: recs };
    });
    const last = ev.rounds[ev.rounds.length - 1][0];
    return { id: `real-${ev.id}`, name: ev.name, tier: ev.tier, exhibition: !!ev.exhibition, surface: ev.surface, indoor: ev.indoor, nation: ev.nation, size: ev.size,
      champion: ev.entrants[last.winner].name, results };
  });
  return { updated: Date.now(), events, corrections: adminCorr() };
}

function saveAdminEvent(ev) {
  writeJSON(ADMIN_EVENTS, adminEvents().map(x => x.id === ev.id ? ev : x));
}

function renderAdDraw(id) {
  const ev = adminEvents().find(x => x.id === id);
  if (!ev) return renderAdmin();
  const last = ev.rounds[ev.rounds.length - 1];
  const done = last.length === 1 && last[0].winner !== undefined;
  const nextName = roundName(last.length * 2);
  const shown = s => s.winner !== undefined;
  const who = i => {
    const e = ev.entrants[i];
    return `${e.seed ? `<i>${e.seed}</i>` : ''}${flagOf(e.nation)} ${e.real ? `<b>⭐ ${esc(e.name)}</b>` : esc(e.name)}`;
  };
  const champ = done ? ev.entrants[last[0].winner] : null;
  // Next match to play live: real players first, then everything else in draw order.
  const pending = done ? [] : last.map((s, k) => ({ s, k })).filter(({ s }) => s.winner === undefined);
  const nextUpK = (pending.find(({ s }) => hasReal(ev, s)) || pending[0] || {}).k, nextUp = nextUpK !== undefined ? last[nextUpK] : null;
  const cpuLeft = pending.filter(({ s }) => !hasReal(ev, s)).length;
  const realLeft = done ? [] : last.flatMap(s => [s.a, s.b]).filter(i => ev.entrants[i].real && last.find(s => (s.a === i || s.b === i)).winner === undefined);
  $('adBody').innerHTML = `<section class="card"><h2>${esc(ev.name)}</h2>` +
    `<p class="hint">${tierLabel(ev.tier)} · ${surfaceLabel(ev.surface)}${ev.indoor ? ' · Indoor' : ''} · ${ev.size} players · ⭐ = real player</p>` +
    (champ ? `<div class="tlchamp">🏆 ${flagOf(champ.nation)} ${esc(champ.name)}${champ.real ? ` <small>(${esc(champ.owner || 'real player')})</small>` : ''}</div>` :
      (nextUp ? `<button type="button" class="btn huge" id="adNext">▶ Play Live: ${who(nextUp.a)} vs ${who(nextUp.b)}</button>` +
        `<button type="button" class="btn ghost" id="adTape">📊 Tale Of The Tape</button>` : '') +
      (cpuLeft ? `<button type="button" class="btn ghost" id="adCpu">⚡ Sim the ${cpuLeft} Computer-Only Match${cpuLeft === 1 ? '' : 'es'}</button>` : '') +
      `<p class="hint">${nextName}: matches are played live one at a time, and the score is only revealed when the match ends.</p>` +
      (realLeft.length ? `<p class="hint">Real players still in: ${realLeft.map(i => esc(ev.entrants[i].name)).join(', ')}</p>` : '')) +
    `</section><div class="tlbracket">${ev.rounds.map((round, r) =>
      `<div class="tlround"><h4>${roundName(round.length * 2)}</h4><div class="tlms">${round.map((s, k) =>
        `<div class="tlmatch${s.winner !== undefined ? ' click' : ''}" data-m="${r}-${k}">` +
          `<div class="${shown(s) && s.winner === s.a ? 'won' : shown(s) ? 'lost' : ''}">${who(s.a)}</div>` +
          `<div class="${shown(s) && s.winner === s.b ? 'won' : shown(s) ? 'lost' : ''}">${who(s.b)}</div>` +
          (s.score && shown(s) ? `<small>${s.score}</small>` : '') +
          (s.winner === undefined && r === ev.rounds.length - 1 ? `<button type="button" class="btn small ghost tltape" data-t="${k}">📊 Matchup</button><button type="button" class="btn small tllive${hasReal(ev, s) ? ' gold' : ''}" data-l="${k}">▶ ${s.live ? 'Resume' : 'Play Live'}</button>` : '') +
          (s.replay ? `<button type="button" class="btn small ghost tlwatch" data-w="${r}-${k}">▶ Watch Again</button>` : '') + `</div>`).join('')}</div></div>`).join('')}</div>` +
    `<button type="button" class="link" id="adBackList">All tournaments</button>`;
  // Play a match live: the score is saved only once it has been watched to the end. Then offer the next one.
  const live = k => {
    const round = ev.rounds[ev.rounds.length - 1], s = round[k], len = round.length;
    const snap = startSlot(ev, s); saveAdminEvent(ev);
    let finished = false;
    const nextK = () => { const rr = ev.rounds[ev.rounds.length - 1], p = rr.map((x, i) => ({ x, i })).filter(({ x }) => x.winner === undefined);
      return (p.find(({ x }) => hasReal(ev, x)) || p[0] || {}).i; };
    watchRealMatch({ replay: { ...snap, side: 0 }, round: roundName(len * 2), event: ev.name },
      { neutral: true, onDone: () => { finished = true; finishSlot(ev, s, len); saveAdminEvent(ev); },
        onNext: () => { const n = nextK(); if (finished && n !== undefined) live(n); else renderAdDraw(id); }, onClose: () => renderAdDraw(id) });
  };
  if (!done) {
    if ($('adNext')) $('adNext').onclick = () => live(nextUpK);
    if ($('adTape')) $('adTape').onclick = () => openMatchup(ev, last[nextUpK], () => live(nextUpK));
    if ($('adCpu')) $('adCpu').onclick = () => { simCpuMatches(ev); saveAdminEvent(ev); renderAdDraw(id); };
  }
  $('adBackList').onclick = () => renderAdmin();
  // Watch a match, then (optionally) roll straight on to the next one in the bracket.
  const order = ev.rounds.flatMap((round, r) => round.map((s, k) => [r, k])).filter(([r, k]) => ev.rounds[r][k].replay);
  const watch = (r, k) => {
    const s = ev.rounds[r][k], idx = order.findIndex(([a, b]) => a === r && b === k), nxt = order[idx + 1];
    watchRealMatch({ replay: s.replay, score: s.score, round: roundName(ev.rounds[r].length * 2), event: ev.name },
      { neutral: true, onDone: () => { s.watched = true; saveAdminEvent(ev); },
        onNext: nxt ? () => watch(...nxt) : null, onClose: () => renderAdDraw(id) });
  };
  $('adBody').querySelector('.tlbracket').onclick = e => {
    const lv = e.target.closest('.tllive');
    if (lv) { live(+lv.dataset.l); return; }
    const tp = e.target.closest('.tltape');
    if (tp) { const k = +tp.dataset.t; openMatchup(ev, ev.rounds[ev.rounds.length - 1][k], () => live(k)); return; }
    const w = e.target.closest('.tlwatch');
    if (w) { const [r, k] = w.dataset.w.split('-').map(Number); watch(r, k); return; }
    const b = e.target.closest('.tlmatch.click');
    if (!b) return;
    const [r, k] = b.dataset.m.split('-').map(Number), s = ev.rounds[r][k];
    const W = ev.entrants[s.winner], L = ev.entrants[s.winner === s.a ? s.b : s.a];
    const st = s.stats || [{}, {}], wi = s.winner === s.a ? 0 : 1, li = 1 - wi;
    const row = (label, key) => `<tr><td>${st[wi][key] ?? '–'}</td><th>${label}</th><td>${st[li][key] ?? '–'}</td></tr>`;
    openModal(`<button type="button" class="x" id="mx" aria-label="Close">×</button>` +
      `<h2 class="itop">${roundName(ev.rounds[r].length * 2)}</h2>` +
      `<p class="big center"><b>${flagOf(W.nation)} ${esc(W.name)}</b> d. ${flagOf(L.nation)} ${esc(L.name)}<br>${s.score}</p>` +
      `<table class="tlstats"><tr><td><b>${esc(W.name)}</b></td><th></th><td><b>${esc(L.name)}</b></td></tr>` +
      row('Aces', 'aces') + row('Double faults', 'df') + row('Winners', 'winners') + row('Unforced errors', 'ue') + row('Break points won', 'bp') + row('Points won', 'pts') + `</table>`);
    $('mx').onclick = closeModal;
  };
}

// Open with #admin on the end of the address.
const checkAdminHash = () => { if (location.hash === '#admin') openAdmin(); };
window.addEventListener('hashchange', checkAdminHash);
checkAdminHash();


// --- One-on-one matches ----------------------------------------------------------------------
// Any two players (or a player against a computer player at a chosen level), any surface and weather.
// Test players: one of every playstyle at 75 OVR, stats leaning the way that style leans, plan to match.
function styleEntrant(i) {
  const sty = STYLES[i], attrs = {};
  ATTR_KEYS.forEach((k, j) => { attrs[k] = 75 + (sty.w ? sty.w[j] * 4 : 0); });
  for (let n = 0; n < 5; n++) { const d = 75 - overall({ attrs }); ATTR_KEYS.forEach(k => { attrs[k] = clamp(attrs[k] + d, 20, 99); }); }
  ATTR_KEYS.forEach(k => { attrs[k] = Math.round(attrs[k]); });
  // serve, return position, aggression, net, drops, spin
  const P = { 'Serve-Dominant': 'big normal aggressive sometimes rarely flat', 'Serve +1 Attacker': 'big normal aggressive sometimes rarely mixed',
    'First-Strike Attacker': 'big inside aggressive sometimes rarely flat', 'Aggressive Baseliner': 'balanced normal aggressive rarely sometimes mixed',
    'Flat Attacker': 'big inside aggressive rarely rarely flat', 'Solid Baseliner': 'balanced normal balanced rarely rarely mixed',
    'Counterpuncher': 'safe deep patient rarely sometimes mixed', 'Defensive Grinder': 'safe deep patient rarely rarely topspin',
    'Heavy-Topspin Baseliner': 'balanced deep patient rarely rarely topspin', 'Heavy-Topspin Attacker': 'balanced normal aggressive sometimes rarely topspin',
    'All-Court': 'balanced normal balanced sometimes sometimes mixed', 'Net Attacker': 'balanced normal aggressive often sometimes mixed',
    'Serve-and-Volley': 'big inside aggressive often sometimes mixed', 'Variety / Slice-Heavy': 'safe normal balanced sometimes often mixed',
    'Creative Shotmaker': 'balanced normal balanced sometimes often mixed' }[sty.name].split(' ');
  const plan = { ...DEFAULT_PLAN, serve: P[0], returnPos: P[1], aggression: P[2], net: P[3], drops: P[4], spin: P[5], sig: 'on' };
  return { name: sty.name, nation: 'USA', attrs, temperament: 'stoic', hand: 'right', backhand: 'two', plan, formSd: 0.02, seed: null,
    realStyle: sty.name };
}

// Play a one-on-one yourself: Player 1 becomes you in a throwaway test save (tourlife.test.*), Player 2 the computer.
// The page reloads into that save at the draw; the bar at the top brings you back to admin and your own career.
function playTestMatch(st, players) {
  const pick1 = v => /^sty\d+$/.test(v) ? styleEntrant(+v.slice(3)) : realEntrant(players.find(x => x.id === v));
  const a = pick1(st.a), b = st.b === 'cpu' ? generateOpponent(pick(Math.random, Object.keys(REGION_OF)), st.cpu) : pick1(st.b);
  const base = readJSON('tourlife.player') || (players[0] && players[0].player);
  if (!base) { toast('No Player On This Device', 'Make a career on this device first: the test match borrows its settings.'); return; }
  const me = JSON.parse(JSON.stringify(base));
  Object.assign(me, { name: a.name, nation: a.nation, attrs: { ...a.attrs }, plan: { ...a.plan }, temperament: a.temperament || me.temperament,
    hand: a.hand || 'right', backhand: a.backhand || 'two', fatigue: 0, injury: null, realStyle: a.realStyle || undefined, bhGap: a.bhGap });
  me.playstyle = styleOf(me).name;
  const career = JSON.parse(JSON.stringify(readJSON('tourlife.career') || {}));
  Object.assign(career, { injury: null, notice: null, offer: null, money: TEST_MONEY });
  const opp = { ...b, seed: null, isPlayer: false };
  const you = { name: me.name, nation: me.nation, attrs: { ...me.attrs }, temperament: me.temperament, fav: me.fav, worst: me.worst,
    hand: me.hand, backhand: me.backhand, plan: planOf(me), formSd: 0.02, seed: null, isPlayer: true, realStyle: me.realStyle, bhGap: me.bhGap };
  const id = 'test' + Date.now();
  const ev = { id, city: 'Test Match', name: 'Test Match', nation: a.nation, tier: st.b === 'cpu' ? st.cpu : 'ATP250', surface: st.surface,
    indoor: st.weather === 'indoor', weather: st.weather, week: career.week || 1 };
  const entry = { id, test: true, event: ev, entrants: [you, opp], rounds: [[{ a: 0, b: 1 }]], live: null, matches: [], result: null, plan: planOf(me), acclimated: true };
  for (const [k, v] of [['player', me], ['career', career], ['entry', entry]]) localStorage.setItem('tourlife.test.' + k, JSON.stringify(v));
  localStorage.setItem('tourlife.mode', 'test');
  location.hash = '';
  location.reload();
}

function renderAdExh(st = { a: null, b: null, cpu: 'ATP250', surface: 'hard', weather: 'sunny' }) {
  const players = adminPlayers().sort((x, y) => overall(y.player) - overall(x.player));
  const opt = (sel, extra = '') => `<option value="">Choose…</option>` + players.map(x =>
    `<option value="${esc(x.id)}" ${sel === x.id ? 'selected' : ''}>${flagOf(x.player.nation)} ${esc(x.player.name)} (OVR ${overall(x.player).toFixed(1)})</option>`).join('') + extra;
  const styOpt = sel => `<optgroup label="Playstyles (OVR 75)">` + STYLES.map((y, i) =>
    `<option value="sty${i}" ${sel === 'sty' + i ? 'selected' : ''}>🎾 ${esc(y.name)} (OVR 75)</option>`).join('') + `</optgroup>`;
  const cpuOpt = `<option value="cpu" ${st.b === 'cpu' ? 'selected' : ''}>🤖 A computer player…</option>` + styOpt(st.b);
  const seg = (key, opts) => `<div class="seg" style="grid-template-columns:repeat(${opts.length},1fr)" data-key="${key}">${opts.map(([v, l]) =>
    `<button type="button" data-v="${v}" class="${st[key] === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  $('adBody').innerHTML = `<section class="card"><h2>🎾 One-on-one match</h2>` +
    `<label class="lbl">Player 1</label><select id="exA" class="inp big">${opt(st.a, styOpt(st.a))}</select>` +
    `<label class="lbl">Player 2</label><select id="exB" class="inp big">${opt(st.b, cpuOpt)}</select>` +
    (st.b === 'cpu' ? `<label class="lbl">Computer player's level</label><select id="exCpu" class="inp">${TITLE_LADDER.slice().reverse().map(t => `<option value="${t}" ${st.cpu === t ? 'selected' : ''}>${TIERS[t].label} level (OVR ~${TIERS[t].level})</option>`).join('')}</select>` : '') +
    `<label class="lbl">Surface</label>${seg('surface', [['hard', 'Hard'], ['clay', 'Clay'], ['grass', 'Grass']])}` +
    `<label class="lbl">Conditions</label>${seg('weather', Object.entries(WEATHER).map(([k, w]) => [k, w.icon]))}` +
    `<p class="hint">${WEATHER[st.weather].name}: ${WEATHER[st.weather].desc}</p>` +
    `<button type="button" class="btn huge" id="exPlay" ${st.a && st.b && st.a !== st.b ? '' : 'disabled'}>🎾 Play It Myself</button>` +
    `<p class="hint">You play as Player 1 with every match mode; Player 2 is the computer. Played in a separate test save: your own career isn't touched.</p>` +
    `<button type="button" class="btn ghost" id="exGo" ${st.a && st.b && st.a !== st.b ? '' : 'disabled'}>Set Up The Match To Watch</button>` +
    `<p class="hint">${players.length < 2 ? 'Tip: get players on the Players tab first, or pick a computer player as Player 2.' : 'One-on-ones give no ranking points; players see the result in their game.'}</p></section>` +
    `<button type="button" class="link" id="exBack">Back</button>`;
  const keep = () => { st.a = $('exA').value || null; st.b = $('exB').value || null; if ($('exCpu')) st.cpu = $('exCpu').value; };
  $('adBody').onchange = () => { keep(); renderAdExh(st); };
  $('adBody').onclick = e => { const b = e.target.closest('.seg [data-v]'); if (!b) return; keep(); st[b.parentElement.dataset.key] = b.dataset.v; renderAdExh(st); };
  $('exBack').onclick = () => { $('adBody').onclick = $('adBody').onchange = null; renderAdmin(); };
  $('exPlay').onclick = () => { keep(); playTestMatch(st, players); };
  $('exGo').onclick = () => {
    keep();
    $('adBody').onclick = $('adBody').onchange = null;
    const who = v => /^sty\d+$/.test(v) ? styleEntrant(+v.slice(3)) : realEntrant(players.find(x => x.id === v));
    const B = st.b !== 'cpu';
    const entrants = [who(st.a), B ? who(st.b) : generateOpponent(pick(Math.random, Object.keys(REGION_OF)), st.cpu)];
    entrants.forEach(e => { e.seed = null; });
    const ev = { id: Date.now(), created: Date.now(), exhibition: true, tier: B ? 'ATP250' : st.cpu, surface: st.surface,
      indoor: st.weather === 'indoor', weather: st.weather, size: 2, nation: entrants[0].nation,
      name: `${entrants[0].name} vs ${entrants[1].name}`, entrants, rounds: [[{ a: 0, b: 1 }]] };
    writeJSON(ADMIN_EVENTS, [...adminEvents(), ev]);
    renderAdDraw(ev.id);
  };
}

// Left a test match: its throwaway save goes (the page can write it once more on the way out).
if (!isTestMatch()) try { for (const k of Object.keys(localStorage)) if (k.startsWith('tourlife.test.')) localStorage.removeItem(k); } catch {}
// In an admin test match: a bar to get back to admin (and your own career), and straight to the match's draw.
if (isTestMatch()) {
  const bar = document.createElement('div');
  bar.className = 'testbar';
  const tut = typeof hoTutOn === 'function' && hoTutOn();
  bar.innerHTML = tut ? `<b>🎓 Tutorial</b><span>Practice only: your career isn't touched</span><button type="button" class="btn small">Leave Tutorial</button>`
    : `<b>🧪 Test Match</b><span>Your own career isn't touched</span><button type="button" class="btn small">Back To Admin</button>`;
  document.body.prepend(bar);
  bar.querySelector('button').onclick = () => {
    if (tut) return hoTutLeave(false);
    for (const k of Object.keys(localStorage)) if (k.startsWith('tourlife.test.')) localStorage.removeItem(k);
    localStorage.setItem('tourlife.mode', 'player');
    location.hash = '#admin';
    location.reload();
  };
  if (current.career && current.career.money !== TEST_MONEY) { current.career.money = TEST_MONEY; writeJSON(CAREER_KEY, current.career); }
  if (current.entry && current.entry.test && !current.entry.result && location.hash !== '#admin') { if (tut) openMatch(); else openDraw(); }
}
