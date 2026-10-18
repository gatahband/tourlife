// ranking.js — world ranking from your last 52 weeks of results, and who can enter what.

// A realistic ranking curve: points needed for a given world ranking (about 1,500 ranked players).
const RANK_CURVE = [[1, 9000], [10, 3000], [50, 1100], [100, 650], [200, 330], [300, 210], [400, 140],
  [500, 100], [700, 55], [1000, 22], [1300, 8], [1500, 3], [1800, 1]];

// Ranking points: your best 18 results from the last 52 weeks (like the real tour's best-of rule).
const COUNT_BEST = 18;
function rankingPoints(career, extra = 0) {
  const recent = career.history.filter(h => h.week > career.week - 52).map(h => h.points).sort((a, b) => b - a);
  return recent.slice(0, COUNT_BEST).reduce((a, b) => a + b, 0) + extra;
}

// Points dropping off within the next 4 weeks (results from 48–51 weeks ago).
function pointsExpiring(career) {
  return career.history.filter(h => h.week > career.week - 52 && h.week <= career.week - 48).reduce((a, h) => a + h.points, 0);
}

// World ranking for a points total (null = unranked).
function rankFromPoints(pts) {
  if (pts <= 0) return null;
  if (pts >= RANK_CURVE[0][1]) return 1;
  for (let i = 1; i < RANK_CURVE.length; i++) {
    const [r0, p0] = RANK_CURVE[i - 1], [r1, p1] = RANK_CURVE[i];
    if (pts >= p1) return Math.round(r0 * Math.exp(Math.log(r1 / r0) * Math.log(p0 / pts) / Math.log(p0 / p1)));
  }
  return 1900;
}

function currentRank(career) {
  return rankFromPoints(rankingPoints(career));
}

// Can you enter this event? 'main' (straight in), 'qual' (qualifying), or 'locked'.
function eligibility(ev, rank) {
  const t = TIERS[ev.tier];
  if (t.main === null) return 'main';
  if (rank && rank <= t.main) return 'main';
  if (rank && rank <= t.qual) return 'qual';
  return 'locked';
}

const rankText = r => r ? `#${r}` : 'Unranked';
