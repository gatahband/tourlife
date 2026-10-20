// tips.js — first-time guidance: a welcome for brand-new players, then a short spotlight tour the first
// time each screen appears (the screen dims, one part lights up, a card explains it). Each tour shows
// once per device; "Skip tips" turns them all off. Deliberately doesn't spell out every rule: some
// things players learn by playing.

const TIPS_KEY = 'tourlife.tips';
const tipsSeen = () => readJSON(TIPS_KEY) || {};
const markTip = id => { const s = tipsSeen(); s[id] = 1; writeJSON(TIPS_KEY, s); };
const tipsOff = () => !!tipsSeen().off;

const TOURS = {
  creator: [
    ['#name', 'Who Are You?', 'Give your player a name and pick the country they play for.'],
    ['#temper', 'Your Temperament', 'How you react when things go right or wrong on court. Every type has its upside and its downside.'],
    ['#attrs', 'Your Seven Stats', 'Share out your points. Strong serve? Great returner? Fit enough to grind? There is no perfect build, just your build.'],
    ['#topStyle', 'Your Playstyle', 'The shape of your stats gives you a playstyle. Move the sliders and watch it change.'],
    ['#fav', 'Surfaces', 'Pick your best and worst court. You will play better on one and worse on the other.'],
    ['#cPlan', 'Game Plan', 'How you like to play. You can change it before any match, so do not overthink it now.'],
    ['#save', 'Ready?', 'Start your career. You begin at the bottom of the tennis world.'],
  ],
  home: [
    ['#hOvr', 'This Is You', 'Your overall rating, your playstyle and your chances at the levels you can play. Get better and these climb.'],
    ['#events', 'Each Week, Pick A Tournament', 'Tap Preview to see your chances and the cost of the trip, then enter. Your ranking decides which events let you in.'],
    ['#hGoals', 'Season Goals', 'Five goals for the season. Reach one and you get a reward on the spot.'],
    ['#hTeam', 'Money And Team', 'Prize money pays your travel. Later you can hire a coach and a medical team, and brands will come calling.'],
    ['#share', 'Play With Real People', 'Send your player in to be entered into tournaments against other players\' characters. Tap it for a quick walkthrough.'],
  ],
  draw: [
    ['#dAction .vsbox', 'Your Next Match', 'You against your next opponent, and how each of you likes to play.'],
    ['#dAction .scard', 'Scout Them', 'Their strengths, weaknesses and habits, plus the weather. Use it to plan.'],
    ['#dPlanBtn', 'Change Your Plan', 'Adjust your game plan to beat this particular opponent.'],
    ['#dPlay', 'Play The Match', 'When you are ready, play it.'],
  ],
  match: [
    ['#mActions .modes', 'How Do You Want To Play It?', 'Watch every point live, go set by set, or skip to the result. Watching lets you make the big calls yourself.'],
    ['#mCourtWrap', 'The Court', 'While you watch, switch camera views here. On big points the match will stop and ask you what to do.'],
  ],
  review: [
    ['#rStoryBox', 'What Happened', 'The story of the match, and below it the full stats.'],
    ['#rSave', 'Get Better', 'After every match, pick one thing to work on. Those stats go up for good.'],
  ],
  train: [
    ['#tStatus', 'Your Body', 'Fatigue builds with matches and training. Keep an eye on it.'],
    ['#tBody', 'Free Days', 'Days without matches: train here, travel early to next week\'s event, or rest.'],
  ],
};

// --- Welcome (brand-new players) ----------------------------------------------------------
const WELCOME = [
  ['🎾', 'Welcome To TourLife', 'You are about to start a professional tennis career. Nobody has heard of you yet.'],
  ['🌍', 'Your Goal', 'Start at the small ITF events, win matches, climb the world ranking and work your way up to the ATP Tour, the Grand Slams and world No. 1.'],
  ['🧬', 'First: Create Your Player', 'Choose who you are and how you play. We will walk you through it one step at a time.'],
];

function openWelcome(step = 0, done) {
  const [icon, title, text] = WELCOME[step], last = step === WELCOME.length - 1;
  openModal(`<div class="help welcome"><div class="helpicon">${icon}</div><h2 class="itop">${title}</h2><p class="big">${text}</p>` +
    `<div class="helpdots">${WELCOME.map((_, i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('')}</div>` +
    `<button type="button" class="btn huge" id="wcNext">${last ? 'Create My Player' : 'Next'}</button>` +
    (step === 0 ? `<button type="button" class="link" id="wcSkip">I've Played Before: Skip The Tips</button>` : '') + `</div>`);
  $('wcNext').onclick = () => { if (last) { markTip('welcome'); closeModal(); done && done(); } else openWelcome(step + 1, done); };
  if ($('wcSkip')) $('wcSkip').onclick = () => { writeJSON(TIPS_KEY, { off: 1, welcome: 1 }); closeModal(); };
}

