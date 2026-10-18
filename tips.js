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
    ['#name', 'Who are you?', 'Give your player a name and pick the country they play for.'],
    ['#temper', 'Your temperament', 'How you react when things go right or wrong on court. Every type has its upside and its downside.'],
    ['#attrs', 'Your seven stats', 'Share out your points. Strong serve? Great returner? Fit enough to grind? There is no perfect build, just your build.'],
    ['#topStyle', 'Your playstyle', 'The shape of your stats gives you a playstyle. Move the sliders and watch it change.'],
    ['#fav', 'Surfaces', 'Pick your best and worst court. You will play better on one and worse on the other.'],
    ['#cPlan', 'Game plan', 'How you like to play. You can change it before any match, so do not overthink it now.'],
    ['#save', 'Ready?', 'Start your career. You begin at the bottom of the tennis world.'],
  ],
  home: [
    ['#hOvr', 'This is you', 'Your overall rating, your playstyle and your chances at the levels you can play. Get better and these climb.'],
    ['#events', 'Each week, pick a tournament', 'Tap Preview to see your chances and the cost of the trip, then enter. Your ranking decides which events let you in.'],
    ['#hGoals', 'Season goals', 'Five goals for the season. Reach one and you get a reward on the spot.'],
    ['#hTeam', 'Money and team', 'Prize money pays your travel. Later you can hire a coach and a physio, and brands will come calling.'],
    ['#share', 'Play with real people', 'Send your player in to be entered into tournaments against other players\' characters.'],
  ],
  draw: [
    ['#dAction .vsbox', 'Your next match', 'You against your next opponent, and how each of you likes to play.'],
    ['#dAction .scard', 'Scout them', 'Their strengths, weaknesses and habits, plus the weather. Use it to plan.'],
    ['#dPlanBtn', 'Change your plan', 'Adjust your game plan to beat this particular opponent.'],
    ['#dPlay', 'Play the match', 'When you are ready, play it.'],
  ],
  match: [
    ['#mActions .modes', 'How do you want to play it?', 'Watch every point live, go set by set, or skip to the result. Watching lets you make the big calls yourself.'],
    ['#mCourtWrap', 'The court', 'While you watch, switch camera views here. On big points the match will stop and ask you what to do.'],
  ],
  review: [
    ['#rStoryBox', 'What happened', 'The story of the match, and below it the full stats.'],
    ['#rSave', 'Get better', 'After every match, pick one thing to work on. Those stats go up for good.'],
  ],
  train: [
    ['#tStatus', 'Your body', 'Fatigue builds with matches and training. Keep an eye on it.'],
    ['#tBody', 'Free days', 'Days without matches: train here, travel early to next week\'s event, or rest.'],
  ],
};

// --- Welcome (brand-new players) ----------------------------------------------------------
const WELCOME = [
  ['🎾', 'Welcome to TourLife', 'You are about to start a professional tennis career. Nobody has heard of you yet.'],
  ['🌍', 'Your goal', 'Start at the small ITF events, win matches, climb the world ranking and work your way up to the ATP Tour, the Grand Slams and world No. 1.'],
  ['🧬', 'First: create your player', 'Choose who you are and how you play. We will walk you through it one step at a time.'],
];

function openWelcome(step = 0, done) {
  const [icon, title, text] = WELCOME[step], last = step === WELCOME.length - 1;
  openModal(`<div class="help welcome"><div class="helpicon">${icon}</div><h2 class="itop">${title}</h2><p class="big">${text}</p>` +
    `<div class="helpdots">${WELCOME.map((_, i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('')}</div>` +
    `<button type="button" class="btn huge" id="wcNext">${last ? 'Create my player' : 'Next'}</button>` +
    (step === 0 ? `<button type="button" class="link" id="wcSkip">I've played before: skip the tips</button>` : '') + `</div>`);
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
      `<div class="tour-nav"><button type="button" class="link" data-t="off">Skip tips</button>` +
      `<button type="button" class="btn small" data-t="next">${last ? 'Got it' : 'Next'}</button></div>`;
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
