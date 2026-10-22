// coachmode.js — Coach Mode: you're the full-time coach of one player and guide them through the tour. You pick
// their schedule, training and game plans, and talk to them between sets, but they play the points and make the
// big-point calls themselves. How closely they follow your plan depends on how much they trust you, and trust is
// earned: plans that win build it, plans that lose cost it. Lose it completely and you're fired.
// Coach Mode saves live under their own keys (names.js TL_NS), so a player career is never touched.

const TRUST_START = 55, TRUST_FIRED = 12;
const trustOf = c => c.trust ?? TRUST_START;
const trustWord = t => t >= 80 ? 'Total Belief' : t >= 65 ? 'Strong' : t >= 45 ? 'Solid' : t >= 30 ? 'Shaky' : 'On Thin Ice';

// The plan your player would choose on their own: their playstyle's natural game, signature play switched on.
function ownPlan(p) {
  const st = styleOf(p).name;
  return { ...DEFAULT_PLAN, ...previewPlan(st), ...(SIGNATURE[st] ? { sig: 'on' } : {}), ...(st === 'Creative Shotmaker' ? { underarm: 'rarely' } : {}) };
}
// Chance they follow each instruction that differs from their own way of playing.
const followChance = (c, p) => clamp(0.3 + 0.006 * trustOf(c) + 0.004 * (attr(p, 'iq') - 60), 0.2, 0.97);

// At the start of each set: your plan, filtered through what they're willing to do. Seeded, so a refreshed set
// plays out the same way. Returns the plan they'll actually play and what they did with your instructions.
function coachFollow(c, p, plan, rng) {
  const own = ownPlan(p), f = followChance(c, p), out = { ...plan }, ignored = [];
  let asked = 0;
  for (const g of GAME_PLAN) {
    const want = plan[g.key] ?? DEFAULT_PLAN[g.key], theirs = own[g.key] ?? DEFAULT_PLAN[g.key];
    if (want === theirs) continue;
    asked++;
    if (rng() >= f) { out[g.key] = theirs; ignored.push({ key: g.key, label: g.label, wanted: want, kept: theirs }); }
  }
  return { plan: out, asked, followed: asked - ignored.length, ignored };
}
function followText(name, r) {
  if (!r.asked) return `📋 ${name} is playing the plan exactly as you set it (it's their natural game anyway).`;
  if (!r.ignored.length) return r.asked === 1 ? `📋 ${name} is following your instruction.` : `📋 ${name} is following all ${r.asked} of your instructions.`;
  return `📋 ${name} is following ${r.followed} of your ${r.asked} instructions. Doing it their way: ` +
    r.ignored.map(x => `${x.label} (${planLabel(x.key, x.kept)}, not ${planLabel(x.key, x.wanted)})`).join(', ') + '.';
}

// After a match: trust moves with the result, and more when they did it your way.
function coachAfterMatch(c, p, won, fol) {
  const t0 = trustOf(c), share = fol && fol.asked ? fol.followed / fol.asked : 0.5;
  let d = won ? 4 : -3;
  if (fol && fol.asked) d += won ? 2 * share : -2 * share; // your plan, your credit (or your blame)
  c.trust = clamp(Math.round((t0 + d) * 10) / 10, 0, 100);
  const name = (p.name || 'Your player').split(' ')[0];
  c.trustNote = d >= 0 ? `🤝 ${name}'s trust in you went up (${trustWord(c.trust)}).` : `😬 ${name}'s trust in you dropped (${trustWord(c.trust)}).`;
  if (c.trust < TRUST_FIRED) c.fired = true;
}

// Home in Coach Mode: who you coach, how much they trust you and what you've earned (10% of their prize money).
function coachBannerHtml(c, p) {
  const t = trustOf(c), earned = Math.round(c.history.reduce((a, h) => a + (h.prize || 0), 0) * 0.1);
  return `<div class="coachbar"><div class="cbtop"><span>🧑‍🏫 You Coach</span><b>${esc(p.name)}</b><small>${esc(styleOf(p).name)} · Age ${p.age || 18}</small></div>` +
    `<div class="cbtrust"><div class="cbtlabel"><span>Trust In You</span><b>${Math.round(t)} · ${trustWord(t)}</b></div><div class="cbbar"><i style="width:${t}%"></i></div>` +
    `<small>They follow about ${Math.round(followChance(c, p) * 100)}% of the instructions that go against their natural game. Plans that win build trust; below ${TRUST_FIRED}, you're fired.</small></div>` +
    `<div class="cbfoot"><span>💰 Your earnings: <b>${money(earned)}</b> (10% of their prize money)</span></div></div>`;
}
function renderCoachBits(c, p) {
  const el = $('hCoach');
  if (!el) return;
  el.hidden = !isCoachMode();
  if (!isCoachMode()) return;
  el.innerHTML = coachBannerHtml(c, p);
  if (c.trustNote) { const n = c.trustNote; c.trustNote = null; writeJSON(CAREER_KEY, c); toast(n); }
  if (c.fired && !current.entry) setTimeout(() => openFired(c, p), 60);
}
function openFired(c, p) {
  openModal(`<h2 class="itop">📄 You've Been Let Go</h2>` +
    `<p class="big center">${esc(p.name)} has lost faith in your coaching and decided to part ways.</p>` +
    `<p class="hint center">Your record together: ranked ${currentRank(c) ? `#${currentRank(c)}` : 'unranked'}, best ranking ${c.bestRank ? `#${c.bestRank}` : '–'}. Every coach gets fired sometime. Take what you learned to a new player.</p>` +
    `<button type="button" class="btn" id="cfNew">🧑‍🏫 Coach A New Player</button><button type="button" class="link" id="cfMode">🎾 Back To Player Mode</button>`, { wide: true });
  $('cfNew').onclick = () => { for (const k of [SAVE_KEY, CAREER_KEY, ENTRY_KEY]) writeJSON(k, null); location.reload(); };
  $('cfMode').onclick = () => setGameMode('player');
}

// Switching modes: each mode keeps its own saves, so nothing is lost either way.
function setGameMode(mode) {
  try { localStorage.setItem('tourlife.mode', mode); } catch {}
  location.reload();
}
function modeSwitchHtml(where) {
  if (!isCoachMode()) return ''; // Coach Mode is on hold: no way in (anyone already in it can still switch back)
  return isCoachMode()
    ? `<button type="button" class="btn ghost modeswitch" data-mode-switch="player">🎾 Switch To Player Mode<small>Your player career is saved and waiting</small></button>`
    : `<button type="button" class="btn ghost modeswitch" data-mode-switch="coach">🧑‍🏫 Try Coach Mode<small>${where === 'creator' ? 'Coach a player through the tour instead' : 'Coach a player through the tour. This career stays saved.'}</small></button>`;
}
document.addEventListener('click', e => { const b = e.target.closest('[data-mode-switch]'); if (b) setGameMode(b.dataset.modeSwitch); });
