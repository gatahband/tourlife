// phonegame.js — Phones: the match as a game screen. Held sideways, the court and its controls take over the whole
// screen (nothing else from the page shows, and the controls sit beside the court, not on it). Held upright while a
// match is playing, it asks you to turn the phone (iPhones can't be turned by a web page), with a way to carry on
// upright. On Android, choosing how to play also tries real full screen, locked sideways.
const PG_UPRIGHT_KEY = 'tourlife.pgUpright'; // (this visit only) you chose to keep playing upright
const pgSS = (k, v) => { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch { return null; } };
// A phone: a touch screen whose short side is phone-sized (tablets keep the normal page). Tests can force it.
const pgPhone = () => !!pgSS('tourlife.pgTest') || matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) <= 520;
// The match is on court: a set playing, a decision, a set break or the result (not the choose-how-to-play page).
function pgInPlay() {
  const scr = document.getElementById('match');
  if (!scr || scr.hidden) return false;
  const box = document.getElementById('mCallBox'), bb = document.getElementById('mBreak'), L = current.entry && current.entry.live;
  return typeof anim !== 'undefined' && anim.running || !!(box && !box.hidden) || !!(bb && !bb.hidden) || !!(L && L.inSet);
}
let pgLast = '';
function pgTick() {
  const on = pgPhone() && pgInPlay(), land = innerWidth > innerHeight, body = document.body;
  const box = document.getElementById('mCallBox'), wrap = document.getElementById('mCourtWrap'), cv = document.getElementById('court');
  const game = on && land, upright = on && !land && !pgSS(PG_UPRIGHT_KEY);
  const deciding = game && !!box && !box.hidden && box.classList.contains('ho');
  const board = document.getElementById('mBoard'), bh0 = game && board ? board.offsetHeight : 0;
  const key = `${game}|${upright}|${deciding}|${innerWidth}x${innerHeight}|${typeof Court !== 'undefined' && Court.view}|${bh0}`;
  if (key === pgLast) return;
  pgLast = key;
  body.classList.toggle('phgame', game);
  body.classList.toggle('phdecide', deciding);
  pgTurnNotice(upright);
  if (typeof Court === 'undefined' || !wrap || !cv) return;
  if (bh0) body.style.setProperty('--pgbh', `${bh0 + 8}px`); // (the right-hand buttons start below the score)
  if (!game) {
    if (Court.fit) { cv.style.position = cv.style.left = cv.style.top = ''; Court.fit = null; }
    return;
  }
  // The court as big as it fits: between the two control columns, or (while you choose a shot) in the left part,
  // with the choice beside it.
  const side = parseFloat(getComputedStyle(body).getPropertyValue('--pgside')) || 112;
  const W = wrap.clientWidth, H = wrap.clientHeight, left = deciding ? Math.round(W * 0.42) : W - 2 * side;
  const bh = deciding ? (document.getElementById('mBoard').offsetHeight || 0) + 6 : 0; // (the score sits above the court then)
  Court.fit = { w: left - 8, h: H - 4 - 2 * bh };
  const cw = cv.clientWidth, ch = cv.clientHeight;
  cv.style.position = 'absolute';
  cv.style.left = `${Math.round(deciding ? (left - cw) / 2 : (W - cw) / 2)}px`;
  cv.style.top = `${Math.max(0, Math.round((H - ch) / 2))}px`;
}
// "Turn your phone sideways", over the match while it's upright.
function pgTurnNotice(show) {
  let el = document.getElementById('pgTurn');
  if (!show) { if (el) el.hidden = true; return; }
  if (!el) {
    el = document.createElement('div'); el.id = 'pgTurn'; el.className = 'pgturn';
    el.innerHTML = `<div class="pgphone" aria-hidden="true">📱</div><h2>Turn Your Phone Sideways</h2>` +
      `<p>The match plays across the whole screen. If your phone won't turn, check that its rotation lock is off.</p>` +
      `<button type="button" class="btn ghost" id="pgUpright">Keep Playing Upright</button>`;
    document.body.appendChild(el);
    el.querySelector('#pgUpright').onclick = () => { pgSS(PG_UPRIGHT_KEY, '1'); pgLast = ''; pgTick(); };
  }
  el.hidden = false;
}
// Android: real full screen, held sideways, once you choose to play (it needs a tap to be allowed). iPhones ignore it.
document.addEventListener('click', e => {
  if (!pgPhone() || !e.target.closest('[data-mode], [data-nb], #mWatch, #mWatchSet')) return;
  const de = document.documentElement;
  if (document.fullscreenElement || !de.requestFullscreen) return;
  de.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape')).catch(() => {});
}, true);
setInterval(pgTick, 250);
addEventListener('resize', () => { pgLast = ''; pgTick(); });
addEventListener('orientationchange', () => { pgLast = ''; setTimeout(pgTick, 150); });
