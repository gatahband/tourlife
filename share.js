// share.js — save codes (backup, move to another device, send to a friend) and "Send my player",
// which submits your player to the site owner through Netlify Forms.

// --- Save codes ----------------------------------------------------------------
// A code is "TL1." + gzipped JSON in URL-safe base64 ("TL0." = not gzipped, for old browsers).

const b64 = bytes => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64 = str => Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

async function encodeSave(obj) {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream === 'undefined') return 'TL0.' + b64(raw);
  return 'TL1.' + b64(await pipe(raw, new CompressionStream('gzip')));
}

async function decodeSave(code) {
  const m = String(code).trim().replace(/\s+/g, '').match(/^TL([01])\.([A-Za-z0-9_-]+)$/);
  if (!m) throw new Error("That doesn't look like a TourLife code.");
  let bytes = unb64(m[2]);
  if (m[1] === '1') bytes = await pipe(bytes, new DecompressionStream('gzip'));
  const obj = JSON.parse(new TextDecoder().decode(bytes));
  if (!obj || !obj.player || !obj.player.attrs) throw new Error('This code has no player in it.');
  return obj;
}

// The whole career (player, results, the event in progress).
const fullSave = () => { const p = readJSON(SAVE_KEY); return { v: 1, kind: 'career', player: p, sig: fingerprint(p), career: readJSON(CAREER_KEY), entry: readJSON(ENTRY_KEY) }; };

// Just the player and a short summary: small enough to send in a form.
function playerCard() {
  const p = readJSON(SAVE_KEY), c = loadCareer();
  return { v: 1, kind: 'player', player: p, sig: fingerprint(p),
    summary: { week: c.week, rank: currentRank(c), bestRank: c.bestRank || null, points: rankingPoints(c), wins: c.wins, losses: c.losses, titles: c.titles.length, ovr: +overall(p).toFixed(1) } };
}

// Import: becomes a saved career and is loaded. A player card starts a fresh career with that player.
function importSave(obj) {
  // A full career keeps its id (loading your own backup replaces it); a player card always starts a new slot.
  const id = obj.kind === 'career' && obj.player.created || Date.now();
  shelveLive();
  const saves = loadSaves().filter(x => x.id !== id);
  writeJSON(SAVES_KEY, saves);
  writeJSON(SAVE_KEY, { ...obj.player, created: id });
  writeJSON(CAREER_KEY, obj.kind === 'career' ? obj.career : null);
  writeJSON(ENTRY_KEY, obj.kind === 'career' ? obj.entry : null);
  location.reload();
}

