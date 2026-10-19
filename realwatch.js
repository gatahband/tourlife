// realwatch.js — watch a match the admin played (a real tournament or a one-on-one). The admin saves the
// random seed plus a snapshot of both players and the conditions, so the same engine replays the exact
// same match here, point by point, on court.

// Re-run the match from its seed. Returns the points of each set (or null if the replay can't be matched).
function replayMatch(rp) {
  const rng = seeded(rp.seed);
  const ps = JSON.parse(JSON.stringify(rp.ps));
  const m = newMatch(0, 1, rng, true);
  if (rp.bestOf) m.bestOf = rp.bestOf;
  const sets = [];
  let guard = 0;
  while (m.winner === null && guard++ < 7) { playSet(m, ps, rp.ev, rng); sets.push(m.points.slice()); }
  return { m, ps, sets };
}

// opts.neutral: the admin streaming any match (both players by name, no result shown up front).
// opts.onDone when it finishes; opts.onNext offers "Next match"; opts.onClose when the window closes.
function watchRealMatch(rec, opts = {}) {
  const rp = rec.replay;
  if (!rp) return;
  const { m, ps, sets } = replayMatch(rp);
  const neutral = !!opts.neutral;
  const me = rp.side, op = 1 - me, view = i => (i === me ? 0 : 1);
  const same = neutral || scoreLine(m, me) === rec.score;
  const name = i => (i === me && !neutral ? 'You' : shortName(ps[i]));
  const label = i => (i === me && !neutral ? `${flagOf(ps[i].nation)} You` : `${flagOf(ps[i].nation)} ${esc(ps[i].name)}`);
  let ang = readJSON('tourlife.replayAngle') || 'broadcast', speed = readJSON(SPEED_KEY) || 1, paused = false, closed = false, skipTo = null;

  openModal(`<button type="button" class="x" id="mx" aria-label="Close">×</button>` +
    (neutral ? `<h2 class="itop">${esc(rec.round)}: ${label(0)} vs ${label(1)}</h2>`
      : `<h2 class="itop">${rec.won ? '✅' : '❌'} ${esc(rec.round)} vs ${flagOf(ps[op].nation)} ${esc(ps[op].name)}</h2>`) +
    `<p class="hint center">${esc(rec.event || rp.ev.city || '')} · ${surfaceLabel(rp.ev.surface)}${rp.ev.indoor ? ' indoor' : ''}${neutral ? '' : ` · Final score ${rec.score}`}</p>` +
    `<button type="button" class="btn small ghost rwfs" id="rwFs">⛶ Full screen</button><div id="rwStage">` +
    (same ? '' : `<p class="hint center warnline">This match was played on an older version, so the replay may differ a little from the real result.</p>`) +
    `<table class="board" id="rwBoard"></table>` +
    `<div class="rpbar"><div class="seg four" id="rwAngle">${[['broadcast', 'Broadcast'], ['reverse', 'Reverse'], ['side', 'Side'], ['top', 'Top-down'], ['fps', 'POV: You'], ['fps2', 'POV: Opp']]
      .map(([v, l]) => `<button type="button" data-v="${v}" class="${v === ang ? 'on' : ''}">${l}</button>`).join('')}</div>` +
    `<div class="seg" id="rwSpeed" style="grid-template-columns:repeat(3,1fr)">${[1, 2, 4].map(x => `<button type="button" data-s="${x}" class="${x === speed ? 'on' : ''}">${x}×</button>`).join('')}</div></div>` +
    `<canvas id="rwCourt" class="court"></canvas><div id="rwCall" class="call"></div>` +
    `<div class="btn-row three"><button type="button" class="btn ghost" id="rwPause">❚❚ Pause</button>` +
    `<button type="button" class="btn ghost" id="rwGame">⏭ Next game</button><button type="button" class="btn ghost" id="rwSet">⏩ Next set</button></div>` +
    (opts.onNext ? `<button type="button" class="btn" id="rwNext" hidden>Next match ›</button>` : '') + `</div>`,
    { wide: true, onClose: () => { closed = true; ReplayCourt.skip = true; ReplayCourt.pauseCheck = () => false; if (!going && opts.onClose) opts.onClose(); } });
  let going = false;
  if ($('rwNext')) $('rwNext').onclick = () => { going = true; closeModal(); opts.onNext(); };
  $('rwFs').onclick = () => { const st = $('rwStage'); (st.requestFullscreen || st.webkitRequestFullscreen).call(st); setTimeout(() => ReplayCourt.resize(), 200); };

  ReplayCourt.skip = false;
  ReplayCourt.mount($('rwCourt'));
  ReplayCourt.setOptions({ showType: true, showWing: true, ...readJSON(LABELS_KEY) });
  ReplayCourt.setAngle(ang === 'broadcast' ? null : ang);
  ReplayCourt.pauseCheck = () => paused;
  const prof = p => ({ real: !!p.atpRank, hand: p.hand || 'right', backhand: p.backhand || 'two', iq: attr(p, 'iq'), net: p.attrs.net, plan: planOf(p),
    style: detectStyles(p.attrs, p.fav)[0].name });
  ReplayCourt.scene(rp.ev.surface, rp.ev.indoor, [name(me), name(op)], [prof(ps[me]), prof(ps[op])]);

  const board = (done, games, labels, server) => {
    const row = (i, v) => `<tr><th><span class="serve-dot${server === v ? '' : ' off'}"></span>${label(i)}</th>` +
      done.map(st => `<td class="${st.games[i] > st.games[1 - i] ? 'w' : ''}">${st.games[i]}</td>`).join('') +
      (games ? `<td class="cur">${games[i]}</td><td class="pts">${labels[v]}</td>` : '') + `</tr>`;
    $('rwBoard').innerHTML = row(me, 0) + row(op, 1);
  };

  $('rwAngle').onclick = e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    ang = b.dataset.v; writeJSON('tourlife.replayAngle', ang);
    $('rwAngle').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    ReplayCourt.setAngle(ang === 'broadcast' ? null : ang);
  };
  $('rwSpeed').onclick = e => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    speed = +b.dataset.s;
    $('rwSpeed').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  };
  $('rwPause').onclick = () => { paused = !paused; $('rwPause').textContent = paused ? '▶ Resume' : '❚❚ Pause'; };
  $('rwGame').onclick = () => { skipTo = 'game'; paused = false; ReplayCourt.skip = true; };
  $('rwSet').onclick = () => { skipTo = 'set'; paused = false; ReplayCourt.skip = true; };
  $('mx').onclick = closeModal;

  const mapBy = o => o && { ...o, by: view(o.by) };
  (async () => {
    const done = [];
    for (let si = 0; si < sets.length && !closed; si++) {
      let inGame = 0;
      for (let j = 0; j < sets[si].length && !closed; j++) {
        const pt = sets[si][j];
        while (paused && !closed) await new Promise(r => setTimeout(r, 120));
        const L = pt.end ? ['', ''] : ptsLabels(pt.pts, pt.tb);
        ReplayCourt.skip = !!skipTo;
        $('rwCall').textContent = pt.press ? `${pt.press.match ? 'Match' : 'Set'} point — ${name(pt.press.who)}` : pt.bp !== null ? `Break point — ${name(pt.bp)}` : '';
        await ReplayCourt.playPoint({ ...pt, review: false, w: view(pt.w), net: mapBy(pt.net), drop: mapBy(pt.drop), netcord: mapBy(pt.netcord),
          call: pt.call && { ...pt.call, side: view(pt.call.side) } }, { server: view(pt.s), deuce: inGame % 2 === 0 }, speed);
        board(done, pt.games, [L[me], L[op]], view(pt.s));
        if (pt.end) {
          inGame = 0;
          if (skipTo === 'game') skipTo = null;
          $('rwCall').textContent = `${pt.tb ? 'Tiebreak' : pt.w !== pt.s ? 'Break' : 'Game'} — ${name(pt.w)}`;
        } else inGame++;
        if (!ReplayCourt.skip) await new Promise(r => setTimeout(r, (pt.end ? 1100 : 500) / speed));
      }
      done.push(m.sets[si]);
      if (skipTo === 'set') skipTo = null;
      board(done, null, null, -1);
    }
    if (closed) return;
    $('rwCall').textContent = neutral ? `${shortName(ps[m.winner])} wins ${scoreLine(m, m.winner)}` : `${rec.won ? 'You won' : `${shortName(ps[op])} won`} ${rec.score}`;
    if (opts.onDone) opts.onDone();
    if ($('rwNext')) $('rwNext').hidden = false;
  })();
}
