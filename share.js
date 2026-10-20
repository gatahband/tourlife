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
// Which device a save was made on (so a backup from this device can't be used to replay matches, while moving
// a career between your own devices always works).
function deviceId() {
  let id = null; try { id = localStorage.getItem('tourlife.device'); } catch {}
  if (!id) { id = Math.random().toString(36).slice(2, 10); try { localStorage.setItem('tourlife.device', id); } catch {} }
  return id;
}
const fullSave = () => { const p = readJSON(SAVE_KEY); return { v: 1, kind: 'career', player: p, sig: fingerprint(p), career: readJSON(CAREER_KEY), entry: readJSON(ENTRY_KEY), savedOn: deviceId() }; };

// Just the player and a short summary: small enough to send in a form.
function playerCard() {
  const p = readJSON(SAVE_KEY), c = loadCareer();
  return { v: 1, kind: 'player', player: p, sig: fingerprint(p),
    summary: { week: c.week, rank: currentRank(c), bestRank: c.bestRank || null, points: rankingPoints(c), wins: c.wins, losses: c.losses, titles: c.titles.length, ovr: +overall(p).toFixed(1) } };
}

// Import: becomes a saved career and is loaded. A player card starts a fresh career with that player.
// --- Safety backups ---------------------------------------------------------------------------------
// Before anything that replaces or removes a career (loading a save, switching or starting a career,
// deleting a saved one), the career is copied here first. The last 3 are kept and can be restored any time,
// so progress is never lost to a load or a mis-tap.
const BACKUPS_KEY = 'tourlife.backups';
const loadBackups = () => readJSON(BACKUPS_KEY) || [];
function autoBackup(snap, reason) {
  if (!snap || !snap.player || !snap.career) return;
  const list = loadBackups();
  // A trimmed copy (old seasons' matches keep their results but not point-by-point detail) to save room.
  const career = JSON.parse(JSON.stringify(snap.career));
  if (career.history) compactHistory(career);
  if (career.highlights) career.highlights = career.highlights.slice(-4);
  list.push({ at: Date.now(), reason, player: snap.player, career, entry: snap.entry || null });
  // Keep the newest 3, and drop the oldest if the browser runs short of room.
  let keep = list.slice(-3);
  for (;;) { try { localStorage.setItem(BACKUPS_KEY, JSON.stringify(keep)); break; } catch { if (keep.length <= 1) break; keep = keep.slice(1); } }
}
const backupLive = reason => autoBackup({ player: readJSON(SAVE_KEY), career: readJSON(CAREER_KEY), entry: readJSON(ENTRY_KEY) }, reason);
function backupsHtml() {
  const list = loadBackups().slice().reverse();
  if (!list.length) return '<p class="hint">None yet. One is made automatically before you load a save, switch or start a career, or delete one.</p>';
  return `<div class="bklist">${list.map((b, i) => `<div class="bkrow"><span><b>${esc(b.player.name)}</b> · season ${seasonOfWeek(b.career.week || 1)}, week ${weekInSeason(b.career.week || 1)}` +
    `<small>${esc(b.reason)} · ${new Date(b.at).toLocaleString()}</small></span><button type="button" class="btn small ghost" data-bk="${list.length - 1 - i}">Restore</button></div>`).join('')}</div>`;
}
function restoreBackup(i) {
  const b = loadBackups()[i];
  if (!b || !confirm(`Restore ${b.player.name} (season ${seasonOfWeek(b.career.week || 1)}, week ${weekInSeason(b.career.week || 1)})? The career you have open now is backed up first.`)) return;
  importSave({ v: 1, kind: 'career', player: b.player, career: b.career, entry: b.entry, savedOn: 'restore' });
}

