// Router and shell: #/ (releases: fresh block + full list; #/all is an old alias), #/search, #/g/<id>.

import { pageSkeleton } from './ui.js';
import { renderAll } from './views/all.js';
import { renderDetail } from './views/detail.js';
import { renderSearch } from './views/search.js';

const view = document.getElementById('view');
const searchInput = document.getElementById('q');
let cleanup = null;
let renderSeq = 0;

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [p, query = ''] = raw.split('?');
  const params = Object.fromEntries(new URLSearchParams(query));
  const m = p.match(/^\/g\/(\d+)$/);
  if (m) return { route: 'detail', id: Number(m[1]), params };
  const route = { '/search': 'search' }[p] ?? 'all';
  return { route, params };
}

const RENDER = { search: renderSearch, all: renderAll, detail: renderDetail };
const TITLE = { search: 'Пошук', all: 'Релізи', detail: 'Реліз' };

// ---- "back" returns to the same place. Every history entry gets an id (history.state.viewId); a list
// page is kept with everything loaded into it ("Показати ще" pages, search results) and its scroll
// position. Back / forward to that entry shows the kept page where it was; a click on a tab or the
// logo is a new entry and gets a fresh page from the top.
history.scrollRestoration = 'manual';
const KEEP = new Set(['all', 'search']); // pages kept whole; others only remember the scroll position
const kept = new Map(); // viewId → { hash, container | null, scrollY }
let current = null; // viewId of the page on screen

function entryId() {
  if (history.state?.viewId) return history.state.viewId;
  const viewId = `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  history.replaceState({ ...history.state, viewId }, '');
  return viewId;
}

/** @param {boolean} [traversal] true from hashchange: may show a kept page; false (rerender): always fresh */
async function render(traversal = false) {
  const seq = ++renderSeq;
  const { route, id, params } = parseHash();
  if (current && kept.has(current)) kept.get(current).scrollY = window.scrollY;
  cleanup?.();
  cleanup = null;
  document.querySelectorAll('[data-route]').forEach((a) => {
    if (a.dataset.route === route) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.body.dataset.route = route;
  if (route === 'search') searchInput.value = params.q ?? '';
  else if (document.activeElement !== searchInput) searchInput.value = '';
  document.title = `${TITLE[route]} · Toloka`;
  const viewId = entryId();
  current = viewId;
  const back = traversal ? kept.get(viewId) : null;
  if (back?.container && back.hash === location.hash) {
    view.replaceChildren(back.container);
    window.scrollTo(0, back.scrollY);
    return;
  }
  const container = document.createElement('div');
  container.style.cssText = 'display:flex;flex-direction:column;gap:16px';
  // a page that takes a moment (data from the server) shows placeholder cards meanwhile
  const slow = setTimeout(() => { if (seq === renderSeq) view.replaceChildren(pageSkeleton()); }, 200);
  try {
    const result = await RENDER[route](container, { id, params, rerender: () => render() });
    if (seq !== renderSeq) { if (typeof result === 'function') result(); return; } // a newer navigation won
    view.replaceChildren(container);
    cleanup = typeof result === 'function' ? result : null;
    kept.delete(viewId);
    kept.set(viewId, { hash: location.hash, container: KEEP.has(route) && !cleanup ? container : null, scrollY: back?.scrollY ?? 0 });
    if (kept.size > 30) kept.delete(kept.keys().next().value);
    window.scrollTo(0, back?.scrollY ?? 0);
  } catch (e) {
    if (seq !== renderSeq) return;
    view.replaceChildren(Object.assign(document.createElement('div'), { className: 'tile empty', textContent: `Не вдалося завантажити: ${e.message}` }));
  } finally {
    clearTimeout(slow);
  }
}

window.addEventListener('hashchange', () => render(true));

// posters shimmer until their image arrives (or fails): one listener for every img.poster on any page
for (const type of ['load', 'error']) {
  document.addEventListener(type, (e) => { if (e.target instanceof HTMLImageElement && e.target.classList.contains('poster')) e.target.classList.add('loaded'); }, true);
}

// header search (desktop): typing opens "Пошук"; from then on views/search.js handles the field itself
const openSearch = () => {
  if (parseHash().route === 'search') return;
  const q = searchInput.value.trim();
  location.hash = q ? `#/search?q=${encodeURIComponent(q)}` : '#/search';
};
searchInput.addEventListener('input', () => { if (searchInput.value.trim()) openSearch(); });
document.getElementById('search-form').addEventListener('submit', (e) => { e.preventDefault(); openSearch(); });
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { searchInput.value = ''; searchInput.dispatchEvent(new Event('input')); searchInput.blur(); }
});
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName)) { e.preventDefault(); searchInput.focus(); }
});

render();
