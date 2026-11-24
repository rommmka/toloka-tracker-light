// Router and shell: #/ (today), #/search, #/all, #/g/<id>.

import { renderToday } from './views/today.js';
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
  const route = { '/': 'today', '/search': 'search', '/all': 'all' }[p] ?? 'today';
  return { route, params };
}

const RENDER = { today: renderToday, search: renderSearch, all: renderAll, detail: renderDetail };
const TITLE = { today: 'Сьогодні', search: 'Пошук', all: 'Усі релізи', detail: 'Реліз' };

async function render() {
  const seq = ++renderSeq;
  const { route, id, params } = parseHash();
  cleanup?.();
  cleanup = null;
  document.querySelectorAll('[data-route]').forEach((a) => {
    if (a.dataset.route === route) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  if (route === 'search') searchInput.value = params.q ?? '';
  document.title = `${TITLE[route]} · Toloka`;
  const container = document.createElement('div');
  container.style.cssText = 'display:flex;flex-direction:column;gap:16px';
  try {
    const result = await RENDER[route](container, { id, params, rerender: render });
    if (seq !== renderSeq) { if (typeof result === 'function') result(); return; } // a newer navigation won
    view.replaceChildren(container);
    cleanup = typeof result === 'function' ? result : null;
    if (route !== 'detail' || !history.state?.keepScroll) window.scrollTo(0, 0);
  } catch (e) {
    if (seq !== renderSeq) return;
    view.replaceChildren(Object.assign(document.createElement('div'), { className: 'tile empty', textContent: `Не вдалося завантажити: ${e.message}` }));
  }
}

window.addEventListener('hashchange', render);

// header search → search among the collected releases
document.getElementById('search-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = searchInput.value.trim();
  location.hash = q ? `#/search?q=${encodeURIComponent(q)}` : '#/search';
});
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName)) { e.preventDefault(); searchInput.focus(); }
});

render();
