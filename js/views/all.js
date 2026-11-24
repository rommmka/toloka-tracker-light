// "Усі": every exported card, filters and sorting (in the browser, over feed.json), day groups.

import { h, loadFeed, posterCard, dayLabel, empty, norm, ratingOf, maxSeeds, tolokaSearchUrl } from '../ui.js';

const KEY = 'toloka.allFilters';
const DEFAULTS = { category: '', genre: '', res: '', minRating: '', sort: 'new' };
const PAGE = 60;
const RES_RANK = { '2160p': 4, '1440p': 3, '1080p': 2, '1080i': 2, '720p': 1 };

/** Cards matching the filters, sorted (pure). */
export function filterCards(cards, { category, genre, res, minRating, sort } = {}, q = '') {
  const g = genre ? genre.toLowerCase() : null;
  const minRes = RES_RANK[res] ?? 0;
  const min = Number(minRating) || 0;
  const nq = norm(q);
  const out = cards.filter((c) => {
    if (category && c.category !== category) return false;
    if (nq && !norm(c.titleUa).includes(nq) && !norm(c.titleOrig).includes(nq)) return false;
    if (g && !String(c.description?.genre ?? '').toLowerCase().includes(g)) return false;
    if (minRes && !c.releases.some((r) => (RES_RANK[r.resolution] ?? 0) === minRes)) return false;
    if (min && (ratingOf(c) ?? 0) < min) return false;
    return true;
  });
  if (sort === 'rating') out.sort((a, b) => (ratingOf(b) ?? 0) - (ratingOf(a) ?? 0));
  else if (sort === 'seeds') out.sort((a, b) => maxSeeds(b) - maxSeeds(a));
  return out;
}

/** Most common genres across the cards, for the filter dropdown. */
export function genreFacet(cards, top = 20) {
  const count = new Map();
  for (const c of cards) {
    for (const raw of String(c.description?.genre ?? '').split(/\s*,\s*/)) {
      const genre = raw.trim().toLowerCase();
      if (genre && genre.length < 30) count.set(genre, (count.get(genre) ?? 0) + 1);
    }
  }
  return [...count].sort((a, b) => b[1] - a[1]).slice(0, top).map(([name]) => name);
}

function loadFilters() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
}
function saveFilters(f) {
  try { localStorage.setItem(KEY, JSON.stringify(f)); } catch { /* private mode */ }
}

export async function renderAll(el, { params }) {
  const f = loadFilters();
  for (const k of Object.keys(f)) if (!(k in DEFAULTS)) delete f[k];
  let q = params.q ?? '';
  let offset = 0;
  let lastDay = null;
  let genres = [];

  const grid = h('div', { style: 'display:flex;flex-direction:column;gap:16px' });
  const more = h('button', { type: 'button', class: 'btn soft', style: 'align-self:center', hidden: true }, 'Показати ще');
  const count = h('span', { class: 'muted', style: 'font-size:14px;font-weight:600' });
  const genreSelect = h('select', { 'aria-label': 'Жанр' });

  const feed = await loadFeed();
  let found = [];

  function load(append = false) {
    if (!append) {
      offset = 0; lastDay = null; grid.replaceChildren();
      const byCategory = f.category ? feed.groups.filter((c) => c.category === f.category) : feed.groups;
      genres = genreFacet(byCategory);
      genreSelect.replaceChildren(h('option', { value: '' }, 'Усі жанри'), ...genres.map((g) => h('option', { value: g, selected: g === f.genre }, g)));
      if (f.genre && !genres.includes(f.genre)) genreSelect.append(h('option', { value: f.genre, selected: true }, f.genre));
      found = filterCards(feed.groups, f, q);
      count.textContent = `${found.length} ${q ? `за запитом «${q}»` : ''}`.trim();
    }
    const page = found.slice(offset, offset + PAGE);
    renderCards(page);
    offset += page.length;
    more.hidden = offset >= found.length;
    if (!append && !found.length) {
      grid.replaceChildren(empty(q ? 'Нічого не знайдено' : 'Порожньо', q ? 'Спробуйте іншу назву або приберіть фільтри.' : 'Під ці фільтри нічого не підходить.',
        q ? h('a', { class: 'btn ink', href: tolokaSearchUrl(q), target: '_blank', rel: 'noopener noreferrer' }, `Шукати «${q}» на toloka ↗`) : null));
    }
  }

  function renderCards(cards) {
    if (f.sort !== 'new') {
      let g = grid.querySelector('.grid-posters');
      if (!g) { g = h('div', { class: 'grid-posters' }); grid.append(g); }
      g.append(...cards.map((c) => posterCard(c, { showKind: true })));
      return;
    }
    for (const c of cards) {
      const day = new Date(c.updatedAt).toDateString();
      if (day !== lastDay) {
        lastDay = day;
        grid.append(h('h2', { class: 'h-section' }, dayLabel(c.updatedAt)), h('div', { class: 'grid-posters' }));
      }
      grid.lastElementChild.append(posterCard(c, { showKind: true }));
    }
  }

  const set = (k, v) => { f[k] = v; saveFilters(f); load(); };

  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Категорія' },
    [['', 'Усе'], ['movies', 'Фільми'], ['series', 'Серіали'], ['cartoons', 'Мультики']].map(([v, label]) => {
      const b = h('button', { type: 'button', 'aria-pressed': String(f.category === v) }, label);
      b.addEventListener('click', () => {
        seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        set('category', v);
      });
      return b;
    }));
  genreSelect.addEventListener('change', () => set('genre', genreSelect.value));

  const select = (label, key, options) => {
    const s = h('select', {}, options.map(([v, t]) => h('option', { value: v, selected: f[key] === v }, t)));
    s.addEventListener('change', () => set(key, s.value));
    return h('label', { class: 'field' }, label, s);
  };

  const qInput = h('input', { type: 'search', value: q, placeholder: 'Назва серед зібраних', 'aria-label': 'Пошук серед зібраних релізів', style: 'border:0;background:var(--track);border-radius:10px;padding:9px 12px;font-weight:600;font-size:14px;min-width:0;width:200px;color:var(--ink)' });
  let qTimer;
  qInput.addEventListener('input', () => { clearTimeout(qTimer); qTimer = setTimeout(() => { q = qInput.value.trim(); load(); }, 200); });

  el.append(
    h('section', { class: 'tile filters', 'aria-label': 'Фільтри' },
      qInput,
      seg,
      h('label', { class: 'field' }, 'Жанр', genreSelect),
      select('Якість', 'res', [['', 'Будь-яка'], ['2160p', '4K'], ['1080p', '1080p'], ['720p', '720p']]),
      select('TMDB від', 'minRating', [['', '—'], ['6', '6'], ['7', '7'], ['8', '8']]),
      h('span', { style: 'flex:1' }),
      select('Сортувати', 'sort', [['new', 'Новіші'], ['rating', 'Рейтинг TMDB'], ['seeds', 'Найбільше сідів']])),
    h('div', { style: 'display:flex;align-items:baseline;gap:12px;margin-top:4px' },
      h('h1', { class: 'h-section', style: 'margin:0' }, 'Усі релізи'), count),
    grid,
    more);

  more.addEventListener('click', () => load(true));

  load();
}
