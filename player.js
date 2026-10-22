// player.js — character creation, attributes, temperament, playstyle detection

const POOL = 350, MIN = 20, MAX = 90, START = 40;
const SAVE_KEY = 'tourlife.player';

const ATTRS = [
  ['serve', 'Serve Power'],
  ['ground', 'Groundstrokes'],
  ['ret', 'Return Quality'],
  ['net', 'Net Proficiency'],
  ['stam', 'Stamina'],
  ['mental', 'Mental Resilience'],
  ['iq', 'Tennis IQ'],
];

const HANDS = [['right', 'Right-handed'], ['left', 'Left-handed']];

// Game plan settings (effects live in sim.js). Each one helps or hurts depending on your stats and your opponent's.
const GAME_PLAN = [
  { key: 'serve', label: 'First Serve', opts: [['safe', 'Safe'], ['balanced', 'Balanced'], ['big', 'Big']],
    hint: 'Big: fewer first serves in, more aces and free points. Pays off with high Serve Power.' },
  { key: 'returnPos', label: 'Return Position', opts: [['deep', 'Deep'], ['normal', 'Normal'], ['inside', 'Inside']],
    hint: 'Deep: blunts big servers but gives up second-serve points. Inside: attacks second serves, risky against big serves.' },
  { key: 'aggression', label: 'Rally Style', opts: [['patient', 'Patient'], ['balanced', 'Balanced'], ['aggressive', 'Aggressive']],
    hint: 'Aggressive: more winners and more errors. Needs strong Groundstrokes. Patient: longer rallies. Suits Stamina and Tennis IQ.' },
  { key: 'spin', label: 'Spin', opts: [['topspin', 'Heavy Topspin'], ['mixed', 'Mixed'], ['flat', 'Flat']],
    hint: 'Flat: faster, more winners and more errors. Needs strong Groundstrokes; best on grass and indoors. Heavy topspin: safer, higher balls, longer rallies. Suits Stamina; best on clay.' },
  { key: 'net', label: 'Net Approaches', opts: [['rarely', 'Rarely'], ['sometimes', 'Sometimes'], ['often', 'Often']],
    hint: 'Works with Net Proficiency, best on grass. Come in too often and you get passed.' },
  { key: 'drops', label: 'Drop Shots', opts: [['rarely', 'Rarely'], ['sometimes', 'Sometimes'], ['often', 'Often']],
    hint: 'Works with Tennis IQ and Net Proficiency, on clay, and against tired opponents. A poor one hands away the point.' },
  { key: 'underarm', label: 'Underarm Serve', opts: [['never', 'Never'], ['rarely', 'Rarely'], ['sometimes', 'Sometimes']],
    hint: 'Cheeky. Catches returners standing deep. A smart, quick returner punishes it, and it works less each time you try it in a match.' },
  // Your playstyle's signature play (sim.js SIGNATURE); label and hint come from your style. Creative Shotmakers use the underarm serve instead.
  { key: 'sig', label: 'Signature Play', opts: [['off', 'Off'], ['on', 'On']], hint: '' },
  // Unlocked by the Master coach.
  { key: 'wing', label: 'Target Wing', coach: 4, opts: [['fh', 'Forehand'], ['neutral', 'Neutral'], ['bh', 'Backhand']],
    hint: 'Send most rally balls to one side. Pick on their weaker wing (your coach can tell you which). Smart players adjust as the match goes on.' },
  { key: 'depth', label: 'Shot Depth & Margin', coach: 4, opts: [['high', 'High Margin'], ['balanced', 'Balanced'], ['deep', 'Deep & Driving']],
    hint: 'High margin: moonballs over the net, safe and great on clay against big hitters, but net rushers feast. Deep & driving: pins them back. Needs strong Groundstrokes, best on quick courts.' },
  { key: 'energy', label: 'Energy Pacing', coach: 4, opts: [['conserve', 'Conserve'], ['normal', 'Normal'], ['hustle', 'All-Out Hustle']],
    hint: 'Hustle wins more points but tires you much faster (worse in the heat) and leaves you more tired after. Conserve saves your legs for later rounds.' },
  { key: 'pressure', label: 'Big-Point Risk', coach: 4, opts: [['safe', 'Safe & Solid'], ['standard', 'Standard'], ['broke', 'Go For Broke']],
    hint: 'On break points, set points and tiebreaks. Go for broke against a nervous, fragile opponent; stay safe and solid against a tough one.' },
];

