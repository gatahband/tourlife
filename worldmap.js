// worldmap.js — small world maps: where you are and where an event is (in previews), and the path of
// your season so far (Home). Land outlines come from the public world-atlas data, loaded once.

// Rough position of each country's main tennis city (lat, lon).
const NATION_LL = {
  ARG: [-34.6, -58.4], AUS: [-33.9, 151.2], AUT: [48.2, 16.4], BEL: [50.8, 4.4], BRA: [-23.5, -46.6], BUL: [42.7, 23.3],
  CAN: [43.7, -79.4], CHI: [-33.4, -70.6], CHN: [39.9, 116.4], COL: [4.7, -74.1], CRO: [45.8, 16.0], CZE: [50.1, 14.4],
  DEN: [55.7, 12.6], EGY: [30.0, 31.2], ESP: [40.4, -3.7], FIN: [60.2, 24.9], FRA: [48.9, 2.4], GBR: [51.5, -0.1],
  GER: [52.5, 13.4], GRE: [38.0, 23.7], HUN: [47.5, 19.0], IND: [28.6, 77.2], ITA: [41.9, 12.5], JPN: [35.7, 139.7],
  KAZ: [51.2, 71.4], KOR: [37.6, 127.0], MAR: [33.6, -7.6], MEX: [19.4, -99.1], NED: [52.4, 4.9], NGA: [6.5, 3.4],
  NOR: [59.9, 10.8], POL: [52.2, 21.0], POR: [38.7, -9.1], RSA: [-26.2, 28.0], SRB: [44.8, 20.5], SUI: [46.9, 7.4],
  SWE: [59.3, 18.1], TUN: [36.8, 10.2], TUR: [41.0, 29.0], USA: [38.9, -77.0], MON: [43.7, 7.4], PER: [-12.0, -77.0],
  PAR: [-25.3, -57.6], HKG: [22.3, 114.2], SVK: [48.1, 17.1], URU: [-34.9, -56.2],
};

let WORLD_PATH = null, worldLoading = null;
const MAP_W = 360, MAP_H = 170, LAT_TOP = 76, LAT_BOT = -56;
const proj = ([lat, lon]) => [(lon + 180) / 360 * MAP_W, (LAT_TOP - lat) / (LAT_TOP - LAT_BOT) * MAP_H];

function loadScript(src) {
  return new Promise((ok, fail) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = fail; document.head.appendChild(s); });
}

