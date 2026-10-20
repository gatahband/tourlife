// orders.js — match orders for real tournaments. Players can't be online while the admin streams their
// matches, so they decide ahead of time: how to play each family of opponent, big points, and what to do
// if they lose a set. The orders travel inside the player file; the admin's screen shows them.

const FAMILIES = [
  { id: 'serve', name: 'Big Servers', styles: ['Serve-Dominant', 'Serve +1 Attacker'] },
  { id: 'attack', name: 'Baseline Attackers', styles: ['First-Strike Attacker', 'Aggressive Baseliner', 'Flat Attacker', 'Heavy-Topspin Attacker'] },
  { id: 'grind', name: 'Grinders', styles: ['Solid Baseliner', 'Counterpuncher', 'Defensive Grinder', 'Heavy-Topspin Baseliner'] },
  { id: 'net', name: 'Net Rushers', styles: ['Net Attacker', 'Serve-and-Volley'] },
  { id: 'craft', name: 'Crafty All-Courters', styles: ['All-Court', 'Variety / Slice-Heavy', 'Creative Shotmaker'] },
];
const TACTICS = {
  usual: { name: 'My Usual Plan', plan: {} },
  attack: { name: 'Attack', plan: { aggression: 'aggressive', returnPos: 'inside', net: 'sometimes' } },
  patient: { name: 'Be Patient', plan: { aggression: 'patient', spin: 'topspin', net: 'rarely' } },
  deep: { name: 'Get Returns Back', plan: { returnPos: 'deep', aggression: 'patient' } },
};
const COACH_TACTIC = { serve: 'deep', attack: 'patient', grind: 'attack', net: 'patient', craft: 'attack' };
const BIG_POINTS = { coach: { name: "Coach's Pick", v: 'standard' }, safe: { name: 'Play Safe', v: 'safe' }, broke: { name: 'Go For It', v: 'broke' } };
const LOSING = { stick: 'Keep Going', switch: 'Change It Up' };
const ordersOf = p => ({ fam: {}, big: 'coach', losing: 'stick', ...(p && p.orders) });
const familyOf = p => FAMILIES.find(f => f.styles.includes(styleOf(p).name)) || FAMILIES[4];
const tacticFor = (p, fam) => { const t = ordersOf(p).fam[fam.id] || 'coach'; return t === 'coach' ? COACH_TACTIC[fam.id] : t; };

// Applied when the admin starts a match (into the match snapshot, so replays match).
function applyOrders(me, opp) {
  if (!me.orders) return;
  const o = ordersOf(me), fam = familyOf(opp), t = tacticFor(me, fam);
  me.plan = { ...planOf(me), ...TACTICS[t].plan, pressure: BIG_POINTS[o.big].v };
  me.ordersNote = `vs ${fam.name}: ${TACTICS[t].name}${o.fam[fam.id] && o.fam[fam.id] !== 'coach' ? '' : ' (coach)'} · Big points: ${BIG_POINTS[o.big].name} · Losing a set: ${LOSING[o.losing]}`;
}
// After losing a set (called by the engine): "Change It Up" flips the rally plan, once per match.
function ordersAfterSetLost(m, ps, loser) {
  const p = ps[loser];
  if (!p.real || !p.orders || ordersOf(p).losing !== 'switch' || p.switched) return; // admin events only
  const pl = planOf(p), agg = pl.aggression === 'aggressive' ? 'patient' : 'aggressive';
  p.plan = { ...pl, aggression: agg, net: agg === 'aggressive' ? 'often' : 'rarely' };
  p.switched = true;
  m.moments.push({ set: m.sets.length + 1, who: loser, kind: 'orders', label: `changes it up: now ${agg === 'aggressive' ? 'attacking and coming forward' : 'playing patient from the back'}` });
}

// The player's side: big buttons, one question at a time on one page.
function openOrders(back) {
  const p = readJSON(SAVE_KEY), o = ordersOf(p);
  const row = (key, opts, cur) => `<div class="seg ordseg" style="grid-template-columns:repeat(${opts.length},1fr)" data-ok="${key}">` +
    opts.map(([v, l]) => `<button type="button" data-v="${v}" class="${cur === v ? 'on' : ''}${v === 'coach' ? ' coach' : ''}">${l}</button>`).join('') + `</div>`;
  const famOpts = [['coach', "Coach's Pick"], ...Object.entries(TACTICS).map(([k, t]) => [k, t.name])];
  openModal(`<button type="button" class="x" id="mx" aria-label="Close">×</button><h2 class="itop">📋 My Match Orders</h2>` +
    `<p class="big">You won't be there when your matches are played, so tell your player what to do. Not sure? Leave it on <b>Coach's Pick</b>.</p>` +
    FAMILIES.map(f => `<h3 class="ordq">Against ${f.name}, I…</h3>${row('fam.' + f.id, famOpts, o.fam[f.id] || 'coach')}`).join('') +
    `<h3 class="ordq">On big points, I…</h3>${row('big', Object.entries(BIG_POINTS).map(([k, b]) => [k, b.name]), o.big)}` +
    `<h3 class="ordq">If I lose a set, I…</h3>${row('losing', Object.entries(LOSING), o.losing)}` +
    `<p class="hint center">Saved as you tap. Send your player again so the tournament gets your new orders.</p>` +
    `<button type="button" class="btn huge" id="ordDone">Done</button>`);
  const close = () => { closeModal(); if (back) back(); };
  $('mx').onclick = close; $('ordDone').onclick = close;
  $('sheet').querySelectorAll('.ordseg').forEach(seg => { seg.onclick = e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    const pl = readJSON(SAVE_KEY), cur = ordersOf(pl), [k, sub] = seg.dataset.ok.split('.');
    if (sub) cur.fam = { ...cur.fam, [sub]: b.dataset.v }; else cur[k] = b.dataset.v;
    pl.orders = cur; writeJSON(SAVE_KEY, pl);
    seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  }; });
}