function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// --- Save / load progress: one tap each, on any device ---------------------------------
// Save: on phones and tablets the share sheet opens (Save to Files, AirDrop, Messages, email);
// on computers the file downloads. Load: pick that file.
async function saveProgress() {
  const p = readJSON(SAVE_KEY), c = loadCareer();
  const name = `${p.name.replace(/[^\w-]+/g, '-')}-TourLife-week${c.week}.txt`;
  const text = await encodeSave(fullSave());
  const file = typeof File === 'function' ? new File([text], name, { type: 'text/plain' }) : null;
  if (file && navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent)) {
    try { await navigator.share({ files: [file], title: `${p.name}: TourLife progress` }); toast('✅ Progress saved', 'Keep that file: open it with "Load my progress" on any device.'); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  download(name, text);
  toast('✅ Progress saved', 'It is in your Downloads. Open it with "Load my progress" on any device.');
}

function loadProgress() {
  const inp = $('loadFile');
  inp.value = '';
  inp.onchange = async () => {
    const f = inp.files[0];
    if (!f) return;
    try {
      const obj = await decodeSave(await f.text());
      const c = obj.career || {};
      if (confirm(`Load ${obj.player.name}'s career (season ${seasonOfWeek(c.week || 1)}, week ${weekInSeason(c.week || 1)})? The career on this device is kept in your saved careers.`)) importSave(obj);
    } catch { alert("That file isn't a TourLife save. Pick the file you saved with \"Save my progress\"."); }
  };
  inp.click();
}

// --- Move to another device ----------------------------------------------------------
// The career rides inside a link (#load=…), so no account or server is needed. Older seasons' matches
// are trimmed first to keep the link short.
async function transferLink() {
  const save = fullSave();
  const c = JSON.parse(JSON.stringify(save.career || {}));
  if (c.history) { const real = c.week; c.week = c.week + 52; compactHistory(c); c.week = real; } // trim all but this season
  return `${location.origin}${location.pathname}#load=${await encodeSave({ ...save, career: c })}`;
}

// Opened from a transfer link: offer to load that career.
async function checkTransferLink() {
  const m = location.hash.match(/^#load=(TL[01]\.[A-Za-z0-9_-]+)/);
  if (!m) return;
  history.replaceState(null, '', location.pathname);
  try {
    const obj = await decodeSave(m[1]);
    const c = obj.career || {};
    openModal(`<h2 class="itop">📱 Carry on here?</h2>` +
      `<p class="big center">Load <b>${esc(obj.player.name)}</b>'s career (season ${seasonOfWeek(c.week || 1)}, week ${weekInSeason(c.week || 1)}) on this device?</p>` +
      `<p class="hint center">${readJSON(SAVE_KEY) ? 'The career already on this device is kept in your saved careers.' : ''}</p>` +
      `<button type="button" class="btn huge" id="tlYes">Yes, load it</button><button type="button" class="link" id="tlNo">No thanks</button>`);
    $('tlYes').onclick = () => importSave(obj);
    $('tlNo').onclick = closeModal;
  } catch { toast("That career link didn't work", 'It may have been cut off. Try sending it again.'); }
}
setTimeout(checkTransferLink, 400);

// --- Updates ---------------------------------------------------------------------------
// Each publish stamps a version (deploy-gh.sh). When a newer one is out, a bar offers a one-tap update;
// progress is untouched (it lives in the browser, not in the game files).
async function checkForUpdate() {
  if (!window.TL_VERSION || document.querySelector('.update-bar')) return;
  try {
    const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    const { v } = await r.json();
    if (!v || v === window.TL_VERSION) return;
    let dismissed = null; try { dismissed = localStorage.getItem('tourlife.updDismissed'); } catch {}
    if (dismissed === v) return; // closed for this version; the next update shows again
    const b = document.createElement('div');
    b.className = 'update-bar';
    b.innerHTML = `<button type="button" class="upgo">🎾 A new version of TourLife is ready. Tap to update.</button><button type="button" class="upx" aria-label="Close">×</button>`;
    b.querySelector('.upgo').onclick = () => { location.href = `${location.pathname}?v=${v}${location.hash}`; };
    b.querySelector('.upx').onclick = () => { try { localStorage.setItem('tourlife.updDismissed', v); } catch {} b.remove(); };
    document.body.appendChild(b);
  } catch {}
}
setTimeout(checkForUpdate, 3000);
setInterval(checkForUpdate, 5 * 60 * 1000);

// --- Send my player (Netlify Forms) ------------------------------------------------
// The matching hidden form is in index.html so Netlify picks it up when the site is deployed.

async function sendPlayer(contact, note) {
  const card = playerCard(), p = card.player, s = card.summary;
  const body = new URLSearchParams({
    'form-name': 'send-player', 'bot-field': '',
    player: p.name, nation: p.nation, ovr: s.ovr, rank: s.rank ? `#${s.rank}` : 'Unranked',
    record: `${s.wins}-${s.losses}, ${s.titles} titles, week ${s.week}`,
    contact, note, code: await encodeSave(card),
  });
  // On the live site the form posts to itself. Anywhere else (a copy on your own computer) it posts to
  // the live site; the browser can't read that reply, so a send that leaves without error counts as sent.
  const live = location.hostname.endsWith('.netlify.app');
  const res = await fetch(live ? '/' : 'https://tourlife-gatah.netlify.app/', { method: 'POST', mode: live ? 'same-origin' : 'no-cors',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
  if (live && !res.ok) throw new Error(`status ${res.status}`);
  const c = loadCareer();
  c.sentAt = Date.now();
  writeJSON(CAREER_KEY, c);
}

// --- Windows -----------------------------------------------------------------------

// "Join real tournaments": one box, one button. Kept as plain as possible.
function openShare() {
  const p = readJSON(SAVE_KEY), c = loadCareer();
  openModal(`<button type="button" class="x" id="mx" aria-label="Close">×</button>` +
    `<h2 class="itop">🎾 Join real tournaments</h2>` +
    `<p class="big">Put <b>${esc(p.name)}</b> into tournaments against players made by real people.</p>` +
    `<label class="lbl" for="shContact">Your name</label>` +
    `<input id="shContact" class="inp big" maxlength="80" placeholder="e.g. Mike from Leeds" value="${esc(c.sentBy || '')}">` +
    `<p class="hint">So we know whose player it is. Add a phone or email if you want to hear about results.</p>` +
    `<button type="button" class="btn huge" id="shSend">${c.sentAt ? `Send ${esc(p.name)} again` : `Join with ${esc(p.name)}`}</button>` +
    `<p class="big center" id="shSendMsg">${c.sentAt ? `✅ ${esc(p.name)} joined on ${new Date(c.sentAt).toLocaleDateString()}. Sending again updates your player.` : ''}</p>` +
    `<p class="hint center">That's it. Keep playing as normal.</p>`);
  $('mx').onclick = closeModal;
  $('shSend').onclick = async () => {
    const btn = $('shSend'), msg = $('shSendMsg'), who = $('shContact').value.trim();
    btn.disabled = true; btn.textContent = 'Sending…'; msg.textContent = '';
    try {
      await sendPlayer(who, '');
      const c2 = loadCareer(); c2.sentBy = who; writeJSON(CAREER_KEY, c2);
      btn.hidden = true;
      msg.innerHTML = `✅ <b>You're in!</b> ${esc(p.name)} has joined. Close this and keep playing.`;
    } catch {
      btn.disabled = false; btn.textContent = 'Try again';
      msg.textContent = "Sorry, that didn't go through. Check you're connected to the internet and press Try again.";
    }
  };
}

// Back up or move a career: the save code tools, for people who want them.
function openBackup() {
  const p = readJSON(SAVE_KEY), c = loadCareer();
  openModal(`<button type="button" class="x" id="mx" aria-label="Close">×</button>` +
    `<h2 class="itop">Move or back up my career</h2>` +
    `<section class="sh"><h3>📱 Play on another device</h3>` +
      `<p class="hint">Sends your career as a link. Open the link on your phone or computer and carry on where you left off.</p>` +
      `<button type="button" class="btn huge" id="shMove">Send my career to my other device</button>` +
      `<p class="hint" id="shMoveMsg"></p></section>` +
    `<section class="sh"><h3>Keep a copy</h3>` +
      `<p class="hint">Saves your whole career as a small file. Open it later (or on another computer or phone) to carry on.</p>` +
      `<button type="button" class="btn" id="shFile">Save a copy to this device</button>` +
      `<button type="button" class="link" id="shCopy">Or copy it as a code</button>` +
      `<textarea id="shCode" class="inp code" rows="3" readonly hidden></textarea></section>` +
    `<section class="sh"><h3>Open a copy</h3>${importHtml()}</section>`);
  $('mx').onclick = closeModal;
  bindImport();
  const codeP = encodeSave(fullSave());
  $('shMove').onclick = async () => {
    const url = await transferLink(), msg = $('shMoveMsg');
    if (navigator.share) {
      try { await navigator.share({ title: `${p.name}: TourLife career`, text: 'Open this to carry on my TourLife career:', url }); msg.textContent = '✅ Sent. Open the link on your other device.'; return; } catch {}
    }
    try { await navigator.clipboard.writeText(url); msg.innerHTML = '✅ Link copied. Paste it into a text or email to yourself, then open it on your other device.'; }
    catch { msg.innerHTML = `Copy this link and open it on your other device:<textarea class="inp code" rows="3" readonly>${url}</textarea>`; }
  };
  $('shFile').onclick = async () => {
    download(`${p.name.replace(/[^\w-]+/g, '_')}-week${c.week}.tourlife.txt`, await codeP);
    $('shFile').textContent = '✅ Saved (check your Downloads)';
  };
  $('shCopy').onclick = async () => {
    const code = await codeP, box = $('shCode');
    box.hidden = false; box.value = code;
    try { await navigator.clipboard.writeText(code); } catch { box.select(); document.execCommand('copy'); }
    $('shCopy').textContent = 'Copied!';
  };
}

function importHtml() {
  return `<p class="hint">Pick the file you saved. Your current career won't be lost.</p>` +
    `<label class="btn filebtn">Open a saved file<input type="file" id="imFile" accept=".txt,text/plain" hidden></label>` +
    `<details class="paste"><summary>Got a code instead?</summary>` +
    `<textarea id="imCode" class="inp code" rows="3" placeholder="Paste the code here"></textarea>` +
    `<button type="button" class="btn small" id="imGo">Open code</button></details>` +
    `<p class="hint" id="imMsg"></p>`;
}

function bindImport() {
  const go = async text => {
    try {
      const obj = await decodeSave(text);
      const what = obj.kind === 'career' ? `${obj.player.name}'s career (week ${(obj.career || {}).week || 1})` : `${obj.player.name} (new career)`;
      if (confirm(`Load ${what}?`)) importSave(obj);
    } catch (e) {
      $('imMsg').textContent = e.message.startsWith('That') || e.message.startsWith('This') ? e.message : "Couldn't read that code. Check it was copied in full.";
    }
  };
  $('imGo').onclick = () => go($('imCode').value);
  $('imFile').onchange = async e => { const f = e.target.files[0]; if (f) go(await f.text()); };
}

function openImport() {
  openModal(`<button type="button" class="x" id="mx" aria-label="Close">×</button>` +
    `<h2 class="itop">Open a saved career</h2>${importHtml()}`);
  $('mx').onclick = closeModal;
  bindImport();
}

// --- Real tournament results ---------------------------------------------------------
// The site owner publishes results.json from the Admin page. On load, any new result for this player is
// added to the career (points, record, history) and shown once.

const myPid = p => String(p.created || `${p.name}|${p.nation}`);

async function checkRealResults() {
  const p = readJSON(SAVE_KEY);
  if (!p || location.hash === '#admin') return;
  let data;
  try {
    const res = await fetch('results.json', { cache: 'no-store' });
    if (!res.ok) return;
    data = await res.json();
  } catch { return; }
  const c = loadCareer();
  c.realSeen = c.realSeen || [];
  const fresh = [];
  for (const ev of data.events || []) {
    if (c.realSeen.includes(ev.id)) continue;
    const r = (ev.results || []).find(x => x.pid === myPid(p));
    if (!r) continue;
    c.realSeen.push(ev.id);
    const wins = r.matches.filter(x => x.won).length;
    c.points += r.points; c.wins += wins; c.losses += r.matches.length - wins;
    if (r.reached === 'W' && !ev.exhibition) c.titles.push({ week: c.week, event: ev.id, city: ev.name, tier: ev.tier, real: true });
    c.history.push({ week: c.week, event: ev.id, city: ev.name, nation: ev.nation, tier: ev.tier, surface: ev.surface,
      reached: r.reached, points: r.points, matches: r.matches, real: true, exhibition: !!ev.exhibition });
    fresh.push({ ev, r });
  }
  if (!fresh.length) return;
  writeJSON(CAREER_KEY, c);
  checkBadges(c);
  if (current.career) current.career = c;
  if (!$('home').hidden) renderTournaments(current.player || p);
  const ROUND_TXT = { W: '🏆 Won the title!', F: 'Reached the final', SF: 'Reached the semi-finals', QF: 'Reached the quarter-finals', R16: 'Lost in the round of 16', R32: 'Lost in the first round' };
  openModal(`<button type="button" class="x" id="mx" aria-label="Close">×</button>` +
    `<h2 class="itop">🎾 Real tournament results</h2>` +
    fresh.map(({ ev, r }) => `<div class="card realres"><b>${esc(ev.name)}</b> <small>${ev.exhibition ? 'One-on-one' : tierLabel(ev.tier)} · ${surfaceLabel(ev.surface)}</small>` +
      `<p class="big">${ev.exhibition ? (r.reached === 'W' ? '🏆 You won the one-on-one!' : 'You lost the one-on-one') : `${ROUND_TXT[r.reached] || r.reached} · <b>+${r.points} pts</b>`}</p>` +
      `<ul class="tlog">${r.matches.map((x, mi) => `<li>${x.won ? '✅' : '❌'} ${x.round} vs ${flagOf(x.opponent.nation)} ${esc(x.opponent.name)}${x.opponent.real ? ' ⭐' : ''} · ${x.score}` +
        `${x.replay ? ` <button type="button" class="btn small rwbtn" data-ev="${esc(ev.id)}" data-mi="${mi}">▶ Watch</button>` : ''}</li>`).join('')}</ul>` +
      (r.reached !== 'W' ? `<small class="hint">Champion: ${esc(ev.champion)}</small>` : '') + `</div>`).join('') +
    `<p class="hint center">⭐ = another real player. The matches are in your Match History.</p>` +
    `<button type="button" class="btn" id="rrOk">Nice</button>`);
  $('mx').onclick = closeModal;
  $('rrOk').onclick = closeModal;
  $('sheet').querySelectorAll('.rwbtn').forEach(btn => {
    btn.onclick = () => { const f = fresh.find(x => x.ev.id === btn.dataset.ev); if (f) watchRealMatch(f.r.matches[+btn.dataset.mi]); };
  });
}
setTimeout(checkRealResults, 600);