// Renders the plan settings into el; calls onChange(plan) after each change. Coach-only settings show
// locked until your coach is good enough.
// The plan rows a player of this style gets: the underarm serve only for Creative Shotmakers, and the signature play
// (labelled for the style) for everyone else.
function planRows(styleName) {
  return GAME_PLAN.filter(g => g.key === 'underarm' ? styleName === 'Creative Shotmaker' : g.key === 'sig' ? !!SIGNATURE[styleName] : true)
    .map(g => g.key === 'sig' ? { ...g, label: `⭐ ${SIGNATURE[styleName].label}`, hint: `Your ${styleName} signature play. ${SIGNATURE[styleName].hint}` }
      : g.key === 'underarm' ? { ...g, label: '⭐ Underarm Serve', hint: `Your Creative Shotmaker signature play. ${g.hint}` } : g);
}
const myStyleName = () => typeof current !== 'undefined' && current.player ? styleOf(current.player).name : (typeof state !== 'undefined' && state.attrs ? detectStyles(state.attrs, state.fav, state.plan)[0].name : '');

function planEditor(el, plan, onChange) {
  const draw = () => {
    const lv = typeof teamLevel === 'function' && current.career ? teamLevel(current.career, 'coach') : 0;
    const rows = planRows(myStyleName());
    // Basic settings first, then the coach-unlocked tier under its own heading.
    el.innerHTML = rows.map((g, i) => {
      const locked = g.coach && lv < g.coach;
      return (g.coach && !(rows[i - 1] || {}).coach ? `<div class="pctier">🎓 Master Coach Options</div>` : '') +
        `<div class="prow${locked ? ' locked' : ''}${g.key === 'sig' || g.key === 'underarm' ? ' sigrow' : ''}"><div class="plabel"><b>${g.label}</b><small>${locked ? `🔒 Unlocks with a ${TEAM.coach.levels[g.coach].name}. ${g.hint}` : g.hint}</small></div>` +
        `<div class="seg" data-key="${g.key}">${g.opts.map(([v, l]) =>
          `<button type="button" data-v="${v}" class="${(plan[g.key] || DEFAULT_PLAN[g.key]) === v ? 'on' : ''}" ${locked ? 'disabled' : ''}>${l}</button>`).join('')}</div></div>`;
    }).join('');
  };
  el.onclick = e => {
    const b = e.target.closest('[data-v]');
    if (!b || b.disabled) return;
    plan[b.parentElement.dataset.key] = b.dataset.v;
    draw();
    onChange(plan);
  };
  draw();
}

const planLabel = (key, v) => GAME_PLAN.find(g => g.key === key).opts.find(([o]) => o === v)[1];

// One-line summary, e.g. "Big serve · Normal return · Aggressive · Net: Often · Drops: Sometimes".
function planSummary(plan) {
  return [`${planLabel('serve', plan.serve)} serve`, `${planLabel('returnPos', plan.returnPos)} return`,
    planLabel('aggression', plan.aggression),
    ...(plan.spin && plan.spin !== 'mixed' ? [planLabel('spin', plan.spin)] : []), `Net: ${planLabel('net', plan.net)}`, `Drops: ${planLabel('drops', plan.drops)}`,
    ...(plan.underarm && plan.underarm !== 'never' ? [`Underarm: ${planLabel('underarm', plan.underarm)}`] : []),
    ...(plan.sig === 'on' ? ['⭐ Signature Play'] : []),
    ...['wing', 'depth', 'energy', 'pressure'].filter(k => plan[k] && plan[k] !== DEFAULT_PLAN[k]).map(k => `${GAME_PLAN.find(g => g.key === k).label}: ${planLabel(k, plan[k])}`)].join(' · ');
}

