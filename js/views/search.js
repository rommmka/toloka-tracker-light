// "Пошук": title search among the exported releases (the site has no server to query toloka),
// plus a link to the same search on toloka itself.

import { h, icon, loadFeed, posterCard, empty, norm, tolokaSearchUrl } from '../ui.js';

export async function renderSearch(el, { params }) {
  const q = (params.q ?? '').trim();
  const feed = await loadFeed();

  const input = h('input', { type: 'search', id: 'qs', value: q, placeholder: 'Назва фільму чи серіалу', autocomplete: 'off', enterkeyhint: 'search' });
  const count = h('span', { style: 'color:var(--hero-muted);font-size:14px;font-weight:600;white-space:nowrap' });
  const form = h('form', { role: 'search', class: 'big-search' },
    icon('M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4', 28),
    h('label', { for: 'qs', class: 'sr-only' }, 'Пошук серед релізів'),
    input, count);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value.trim();
    location.hash = v ? `#/search?q=${encodeURIComponent(v)}` : '#/search';
  });

  const toloka = h('a', { class: 'btn light', target: '_blank', rel: 'noopener noreferrer', style: 'align-self:flex-start' });
  const syncToloka = () => {
    const v = input.value.trim();
    toloka.href = v ? tolokaSearchUrl(v) : 'https://toloka.to/tracker.php';
    toloka.textContent = v ? `Шукати «${v}» на toloka ↗` : 'Пошук на toloka ↗';
  };
  input.addEventListener('input', syncToloka);
  syncToloka();

  el.append(h('section', { class: 'tile dark', 'aria-label': 'Пошук' }, form,
    h('span', { style: 'color:var(--hero-muted);font-size:14px' }, `Шукаємо серед релізів за останні ${feed.days ?? 45} днів. Старіші — на самій toloka (потрібен вхід).`),
    toloka));
  setTimeout(() => { if (!q) input.focus(); }, 0);

  if (!q) return;
  const nq = norm(q);
  const found = feed.groups.filter((c) => norm(c.titleUa).includes(nq) || norm(c.titleOrig).includes(nq));
  count.textContent = `${found.length}`;
  el.append(found.length
    ? h('div', { class: 'grid-posters' }, found.map((c) => posterCard(c, { showKind: true })))
    : empty('Нічого не знайдено', `Серед свіжих релізів немає «${q}». Спробуйте коротшу назву або пошукайте на toloka.`));
}
