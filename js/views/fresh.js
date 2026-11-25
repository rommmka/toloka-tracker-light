// Fresh block on top of "Релізи": what the last run brought, best-seeded release, new cards by category.
// Nothing new since the last run → no block at all, the page is just the full list.

import {
  h, posterEl, posterCard, seriesCard, fmtSize, fmtDay, plural, ratingOf,
  visibleReleases, defaultRelease, seasonText,
} from '../ui.js';

/** Elements of the fresh block (empty array when the last run brought nothing). */
export function freshBlock(feed) {
  const cards = feed.groups.filter((c) => c.isNew || c.isUpdated);
  const run = feed.lastRun;

  if (!cards.length) return [];
  const newCards = cards.filter((c) => c.isNew);
  const byCat = (cat) => cards.filter((c) => c.category === cat);
  const movies = cards.filter((c) => c.kind === 'movie' && c.category !== 'cartoons');
  const series = cards.filter((c) => c.kind === 'series' && c.category !== 'cartoons');
  const cartoons = byCat('cartoons');
  const updatedSeries = series.filter((c) => c.isUpdated).length;

  // ---- hero: the day's summary
  const count = newCards.length;
  const hero = h('section', { class: 'tile dark', style: 'flex:2 1 560px', 'aria-label': 'Підсумок дня' },
    h('span', { style: 'font-size:14px;font-weight:600;color:var(--hero-muted)' },
      run ? `${capital(fmtDay(run.startedAt))} · зібрано о ${new Date(run.startedAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}` : 'Ще не було жодного збору'),
    h('div', { class: 'hero-count' },
      h('b', {}, String(count)),
      h('span', {}, plural(count, 'новий', 'нові', 'нових'), h('br'), plural(count, 'реліз', 'релізи', 'релізів'))),
    h('div', { class: 'chips' },
      movies.length ? h('span', { class: 'hero-chip' }, `${movies.length} ${plural(movies.length, 'фільм', 'фільми', 'фільмів')}`) : null,
      series.length ? h('span', { class: 'hero-chip' }, `${series.length} ${plural(series.length, 'серіал', 'серіали', 'серіалів')}${updatedSeries ? ` · ${updatedSeries} з новими серіями` : ''}`) : null,
      cartoons.length ? h('span', { class: 'hero-chip' }, `${cartoons.length} ${plural(cartoons.length, 'мультфільм', 'мультфільми', 'мультфільмів')}`) : null),
    h('div', { class: 'strip' }, cards.slice(0, 8).map((c) => h('a', { href: `#/g/${c.id}`, title: c.titleUa }, posterEl(c)))));

  const tiles = [hero];

  // ---- best-seeded release of the day
  const top = [...cards].sort((a, b) => topSeeds(b) - topSeeds(a))[0];
  if (top && topSeeds(top) > 0) tiles.push(topSeedsTile(top));

  const out = [h('div', { class: 'row stretch' }, tiles)];
  if (movies.length) out.push(section('Нові фільми', movies, (c) => posterCard(c), 'grid-posters'));
  if (series.length) out.push(section('Нові серіали', series, seriesCard, 'grid-wide'));
  if (cartoons.length) out.push(section('Нові мультики', cartoons, (c) => (c.kind === 'series' ? seriesCard(c) : posterCard(c)), cartoons.some((c) => c.kind === 'series') ? 'grid-wide' : 'grid-posters'));
  return out;
}

const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const topSeeds = (c) => Math.max(0, ...visibleReleases(c).map((r) => r.seeders ?? 0));

function section(title, cards, render, gridClass) {
  return h('section', { 'aria-label': title, style: 'display:flex;flex-direction:column;gap:14px' },
    h('h2', { class: 'h-section' }, title, h('small', {}, String(cards.length))),
    h('div', { class: gridClass }, cards.map(render)));
}

function topSeedsTile(card) {
  const rels = visibleReleases(card).sort((a, b) => (b.seeders ?? 0) - (a.seeders ?? 0)).slice(0, 4);
  const max = Math.max(1, ...rels.map((r) => r.seeders ?? 0));
  const best = defaultRelease(card.releases);
  const rating = ratingOf(card);
  const btn = h('a', { class: 'btn ink', style: 'margin-top:auto', href: best.url, target: '_blank', rel: 'noopener noreferrer' }, `${best.quality} · ${fmtSize(best.sizeBytes)} на toloka ↗`);
  return h('section', { class: 'tile', style: 'flex:1 1 340px', 'aria-label': 'Найбільше сідів' },
    h('span', { class: 'h-label' }, 'Найбільше сідів'),
    h('a', { class: 'feature', href: `#/g/${card.id}` },
      posterEl(card),
      h('div', { style: 'display:flex;flex-direction:column;gap:6px;min-width:0' },
        h('span', { style: 'font:800 22px/1.15 var(--display);letter-spacing:-0.02em' }, card.titleUa),
        h('span', { class: 'muted', style: 'font-size:13px' }, [card.titleOrig !== card.titleUa ? card.titleOrig : '', card.year, (card.description.genre || '').split(',')[0]].filter(Boolean).join(' · ')),
        rating ? h('span', { class: 'badge rating', style: 'align-self:flex-start' }, `${card.tmdb?.rating ? 'TMDB ' : '★ '}${rating}`) : null)),
    h('div', { class: 'seedbars' }, rels.map((r) => h('div', {},
      h('span', { title: r.quality }, [seasonText(r), r.quality].filter(Boolean).join(' ')),
      h('div', { class: `bar thick${r === best ? '' : ' dim'}` }, h('i', { style: `width:${Math.round(((r.seeders ?? 0) / max) * 100)}%` })),
      h('b', {}, `↑${r.seeders ?? 0}`)))),
    btn);
}