const TEMPERAMENTS = {
  fiery:   { emoji: '🤬', name: 'Fiery',   tag: 'Smasher',     desc: 'Feeds on emotion. Big highs, but can boil over after bad calls.' },
  stoic:   { emoji: '🧊', name: 'Stoic',   tag: 'Ice',         desc: 'Ice in the veins. Rarely rattled, rarely ignited.' },
  moping:  { emoji: '🌧️', name: 'Moper',   tag: 'Melancholy',  desc: 'Carries the weight of every miss. Slumps can snowball.' },
  robotic: { emoji: '🤖', name: 'Robotic', tag: 'Zero Emotion', desc: 'Pure process. Consistent, but struggles to raise the level.' },
};

const NATIONS = [
  ['ARG','🇦🇷','Argentina'],['AUS','🇦🇺','Australia'],['AUT','🇦🇹','Austria'],['BEL','🇧🇪','Belgium'],
  ['BRA','🇧🇷','Brazil'],['BUL','🇧🇬','Bulgaria'],['CAN','🇨🇦','Canada'],['CHI','🇨🇱','Chile'],
  ['CHN','🇨🇳','China'],['COL','🇨🇴','Colombia'],['CRO','🇭🇷','Croatia'],['CZE','🇨🇿','Czechia'],
  ['DEN','🇩🇰','Denmark'],['EGY','🇪🇬','Egypt'],['ESP','🇪🇸','Spain'],['FIN','🇫🇮','Finland'],
  ['FRA','🇫🇷','France'],['GBR','🇬🇧','Great Britain'],['GER','🇩🇪','Germany'],['GRE','🇬🇷','Greece'],
  ['HUN','🇭🇺','Hungary'],['IND','🇮🇳','India'],['ITA','🇮🇹','Italy'],['JPN','🇯🇵','Japan'],
  ['KAZ','🇰🇿','Kazakhstan'],['KOR','🇰🇷','South Korea'],['MAR','🇲🇦','Morocco'],['MEX','🇲🇽','Mexico'],
  ['NED','🇳🇱','Netherlands'],['NGA','🇳🇬','Nigeria'],['NOR','🇳🇴','Norway'],['POL','🇵🇱','Poland'],
  ['POR','🇵🇹','Portugal'],['RSA','🇿🇦','South Africa'],['SRB','🇷🇸','Serbia'],['SUI','🇨🇭','Switzerland'],
  ['SWE','🇸🇪','Sweden'],['TUN','🇹🇳','Tunisia'],['TUR','🇹🇷','Türkiye'],['USA','🇺🇸','United States'],
];

// Indoor is an environment, not a surface — it rides on the hard-court preference.
const SURFACES = [['hard', 'Hard'], ['clay', 'Clay'], ['grass', 'Grass']];

