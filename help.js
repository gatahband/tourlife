// help.js — a short "How To Play" walkthrough. Shown once when a new career starts (skippable),
// and any time from the "How To Play" button on Home.

const HELP_KEY = 'tourlife.helpSeen';

const HELP = [
  ['🎾', 'Welcome To TourLife',
    'You are a young pro starting at the bottom: small ITF events. Win matches, climb the world ranking and work your way up to Challengers, the ATP Tour and the Grand Slams.'],
  ['🧬', 'Your Build And Playstyle',
    'Your seven stats (serve, groundstrokes, return, net, stamina, mental, tennis IQ) decide how you play. Their shape (plus your spin and rally style) gives you a playstyle, like Serve +1 Attacker or Counterpuncher, and your standout stat adds a trait, like Powerful Serve. Every stat you raise can shift them. Tap Playstyle on Home to see your full build.'],
  ['📅', 'Every Week: Pick A Tournament',
    'On Home, choose an event for the week. Your ranking decides what you can enter: straight into the draw, qualifying first, or locked. Flights and a hotel cost money, so mind your bank. From ATP 250s up, you face the real top 100.'],
  ['🔎', 'Before Each Match: Make A Plan',
    'The draw screen shows a scouting report on your next opponent and your game plan. Change the plan to suit them: serve, return position, rally style, spin, net, drop shots. A coach adds their plan, a counter-plan and a read on their ratings.'],
  ['📺', 'Play The Match',
    'Watch Live, go Set By Set, or jump to the result. While you watch, big points stop for your call: go big, play safe, attack the net. The call that suits your build helps most. Watch 3 full games for extra growth (simmed matches teach you much less); watch the whole match and the growth from it is tripled. At each set break you can change your plan.'],
  ['📈', 'After Each Match: Improve',
    'Pick one adjustment card. Its stats go up for good. The card tells you which playstyle it pushes you toward, and the build preview shows exactly what changes.'],
  ['🏋️', 'Between Events: Train, Travel, Rest',
    'Spare days after an early loss can go on training, travelling early to next week\'s event (bigger gains and a comfort boost), or rest. Long flights tire you. Above 85 fatigue you play worse and can get injured, even mid-tournament. You can withdraw between matches.'],
  ['💰', 'Money And Your Team',
    'Prize money pays by round. Early on, money is tight: events at home are cheap (you stay with family), and weeks off bring in a little from coaching or hitting-partner work. Climb the ranking and sponsors start paying weekly, bigger events cover your hotel, and you can afford a better coach, a medical team and business-class flights.'],
  ['🏆', 'The Long Game',
    'Ranking points last 52 weeks. Players you keep meeting become rivals. Each season ends with a review and three goals for the next one. You age, peak in your late twenties, and choose when to retire. To carry on from another phone or computer, use Play On Another Device on Home.'],
  ['📨', 'Play With Real People',
    'Press "Join Real Tournaments" on Home to send your player in. Real players get entered into tournaments together and streamed live. Set your Match Orders so your player knows how to play each type of opponent, and the results show up in your game.'],
];

function openHelp(step = 0) {
  const [icon, title, text] = HELP[step];
  const last = step === HELP.length - 1;
  openModal(`<button type="button" class="x" id="mx" aria-label="Close">×</button>` +
    `<div class="help"><div class="helpicon">${icon}</div><h2 class="itop">${title}</h2><p class="big">${text}</p>` +
    `<div class="helpdots">${HELP.map((_, i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('')}</div>` +
    `<div class="shrow helpnav">${step ? '<button type="button" class="btn ghost small" id="hpBack">Back</button>' : ''}` +
    `<button type="button" class="btn small" id="hpNext">${last ? "Let's Play" : 'Next'}</button></div>` +
    (last ? '' : `<button type="button" class="link" id="hpSkip">Skip The Tutorial</button>`) + `</div>`,
    { onClose: () => { try { localStorage.setItem(HELP_KEY, '1'); } catch {} } });
  $('mx').onclick = closeModal;
  $('hpNext').onclick = () => last ? closeModal() : openHelp(step + 1);
  if ($('hpBack')) $('hpBack').onclick = () => openHelp(step - 1);
  if ($('hpSkip')) $('hpSkip').onclick = closeModal;
}

// New careers see it once.
function maybeShowHelp() {
  let seen = null;
  try { seen = localStorage.getItem(HELP_KEY); } catch {}
  if (!seen) setTimeout(() => openHelp(0), 300);
}
