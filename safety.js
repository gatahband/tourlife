// safety.js — progress must never be lost.
//  1. Every save is mirrored to IndexedDB (a much larger store than localStorage). On start-up the two are
//     compared and the copy that's further along wins, automatically.
//  2. The browser is asked to keep the site's storage permanently (Safari otherwise clears unused sites).
//  3. Housekeeping on start-up keeps localStorage well under its limit.
//  4. "Find My Lost Progress" lists every copy of every career on this device and restores one in a tap.

const MIRROR_KEYS = ['player', 'career', 'entry', 'saves', 'backups', 'marks'].map(k => TL_NS + k); // this mode's saves (Coach Mode has its own)
const IDB_NAME = 'tourlife', IDB_STORE = 'kv';
let idbPromise = null;
function idb() {
  if (!idbPromise) idbPromise = new Promise((ok, fail) => {
    if (!window.indexedDB) return fail(new Error('no IndexedDB'));
    const r = indexedDB.open(IDB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(IDB_STORE);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fail(r.error);
  });
  return idbPromise;
}
// Fire-and-forget copy of one key (text = JSON string, or null to delete).
function idbPut(key, text) {
  if (!MIRROR_KEYS.includes(key)) return;
  idb().then(db => {
    const tx = db.transaction(IDB_STORE, 'readwrite'), st = tx.objectStore(IDB_STORE);
    if (text === null) st.delete(key); else st.put({ text, at: Date.now() }, key);
  }).catch(() => {});
}
function idbGetAll() {
  return idb().then(db => new Promise(ok => {
    const out = {}, tx = db.transaction(IDB_STORE, 'readonly'), st = tx.objectStore(IDB_STORE);
    const cur = st.openCursor();
    cur.onsuccess = () => { const c = cur.result; if (c) { out[c.key] = c.value; c.continue(); } else ok(out); };
    cur.onerror = () => ok(out);
  })).catch(() => ({}));
}
const parse = t => { try { return JSON.parse(t); } catch { return null; } };

// Start-up: if the mirror holds a further-along copy of the open career (a save that didn't make it into
// localStorage, or storage the browser cleared), bring it back without asking.
async function recoverFromMirror() {
  const all = await idbGetAll();
  const mP = all[SAVE_KEY] && parse(all[SAVE_KEY].text);
  const mC = all[CAREER_KEY] && parse(all[CAREER_KEY].text);
  if (!mP || !mC) { mirrorNow(); return; }
  const lP = readJSON(SAVE_KEY), lC = readJSON(CAREER_KEY);
  const mE = all[ENTRY_KEY] ? parse(all[ENTRY_KEY].text) : null;
  const sameCareer = !lP || (lP.created && lP.created === mP.created);
  const ahead = !lC || careerProgress(mC, mE) > careerProgress(lC, readJSON(ENTRY_KEY));
  if (sameCareer && ahead) {
    for (const k of [SAVE_KEY, CAREER_KEY, ENTRY_KEY]) if (all[k]) writeJSON(k, parse(all[k].text));
    if (!readJSON(SAVES_KEY) && all[SAVES_KEY]) writeJSON(SAVES_KEY, parse(all[SAVES_KEY].text));
    current.player = readJSON(SAVE_KEY); current.career = null; current.entry = null;
    if (typeof renderTournaments === 'function' && current.player) { renderTournaments(current.player); showScreen('home'); }
    setTimeout(() => toast('🛟 Progress recovered', `Brought back ${mP.name}'s latest save (season ${seasonOfWeek(mC.week)}, week ${weekInSeason(mC.week)}).`), 600);
  } else mirrorNow();
}
// Copy everything to the mirror now (first run, or after recovery checks).
function mirrorNow() { for (const k of MIRROR_KEYS) { const t = (k in PENDING) ? PENDING[k] : localStorage.getItem(k); if (t !== null) idbPut(k, t); } }

// Keep localStorage well under its ~5 MB limit: old seasons keep their results, not point-by-point detail.
function storageUsed() { let n = 0; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); n += k.length + (localStorage.getItem(k) || '').length; } } catch {} return n * 2; }
function housekeeping() {
  if (storageUsed() < 2.5e6) return;
  try {
    localStorage.removeItem('tourlife.odds');
    const c = readJSON(CAREER_KEY);
    if (c && c.history) { compactHistory(c); if (c.highlights) c.highlights = c.highlights.slice(-10); writeJSON(CAREER_KEY, c); }
    const saves = readJSON(SAVES_KEY) || [];
    for (const sv of saves) if (sv.career) { compactHistory(sv.career); if (sv.career.highlights) sv.career.highlights = sv.career.highlights.slice(-6); }
    if (saves.length) writeJSON(SAVES_KEY, saves);
  } catch {}
}

// --- Find My Lost Progress ------------------------------------------------------------------------
// Every copy of every career on this device (open, saved, safety backups, the mirror), furthest first.
async function findCopies() {
  const copies = [];
  const add = (src, player, career, entry) => { if (player && career) copies.push({ src, player, career, entry: entry || null, prog: careerProgress(career, entry) }); };
  add('Open now', readJSON(SAVE_KEY), readJSON(CAREER_KEY), readJSON(ENTRY_KEY));
  for (const sv of readJSON(SAVES_KEY) || []) add('Saved careers', sv.player, sv.career, sv.entry);
  for (const b of readJSON(BACKUPS_KEY) || []) add(`Safety backup (${b.reason})`, b.player, b.career, b.entry);
  const all = await idbGetAll();
  if (all[SAVE_KEY] && all[CAREER_KEY]) add('Backup store', parse(all[SAVE_KEY].text), parse(all[CAREER_KEY].text), all[ENTRY_KEY] && parse(all[ENTRY_KEY].text));
  for (const sv of (all[SAVES_KEY] && parse(all[SAVES_KEY].text)) || []) add('Backup store (saved careers)', sv.player, sv.career, sv.entry);
  return copies.sort((a, b) => b.prog - a.prog);
}
async function openRecovery() {
  const copies = await findCopies();
  const matchesOf = c => (c.career.history || []).reduce((n, h) => n + (h.matches || []).length, 0) + ((c.entry && c.entry.matches) || []).length;
  openModal(`<button type="button" class="x" id="mx" aria-label="Close">×</button><h2 class="itop">🔎 Find My Lost Progress</h2>` +
    `<p class="hint center">Every copy of your careers on this device, furthest along first. Restoring one keeps the career you have open as a backup.</p>` +
    (copies.length ? `<div class="bklist">${copies.map((c, i) => `<div class="bkrow"><span><b>${esc(c.player.name)}</b> · season ${seasonOfWeek(c.career.week || 1)}, week ${weekInSeason(c.career.week || 1)} · ${matchesOf(c)} matches` +
      `<small>${esc(c.src)}</small></span>${c.src === 'Open now' ? '<em class="hint">open</em>' : `<button type="button" class="btn small" data-rc="${i}">Restore</button>`}</div>`).join('')}</div>`
      : '<p class="hint center">No careers found on this device.</p>'));
  $('mx').onclick = closeModal;
  $('sheet').querySelectorAll('[data-rc]').forEach(b => { b.onclick = () => {
    const c = copies[+b.dataset.rc];
    importSave({ v: 1, kind: 'career', player: c.player, career: c.career, entry: c.entry, savedOn: 'restore' });
  }; });
}

// Start-up.
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch {}
housekeeping();
setTimeout(recoverFromMirror, 300);