function importSave(obj) {
  if (olderThanMark(obj)) {
    const here = (readJSON(CAREER_KEY) || {}).week, there = (obj.career || {}).week;
    const when = w => w ? `season ${seasonOfWeek(w)}, week ${weekInSeason(w)}` : 'an earlier point';
    // A backup made on this device: no going back to replay matches.
    if (obj.savedOn && obj.savedOn === deviceId()) { alert(`This backup was made on this device and is behind where you are now (${when(here)}), so it can't be loaded. Matches can't be replayed from a backup.`); return; }
    // From another device: fine, but say that it's behind the copy here.
    if (!confirm(`The copy of this career on this device is further along (${when(here)}) than the one you're loading (${when(there)}). Load the other device's copy anyway? The copy here is kept in your saved careers as "(newer copy)" so you can switch back.`)) return;
    clearMark(obj);
  }
  backupLive(`Before loading ${obj.player && obj.player.name ? obj.player.name + "'s" : 'a'} save`); // never lose the career open now
  // A full career keeps its id (loading your own backup replaces it); a player card always starts a new slot.
  const id = obj.kind === 'career' && obj.player.created || Date.now();
  // If the copy here is further along than the one coming in, never throw it away: keep it in your saved
  // careers as its own entry, so you can switch back to it.
  const live = readJSON(SAVE_KEY), liveC = readJSON(CAREER_KEY);
  const keepNewer = live && live.created === id && liveC && careerProgress(liveC, readJSON(ENTRY_KEY)) > careerProgress(obj.career || {}, obj.entry);
  if (keepNewer) {
    const kid = Date.now();
    const saves0 = loadSaves();
    saves0.push({ id: kid, player: { ...live, created: kid, name: `${live.name} (newer copy)` }, career: liveC, entry: readJSON(ENTRY_KEY), savedAt: Date.now() });
    writeJSON(SAVES_KEY, saves0);
    for (const k of [SAVE_KEY, CAREER_KEY, ENTRY_KEY]) writeJSON(k, null);
  } else shelveLive();
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

// "Join Real Tournaments": one box, one button. Kept as plain as possible.
// First time: a short walkthrough of real tournaments and match orders (again any time from the window).
const SHARE_TOUR = [
  ['🎾', 'Real Tournaments', 'Send your player in and they get entered into tournaments against characters made by other real people. Every match is played out live and streamed, one at a time.'],
  ['📋', 'Your Match Orders', "You won't be there when your matches are played, so you decide ahead of time. In My Match Orders, set a full game plan for each type of opponent: Big Servers, Baseline Attackers, Grinders, Net Rushers and Crafty All-Courters."],
  ['🔁', 'If You Lose A Set', 'Choose Keep My Plan, or Change It Up to switch between attacking and patient play once per match. When it kicks in, the stream shows it.'],
  ['📨', 'Send Again After Changes', 'Changed your orders or got better? Send your player again and the tournament uses the new version. Results and ranking points come back into your game on their own.'],
];
function openShareTour(i = 0) {
  const [icon, title, text] = SHARE_TOUR[i], last = i === SHARE_TOUR.length - 1;
  openModal(`<div class="help welcome"><div class="helpicon">${icon}</div><h2 class="itop">${title}</h2><p class="big">${text}</p>` +
    `<div class="helpdots">${SHARE_TOUR.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('')}</div>` +
    `<button type="button" class="btn huge" id="stNext">${last ? 'Got It' : 'Next'}</button></div>`);
  $('stNext').onclick = () => { if (last) { markTip('share'); openShare(); } else openShareTour(i + 1); };
}
function openShare() {
  if (!tipsSeen().share) return openShareTour(0);
  const p = readJSON(SAVE_KEY), c = loadCareer();
  openModal(`<button type="button" class="x" id="mx" aria-label="Close">×</button>` +
    `<h2 class="itop">🎾 Join Real Tournaments</h2>` +
    `<p class="big">Put <b>${esc(p.name)}</b> into tournaments against players made by real people.</p>` +
    `<label class="lbl" for="shContact">Your Name</label>` +
    `<input id="shContact" class="inp big" maxlength="80" placeholder="e.g. Mike from Leeds" value="${esc(c.sentBy || '')}">` +
    `<p class="hint">So we know whose player it is. Add a phone or email if you want to hear about results.</p>` +
    `<button type="button" class="btn huge" id="shSend">${c.sentAt ? `Send ${esc(p.name)} Again` : `Join With ${esc(p.name)}`}</button>` +
    `<p class="big center" id="shSendMsg">${c.sentAt ? `✅ ${esc(p.name)} joined on ${new Date(c.sentAt).toLocaleDateString()}. Sending again updates your player.` : ''}</p>` +
    `<button type="button" class="btn ghost" id="shOrders">📋 My Match Orders${p.orders ? ' ✓' : ''}</button>` +
    `<p class="hint center">Optional: tell your player how to play each type of opponent. Then send again.</p>` +
    `<p class="hint center">That's it. Keep playing as normal.</p>` +
    `<div class="center"><button type="button" class="link" id="shHow">❓ How This Works</button></div>`);
  $('mx').onclick = closeModal;
  $('shOrders').onclick = () => openOrders(openShare);
  $('shHow').onclick = () => openShareTour(0);
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
    `<section class="sh"><h3>📱 Play On Another Device</h3>` +
      `<p class="hint">Sends your career as a link. Open the link on your phone or computer and carry on where you left off.</p>` +
      `<button type="button" class="btn huge" id="shMove">Send my career to my other device</button>` +
      `<p class="hint" id="shMoveMsg"></p></section>` +
    `<section class="sh"><h3>Keep a copy</h3>` +
      `<p class="hint">Saves your whole career as a small file. Open it later (or on another computer or phone) to carry on.</p>` +
      `<button type="button" class="btn" id="shFile">Save a copy to this device</button>` +
      `<button type="button" class="link" id="shCopy">Or copy it as a code</button>` +
      `<textarea id="shCode" class="inp code" rows="3" readonly hidden></textarea></section>` +
    `<section class="sh"><h3>Open a copy</h3>${importHtml()}</section>` +
    `<section class="sh"><h3>🛟 Safety backups</h3><p class="hint">Made automatically before anything that could replace a career. Tap Restore to go back to one.</p>${backupsHtml()}</section>`);
  $('mx').onclick = closeModal;
  $('sheet').querySelectorAll('[data-bk]').forEach(b => { b.onclick = () => restoreBackup(+b.dataset.bk); });
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

// --- Share my build -----------------------------------------------------------------------------
// A picture card of your build (overall, level, playstyle, stats, style fit) to post or send.
async function shareBuild(p) {
  const W = 1080, H = 1720, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d'), F = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const ovr = overall(p), lv = levelOf(ovr), styles = detectStyles(p.attrs, p.fav, planOf(p)), st = styleOf(p);
  const bg = x.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#0d1420'); bg.addColorStop(1, '#151b2a');
  x.fillStyle = bg; x.fillRect(0, 0, W, H);
  const grad = (x0, x1) => { const g = x.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, '#0a84ff'); g.addColorStop(0.5, '#bf5af2'); g.addColorStop(1, '#ff375f'); return g; };
  const rr = (X, Y, w, h, r) => { x.beginPath(); x.roundRect ? x.roundRect(X, Y, w, h, r) : x.rect(X, Y, w, h); };
  // Header: name, nation, overall badge, level.
  x.fillStyle = '#f5f5f7'; x.font = `800 64px ${F}`; x.fillText(p.name, 80, 140);
  x.fillStyle = '#8e8e93'; x.font = `500 32px ${F}`;
  x.fillText(`${(nationInfo(p.nation) || [p.nation, '', p.nation])[2]} · ${p.hand === 'left' ? 'Left' : 'Right'}-handed · Age ${p.age || 18}`, 80, 190);
  rr(80, 240, 220, 220, 44); x.fillStyle = grad(80, 300); x.fill();
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = `800 92px ${F}`; x.fillText(ovr.toFixed(1), 190, 360); x.font = `700 30px ${F}`; x.fillText('OVR', 190, 410);
  x.textAlign = 'left'; x.fillStyle = '#f5f5f7'; x.font = `800 52px ${F}`; x.fillText(lv.name, 340, 320);
  x.fillStyle = '#c7c7cc'; x.font = `500 30px ${F}`;
  const wrap = (t, X, Y, w, lh) => { let line = ''; for (const word of t.split(' ')) { const tr = line ? line + ' ' + word : word; if (x.measureText(tr).width > w) { x.fillText(line, X, Y); Y += lh; line = word; } else line = tr; } x.fillText(line, X, Y); return Y; };
  wrap(lv.note, 340, 370, 660, 40);
  // Playstyle.
  x.fillStyle = '#8e8e93'; x.font = `700 26px ${F}`; x.fillText('PLAYSTYLE', 80, 540);
  x.fillStyle = '#ffd60a'; x.font = `800 50px ${F}`; x.fillText(st.name, 80, 600);
  x.fillStyle = '#c7c7cc'; x.font = `500 28px ${F}`; wrap(st.desc, 80, 645, 920, 36);
  // Seven stats.
  let y = 740;
  for (const [k, label] of ATTRS) {
    const v = p.attrs[k];
    x.fillStyle = '#f5f5f7'; x.font = `600 28px ${F}`; x.fillText(label, 80, y);
    x.textAlign = 'right'; x.fillText(v.toFixed(1), 1000, y); x.textAlign = 'left';
    rr(80, y + 12, 920, 14, 7); x.fillStyle = '#2a3140'; x.fill();
    rr(80, y + 12, 920 * clamp(v / 99, 0.02, 1), 14, 7); x.fillStyle = grad(80, 1000); x.fill();
    y += 62;
  }
  // Top style fits.
  y += 20; x.fillStyle = '#8e8e93'; x.font = `700 26px ${F}`; x.fillText('HOW THE BUILD FITS EACH STYLE', 80, y); y += 40;
  for (const s of styles.slice(0, 3)) {
    x.fillStyle = '#c7c7cc'; x.font = `600 26px ${F}`; x.fillText(s.name, 80, y);
    rr(420, y - 18, 480, 14, 7); x.fillStyle = '#2a3140'; x.fill();
    rr(420, y - 18, 480 * clamp(s.score, 0.02, 1), 14, 7); x.fillStyle = grad(420, 900); x.fill();
    x.fillStyle = '#c7c7cc'; x.textAlign = 'right'; x.fillText(`${Math.round(s.score * 100)}%`, 1000, y); x.textAlign = 'left'; y += 44;
  }
  // This season's six numbers.
  const ss = typeof seasonNumbers === 'function' ? seasonNumbers(current.career || loadCareer()) : null;
  y += 26; x.fillStyle = '#8e8e93'; x.font = `700 26px ${F}`; x.textAlign = 'left';
  x.fillText(`SEASON ${seasonOfWeek((current.career || loadCareer()).week)} STATS${ss ? ` · ${ss.wins}–${ss.matches - ss.wins}` : ''}`, 80, y); y += 24;
  if (ss) SEASON_STATS.forEach(([k, label, kind], i) => {
    const cx = 80 + (i % 3) * 310, cy = y + Math.floor(i / 3) * 120;
    rr(cx, cy, 290, 104, 18); x.fillStyle = '#1f2633'; x.fill();
    x.fillStyle = '#f5f5f7'; x.font = `800 44px ${F}`; x.fillText(fmtStat(ss[k], kind), cx + 20, cy + 56);
    x.fillStyle = '#8e8e93'; x.font = `600 20px ${F}`; x.fillText(label.toUpperCase(), cx + 20, cy + 88);
  });
  else { x.fillStyle = '#8e8e93'; x.font = `500 26px ${F}`; x.fillText('No matches yet this season.', 80, y + 40); }
  x.fillStyle = '#0a84ff'; x.font = `800 32px ${F}`; x.textAlign = 'center'; x.fillText('🎾 TourLife', W / 2, H - 50); x.textAlign = 'left';
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  const file = new File([blob], `${p.name.replace(/[^a-z0-9]+/gi, '-')}-build.png`, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: `${p.name}'s TourLife build`, text: `${p.name}: ${ovr.toFixed(1)} OVR ${lv.name}, ${st.name}` }); return; } catch {}
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('📸 Build saved', 'The picture is in your downloads.');
}