// --- Spotlight tour ------------------------------------------------------------------------
let tourOpen = false;
function runTour(id, tries = 0) {
  if (tipsOff() || tipsSeen()[id] || tourOpen || !TOURS[id]) return;
  // Wait for any open window (season review, an offer…) to close first.
  if (!$('modal').hidden) { if (tries < 30) setTimeout(() => runTour(id, tries + 1), 1000); return; }
  const steps = TOURS[id].filter(([sel]) => { const el = document.querySelector(sel); return el && el.offsetParent !== null; });
  if (!steps.length) return;
  tourOpen = true;
  const veil = document.createElement('div'); veil.className = 'tour-veil';
  const spot = document.createElement('div'); spot.className = 'tour-spot';
  const card = document.createElement('div'); card.className = 'tour-card';
  document.body.append(veil, spot, card);
  let i = 0;
  const place = () => {
    const el = document.querySelector(steps[i][0]);
    if (!el) return;
    const r = el.getBoundingClientRect(), pad = 8;
    Object.assign(spot.style, { top: `${r.top - pad}px`, left: `${r.left - pad}px`, width: `${r.width + pad * 2}px`, height: `${Math.min(r.height, innerHeight - 40) + pad * 2}px` });
    // Below the highlight if it fits, else above, else (tall areas) at the bottom of the screen.
    const h = card.offsetHeight;
    card.style.top = r.bottom + h + 24 < innerHeight ? `${r.bottom + 16}px`
      : r.top - h - 24 > 0 ? `${r.top - h - 16}px` : `${innerHeight - h - 12}px`;
    card.style.left = `${Math.max(12, Math.min(innerWidth - card.offsetWidth - 12, r.left + r.width / 2 - card.offsetWidth / 2))}px`;
  };
  const show = () => {
    const [sel, title, text] = steps[i], last = i === steps.length - 1;
    card.innerHTML = `<div class="tour-step">${i + 1} of ${steps.length}</div><b>${title}</b><p>${text}</p>` +
      `<div class="tour-nav"><button type="button" class="link" data-t="off">Skip Tips</button>` +
      `<button type="button" class="btn small" data-t="next">${last ? 'Got It' : 'Next'}</button></div>`;
    document.querySelector(sel).scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(place, 380);
  };
  const end = () => { markTip(id); veil.remove(); spot.remove(); card.remove(); tourOpen = false; removeEventListener('resize', place); removeEventListener('scroll', place); };
  card.onclick = e => {
    const b = e.target.closest('[data-t]');
    if (!b) return;
    if (b.dataset.t === 'off') { const s = tipsSeen(); s.off = 1; writeJSON(TIPS_KEY, s); end(); return; }
    if (++i >= steps.length) end(); else show();
  };
  addEventListener('resize', place); addEventListener('scroll', place, { passive: true });
  show();
}

// Called whenever a screen is shown.
function screenTips(name) {
  if (name === 'creator' && !tipsSeen().welcome && !tipsOff()) return; // the welcome comes first
  setTimeout(() => runTour(name === 'creator' ? 'creator' : name), 500);
}

// Brand-new visitor: welcome first, then the creator tour.
function startOnboarding() {
  if (readJSON(SAVE_KEY) || tipsOff()) return;
  if (!tipsSeen().welcome) setTimeout(() => openWelcome(0, () => runTour('creator')), 300);
  else runTour('creator');
}

