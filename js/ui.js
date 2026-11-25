// Shared helpers: safe DOM building, formatting, static data, toast, card components.

/**
 * h('a', { class: 'x', href: '#', onclick: fn }, 'text', child, [children])
 * Text is always inserted as text nodes (no innerHTML), so release titles can't inject markup.
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k === 'checked' || k === 'selected' || k === 'value') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}
function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false || c === '') continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Stroke icon from path data. */
export function icon(d, size = 18, { fill = false, width = 2 } = {}) {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('width', size); s.setAttribute('height', size); s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('fill', fill ? 'currentColor' : 'none');
  if (!fill) { s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', width); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); }
  const p = document.createElementNS(SVG_NS, 'path'); p.setAttribute('d', d); s.append(p);
  return s;
}
export const ICON = {
  back: 'M15 5l-7 7 7 7',
  play: 'M8 5v14l11-7z',
  ext: 'M14 4h6v6M20 4l-9 9M18 14v5H5V6h5',
  down: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  eye: 'M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M3 3l18 18M10.6 5.1A10.9 10.9 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3.2 4.1M6.4 6.5A17.3 17.3 0 0 0 2.5 12s3.5 7 9.5 7a9.8 9.8 0 0 0 5-1.4M9.9 9.9a3 3 0 0 0 4.2 4.2',
  check: 'M5 12.5l4.5 4.5L19 7.5',
};

// ---------- formatting ----------
export const fmtSize = (b) => {
  if (!b) return '—';
  const gb = b / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(gb >= 100 ? 0 : 1)} GB` : `${Math.round(b / 1024 ** 2)} MB`;
};
export const fmtDay = (iso) => new Date(iso).toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' });
export const fmtDateTime = (iso) => new Date(iso).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
export function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(Date.now() - 864e5);
  if (d.toDateString() === today.toDateString()) return 'Сьогодні';
  if (d.toDateString() === y.toDateString()) return 'Вчора';
  return d.toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'long' });
}
export const plural = (n, one, few, many) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};
export const CATEGORY = { movies: 'Фільми', series: 'Серіали', cartoons: 'Мультики' };

export const FILTER_REASON = { cam: 'запис з кінотеатру', lowres: 'низька якість', 'no-ukr': 'без укр. озвучки' };

// ---------- data ----------
// The NAS exports data/feed.json and data/g/<id>.json once a day (see toloka-tracker src/export.js).
const FEED_TTL = 10 * 60 * 1000;
let feedCache = null;

export async function getJson(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (res.status === 404) throw new Error('Не знайдено');
  if (!res.ok) throw new Error(`Помилка ${res.status}`);
  return res.json();
}

/** feed.json, reused across views for a few minutes. */
export function loadFeed() {
  if (!feedCache || Date.now() - feedCache.at > FEED_TTL) {
    const p = getJson('data/feed.json');
    feedCache = { at: Date.now(), p };
    p.catch(() => { feedCache = null; });
  }
  return feedCache.p;
}

/** Lower-case, no accents or punctuation: for matching titles typed in any way. */
export const norm = (s) => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export const tolokaSearchUrl = (q) => `https://toloka.to/tracker.php?${new URLSearchParams({ nm: q })}`;

// ---------- toast ----------
let toastTimer;
export function toast(text, { error = false, action = null } = {}) {
  const el = document.getElementById('toast');
  el.replaceChildren(h('span', {}, text));
  el.classList.toggle('error', error);
  if (action) el.append(h('button', { type: 'button', onclick: () => { el.hidden = true; action.run(); } }, action.label));
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, action ? 6000 : 3500);
}

// ---------- card helpers ----------
export const ratingOf = (c) => c.tmdb?.rating ?? c.rating ?? null;
export const visibleReleases = (c) => c.releases.filter((r) => !r.filtered);
export const maxSeeds = (c) => Math.max(0, ...visibleReleases(c).map((r) => r.seeders ?? 0));

/** Poster image with a lettered placeholder when it is missing or broken. */
export function posterEl(card, cls = 'poster') {
  const ph = () => h('div', { class: 'poster-ph', 'aria-hidden': 'true' }, card.titleUa);
  if (!card.poster) return ph();
  const img = h('img', { class: cls, src: card.poster, alt: '', loading: 'lazy', decoding: 'async' });
  img.addEventListener('error', () => {
    if (card.posterAlt && img.src !== card.posterAlt) img.src = card.posterAlt;
    else img.replaceWith(ph());
  });
  return img;
}