// Weights over [serve, ground, ret, net, stam, mental, iq]; matched by cosine similarity
// against the player's deviation from their own average. A style can also lean on the game plan
// (spin, rally aggression): the right plan lifts it, the opposite one damps it. The style says how a
// player builds points, not how good they are.
const STYLES = [
  { name: 'Serve-Dominant',          w: [ 3, 0,-1, 0,-1, 0,-1], desc: 'Free points and short service games. Holds in bunches.' },
  { name: 'Serve +1 Attacker',       w: [ 2, 2,-1, 0,-1, 0,-1], agg: 'aggressive', desc: 'Uses the serve to set up an attack on the very next ball.' },
  { name: 'First-Strike Attacker',   w: [ 2, 1, 1, 0,-2, 0,-1], desc: 'Attacks early on serve and return. Ends points within a few shots.' },
  { name: 'Aggressive Baseliner',    w: [ 1, 3, 0,-1, 0, 0,-1], agg: 'aggressive', desc: 'Dictates rallies from the back with pace, depth and attacking groundstrokes.' },
  { name: 'Flat Attacker',           w: [ 1, 3, 0, 0,-1,-1,-2], spin: 'flat', desc: 'Takes the ball early on flat trajectories to rush opponents.' },
  { name: 'Solid Baseliner',         w: [ 1, 2, 0,-2, 1, 1, 0], desc: 'Wins with depth, consistency, positioning and controlled aggression.' },
  { name: 'Counterpuncher',          w: [-1, 1, 2,-1, 1, 1, 1], agg: 'patient', desc: 'Absorbs and redirects pace, then turns defense into offense.' },
  { name: 'Defensive Grinder',       w: [-1, 1, 1,-2, 3, 1, 0], desc: 'Retrieves everything. Wins by attrition and one more ball.' },
  { name: 'Heavy-Topspin Baseliner', w: [-1, 2, 0,-1, 2, 0, 1], spin: 'topspin', desc: 'Heavy rotation, net clearance and high-bouncing depth to build points.' },
  { name: 'Heavy-Topspin Attacker',  w: [ 0, 3, 0,-1, 1,-1,-1], spin: 'topspin', agg: 'aggressive', desc: 'Heavy spin used offensively: pushes opponents back, then finishes.' },
  { name: 'All-Court',               w: null,                 desc: 'No weaknesses. Builds and finishes points from anywhere on court.' },
  { name: 'Net Attacker',            w: [-1, 1, 0, 3, 0, 0, 0], desc: 'Comes forward behind attacking shots and finishes with volleys.' },
  { name: 'Serve-and-Volley',        w: [ 2,-1, 0, 3,-1, 0, 0], desc: 'Follows the serve to the net. Rallies are the enemy.' },
  { name: 'Variety / Slice-Heavy',   w: [-1, 0, 1, 1,-1, 1, 3], desc: 'Changes spin, height, pace and angles to break up rhythm.' },
  { name: 'Creative Shotmaker',      w: [ 1, 0,-1, 2,-1,-1, 3], desc: 'Disguise, improvisation and the unexpected as everyday weapons.' },
];

// Hover text for a playstyle: what it does, which stats build it, and how it plays by default.
function styleTip(s) {
  const st = STYLES.find(x => x.name === s.name) || s, lab = i => ATTRS[i][1];
  const idx = st.w ? st.w.map((v, i) => [v, i]) : [];
  const key = idx.filter(([v]) => v >= 2).sort((a, b) => b[0] - a[0]).map(([, i]) => lab(i));
  const light = idx.filter(([v]) => v <= -1).sort((a, b) => a[0] - b[0]).map(([, i]) => lab(i));
  const lean = [st.agg === 'aggressive' && 'aggressive', st.agg === 'patient' && 'patient', st.spin === 'flat' && 'flat hitting', st.spin === 'topspin' && 'heavy topspin'].filter(Boolean);
  return `<b>${st.name}</b>${st.desc}` + (st.w ? `<em>Built on: ${key.join(', ') || 'a mix of everything'}</em>` : '<em>Built on: every stat evenly, with no big weakness</em>') +
    (light.length ? `<em>Matters less: ${light.join(', ')}</em>` : '') + (lean.length ? `<em>Plays ${lean.join(', ')} by default</em>` : '');
}

const SURFACE_BONUS = {
  clay:  { 'Heavy-Topspin Baseliner': 0.15, 'Defensive Grinder': 0.05 },
  grass: { 'Serve-and-Volley': 0.1, 'Serve-Dominant': 0.05 },
  hard:  { 'Aggressive Baseliner': 0.05, 'First-Strike Attacker': 0.05 },
};

