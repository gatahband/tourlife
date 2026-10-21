// fairplay.js — keeps progress honest. You can't shortcut your way to the top:
//  • Diminishing returns: the higher a stat, the less each gain adds, up to a hard cap of 95.
//  • Burnout: training week after week without playing makes each extra week count for less.
//  • Match rust: weeks without a match (outside the off-season) make you play worse until you've
//    shaken it off over a few matches. Training all year and then turning up doesn't work.
//  • Tamper check: player codes carry a fingerprint, so the Admin page can flag edited players.
//  • Storage: old seasons' matches are trimmed so saves don't outgrow the browser.

const STAT_CAP = 95;

// Share of a gain that sticks at this stat level: full at 50, about half at 72, none at the cap.
// Growth slows as a stat climbs, and steeply near the top: the last stretch to the cap is a real grind.
// Tuned with tools/progress-sim.html: about 4–5 h of ITF, about 20 h to 95 for a player who plays their matches.
const growthFactor = v => v >= STAT_CAP ? 0 : Math.max(0.06, Math.pow(clamp((STAT_CAP - v) / 45, 0, 1), 0.7));

function applyGain(attrs, k, gain) { attrs[k] = gainedValue(attrs, k, gain); }
// The value a stat would reach from a gain (growth slows near the cap and past your Tactical rating's cap).
function gainedValue(attrs, k, gain) {
  const v = attrs[k] ?? 50;
  // Your Tactical rating (reads.js) limits how far your stats grow: past its cap, gains slow to a trickle.
  if (typeof tacticalCap === 'function' && typeof current !== 'undefined' && current.career && current.player && current.player.attrs === attrs
    && overall({ attrs }) >= tacticalCap(current.career)) gain *= 0.1;
  return Math.min(STAT_CAP, Math.round(v * (1 + gain * growthFactor(v)) * 1000) / 1000);
}

// In-season weeks in a row without playing an event (set by noteWeek at the end of each week).
const idleWeeks = c => c.idleWeeks || 0;

// Training gains: the first idle week counts fully, then each extra one 40% less than the last (burnout).
const burnout = c => Math.pow(typeof hasTeam === 'function' && hasTeam(c, 'fitness') ? 0.75 : 0.6, Math.max(0, idleWeeks(c) - 1)); // a fitness trainer slows it

// Match rust: builds after two idle weeks (0.6% on points a week, up to 4%), and each match you
// play knocks 1.2% off it.
const RUST_STEP = 0.006, RUST_MAX = 0.04, RUST_SHAKE = 0.012;
const rustOf = c => c.rust || 0;

// A week only counts as played if you actually played a match in it. Entering and pulling out before
// your first match doesn't reset burnout.
function noteWeek(c) {
  const played = c.history.some(h => h.week === c.week && !h.exhibition && (h.matches || []).length > 0);
  if (played) c.idleWeeks = 0;
  else if (!isOffSeason(c.week)) {
    c.idleWeeks = idleWeeks(c) + 1;
    if (c.idleWeeks > 2) c.rust = Math.min(RUST_MAX, rustOf(c) + RUST_STEP);
  }
}

// --- No save-scumming ---------------------------------------------------------------------------
// Every career's furthest point on this device (week, matches, sets) is remembered. An older copy of the
// same career can't be loaded over it, so you can't replay a lost match from a backup.
const MARK_KEY = 'tourlife.marks';
function careerProgress(c, entry) {
  const matches = (c.history || []).reduce((n, h) => n + (h.matches || []).length, 0) + ((entry && entry.matches) || []).length;
  const sets = entry && entry.live && entry.live.m ? entry.live.m.sets.length : 0;
  return (c.week || 0) * 100000 + matches * 10 + sets;
}
function noteMark() {
  const p = current.player, c = current.career;
  if (!p || !c || !p.created) return;
  const marks = readJSON(MARK_KEY) || {}, v = careerProgress(c, current.entry);
  if (!(marks[p.created] >= v)) { marks[p.created] = v; writeJSON(MARK_KEY, marks); }
}
// After choosing another device's (earlier) copy, that copy becomes the furthest point on this device.
function clearMark(obj) {
  const marks = readJSON(MARK_KEY) || {};
  if (obj.player && obj.player.created) { marks[obj.player.created] = careerProgress(obj.career || {}, obj.entry); writeJSON(MARK_KEY, marks); }
}
function olderThanMark(obj) {
  if (obj.kind !== 'career' || !obj.player || !obj.player.created || !obj.career) return false;
  const marks = readJSON(MARK_KEY) || {};
  return marks[obj.player.created] > careerProgress(obj.career, obj.entry);
}

function shakeRust(c) {
  c.rust = Math.max(0, rustOf(c) - RUST_SHAKE);
}

const rustText = c => rustOf(c) >= 0.001 ? `Match rust: −${(rustOf(c) * 100).toFixed(1)}% on points until you've played a few matches.` : '';

// --- Tamper check -------------------------------------------------------------------------

// A fingerprint of the player's stats and identity (FNV-1a). Editing a code breaks it.
function fingerprint(p) {
  const text = `tl|${p.name}|${p.nation}|${p.created}|${ATTR_KEYS.map(k => (p.attrs[k] ?? 0).toFixed(3)).join(',')}|gatah`;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

// Admin: anything that looks off about a sent-in player. Returns a list of reasons (empty = fine).
function suspicious(rec) {
  const p = rec.player, s = rec.summary || {}, why = [];
  if (rec.sig !== undefined && rec.sig !== fingerprint(p)) why.push('stats were edited');
  if (rec.sig === undefined) why.push('no fingerprint (sent from an old version)');
  if (ATTR_KEYS.some(k => (p.attrs[k] ?? 0) > STAT_CAP)) why.push(`a stat above ${STAT_CAP}`);
  // A player can only have grown so much in the weeks they've played.
  const weeks = s.week || 1, ovr = overall(p);
  if (ovr > 55 + weeks * 0.35) why.push(`OVR ${ovr.toFixed(1)} is too high for ${weeks} weeks played`);
  return why;
}

// --- Storage ------------------------------------------------------------------------------

// The stats older matches keep (enough for career totals and percentages).
const KEEP_STATS = ['points', 'servePts', 'firstIn', 'firstWon', 'secondWon', 'df', 'aces', 'bpChances', 'bpWon', 'bpFaced', 'bpSaved', 'winners', 'ue', 'svcGames', 'svcHeld'];
const keepStats = st => st && Object.fromEntries(KEEP_STATS.filter(k => st[k] !== undefined).map(k => [k, st[k]]));

// Matches from before last season keep the result, score, sets and key stats; the rest is dropped.
function compactHistory(c) {
  const keepFrom = seasonOfWeek(c.week) - 1;
  for (const h of c.history) {
    if (seasonOfWeek(h.week) >= keepFrom) continue;
    h.matches = h.matches.map(m => m.compact ? m : {
      compact: true, round: m.round, won: m.won, score: m.score, real: m.real,
      opponent: m.opponent && { name: m.opponent.name, nation: m.opponent.nation, id: m.opponent.id, seed: m.opponent.seed },
      sets: m.sets, styles: m.styles, stats: keepStats(m.stats), oppStats: keepStats(m.oppStats), moments: [],
    });
  }
}