// Land outline as one SVG path (equirectangular, cropped to the inhabited latitudes).
async function worldPath() {
  if (WORLD_PATH) return WORLD_PATH;
  if (!worldLoading) worldLoading = (async () => {
    if (typeof topojson === 'undefined') await loadScript('https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js');
    const topo = await (await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json')).json();
    const land = topojson.feature(topo, topo.objects.land);
    let d = '';
    const ring = r => {
      let prev = null;
      r.forEach(([lon, lat], i) => {
        const [x, y] = proj([Math.max(LAT_BOT - 2, Math.min(LAT_TOP + 2, lat)), lon]);
        // Break the line where it wraps around the edge of the map.
        const jump = prev && Math.abs(x - prev[0]) > MAP_W / 2;
        d += `${i === 0 || jump ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
        prev = [x, y];
      });
      d += 'Z';
    };
    for (const f of land.features) {
      const g = f.geometry;
      (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).forEach(poly => poly.forEach(ring));
    }
    WORLD_PATH = d;
    return d;
  })();
  return worldLoading;
}

// Great-circle distance in km.
function kmBetween(a, b) {
  const R = 6371, rad = x => x * Math.PI / 180;
  const dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

// A curved route between two points (bowed upward, like a flight path).
function arcPath(a, b) {
  const [x1, y1] = proj(a), [x2, y2] = proj(b);
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - Math.min(40, Math.hypot(x2 - x1, y2 - y1) * 0.25);
  return `M${x1.toFixed(1)},${y1.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
}

// Map placeholder; the land fills in once loaded. opts: { route: [fromCode, toCode] } or { path: [codes…], here }.
function mapHtml(opts) {
  const id = `map${Math.random().toString(36).slice(2, 8)}`;
  let marks = '';
  if (opts.route) {
    const [a, b] = opts.route.map(n => NATION_LL[n]).filter(Boolean);
    if (a && b) {
      if (opts.route[0] !== opts.route[1]) marks += `<path d="${arcPath(a, b)}" class="mroute"/>`;
      const [ax, ay] = proj(a), [bx, by] = proj(b);
      marks += `<circle cx="${ax}" cy="${ay}" r="3.2" class="mhere"/><circle cx="${bx}" cy="${by}" r="3.4" class="mdest"/>`;
    }
  }
  if (opts.path) {
    const pts = opts.path.map(n => NATION_LL[n]).filter(Boolean);
    for (let i = 1; i < pts.length; i++) marks += `<path d="${arcPath(pts[i - 1], pts[i])}" class="mpath"/>`;
    pts.forEach((p, i) => { const [x, y] = proj(p); marks += `<circle cx="${x}" cy="${y}" r="${i === pts.length - 1 ? 3.4 : 2.2}" class="${i === pts.length - 1 ? 'mhere' : 'mstop'}"/>`; });
    // Name the dot you're on, so it stands out from the rest.
    if (opts.hereLabel && pts.length) {
      const [x, y] = proj(pts[pts.length - 1]), w = opts.hereLabel.length * 5.6 + 14, tx = Math.max(w / 2 + 4, Math.min(MAP_W - w / 2 - 4, x));
      const up = y > 30, ty = up ? y - 24 : y + 9; // above the dot, or below it near the top edge
      marks += `<circle cx="${x}" cy="${y}" r="6" class="mpulse"/>` +
        `<g class="mtag"><rect x="${(tx - w / 2).toFixed(1)}" y="${ty.toFixed(1)}" width="${w.toFixed(1)}" height="15" rx="7.5"/>` +
        `<text x="${tx.toFixed(1)}" y="${(ty + 10.8).toFixed(1)}">${esc(opts.hereLabel)}</text></g>`;
    }
  }
  setTimeout(async () => {
    try { const d = await worldPath(); const el = document.getElementById(id); if (el) el.querySelector('.mland').setAttribute('d', d); } catch {}
  }, 0);
  return `<svg id="${id}" class="wmap" viewBox="0 0 ${MAP_W} ${MAP_H}" preserveAspectRatio="xMidYMid meet"><path class="mland" d=""/>${marks}</svg>`;
}

// Event preview: from where you are to the event.
function routeHtml(from, to) {
  const a = NATION_LL[from], b = NATION_LL[to];
  const km = a && b ? kmBetween(a, b) : 0, days = travelDays(from, to);
  const name = n => (nationInfo(n) || [n, '', n])[2];
  return `<div class="routebox">${mapHtml({ route: [from, to] })}` +
    `<p class="hint center">${from === to ? `🏠 You're already in ${name(to)}: no flight needed.` :
      `📍 ${flagOf(from)} ${name(from)} → ${flagOf(to)} ${name(to)} · about ${km.toLocaleString('en-US')} km · ${days} travel day${days === 1 ? '' : 's'}`}</p></div>`;
}

// Home: everywhere you've played this season, in order.
function itineraryHtml(c, p) {
  const season = seasonOfWeek(c.week);
  const stops = c.history.filter(h => seasonOfWeek(h.week) === season && h.nation && !h.real).map(h => ({ n: h.nation, city: h.city }));
  const path = [p.nation, ...stops.map(s => s.n)];
  const here = c.location || p.nation;
  if (path[path.length - 1] !== here) path.push(here);
  const km = path.slice(1).reduce((t, n, i) => t + (NATION_LL[n] && NATION_LL[path[i]] ? kmBetween(NATION_LL[path[i]], NATION_LL[n]) : 0), 0);
  const last = stops.slice(-5).map(s => esc(s.city)).join(' → ');
  return `<div class="itin"><div class="gbhead"><b>Season ${season} itinerary</b><span>${stops.length} event${stops.length === 1 ? '' : 's'} · ${km.toLocaleString('en-US')} km</span></div>` +
    mapHtml({ path, hereLabel: `You're here: ${stops.length && stops[stops.length - 1].n === here ? stops[stops.length - 1].city : here === p.nation ? 'Home' : (nationInfo(here) || [here, '', here])[2]}` }) +
    `<p class="hint center">${stops.length ? `${stops.length > 5 ? '… → ' : '🏠 → '}${last}` : 'Your season starts here. Every event you play adds a stop.'}</p></div>`;
}