// Secondary trait: the stat that stands out most above a player's own average. Real players can carry
// a researched trait instead (two of those have no stat of their own).
const TRAITS = {
  serve:  { name: 'Powerful Serve', desc: 'A first serve that wins cheap points.' },
  ground: { name: 'Big Forehand', desc: 'A groundstroke weapon to finish rallies.' },
  ret:    { name: 'Return-Oriented', desc: 'Neutralizes serves and turns return games into chances.' },
  net:    { name: 'Soft Hands', desc: 'Touch and feel at the net.' },
  stam:   { name: 'Marathon', desc: 'Gets stronger the longer it goes.' },
  mental: { name: 'Clutch', desc: 'Lives for break points and tiebreaks.' },
  iq:     { name: 'Tactical Brain', desc: 'Reads the match and adjusts.' },
};
const REAL_TRAITS = { 'Flat Hitting': 'Takes the ball early and flat.', Aggressive: 'Defends to attack: looks to flip rallies early.' };

const $ = id => document.getElementById(id);

const state = {
  name: '',
  nation: 'USA',
  temperament: 'stoic',
  attrs: Object.fromEntries(ATTRS.map(([k]) => [k, START])),
  fav: 'hard',
  worst: 'grass',
  hand: 'right',
  plan: { ...DEFAULT_PLAN },
};

function used() {
  return Object.values(state.attrs).reduce((a, b) => a + b, 0);
}

// -1 / 0 / +1 indoor modifier derived from hard-court preference.
function indoorAffinity() {
  if (state.fav === 'hard') return 1;
  if (state.worst === 'hard') return -1;
  return 0;
}

function detectStyles(attrs, fav, plan) {
  const v = ATTRS.map(([k]) => attrs[k]);
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const d = v.map(x => x - mean);
  const dLen = Math.hypot(...d);
  const std = dLen / Math.sqrt(v.length);
  const bonus = SURFACE_BONUS[fav] || {};
  // Matching plan settings lift a style; the opposite setting damps it, a middle one a little.
  const OPP = { flat: 'topspin', topspin: 'flat', aggressive: 'patient', patient: 'aggressive' };
  const lean = (want, have) => !want || !have ? 0 : have === want ? 0.1 : have === OPP[want] ? -0.5 : -0.2;

  return STYLES.map(s => {
    let score;
    if (!s.w) {
      score = Math.max(0, 1 - std / 12);
    } else if (dLen < 1e-6) {
      score = 0;
    } else {
      const wLen = Math.hypot(...s.w);
      score = Math.max(0, d.reduce((a, x, i) => a + x * s.w[i], 0) / (dLen * wLen));
    }
    if (score > 0) {
      for (const k of [lean(s.spin, plan && plan.spin), lean(s.agg, plan && plan.aggression)]) score = k < 0 ? score * (1 + k) : score + k;
      score += bonus[s.name] || 0;
    }
    return { ...s, raw: score, score: Math.min(1, score) };
  }).sort((a, b) => b.raw - a.raw); // rank before the 100% cap so close styles don't tie
}

function detectTrait(attrs) {
  const keys = ATTRS.map(([k]) => k), mean = keys.reduce((a, k) => a + attrs[k], 0) / keys.length;
  const top = keys.reduce((a, k) => attrs[k] > attrs[a] ? k : a, keys[0]);
  return attrs[top] - mean >= 3 ? TRAITS[top] : null;
}

// A player's style and trait: a real player's researched one, otherwise read off their stats and plan.
function styleOf(p) {
  const real = p.realStyle && STYLES.find(s => s.name === p.realStyle);
  return real ? { ...real, score: 1 } : detectStyles(p.attrs, p.fav, typeof planOf === 'function' ? planOf(p) : p.plan)[0];
}
function traitOf(p) {
  if (p.realTrait) return TRAITS[Object.keys(TRAITS).find(k => TRAITS[k].name === p.realTrait)] || { name: p.realTrait, desc: REAL_TRAITS[p.realTrait] || '' };
  return detectTrait(p.attrs);
}