// --- New-feature introductions ---------------------------------------------------------------
// When something new opens up (you can afford it, you've unlocked it, or it starts happening in your
// matches), a short set of slides explains it on Home. Each shows once per player.
const FEATURES_KEY = 'tourlife.features';
const FEATURES = [
  { id: 'prep', when: c => c.history.length >= 1 && c.money >= 1500, icon: '🧰', title: 'Prepare For Each Tournament', slides: [
    'Before your first match of a week, open "Prepare For The Week" on the draw screen.',
    'Pick up to 3 items: detailed scouting, a hitting partner who plays like your opponent, a surface camp, recovery, a sports psychologist or video analysis.',
    'Each one gives a small edge for that week only. Prices grow with the level of the event, so choose what actually helps you win.'] },
  { id: 'adapt', when: c => (currentRank(c) || 9999) <= 450, icon: '🧠', title: 'Smarter Opponents', slides: [
    'From the Challengers up, opponents adjust to your plan during the match, and more often the higher you climb.',
    'When they do, you see it in the match ("is standing further back…"). Change your plan at a set break or changeover to answer it.',
    'Many players also have a hidden strength their stats don\'t show. Detailed scouting reveals it before you play.'] },
  { id: 'coach', when: c => !hasTeam(c, 'coach') && c.history.length >= 4 && c.money >= teamCost(c, 'coach', 2) * 8, icon: '🧑‍🏫', title: 'You Can Afford A Coach', slides: [
    'Coaches train you faster and read your opponents: their game plan, their ratings, and a counter-plan for you.',
    'Hire one under Money & Team on Home. Wages are paid every week, and they go up as your ranking climbs.',
    'A coach gives you an edge, not the win: copy their plan word for word and smart opponents read it faster. Make it your own.'] },
  { id: 'master', when: c => teamLevel(c, 'coach') < 4 && c.history.length >= 4 && c.money >= teamCost(c, 'coach', 4) * 3, icon: '🎓', title: 'The Master Coach Is Within Reach', slides: [
    'The Master coach is the best there is, and the most expensive.',
    'It unlocks four advanced settings: target wing, shot depth, energy pacing and big-point risk.',
    'It also coaches you during matches: advice and counters at every changeover and set break, and a "Coach\'s Pick" on big points.'] },
  { id: 'mastergot', when: c => teamLevel(c, 'coach') >= 4, icon: '🎓', title: 'Your Master Coach', slides: [
    'Your game plan now has four 🎓 settings: target wing, shot depth & margin, energy pacing and big-point risk.',
    'Watch your matches to get the most from it: at changeovers and set breaks it reads the match and offers advice and two counters, one tap each.',
    'On break points and set points, the gold "Coach\'s Pick" is the call it recommends.'] },
  { id: 'changeovers', when: (c, p) => overall(p) >= 75 && (currentRank(c) || 9999) <= 230, icon: '🔁', title: 'Changeovers', slides: [
    'In ATP 250 and bigger main draws, a 75+ player gets changeovers: the match pauses after game 1 and then every two games.',
    'Keep playing, take your coach\'s advice or a counter, or adjust your plan right there on court.',
    'Tap "Don\'t Stop At Changeovers This Match" if you\'d rather play straight through.'] },
  { id: 'staff', when: c => (c.money || 0) >= 60000, icon: '💼', title: 'Build Your Team', slides: [
    'Money & Team now has More Staff & Upgrades: a fitness trainer, a mental coach, a travelling hitting partner, a stringer, an upgraded hotel and an agent.',
    'Each gives a real but modest edge. Wages rise as your ranking climbs, and everyone who travels with you adds their flights and hotel to each trip.',
    'An agent takes 12% of your sponsor money but brings bigger offers. Spend on what actually helps your game.'] },
  { id: 'study', when: c => typeof studyUnlocked === 'function' && studyUnlocked(c), icon: '📚', title: 'Study Room Unlocked', slides: [
    "You've made it to the ATP Tour. The Study Room is open: tap 🎬 Study Room at the top right of Home.",
    'Pick any two real ATP players, a surface, the conditions and the match length, then watch them play each other.',
    'Each player uses their real playstyle and game plan, so you can see how their points are built and how they adjust to each other.'] },
  { id: 'pc', when: c => c.badges && c.badges.elite, icon: '🏛️', title: 'Performance Center Unlocked', slides: [
    'You earned the Elite Program: the Performance Center is open, in the Prepare card on the draw screen.',
    'Premium preparation: an elite fitness camp, an intelligence package, a specialist sparring partner and technical breakthroughs. Big items take two of your three slots.',
    'Between rounds you can book premium recovery (each one this week helps less). Spend wisely: the right plan still decides the match.'] },
];
function featureIntro(c, p) {
  if (!c || !p || !$('modal').hidden) return;
  const seen = readJSON(FEATURES_KEY) || {};
  const f = FEATURES.find(x => !seen[x.id] && (() => { try { return x.when(c, p); } catch { return false; } })());
  if (!f) return;
  seen[f.id] = c.week; writeJSON(FEATURES_KEY, seen);
  const show = i => {
    const last = i === f.slides.length - 1;
    openModal(`<div class="help welcome"><div class="helpicon">${f.icon}</div><div class="newtag">New</div><h2 class="itop">${f.title}</h2><p class="big">${f.slides[i]}</p>` +
      `<div class="helpdots">${f.slides.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('')}</div>` +
      `<button type="button" class="btn huge" id="ftNext">${last ? 'Got It' : 'Next'}</button></div>`);
    $('ftNext').onclick = () => { if (last) closeModal(); else show(i + 1); };
  };
  // Never cover another window (season review, an offer…): try again next time Home opens.
  setTimeout(() => { if (!$('modal').hidden) { const s2 = readJSON(FEATURES_KEY) || {}; delete s2[f.id]; writeJSON(FEATURES_KEY, s2); return; } show(0); }, 700);
}
