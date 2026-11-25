// "Пошук": title search among the exported releases (the site has no server to query toloka),
// plus a link to the same search on toloka itself.
// One field per screen: on desktop the header field (#q) is the search, the page's own big field is
// hidden by CSS; on phones the header field is hidden and the big field is the search. Both are kept
// in sync and search as you type: results are redrawn in place, the URL follows via replaceState.

import { h, icon, loadFeed, posterCard, empty, norm, tolokaSearchUrl } from '../ui.js';

export async function renderSearch(el, { params }) {
  let q = (params.q ?? '').trim();
  const feed = await loadFeed();
  const header = document.getElementById('q');

  const input = h('input', { type: 'search', id: 'qs', value: q, placeholder: 'Назва фільму чи серіалу', autocomplete: 'off', enterkeyhint: 'search' });
  const form = h('form', { role: 'search', class: 'big-search' },
    icon('M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4', 28),
    h('label', { for: 'qs', class: 'sr-only' }, 'Пошук серед релізів'),
    input);
  const toloka = h('a', { class: 'btn light', target: '_blank', rel: 'noopener noreferrer', style: 'align-self:flex-start' });
  const results = h('div', { style: 'display:flex;flex-direction:column;gap:16px' });

  function draw() {
    toloka.href = q ? tolokaSearchUrl(q) : 'https://toloka.to/tracker.php';
    toloka.textContent = q ? `Шукати «${q}» на toloka ↗` : 'Пошук на toloka ↗';
    if (!q) { results.replaceChildren(); return; }
    const nq = norm(q);
    const found = feed.groups.filter((c) => norm(c.titleUa).includes(nq) || norm(c.titleOrig).includes(nq));
    results.replaceChildren(found.length
      ? h('h2', { class: 'h-section' }, `Знайдено за «${q}»`, h('small', {}, String(found.length)))
      : empty('Нічого не знайдено', `Серед свіжих релізів немає «${q}». Спробуйте коротшу назву або пошукайте на toloka.`),
    found.length ? h('div', { class: 'grid-posters' }, found.map((c) => posterCard(c, { showKind: true }))) : '');
  }

  let timer;
  function update(v) {
    q = v.trim();
    if (input.value !== v) input.value = v;
    if (header.value !== v) header.value = v;
    clearTimeout(timer);
    timer = setTimeout(() => {
      history.replaceState(history.state, '', q ? `#/search?q=${encodeURIComponent(q)}` : '#/search');
      draw();
    }, 150);
  }

  const onPage = () => update(input.value);
  const onHeader = () => update(header.value);
  input.addEventListener('input', onPage);
  header.addEventListener('input', onHeader);
  form.addEventListener('submit', (e) => { e.preventDefault(); input.blur(); });

  el.append(
    h('section', { class: 'tile dark search-tile', 'aria-label': 'Пошук' }, form,
      h('span', { style: 'color:var(--hero-muted);font-size:14px' }, `Шукаємо серед релізів за останні ${feed.days ?? 45} днів. Старіші — на самій toloka (потрібен вхід).`),
      toloka),
    results);
  draw();

  // focus whichever field is visible (the header one keeps focus while typing on desktop)
  setTimeout(() => {
    const field = input.offsetParent ? input : header;
    if (document.activeElement !== field && (!q || field === header)) field.focus();
  }, 0);

  return () => { clearTimeout(timer); header.removeEventListener('input', onHeader); };
}