export function seasonText(r) {
  if (!r?.season) return '';
  const s = r.season.from === r.season.to ? `S${r.season.from}` : `S${r.season.from}–${r.season.to}`;
  if (!r.episodes) return s;
  const e = r.episodes.from === r.episodes.to ? `е${r.episodes.from}` : `е${r.episodes.from}–${r.episodes.to}`;
  return `${s} ${e}${r.episodes.total ? ` з ${r.episodes.total}` : ''}`;
}

/** "2160p · 1080p · SD" — distinct resolutions of the visible releases, best first. */
export function resolutionsText(card) {
  const order = ['2160p', '1440p', '1080p', '1080i', '720p', '576p', '480p', null];
  const set = new Set(visibleReleases(card).map((r) => r.resolution));
  return order.filter((x) => set.has(x)).map((x) => (x === '2160p' ? '4K' : x ?? 'SD')).join(' · ');
}

/** Default release: newest season, prefer 1080p, then most seeders. */
export function defaultRelease(releases) {
  const visible = releases.filter((r) => !r.filtered);
  const pool = visible.length ? visible : releases;
  const top = Math.max(...pool.map((r) => r.season?.to ?? 0));
  const inSeason = pool.filter((r) => (r.season?.to ?? 0) === top);
  const hd = inSeason.filter((r) => r.resolution === '1080p' || r.resolution === '1080i');
  const cands = hd.length ? hd : inSeason;
  return cands.reduce((best, r) => ((r.seeders ?? 0) > (best.seeders ?? 0) ? r : best), cands[0]);
}

export function cardTag(card) {
  if (card.isNew) return h('span', { class: 'badge plain tag' }, 'Нове');
  if (card.isUpdated) return h('span', { class: 'badge plain tag' }, 'Оновлено');
  return null;
}

/** Poster grid tile. */
export function posterCard(card, { showKind = false } = {}) {
  const r = ratingOf(card);
  const best = defaultRelease(card.releases);
  const kind = card.kind === 'series' ? (seasonText(best).split(' ')[0] || 'Серіал') : card.category === 'cartoons' ? 'Мульт' : 'Фільм';
  return h('a', { class: 'pcard', href: `#/g/${card.id}` },
    h('div', { class: 'pic' },
      posterEl(card),
      r ? h('span', { class: 'badge rating' }, r.toFixed ? r.toFixed(1) : r) : null,
      showKind ? h('span', { class: 'badge plain kind' }, kind) : null,
      cardTag(card)),
    h('span', { class: 't' }, card.titleUa),
    h('span', { class: 'm' }, [card.kind === 'series' ? seasonText(best) : card.year, resolutionsText(card), best?.seeders != null ? `↑${maxSeeds(card)}` : ''].filter(Boolean).join(' · ')));
}

/** Wide series tile with episode progress. */
export function seriesCard(card) {
  const r = defaultRelease(card.releases);
  const ep = r?.episodes;
  const pct = ep?.total ? Math.round((ep.to / ep.total) * 100) : null;
  return h('a', { class: 'scard', href: `#/g/${card.id}` },
    posterEl(card),
    h('div', { class: 'body' },
      h('span', { class: 't' }, card.titleUa),
      h('span', { class: 'm' }, [seasonText(r), r?.quality, r?.seeders != null ? `↑${r.seeders}` : ''].filter(Boolean).join(' · ')),
      pct != null ? h('div', { class: 'bar alt', title: `${ep.to} з ${ep.total} серій` }, h('i', { style: `width:${pct}%` })) : null));
}

export function empty(title, text, ...extra) {
  return h('div', { class: 'tile empty' }, h('b', {}, title), text, extra.length ? h('div', { style: 'margin-top:14px' }, extra) : null);
}

/** Placeholder cards while a page loads (shimmering, not clickable). */
export function skeletonGrid(n = 8) {
  return h('div', { class: 'grid-posters skel', 'aria-hidden': 'true' }, Array.from({ length: n }, () => h('div', { class: 'pcard' },
    h('div', { class: 'poster-ph shimmer' }),
    h('div', { class: 'bar shimmer', style: 'width:80%' }),
    h('div', { class: 'bar shimmer', style: 'width:45%' }))));
}

/** The whole view while a slow page loads: a tile and a grid of placeholder cards. */
export function pageSkeleton() {
  return h('div', { class: 'skel', style: 'display:flex;flex-direction:column;gap:16px', 'aria-busy': 'true' },
    h('div', { class: 'tile shimmer', style: 'height:110px' }), skeletonGrid());
}