function render() {
  const left = POOL - used();
  $('pool').textContent = `${left} pts left`;
  $('cOvr').textContent = `OVR ${overall({ attrs: state.attrs }).toFixed(1)}`;
  $('pool').classList.toggle('zero', left === 0);

  for (const [k] of ATTRS) $(`v-${k}`).textContent = state.attrs[k];

  document.querySelectorAll('#temper button').forEach(b =>
    b.classList.toggle('on', b.dataset.t === state.temperament));
  document.querySelectorAll('#hand button').forEach(b => b.classList.toggle('on', b.dataset.v === state.hand));
  for (const which of ['fav', 'worst'])
    document.querySelectorAll(`#${which} button`).forEach(b =>
      b.classList.toggle('on', b.dataset.v === state[which]));

  const ind = indoorAffinity();
  const el = $('indoor');
  el.className = 'hint' + (ind > 0 ? ' indoor-up' : ind < 0 ? ' indoor-down' : '');
  el.textContent = ind > 0 ? '🏟️ Indoor boost — your hard-court comfort carries under the roof.'
    : ind < 0 ? '🏟️ Indoor penalty — indoor hard courts expose your weakest surface.'
    : '🏟️ Indoor neutral — indoor events play on hard courts.';

  const ranked = detectStyles(state.attrs, state.fav, state.plan);
  const best = ranked[0], trait = detectTrait(state.attrs);
  $('topStyle').textContent = best.name + (trait ? ` · ${trait.name}` : '');
  $('topFill').style.width = `${Math.round(best.score * 100)}%`;
  $('topDesc').textContent = best.desc;
  $('styles').innerHTML = ranked.map((s, i) => {
    const pct = Math.round(s.score * 100);
    return `<li class="${i === 0 ? 'best' : ''}" tabindex="0"><span>${s.name}</span><div class="stip">${styleTip(s)}</div>` +
      `<div class="bar"><div style="width:${pct}%"></div></div><span>${pct}%</span></li>`;
  }).join('');
}

function build() {
  // Watch how each playstyle builds its points before you commit to one (stylepreview.js).
  $('cPreview').onclick = () => openStylePreview({ hand: state.hand, plan: state.plan }, { ...state.attrs }, detectStyles(state.attrs, state.fav, state.plan)[0].name, null, 'Back To My Player');

  $('nation').innerHTML = NATIONS.map(([c, f, n]) => `<option value="${c}">${f} ${n}</option>`).join('');

  $('temper').innerHTML = Object.entries(TEMPERAMENTS).map(([k, t]) =>
    `<button type="button" data-t="${k}"><span class="emoji">${t.emoji}</span>` +
    `<b>${t.name}</b><em>${t.tag}</em><small>${t.desc}</small></button>`).join('');
  $('temper').onclick = e => {
    const b = e.target.closest('button');
    if (b) { state.temperament = b.dataset.t; render(); }
  };

  $('attrs').innerHTML = ATTRS.map(([k, label]) =>
    `<div class="attr"><div class="lbl">${label}<b id="v-${k}"></b></div>` +
    `<input type="range" id="s-${k}" min="${MIN}" max="${MAX}" value="${state.attrs[k]}"></div>`).join('');
  for (const [k] of ATTRS) {
    $(`s-${k}`).oninput = e => {
      let val = +e.target.value;
      const over = used() - state.attrs[k] + val - POOL;
      if (over > 0) val -= over;
      state.attrs[k] = val;
      e.target.value = val;
      render();
    };
  }

  const opts = SURFACES.map(([v, l]) => `<button type="button" data-v="${v}">${l}</button>`).join('');
  $('fav').innerHTML = opts;
  $('worst').innerHTML = opts;
  const onSurface = which => e => {
    const b = e.target.closest('button');
    if (!b) return;
    state[which] = b.dataset.v;
    const other = which === 'fav' ? 'worst' : 'fav';
    if (state.fav === state.worst) state[other] = SURFACES.find(([v]) => v !== state[which])[0];
    render();
  };
  $('fav').onclick = onSurface('fav');
  $('worst').onclick = onSurface('worst');

  $('hand').innerHTML = HANDS.map(([v, l]) => `<button type="button" data-v="${v}">${l.split('-')[0]}</button>`).join('');
  $('hand').onclick = e => { const b = e.target.closest('button'); if (b) { state.hand = b.dataset.v; render(); } };
  planEditor($('cPlan'), state.plan, render);

  $('name').oninput = e => { state.name = e.target.value.trim(); };
  $('nation').onchange = e => { state.nation = e.target.value; };
  $('save').onclick = save;
  $('edit').onclick = () => showScreen('creator');
  $('reset').onclick = openSwitcher;
  $('share').onclick = openShare;
  $('backup').onclick = openBackup;
  $('saveProg').onclick = saveProgress;
  $('loadProg').onclick = loadProgress;
  $('helpBtn').onclick = () => openHelp(0);
  $('cImport').onclick = openImport;
  $('dHome').onclick = () => { renderTournaments(current.player); showScreen('home'); };
  $('tHome').onclick = () => { renderTournaments(current.player); showScreen('home'); };
  $('mBack').onclick = () => { anim.watching = false; anim.paused = false; Court.skip = true; openDraw(); };
}

