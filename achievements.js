// achievements.js — badges for milestones and great moments, shown on Home, with a pop-up when earned.

const BADGES = [
  { id: 'first_win', icon: '✅', name: 'First Win', desc: 'Win your first match.', match: r => r.won },
  { id: 'comeback', icon: '🔄', name: 'Comeback Kid', desc: 'Win a match after losing the first set.', match: r => r.won && r.sets[0] && r.sets[0].games[0] < r.sets[0].games[1] },
  { id: 'bagel', icon: '🥯', name: 'Bagel Baker', desc: 'Win a set 6-0.', match: r => r.sets.some(s => s.games[0] === 6 && s.games[1] === 0) },
  { id: 'marathon', icon: '⏱️', name: 'Marathon Man', desc: 'Win a match in a final-set tiebreak.', match: r => r.won && r.sets.length === 3 && !!r.sets[2].tb },
  { id: 'giant', icon: '🗡️', name: 'Giant Killer', desc: 'Beat the No. 1 or No. 2 seed.', match: r => r.won && r.opponent && r.opponent.seed && r.opponent.seed <= 2 },
  { id: 'rival', icon: '⚔️', name: 'Settling Scores', desc: 'Beat one of your rivals.', match: (r, c) => r.won && r.opponent && r.opponent.id && isRival(c, r.opponent.id) },
  { id: 'clutch', icon: '🧊', name: 'Ice in the Veins', desc: 'Win 3 big-point calls in one match.', match: r => r.calls && r.calls.won >= 3 },
  { id: 'student', icon: '🎓', name: 'Student of the Game', desc: 'Watch a whole match.', match: r => (r.watched || 0) >= 0.98 },
  { id: 'streak', icon: '🔥', name: 'On Fire', desc: 'Win 10 matches in a row.', career: c => winStreak(c) >= 10 },
  { id: 'title', icon: '🏆', name: 'Champion', desc: 'Win your first title.', career: c => c.titles.length >= 1 },
  { id: 'titles5', icon: '🏅', name: 'Trophy Cabinet', desc: 'Win 5 titles.', career: c => c.titles.length >= 5 },
  { id: 'titles10', icon: '👑', name: 'Serial Winner', desc: 'Win 10 titles.', career: c => c.titles.length >= 10 },
  { id: 'qualifier', icon: '🎟️', name: 'From Qualifying', desc: 'Win a title after coming through qualifying.', event: (e, res) => e.qualified && res.reached === ROUND_NAMES.length },
  { id: 'challenger', icon: '🥉', name: 'Challenger Champion', desc: 'Win a Challenger title.', career: c => c.titles.some(t => t.tier === 'CH75' || t.tier === 'CH125') },
  { id: 'tour', icon: '🥈', name: 'Tour Title', desc: 'Win an ATP 250 or 500 title.', career: c => c.titles.some(t => t.tier === 'ATP250' || t.tier === 'ATP500') },
  { id: 'masters', icon: '🥇', name: 'Masters Champion', desc: 'Win a Masters title.', career: c => c.titles.some(t => t.tier === 'M1000') },
  { id: 'slam', icon: '🏟️', name: 'Grand Slam Champion', desc: 'Win a Grand Slam.', career: c => c.titles.some(t => t.tier === 'GS') },
  { id: 'top100', icon: '💯', name: 'Top 100', desc: 'Reach the top 100.', career: c => (c.bestRank || 9999) <= 100 },
  { id: 'top10', icon: '🔟', name: 'Top 10', desc: 'Reach the top 10.', career: c => (c.bestRank || 9999) <= 10 },
  { id: 'no1', icon: '🌍', name: 'World No. 1', desc: 'Reach No. 1 in the world.', career: c => c.bestRank === 1 },
  { id: 'million', icon: '💰', name: 'Millionaire', desc: 'Earn $1,000,000 in prize money.', career: c => c.history.reduce((a, h) => a + (h.prize || 0), 0) >= 1e6 },
  { id: 'real', icon: '📨', name: 'The Real Deal', desc: 'Play in a real tournament against other people.', career: c => c.history.some(h => h.real) },
];

// Matches won in a row, most recent first (finished events plus the one in progress).
function winStreak(c) {
  const recs = [...c.history.flatMap(h => h.matches), ...((current.entry && current.entry.matches) || [])];
  let n = 0;
  for (let i = recs.length - 1; i >= 0 && recs[i].won; i--) n++;
  return n;
}

// Check everything that could have just been earned. ctx: { rec } after a match, { entry, result } after an event.
function checkBadges(c, ctx = {}) {
  c.badges = c.badges || {};
  const fresh = BADGES.filter(b => !c.badges[b.id] && (
    (b.match && ctx.rec && b.match(ctx.rec, c)) ||
    (b.event && ctx.entry && ctx.result && b.event(ctx.entry, ctx.result)) ||
    (b.career && b.career(c))));
  for (const b of fresh) c.badges[b.id] = c.week;
  if (fresh.length) { writeJSON(CAREER_KEY, c); fresh.forEach((b, i) => setTimeout(() => toast(`${b.icon} Achievement: ${b.name}`, b.desc), i * 2600)); }
  return fresh;
}

// A small pop-up at the top of the screen.
function toast(title, text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<b>${esc(title)}</b>${text ? `<small>${esc(text)}</small>` : ''}`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('on'));
  setTimeout(() => { el.classList.remove('on'); setTimeout(() => el.remove(), 400); }, 3200);
}

function renderBadges(c) {
  const got = c.badges || {};
  const n = BADGES.filter(b => got[b.id]).length;
  $('hBadgesTitle').textContent = `Achievements · ${n} of ${BADGES.length}`;
  $('hBadges').innerHTML = `<button type="button" class="btn small ghost hlbtn" id="bdHl">🎬 Big-match highlights (${(c.highlights || []).length})</button>` + BADGES.map(b => `<div class="badge${got[b.id] ? ' on' : ''}" title="${esc(b.name + ': ' + b.desc)}"><span>${b.icon}</span><b>${b.name}</b><small>${b.desc}</small>${got[b.id] ? `<small class="bdate">✓ Week ${weekInSeason(got[b.id])}, season ${seasonOfWeek(got[b.id])}</small>` : ''}</div>`).join('');
  $('bdHl').onclick = () => openHighlights();
}
