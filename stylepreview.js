// stylepreview.js — Playstyle Preview (from Rebuild My Game): four signature points for every playstyle, played on
// court with a short note on how the point is built, modelled on how ATP players with that game construct points.
// Purely a demo: nothing here touches your career or the match engine.

// Each point: [title, how it's built, the engine-style point record, who serves (0 = you, near side)].
// Points end on the last shot: whoever hits it wins with a winner/volley/drop, or loses it with an error.
const SP = (how, len, w, extra = {}) => ({ how, len, w, ...extra });
const STYLE_POINTS = {
  'Serve-Dominant': [
    ['Ace Out Wide', 'The big serve swings out wide and never comes back. Free points like this are how big servers hold in bunches.', SP('ace', 1, 0), 0],
    ['Kick Second Serve', 'Even the second serve is a weapon: a heavy kick that jumps over the returner\'s shoulder.', SP('unreturned', 1, 0, { serve2: true }), 0],
    ['Serve, Then One Big Ball', 'A body serve jams the returner. The weak reply sits up and gets put away straight away.', SP('winner', 3, 0, { wing: 'fh' }), 0],
    ['Short Service Game', 'Pace and placement force a rushed return that sails long. Points rarely last more than two shots.', SP('fe', 2, 0), 0],
  ],
  'Serve +1 Attacker': [
    ['Wide Serve, Open Court', 'The Shelton and Fritz pattern: serve wide to pull the returner off the court, then drill the forehand into the open space.', SP('winner', 3, 0, { wing: 'fh' }), 0],
    ['T Serve, Inside-Out Forehand', 'Serve down the middle, run around the reply and crack an inside-out forehand.', SP('winner', 3, 0, { wing: 'fh' }), 0],
    ['Unreturned First Serve', 'When the first serve lands, the point is often over before it starts.', SP('unreturned', 1, 0), 0],
    ['First Strike Forces The Error', 'Serve, then a heavy first forehand into the corner. The opponent is stretched and misses.', SP('fe', 4, 0, { wing: 'fh' }), 0],
  ],
  'First-Strike Attacker': [
    ['Return Winner', 'Step in and take the return early. A first-strike player attacks on the very first ball they hit.', SP('winner', 2, 0, { returnWinner: true }), 1],
    ['Pouncing On The Second Serve', 'A second serve is an invitation: an aggressive return, then the kill on the next ball.', SP('winner', 4, 0, { serve2: true, wing: 'fh' }), 1],
    ['Serve +1 Forehand', 'On serve it\'s the same idea: one serve, one big forehand, done.', SP('winner', 3, 0, { wing: 'fh' }), 0],
    ['Big Return, Rushed Error', 'A deep, hard return lands at the server\'s feet, and their reply goes into the net.', SP('fe', 3, 0), 1],
  ],
  'Aggressive Baseliner': [
    ['Inside-Out Forehand', 'The Sinner and Alcaraz staple: build the rally, run around the backhand and rip the inside-out forehand.', SP('winner', 5, 0, { wing: 'fh' }), 0],
    ['Backhand Down The Line', 'Hold the cross-court rally, then change direction with a flat backhand down the line.', SP('winner', 7, 0, { wing: 'bh' }), 0],
    ['Pin Them Deep, Then Pounce', 'Heavy, deep balls push the opponent back until a short one comes, and it gets punished.', SP('winner', 9, 0, { wing: 'fh' }), 0],
    ['Taking Time Away', 'Standing on the baseline and hitting early, the pressure builds until the opponent cracks.', SP('fe', 6, 0), 0],
  ],
  'Flat Attacker': [
    ['On The Rise', 'Take the ball early and flat. It skids through low and the opponent never gets set.', SP('winner', 4, 0, { wing: 'fh' }), 1],
    ['Flat Backhand Line', 'A low, flat backhand down the line, no margin and no warning.', SP('winner', 5, 0, { wing: 'bh' }), 0],
    ['Return Off The Bounce', 'Block the serve back early and flat, straight past the server.', SP('winner', 2, 0, { returnWinner: true }), 1],
    ['Rushed Into An Error', 'Pace without spin rushes the opponent, and the mistake comes early in the rally.', SP('fe', 6, 0), 0],
  ],
  'Solid Baseliner': [
    ['Cross-Court, Then The Line', 'The Zverev pattern: a long cross-court backhand exchange until the opening for the line appears.', SP('winner', 11, 0, { wing: 'bh' }), 0],
    ['Depth Draws The Error', 'Ball after ball lands near the baseline. Eventually the opponent goes for too much and misses.', SP('ue', 9, 0), 1],
    ['Patient Build, Forehand Finish', 'Work the point side to side, wait for the short ball, then finish with the forehand.', SP('winner', 8, 0, { wing: 'fh' }), 1],
    ['Solid Hold', 'Serve, a deep forehand to the corner, and a forced error. Nothing flashy, just control.', SP('fe', 4, 0), 0],
  ],
  'Counterpuncher': [
    ['Passing Shot', 'The Medvedev and de Minaur weapon: let them come in, then thread the pass past them.', SP('winner', 6, 0, { net: { by: 1, won: false } }), 1],
    ['Absorb Everything', 'Deep behind the baseline, every ball comes back with interest until the opponent misses.', SP('ue', 13, 0), 1],
    ['Defense To Offense', 'Soak up the pressure, then turn one defensive ball into an attacking one and finish.', SP('winner', 10, 0, { wing: 'bh' }), 1],
    ['Lob Over The Net Rusher', 'They charge the net, and the counterpuncher simply flicks it over or past them.', SP('winner', 5, 0, { net: { by: 1, won: false } }), 0],
  ],
  'Defensive Grinder': [
    ['One More Ball', 'The Navone and Baez way: just make one more ball than the opponent, every time.', SP('ue', 17, 0), 1],
    ['Running Everything Down', 'Corner to corner and back again. The opponent finally overhits under the pressure.', SP('fe', 12, 0), 0],
    ['Chasing Down The Drop', 'They try a drop shot to end the grind. The grinder gets there and flicks it past them.', SP('dropchased', 5, 0, { drop: { by: 1, result: 'chased' } }), 0],
    ['Winning The War Of Attrition', 'A marathon rally that ends the way grinders love: with the other player\'s error.', SP('ue', 21, 0), 1],
  ],
  'Heavy-Topspin Baseliner': [
    ['High Ball To The Backhand', 'Heavy topspin kicks up above the opponent\'s shoulder on the backhand until they miss.', SP('fe', 9, 0), 1],
    ['Push Back, Then The Angle', 'The heavy ball drives them deep, then a short, dipping angle wins the point.', SP('winner', 7, 0, { wing: 'fh' }), 0],
    ['Cross-Court Forehand Grind', 'The Ruud plan: loopy, heavy forehands cross-court, rally after rally, until the error.', SP('ue', 12, 0), 0],
    ['Punish The Short Ball', 'When the opponent drops short, the heavy forehand is ready to finish it.', SP('winner', 6, 0, { wing: 'fh' }), 1],
  ],
  'Heavy-Topspin Attacker': [
    ['Heavy Forehand, Then The Kill', 'A big, heavy forehand moves the opponent off the court, and the next one goes into the open space.', SP('winner', 5, 0, { wing: 'fh' }), 0],
    ['Kick Serve, Forehand Winner', 'A kick serve to the backhand sets up a forehand on the very next ball.', SP('winner', 3, 0, { wing: 'fh' }), 0],
    ['Spin Forces The Error', 'The ball jumps so high and fast that the opponent can only fend it off, and it lands long.', SP('fe', 6, 0), 0],
    ['Approach Off The Heavy Ball', 'Pushed back by the spin, the opponent floats a reply, and it gets finished at the net.', SP('winner', 7, 0, { net: { by: 0, won: true } }), 0],
  ],
  'All-Court': [
    ['Rally, Approach, Volley', 'The Alcaraz complete game: win the rally, step in behind a big ball and finish at the net.', SP('winner', 7, 0, { net: { by: 0, won: true } }), 0],
    ['Drop Shot From The Baseline', 'With the opponent camped deep, a disguised drop shot dies just over the net.', SP('drop', 6, 0, { drop: { by: 0, result: 'won' } }), 1],
    ['Defend, Then Inside-Out', 'Defend the first few balls, then switch to attack with an inside-out forehand.', SP('winner', 9, 0, { wing: 'fh' }), 0],
    ['Return And Rush', 'Chip the return and follow it in, taking the net away from the server.', SP('winner', 4, 0, { net: { by: 0, won: true } }), 1],
  ],
  'Net Attacker': [
    ['Approach And Volley', 'The Tiafoe and Davidovich Fokina move: a deep approach shot, then a crisp volley into the open court.', SP('winner', 5, 0, { net: { by: 0, won: true } }), 0],
    ['Chip And Charge', 'Chip the return low and charge in behind it. The server has to pass from below the net.', SP('winner', 4, 0, { net: { by: 0, won: true } }), 1],
    ['Forcing The Pass', 'Coming in puts the pressure on: the opponent has to hit a perfect pass, and misses.', SP('fe', 6, 0, { net: { by: 0 } }), 0],
    ['Finish At The Net', 'Control the point from the front of the court and put the ball away up close.', SP('winner', 7, 0, { net: { by: 0, won: true } }), 0],
  ],
  'Serve-and-Volley': [
    ['Serve, Volley, Point', 'The classic: serve and follow it straight in. The first volley wins the point.', SP('winner', 3, 0, { net: { by: 0, won: true } }), 0],
    ['Wide Serve, Volley Into The Open Court', 'Serve out wide, rush in and put the volley into the empty side of the court.', SP('winner', 3, 0, { net: { by: 0, won: true } }), 0],
    ['Low Return, Then The Put-Away', 'The returner dips one at the feet. Dig it up, close in and finish the next one.', SP('winner', 5, 0, { net: { by: 0, won: true } }), 0],
    ['Rushing The Passer', 'Serve and charge. Under pressure from the server closing in, the returner rushes the pass and misses.', SP('fe', 4, 0, { net: { by: 0 } }), 0],
  ],
  'Variety / Slice-Heavy': [
    ['Low Slice Draws The Error', 'A skidding backhand slice stays low. The opponent has to lift it, and nets it.', SP('fe', 7, 0), 1],
    ['Slice, Then The Drop', 'The Musetti touch: slice to slow things down, then a drop shot when they\'re deep.', SP('drop', 6, 0, { drop: { by: 0, result: 'won' } }), 1],
    ['Changing Height', 'Loopy, high balls then a flat one: no rhythm for the opponent, who finally misses.', SP('ue', 9, 0), 1],
    ['Slice Approach, Volley', 'A low slice approach is hard to pass. Come in behind it and volley the reply away.', SP('winner', 5, 0, { net: { by: 0, won: true } }), 0],
  ],
  'Creative Shotmaker': [
    ['Disguised Drop Shot', 'The Bublik and Moutet surprise: shape up for a big shot, then feather a drop shot that spins away.', SP('drop', 4, 0, { drop: { by: 0, result: 'won', spin: true } }), 1],
    ['Underarm Serve', 'The returner is standing way back, so serve underarm and catch them out.', SP('underarmWin', 1, 0, { underarm: true }), 0],
    ['Drop Answered With A Drop', 'They try a drop shot. Instead of hitting hard, answer with an even softer drop of your own.', SP('dropchased', 5, 0, { drop: { by: 1, result: 'chased', redrop: true } }), 0],
    ['Out-Of-Nowhere Angle', 'From a neutral rally, a sharp, unexpected backhand angle that nobody saw coming.', SP('winner', 6, 0, { wing: 'bh' }), 1],
  ],
};

