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
  { key: 'serve', label: 'First serve', opts: [['safe', 'Safe'], ['balanced', 'Balanced'], ['big', 'Big']],
    hint: 'Big: fewer first serves in, more aces and free points. Pays off with high Serve Power.' },
  { key: 'returnPos', label: 'Return position', opts: [['deep', 'Deep'], ['normal', 'Normal'], ['inside', 'Inside']],
    hint: 'Deep: blunts big servers but gives up second-serve points. Inside: attacks second serves, risky against big serves.' },
  { key: 'aggression', label: 'Rally style', opts: [['patient', 'Patient'], ['balanced', 'Balanced'], ['aggressive', 'Aggressive']],
    hint: 'Aggressive: more winners and more errors. Needs strong Groundstrokes. Patient: longer rallies. Suits Stamina and Tennis IQ.' },
  { key: 'spin', label: 'Spin', opts: [['topspin', 'Heavy topspin'], ['mixed', 'Mixed'], ['flat', 'Flat']],
    hint: 'Flat: faster, more winners and more errors. Needs strong Groundstrokes; best on grass and indoors. Heavy topspin: safer, higher balls, longer rallies. Suits Stamina; best on clay.' },
  { key: 'net', label: 'Net approaches', opts: [['rarely', 'Rarely'], ['sometimes', 'Sometimes'], ['often', 'Often']],
    hint: 'Works with Net Proficiency, best on grass. Come in too often and you get passed.' },
  { key: 'drops', label: 'Drop shots', opts: [['rarely', 'Rarely'], ['sometimes', 'Sometimes'], ['often', 'Often']],
    hint: 'Works with Tennis IQ and Net Proficiency, on clay, and against tired opponents. A poor one hands away the point.' },
  { key: 'underarm', label: 'Underarm serve', opts: [['never', 'Never'], ['rarely', 'Rarely'], ['sometimes', 'Sometimes']],
    hint: 'Cheeky. Catches returners standing deep. A smart, quick returner punishes it, and it works less each time you try it in a match.' },
];

// Renders the plan settings into el; calls onChange(plan) after each change.
function planEditor(el, plan, onChange) {
  const draw = () => {
    el.innerHTML = GAME_PLAN.map(g =>
      `<div class="prow"><div class="plabel"><b>${g.label}</b><small>${g.hint}</small></div>` +
      `<div class="seg" data-key="${g.key}">${g.opts.map(([v, l]) =>
        `<button type="button" data-v="${v}" class="${plan[g.key] === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>`).join('');
  };
  el.onclick = e => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
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
    ...(plan.underarm && plan.underarm !== 'never' ? [`Underarm: ${planLabel('underarm', plan.underarm)}`] : [])].join(' · ');
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
// against the player's deviation from their own average.
const STYLES = [
  { name: 'Big Server',            w: [ 3, 0,-1, 0,-1, 0,-1], desc: 'Free points off the first ball. Holds serve in bunches.' },
  { name: 'Serve-and-Volleyer',    w: [ 2,-1, 0, 3,-1, 0, 0], desc: 'Serves and charges. Rallies are the enemy.' },
  { name: 'Aggressive Baseliner',  w: [ 1, 3, 0,-1, 0, 0,-1], desc: 'Dictates from the back with heavy, early ball-striking.' },
  { name: 'Counterpuncher',        w: [-1, 1, 2,-1, 1, 1, 1], desc: 'Absorbs pace and turns defense into offense.' },
  { name: 'Defensive Grinder',     w: [-1, 1, 1,-2, 3, 1, 0], desc: 'One more ball, every time. Wins by attrition.' },
  { name: 'All-Courter',           w: null,                desc: 'No weaknesses. Comfortable anywhere on the court.' },
  { name: 'Return Specialist',     w: [-1, 0, 3, 0, 0, 1, 1], desc: 'Breaks serve for fun. Every return game is a threat.' },
  { name: 'Clay-Court Specialist', w: [-1, 2, 0,-1, 2, 0, 1], desc: 'Topspin, patience and sliding. Built for the dirt.' },
  { name: 'Net Rusher',            w: [-1, 1, 0, 3, 0, 0, 0], desc: 'Approaches behind groundstrokes and finishes at net.' },
  { name: 'Power Hitter',          w: [ 2, 2,-1, 0,-1,-1,-2], desc: 'Raw pace off both sides. High risk, high reward.' },
  { name: 'Tactician',             w: [-1, 0, 1, 1,-1, 1, 3], desc: 'Out-thinks opponents with variety, touch and drop shots.' },
  { name: 'Marathon Man',          w: [-1, 0, 0, 0, 3, 1, 0], desc: 'Gets stronger in the fifth hour. Loves long matches.' },
  { name: 'Clutch Competitor',     w: [ 0, 0, 1, 0, 0, 3, 1], desc: 'Lives for break points and tiebreaks.' },
  { name: 'First-Strike Player',   w: [ 2, 1, 1, 0,-2, 0,-1], desc: 'Ends points in three shots or fewer.' },
];

const SURFACE_BONUS = {
  clay:  { 'Clay-Court Specialist': 0.15, 'Defensive Grinder': 0.05 },
  grass: { 'Serve-and-Volleyer': 0.1, 'Big Server': 0.05 },
  hard:  { 'Aggressive Baseliner': 0.05, 'First-Strike Player': 0.05 },
};

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

function detectStyles(attrs, fav) {
  const v = ATTRS.map(([k]) => attrs[k]);
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const d = v.map(x => x - mean);
  const dLen = Math.hypot(...d);
  const std = dLen / Math.sqrt(v.length);
  const bonus = SURFACE_BONUS[fav] || {};

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
    score = Math.min(1, score + (score > 0 ? bonus[s.name] || 0 : 0));
    return { ...s, score };
  }).sort((a, b) => b.score - a.score);
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

  const ranked = detectStyles(state.attrs, state.fav);
  const best = ranked[0];
  $('topStyle').textContent = best.name;
  $('topFill').style.width = `${Math.round(best.score * 100)}%`;
  $('topDesc').textContent = best.desc;
  $('styles').innerHTML = ranked.map((s, i) => {
    const pct = Math.round(s.score * 100);
    return `<li class="${i === 0 ? 'best' : ''}"><span>${s.name}</span>` +
      `<div class="bar"><div style="width:${pct}%"></div></div><span>${pct}%</span></li>`;
  }).join('');
}

function build() {
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
  planEditor($('cPlan'), state.plan, () => {});

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
    playstyle: detectStyles(state.attrs, state.fav)[0].name,
    created: Date.now(),
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(player));
  } catch {
    $('status').textContent = 'Could not save (browser storage unavailable).';
    return;
  }
  $('status').textContent = '';
  showPlayer(player);
  maybeShowHelp();
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
