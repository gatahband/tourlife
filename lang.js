// lang.js — plays TourLife in another language. The game itself is written (and saves) in English; this
// layer only swaps the words on screen: page text, a few attributes, canvas labels and pop-up dialogs.
// It never reads or writes a save, so changing language can't touch anyone's progress. In English it
// does nothing at all.
//
// Each lang-xx.js file adds a table to I18N_DATA: English text → translation. "{0}", "{1}" stand for
// numbers or names that change; captured parts are translated too where they're known. Text the table
// doesn't know stays in English.

const LANG_KEY = 'tourlife.lang';
const LANGS = [['en', 'English'], ['fr', 'Français'], ['es', 'Español'], ['pt', 'Português'], ['de', 'Deutsch'], ['ja', '日本語']];
var I18N_DATA = window.I18N_DATA || {};

const I18N = (() => {
  let lang = 'en';
  try { lang = localStorage.getItem(LANG_KEY) || 'en'; } catch {}
  const asked = (location.search.match(/[?&]lang=([a-z]{2})/) || [])[1]; // a link can pick the language
  if (asked && LANGS.some(([c]) => c === asked)) { lang = asked; try { localStorage.setItem(LANG_KEY, lang); } catch {} }
  if (!LANGS.some(([c]) => c === lang)) lang = 'en';

  let exact = null, patterns = [], phrases = [], cache = new Map();
  const ORIG = new WeakMap();      // text node → { o: English, t: what we put there }
  const ORIG_ATTR = new WeakMap(); // element → { attr: English }
  const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
  const SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1 }; // never touch what's typed: inputs only get their placeholder/title translated
  const LETTERS = /[A-Za-z]{2,}/;
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function build() {
    const tbl = I18N_DATA[lang] || {};
    exact = new Map(); patterns = []; phrases = []; cache = new Map();
    for (const k of Object.keys(tbl)) {
      const v = tbl[k];
      if (!v) continue;
      if (/\{\d+\}/.test(k)) {
        const lit = k.replace(/\{\d+\}/g, '\u0000');
        const chunks = lit.split('\u0000').map(c => c.trim()).filter(Boolean);
        if (!chunks.some(c => /[A-Za-z]{2,}/.test(c))) continue;
        const order = [];
        const rx = new RegExp('^' + k.split(/(\{\d+\})/).map(p => {
          const m = p.match(/^\{(\d+)\}$/);
          if (m) { order.push(+m[1]); return '(.*?)'; }
          return esc(p);
        }).join('') + '$');
        const key = chunks.sort((a, b) => b.length - a.length)[0];
        const weight = lit.replace(/\u0000/g, '').replace(/[^A-Za-z]/g, '').length;
        patterns.push({ rx, order, v, key, weight, weak: weight < 10 });
      } else {
        exact.set(k, v);
        if (k.length >= 12 && k.includes(' ')) phrases.push(k);
      }
    }
    patterns.sort((a, b) => b.weight - a.weight);
    phrases.sort((a, b) => b.length - a.length);
  }

  // English text → translated text, or null if we don't know it.
  function tr(text, depth = 0) {
    const norm = text.replace(/\s+/g, ' ').trim();
    if (!norm || !LETTERS.test(norm)) return null;
    const ck = depth ? '\u0001' + norm : norm; // deeper lookups skip some steps, so cache them apart
    if (cache.has(ck)) return cache.get(ck);
    let out = exact.get(norm);
    if (out === undefined) out = viaPattern(norm, depth, false);
    if (out == null) out = viaWrap(norm, depth);
    if (out == null) out = viaPattern(norm, depth, true); // short catch-alls ("{0} vs {1}"), kept to one label
    if (out == null && depth === 0) out = viaPieces(norm);
    if (out == null && depth === 0) out = viaPhrases(norm);
    if (out == null) out = null;
    if (cache.size > 20000) cache.clear();
    cache.set(ck, out);
    return out;
  }

  function viaPattern(norm, depth, weak) {
    for (const p of patterns) {
      if (p.weak !== weak || !norm.includes(p.key)) continue;
      const m = norm.match(p.rx);
      if (!m) continue;
      const caps = [];
      let ok = true;
      p.order.forEach((n, i) => {
        const raw = m[i + 1], t = depth < 3 ? tr(raw, depth + 1) : null;
        if (t == null && raw.length > 40 && LETTERS.test(raw)) ok = false; // a long untranslatable gap: probably not this line
        if (weak && /[.!?;]\s+\S|[·•|]/.test(raw)) ok = false; // a catch-all never swallows other sentences or labels
        caps[n] = t == null ? raw : t;
      });
      if (!ok) continue;
      return p.v.replace(/\{(\d+)\}/g, (_, n) => caps[n] != null ? caps[n] : '');
    }
    return null;
  }
  // An emoji or symbol in front ("☀️ Sunny and mild", "🎁 …"): translate what follows it.
  function viaWrap(norm, depth) {
    if (depth > 2) return null;
    let m = norm.match(/^([^A-Za-z0-9"'(‹]+)(.+)$/), t;
    if (m && (t = tr(m[2], depth + 1)) != null) return m[1] + t;
    m = norm.match(/^(.+?)\s*([:.…]+)$/); // "Fitness Trainer:" → the label, then the colon back
    if (m && (t = tr(m[1], depth + 1)) != null) return t + m[2];
    return null;
  }
  // Several labels or sentences joined together: translate each one (labels first, then sentences).
  function viaPieces(norm) {
    const join = (text, rx, each) => {
      const bits = text.split(rx);
      if (bits.length < 3) return null;
      let hit = false;
      const out = bits.map((b, i) => { if (i % 2 || !b) return b; const t = each(b); if (t != null) hit = true; return t != null ? t : b; }).join('');
      return hit ? out : null;
    };
    // Sentence breaks: "Done. Next" → "Done." + " " + "Next" (no lookbehind: older iPhones can't parse it).
    const SENT = /([.!?:])(\s+)/;
    const bySentence = text => {
      const p = text.split(SENT), bits = [];
      for (let i = 0; i < p.length; i += 3) { bits.push(p[i] + (p[i + 1] || '')); if (p[i + 2]) bits.push(p[i + 2]); }
      return bits;
    };
    const joinSent = text => { // longest run of known sentences first, so two-sentence lines stay whole
      const bits = bySentence(text);
      if (bits.length < 3) return null;
      let hit = false, out = '';
      for (let i = 0; i < bits.length; i += 2) {
        let t = null, j = bits.length - 1;
        for (; j > i; j -= 2) if ((t = tr(bits.slice(i, j + 1).join(''), 1)) != null) break;
        if (t == null) { t = tr(bits[i], 1); j = i; }
        if (t != null) hit = true;
        out += (t != null ? t : bits[i]) + (bits[j + 1] || '');
        i = j;
      }
      return hit ? out : null;
    };
    return join(norm, /(\s*[·•|]\s*)/, b => tr(b, 1) ?? joinSent(b)) ?? joinSent(norm);
  }
  // Last resort: swap known phrases inside the text (e.g. a name followed by a known line).
  function viaPhrases(norm) {
    let s = norm, hit = false;
    const put = [];
    for (const k of phrases) {
      if (k.length > s.length) continue;
      const i = s.indexOf(k);
      if (i < 0) continue;
      const before = s[i - 1], after = s[i + k.length];
      if ((before && /\w/.test(before)) || (after && /\w/.test(after))) continue;
      s = s.slice(0, i) + '\u0001' + put.length + '\u0002' + s.slice(i + k.length);
      put.push(exact.get(k)); hit = true;
    }
    return hit ? s.replace(/\u0001(\d+)\u0002/g, (_, n) => put[n]) : null;
  }

  function doText(node) {
    const rec = ORIG.get(node), cur = node.data;
    if (rec && cur === rec.t) return;
    const t = tr(cur);
    if (t == null) { if (rec) ORIG.delete(node); return; }
    const lead = cur.match(/^\s*/)[0], trail = cur.match(/\s*$/)[0];
    const val = lead + t + trail;
    ORIG.set(node, { o: cur, t: val });
    if (val !== cur) node.data = val;
  }
  function doAttrs(el) {
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const rec = ORIG_ATTR.get(el) || {}, cur = el.getAttribute(a);
      if (rec[a] && rec[a].t === cur) continue;
      const t = tr(cur);
      if (t == null) continue;
      rec[a] = { o: cur, t }; ORIG_ATTR.set(el, rec);
      el.setAttribute(a, t);
    }
  }
  function walk(root) {
    if (root.nodeType === 3) { if (!(root.parentNode && SKIP[root.parentNode.nodeName])) doText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 11) return;
    if (SKIP[root.nodeName] || (root.closest && root.closest('[data-noi18n]'))) return;
    if (root.nodeType === 1) doAttrs(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.nodeType === 1 && (SKIP[n.nodeName] || n.hasAttribute('data-noi18n')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    let n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
  }

  let obs = null, patched = false;
  function observe() {
    if (obs) return;
    obs = new MutationObserver(list => {
      if (lang === 'en') return;
      for (const m of list) {
        try {
          if (m.type === 'characterData') doText(m.target);
          else if (m.type === 'attributes') doAttrs(m.target);
          else m.addedNodes.forEach(walk);
        } catch {}
      }
    });
    obs.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  // Canvas labels (court graphics) and the browser's own pop-ups.
  function patch() {
    if (patched) return; patched = true;
    const C = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
    const wrap = (obj, name) => {
      const orig = obj && obj[name];
      if (typeof orig !== 'function') return;
      obj[name] = function (text, ...rest) {
        let t = text;
        if (lang !== 'en' && typeof text === 'string') { try { t = tr(text) || text; } catch {} }
        return orig.call(this, t, ...rest);
      };
    };
    ['fillText', 'strokeText', 'measureText'].forEach(n => wrap(C, n));
    ['alert', 'confirm', 'prompt'].forEach(n => wrap(window, n));
  }

  function restore() {
    const w = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) { const r = ORIG.get(n); if (r) { if (n.data === r.t) n.data = r.o; ORIG.delete(n); } }
      else { const r = ORIG_ATTR.get(n); if (r) { for (const a in r) if (n.getAttribute(a) === r[a].t) n.setAttribute(a, r[a].o); ORIG_ATTR.delete(n); } }
    }
  }

  function start() {
    try { build(); patch(); walk(document.documentElement); observe(); document.documentElement.lang = lang; } catch {}
  }

  function src(code) { return `lang-${code}.js` + (window.TL_VERSION ? `?v=${window.TL_VERSION}` : ''); }

  // Switch language on the spot: no reload, so nothing in memory is ever dropped.
  function set(code, done) {
    if (!LANGS.some(([c]) => c === code) || code === lang) { if (done) done(); return; }
    try { localStorage.setItem(LANG_KEY, code); } catch {}
    if (lang !== 'en') { try { restore(); } catch {} }
    lang = code;
    if (code === 'en') { cache = new Map(); document.documentElement.lang = 'en'; if (done) done(); return; }
    const go = () => { start(); if (done) done(); };
    if (I18N_DATA[code]) return go();
    const s = document.createElement('script');
    s.src = src(code); s.onload = go; s.onerror = () => { if (done) done(); };
    document.head.appendChild(s);
  }

  // Language picker for the creator and home screens.
  function picker() {
    const el = document.createElement('div');
    el.className = 'settings langpick'; el.setAttribute('data-noi18n', '');
    el.innerHTML = `<span>🌐</span><select aria-label="Language">${LANGS.map(([c, n]) =>
      `<option value="${c}"${c === lang ? ' selected' : ''}>${n}</option>`).join('')}</select>`;
    el.querySelector('select').onchange = e => set(e.target.value, () => {
      document.querySelectorAll('.langpick select').forEach(s => { s.value = lang; });
    });
    return el;
  }
  function mountPickers() {
    for (const id of ['cModeSwitch', 'hModeSwitch']) {
      const at = document.getElementById(id);
      if (at && !at.parentNode.querySelector('.langpick')) at.parentNode.insertBefore(picker(), at.nextSibling);
    }
  }

  return { get lang() { return lang; }, tr: s => (lang !== 'en' && tr(s)) || s, set, start, src, mountPickers };
})();

// Load the chosen language before the game draws anything (the script is written in while the page is
// still loading, so it runs first). English loads nothing.
if (I18N.lang !== 'en') document.write(`<script src="${I18N.src(I18N.lang)}"><\/script><script>I18N.start()<\/script>`);
document.addEventListener('DOMContentLoaded', () => { try { I18N.mountPickers(); } catch {} });