// The playstyle's usual game plan, so the court plays it the way that style would.
function previewPlan(name) {
  const st = STYLES.find(x => x.name === name) || {};
  return { ...DEFAULT_PLAN, ...(st.agg ? { aggression: st.agg } : {}), ...(st.spin ? { spin: st.spin } : {}),
    ...(['Net Attacker', 'Serve-and-Volley', 'All-Court'].includes(name) ? { net: 'often' } : {}),
    ...(['Variety / Slice-Heavy', 'Creative Shotmaker', 'All-Court'].includes(name) ? { drops: 'often' } : {}),
    ...(['Serve-Dominant', 'Serve +1 Attacker'].includes(name) ? { serve: 'big' } : {}) };
}

const previewState = { style: null, i: 0 };
function openStylePreview(p, attrs, start, onBack, backLabel = 'Back To My Rebuild') {
  const st = previewState;
  if (!st.style || start) st.style = start || styleOf({ ...p, attrs }).name;
  const pts = STYLE_POINTS[st.style] || STYLE_POINTS['All-Court'];
  st.i = Math.min(st.i, pts.length - 1);
  const [title, text] = pts[st.i];
  let closed = false;
  openModal(`<button type="button" class="x" id="mx" aria-label="Close">×</button><h2 class="itop">🎬 Playstyle Preview</h2>` +
    `<p class="hint center">See how each playstyle builds its points before you commit your points to it.</p>` +
    `<select id="pvStyle" class="inp">${STYLES.map(s => `<option ${s.name === st.style ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>` +
    `<div class="seg pvtabs" style="grid-template-columns:repeat(${pts.length},1fr)">${pts.map((x, i) => `<button type="button" data-i="${i}" class="${i === st.i ? 'on' : ''}">Point ${i + 1}</button>`).join('')}</div>` +
    `<canvas id="pvCourt" class="court"></canvas>` +
    `<div class="pvtext"><b>${esc(title)}</b><p>${esc(text)}</p></div>` +
    `<div class="pbtns"><button type="button" class="btn ghost" id="pvAgain">↻ Restart Point</button><button type="button" class="btn" id="pvBack">‹ ${esc(backLabel)}</button></div>`,
    { wide: true, onClose: () => { closed = true; ReplayCourt.skip = true; if (onBack) onBack(); } });
  $('mx').onclick = closeModal;
  $('pvBack').onclick = closeModal;
  $('pvStyle').onchange = e => { st.style = e.target.value; st.i = 0; ReplayCourt.skip = true; openStylePreview(p, attrs, null, onBack, backLabel); };
  $('sheet').querySelectorAll('.pvtabs [data-i]').forEach(b => { b.onclick = () => { st.i = +b.dataset.i; ReplayCourt.skip = true; openStylePreview(p, attrs, null, onBack, backLabel); }; });
  const prof = (style, a, hand) => ({ ground: a.ground, adv: {}, real: false, legend: false, hand, backhand: 'two', iq: a.iq, net: a.net, plan: previewPlan(style), style, trait: null });
  const opp = { serve: 75, ground: 75, ret: 75, net: 65, stam: 75, mental: 75, iq: 75 };
  // One point at a time: any point still playing (from another style or tab) is stopped and finished first, then
  // the court is set up fresh with both players in place.
  const play = async () => {
    const [, , pt, server] = pts[st.i], token = st.token = (st.token || 0) + 1;
    ReplayCourt.skip = true;
    await (st.running || Promise.resolve());
    if (closed || token !== st.token || !$('pvCourt')) return;
    ReplayCourt.skip = false;
    ReplayCourt.setBreak(false);
    ReplayCourt.banner(null);
    ReplayCourt.mount($('pvCourt'));
    ReplayCourt.setOptions({ showType: true, showWing: true });
    ReplayCourt.setAngle(null);
    ReplayCourt.setWeather(null, false, {});
    ReplayCourt.scene('hard', false, ['You', 'Opponent'], [prof(st.style, attrs, p.hand || 'right'), prof('Solid Baseliner', opp, 'right')]);
    ReplayCourt.reset(server);
    ReplayCourt.draw();
    await new Promise(r => setTimeout(r, 500));
    if (closed || token !== st.token) return;
    // Serve speeds (km/h, first and second serve) by playstyle: the court needs them to time every shot after the serve.
    const big = ['Serve-Dominant', 'Serve +1 Attacker', 'Serve-and-Volley'].includes(st.style), mine = server === 0;
    const kmh1 = mine ? (big ? 212 : 192) : 188, kmh2 = mine ? (big ? 172 : 158) : 155;
    st.running = ReplayCourt.playPoint({ kmh1, kmh2, ...pt, review: false }, { server, deuce: true }, 1).catch(() => {});
    await st.running;
    // Loop: a short pause, then the same point again, until you pick another point or style or close the preview.
    await new Promise(r => setTimeout(r, 1600));
    if (!closed && token === st.token && $('pvCourt')) play();
  };
  $('pvAgain').onclick = play;
  play();
}