function save() {
  if (!state.name) { $('status').textContent = 'Enter a name first.'; return; }
  const player = {
    ...state,
    attrs: { ...state.attrs },
    plan: { ...state.plan },
    surfaces: { fav: state.fav, worst: state.worst, indoor: indoorAffinity() },
    playstyle: detectStyles(state.attrs, state.fav, state.plan)[0].name,
    created: Date.now(),
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(player));
  } catch {
    // Storage blocked by the browser (Private Browsing, an app's built-in browser, or website data turned off).
    $('status').textContent = "Your browser isn't letting TourLife save. This usually happens in Private Browsing, inside an app's built-in browser (like Instagram, Facebook or TikTok), or when website data is blocked in settings. Open the link in Safari or Chrome, not in Private mode, and try again.";
    return;
  }
  $('status').textContent = '';
  showPlayer(player);
}

function showPlayer(player) {
  const t = TEMPERAMENTS[player.temperament];
  const [, flag, country] = NATIONS.find(([c]) => c === player.nation);
  const label = v => SURFACES.find(([s]) => s === v)[1];
  $('cName').textContent = player.name;
  $('cMeta').textContent = `${flag} ${country} · ${t.emoji} ${t.name} / ${t.tag} · ${HANDS.find(([h]) => h === player.hand)[1]}`;
  $('cStyle').textContent = player.playstyle;
  $('cSurf').textContent = `Favorite: ${label(player.fav)} · Worst: ${label(player.worst)}`;
  renderTournaments(player);
  showScreen('home');
}

function load() {
  try {
    const p = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!p) return null;
    // Saves from before Tennis IQ, handedness and drop shots existed.
    if (p.attrs.iq === undefined) p.attrs.iq = 50;
    p.hand = p.hand || 'right';
    p.plan = planOf(p);
    delete p.dropShots;
    Object.assign(state, {
      name: p.name, nation: p.nation, temperament: p.temperament,
      attrs: { ...state.attrs, ...p.attrs }, fav: p.fav, worst: p.worst,
      hand: p.hand, plan: { ...p.plan },
    });
    return p;
  } catch { return null; }
}

const saved = load();
build();
$('name').value = state.name;
$('nation').value = state.nation;
for (const [k] of ATTRS) $(`s-${k}`).value = state.attrs[k];
render();
initModal();
// Saved careers on the create screen, so you can go back to one instead of starting fresh.
const renderSlots = () => {
  const has = loadSaves().length > 0;
  $('cSaves').hidden = !has;
  if (has) { $('cSlotList').innerHTML = savesHtml(); bindSaves($('cSlotList'), renderSlots); }
};
renderSlots();
if (saved) showPlayer(saved);
else startOnboarding();
