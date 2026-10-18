// sponsors.js — brand deals. As your ranking climbs, (very loosely inspired) brands make offers: one deal per
// category, with a signing bonus, weekly pay and a length. Accept or turn them down.

const BRANDS = [
  { id: 'gatex',    name: 'Gatex',        cat: 'racket',  bg: '#0b6e4f', fg: '#ffffff', glyph: '◇', line: 'Precision frames since forever.' },
  { id: 'wilgatah', name: 'Wilgatah',     cat: 'racket',  bg: '#d0021b', fg: '#ffffff', glyph: 'W', line: 'Feel every ball.' },
  { id: 'babolgat', name: 'Babolgat',     cat: 'racket',  bg: '#1b3f8b', fg: '#ffd400', glyph: '⚡', line: 'Spin. Power. Gatah.' },
  { id: 'gatatas',  name: 'Gatatas',      cat: 'apparel', bg: '#111111', fg: '#ffffff', glyph: '▲', line: 'Impossible is nothing much.' },
  { id: 'gatike',   name: 'Gatike',       cat: 'apparel', bg: '#f5f5f7', fg: '#111111', glyph: '〜', line: 'Just Gatah it.' },
  { id: 'uniqatah', name: 'UniGatah',     cat: 'apparel', bg: '#e60012', fg: '#ffffff', glyph: '■', line: 'Life wear, match wear.' },
  { id: 'gatasics', name: 'Gatasics',     cat: 'shoes',   bg: '#002d72', fg: '#ffffff', glyph: '≋', line: 'Sound mind, sound feet.' },
  { id: 'newgat',   name: 'New Gatlance', cat: 'shoes',   bg: '#7a7a7a', fg: '#ffffff', glyph: 'N', line: 'Fearlessly sliding.' },
  { id: 'rolgatah', name: 'Rolgatah',     cat: 'watch',   bg: '#00603d', fg: '#e6c35c', glyph: '♛', line: 'A crown for every champion.' },
  { id: 'gatorade', name: 'Gatahrade',    cat: 'drink',   bg: '#f26b21', fg: '#ffffff', glyph: '⚡', line: 'Is it in you?' },
];
const CAT_LABEL = { racket: 'Racket', apparel: 'Clothing', shoes: 'Shoes', watch: 'Watch', drink: 'Drink' };
// Pay by ranking band (weekly), and how much each category pays relative to that.
const DEAL_BANDS = [[5, 25000], [20, 10000], [50, 4000], [100, 1500], [200, 600], [500, 200], [1000, 80]];
const CAT_PAY = { racket: 1, apparel: 1.2, shoes: 0.7, watch: 0.9, drink: 0.5 };
const CAT_MIN_RANK = { racket: 1000, apparel: 500, shoes: 300, drink: 150, watch: 60 }; // who'll talk to you, by ranking

const brandOf = id => BRANDS.find(b => b.id === id);
const brandBadge = b => `<span class="brand" style="background:${b.bg};color:${b.fg}"><i>${b.glyph}</i>${b.name}</span>`;
const dealsOf = c => (c.deals = c.deals || []);
const activeDeals = c => dealsOf(c).filter(d => d.until >= c.week);

function bandPay(rank) { return rank ? (DEAL_BANDS.find(([r]) => rank <= r) || [0, 0])[1] : 0; }

// After a good week: maybe a brand calls with an offer (one at a time, one deal per category).
function maybeOffer(c) {
  const rank = currentRank(c);
  if (!rank || c.offer) return;
  const taken = new Set(activeDeals(c).map(d => d.cat));
  const cats = Object.keys(CAT_PAY).filter(k => !taken.has(k) && rank <= CAT_MIN_RANK[k]);
  if (!cats.length) return;
  // More likely the higher you climb and the more you've just improved.
  const improved = c.lastOfferRank ? c.lastOfferRank - rank : 999;
  if (improved < Math.max(15, rank * 0.15) && Math.random() > 0.08) return;
  const cat = pick(Math.random, cats);
  const brands = BRANDS.filter(b => b.cat === cat);
  const b = pick(Math.random, brands);
  const weekly = Math.max(50, Math.round(bandPay(rank) * CAT_PAY[cat] * (0.85 + Math.random() * 0.3) / 10) * 10);
  const weeks = pick(Math.random, [26, 39, 52]);
  c.offer = { brand: b.id, cat, weekly, weeks, bonus: weekly * 4 };
  c.lastOfferRank = rank;
}

function signDeal(c, o) {
  dealsOf(c).push({ brand: o.brand, cat: o.cat, weekly: o.weekly, until: c.week + o.weeks, signed: c.week });
  if (o.bonus) earn(c, o.bonus, `${brandOf(o.brand).name} signing bonus`);
}

// Weekly pay from every active deal; a note when one runs out.
function payDeals(c) {
  for (const d of dealsOf(c)) {
    if (d.until >= c.week) earn(c, d.weekly, `${brandOf(d.brand).name} (${CAT_LABEL[d.cat].toLowerCase()} deal)`);
    else if (!d.ended) { d.ended = true; c.notice = `Your ${brandOf(d.brand).name} deal has ended. Keep winning and offers will come.`; c.lastOfferRank = null; }
  }
}

// The offer, shown on Home.
function openOffer(c) {
  const o = c.offer, b = brandOf(o.brand);
  openModal(`<button type="button" class="x" id="mx" aria-label="Close">×</button>` +
    `<div class="offer"><div class="offerbadge">${brandBadge(b)}</div><h2 class="itop">${b.name} wants you</h2>` +
    `<p class="hint center"><i>"${b.line}"</i></p>` +
    `<p class="big center">A ${CAT_LABEL[o.cat].toLowerCase()} deal: <b>${money(o.weekly)} a week</b> for ${o.weeks} weeks, plus a <b>${money(o.bonus)}</b> signing bonus.</p>` +
    `<p class="hint center">You can only wear one ${CAT_LABEL[o.cat].toLowerCase()} brand at a time.</p>` +
    `<div class="shrow helpnav"><button type="button" class="btn" id="ofYes">Sign the deal</button><button type="button" class="btn ghost" id="ofNo">Turn it down</button></div></div>`);
  const done = () => { c.offer = null; writeJSON(CAREER_KEY, c); closeModal(); renderTournaments(current.player); };
  $('ofYes').onclick = () => { signDeal(c, o); toast(`✍️ Signed with ${b.name}`, `${money(o.weekly)} a week`); done(); };
  $('ofNo').onclick = done;
  $('mx').onclick = closeModal;
}

function sponsorsHtml(c) {
  const ds = activeDeals(c);
  return `<div class="deals"><h3 class="ssec">Sponsors</h3>` +
    (ds.length ? ds.map(d => { const b = brandOf(d.brand);
      return `<div class="deal">${brandBadge(b)}<span>${CAT_LABEL[d.cat]} · <b>${money(d.weekly)}/week</b> · ${d.until - c.week} weeks left</span></div>`; }).join('')
      : `<p class="hint">No deals yet. Break into the top 1,000 and brands will start calling.</p>`) +
    (c.offer ? `<button type="button" class="btn small" id="hOffer">📩 You have an offer from ${brandOf(c.offer.brand).name}</button>` : '') + `</div>`;
}
