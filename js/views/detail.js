// Film / series page: hero, trailer, plot, cast, quality picker with seeders → link to that release on toloka, seasons.

import {
  h, icon, ICON, getJson, posterEl, fmtSize, seasonText, defaultRelease, FILTER_REASON,
} from '../ui.js';

const CAST_BG = ['#DCE1FF', '#FFE1D2', '#DDF3E7', '#F1E3FF', '#FFF1C7', '#D9F1FB', '#FFDDE6', '#E6E8EC'];

export async function renderDetail(el, { id }) {
  const c = await getJson(`data/g/${id}.json`);
  const d = c.description || {};
  let selected = defaultRelease(c.releases);
  const isSeries = c.kind === 'series';
  const rating = c.tmdb?.rating ?? c.rating;

  // ---- back
  el.append(h('div', { style: 'display:flex' },
    h('button', { type: 'button', class: 'back', onclick: () => (history.length > 1 ? history.back() : (location.hash = '#/')) },
      icon(ICON.back, 16, { width: 2.4 }), 'Назад')));

  // ---- hero
  const links = h('div', { class: 'chips', style: 'margin-top:4px' },
    c.trailer ? h('a', { class: 'btn light', href: '#trailer', onclick: (e) => { e.preventDefault(); document.getElementById('trailer')?.scrollIntoView({ behavior: 'smooth' }); } }, '▶ Трейлер') : null,
    c.tmdb ? h('a', { class: 'btn on-hero', href: c.tmdb.url, target: '_blank', rel: 'noopener noreferrer' }, 'TMDB ↗') : null,
    c.imdbId ? h('a', { class: 'btn on-hero', href: `https://www.imdb.com/title/${c.imdbId}/`, target: '_blank', rel: 'noopener noreferrer' }, 'IMDb ↗') : null);
  el.append(h('section', { class: 'tile dark d-hero' },
    posterEl(c),
    h('div', { class: 'info' },
      h('div', { class: 'hero-badges' },
        rating ? h('span', { class: 'acc' }, c.tmdb?.rating ? `TMDB ${c.tmdb.rating.toFixed(1)}${c.tmdb.votes ? ` · ${c.tmdb.votes}` : ''}` : `★ ${rating}`) : null,
        h('span', {}, isSeries ? (c.category === 'cartoons' ? 'Мультсеріал' : 'Серіал') : (c.category === 'cartoons' ? 'Мультфільм' : 'Фільм')),
        c.isNew ? h('span', {}, 'Нове') : c.isUpdated ? h('span', {}, 'Оновлено') : null),
      h('h1', {}, c.titleUa),
      h('span', { class: 'sub' }, [c.titleOrig !== c.titleUa ? c.titleOrig : '', c.year, d.duration && !isSeries ? d.duration.split(' ')[0] : '', d.genre].filter(Boolean).join(' · ')),
      links)));

  // ---- main column + aside
  const main = h('div', { style: 'flex:999 1 640px;display:flex;flex-direction:column;gap:16px' });
  const aside = h('aside', { style: 'flex:1 1 360px;display:flex;flex-direction:column;gap:16px', 'aria-label': 'Роздачі' });
  el.append(h('div', { class: 'row' }, main, aside));

  if (isSeries) main.append(seasonsBlock(c, (r) => { selected = r; syncPicker(); }));

  if (c.trailer) {
    const box = h('section', { class: 'trailer', id: 'trailer', 'aria-label': 'Трейлер' },
      c.poster ? h('img', { src: c.poster, alt: '' }) : null,
      h('span', { class: 'cap' }, `${c.trailer.name || 'Трейлер'} · YouTube`));
    const play = h('button', { type: 'button', 'aria-label': 'Відтворити трейлер' }, icon(ICON.play, 30, { fill: true }));
    play.addEventListener('click', () => {
      box.replaceChildren(h('iframe', {
        src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(c.trailer.key)}?autoplay=1&rel=0`,
        title: `Трейлер: ${c.titleUa}`, allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: true,
      }));
    });
    box.append(play);
    main.append(box);
  }

  const info = [
    ['Режисер', d.director], ['Країна', d.country], ['Студія', d.studio],
    ['Тривалість', d.duration], ['Озвучка', null], ['Субтитри', null],
  ];
  const audioDd = h('dd', {});
  const subsDd = h('dd', {});
  main.append(h('div', { class: 'row stretch' },
    d.plot ? h('section', { class: 'tile', style: 'flex:3 1 420px' }, h('h2', { class: 'h-tile' }, isSeries ? 'Про серіал' : 'Про фільм'), h('p', { class: 'plot' }, d.plot)) : null,
    h('section', { class: 'tile', style: 'flex:2 1 280px' },
      h('dl', { class: 'dl-info' }, info.flatMap(([k, v]) => {
        if (k === 'Озвучка') return [h('dt', {}, k), audioDd];
        if (k === 'Субтитри') return [h('dt', {}, k), subsDd];
        return v ? [h('dt', {}, k), h('dd', {}, v)] : [];
      })))));

  if (c.cast?.length) {
    main.append(h('section', { class: 'tile' }, h('h2', { class: 'h-tile' }, 'У ролях'),
      h('div', { class: 'cast' }, c.cast.map((a, i) => {
        const face = () => h('i', { style: `background:${CAST_BG[i % CAST_BG.length]}`, 'aria-hidden': 'true' }, initials(a.name));
        let pic = face();
        if (a.photo) {
          pic = h('img', { src: a.photo, alt: '', loading: 'lazy', decoding: 'async' });
          pic.addEventListener('error', () => pic.replaceWith(face()), { once: true });
        }
        const inner = [pic, a.name, a.character ? h('small', {}, a.character) : null];
        return a.url ? h('a', { href: a.url, target: '_blank', rel: 'noopener', title: `${a.name} на TMDB` }, ...inner) : h('span', {}, ...inner);
      }))));
  }

  // ---- quality picker
  const maxSeed = Math.max(1, ...c.releases.map((r) => r.seeders ?? 0));
  const opts = h('fieldset', { class: 'opts' }, h('legend', { class: 'sr-only' }, 'Якість'),
    c.releases.map((r) => {
      const input = h('input', { type: 'radio', name: 'rel', value: r.topicId, checked: r === selected });
      input.addEventListener('change', () => { selected = r; syncPicker(); });
      return h('label', { class: `opt${r.filtered ? ' filtered' : ''}` },
        input,
        h('span', { style: 'display:flex;flex-direction:column;min-width:0;gap:2px' },
          h('span', { class: 'q' }, [seasonText(r), r.quality].filter(Boolean).join(' · ')),
          h('span', { class: 'n' }, [audioText(r), r.subs ? `суб. ${r.subs}` : ''].filter(Boolean).join(' · ')),
          h('span', { class: 'peers' }, h('span', { class: 'bar thin good' }, h('i', { style: `width:${Math.round(((r.seeders ?? 0) / maxSeed) * 100)}%` })), `↑${r.seeders ?? 0} ↓${r.leechers ?? 0}`),
          tagsFor(r)),
        h('span', { class: 's' }, fmtSize(r.sizeBytes)));
    }));
  const tolokaBtn = h('a', { class: 'btn primary', target: '_blank', rel: 'noopener noreferrer', style: 'flex:1 1 200px' });
  // .torrent straight from toloka: downloads for visitors signed in there, others land on its login page
  const torrentBtn = h('a', { class: 'btn ink', target: '_blank', rel: 'noopener noreferrer', style: 'flex:1 1 160px' }, icon(ICON.down, 18), 'Завантажити торент');
  function syncPicker() {
    opts.querySelectorAll('input').forEach((i) => { i.checked = Number(i.value) === selected.topicId; });
    tolokaBtn.href = selected.url;
    tolokaBtn.textContent = `Відкрити на toloka · ${fmtSize(selected.sizeBytes)} ↗`;
    torrentBtn.hidden = !selected.torrentUrl;
    if (selected.torrentUrl) torrentBtn.href = selected.torrentUrl;
    audioDd.textContent = audioText(selected) || '—';
    subsDd.textContent = selected.subs || '—';
  }
  syncPicker();

  aside.append(h('section', { class: 'tile', style: 'padding:20px;gap:10px' },
    h('h2', { class: 'h-tile', style: 'font-size:20px' }, `Якість · ${c.releases.length} ${c.releases.length === 1 ? 'роздача' : c.releases.length < 5 ? 'роздачі' : 'роздач'}`),
    opts,
    h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' }, tolokaBtn, torrentBtn),
    h('span', { class: 'muted', style: 'font-size:12px;text-align:center' }, 'Торент завантажиться, якщо ви увійшли на toloka.to')));
}

function tagsFor(r) {
  return h('span', { class: 'tags' },
    r.filtered ? h('span', { class: 'badge warn' }, FILTER_REASON[r.filtered] || 'приховано') : null);
}

function audioText(r) {
  const a = r.audio;
  if (!a?.listed) return '';
  return a.languages.map((l) => (l === 'Ukr' && a.ukrTracks > 1 ? `${a.ukrTracks}×Ukr` : l)).join('/');
}

const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

/** One tile per release, newest season first: episodes grid and a link to that release on toloka. */
function seasonsBlock(c, onPick) {
  const tiles = c.releases.filter((r) => !r.filtered).map((r, i) => {
    const s = r.season;
    const ep = r.episodes;
    const total = ep?.total ?? (ep ? ep.to : 0);
    const eps = total && total <= 60
      ? h('div', { class: 'eps', 'aria-label': `Серії ${ep.from}–${ep.to}${ep.total ? ` з ${ep.total}` : ''}` },
        Array.from({ length: total }, (_, k) => {
          const n = k + 1;
          const have = n >= ep.from && n <= ep.to;
          return h('i', { class: have ? 'on' : '' }, String(n));
        }))
      : null;
    const link = h('a', { class: 'btn small primary', href: r.url, target: '_blank', rel: 'noopener noreferrer', onclick: () => onPick(r) }, 'На toloka ↗');
    return h('article', { class: `tile season-card${i === 0 ? ' cur' : ''}`, style: 'padding:20px;gap:12px' },
      h('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:10px' },
        h('span', { class: 'big' }, s ? (s.from === s.to ? `S${s.from}` : `S${s.from}–${s.to}`) : '—'),
        c.isUpdated && i === 0 ? h('span', { class: 'badge new' }, 'Оновлено') : c.isNew && i === 0 ? h('span', { class: 'badge new' }, 'Нове') : null),
      h('span', { class: 'muted', style: 'font-size:14px' }, [seasonText(r).replace(/^S\S+\s?/, '') || null, r.registeredAt ? `роздача від ${r.registeredAt.slice(0, 10).split('-').reverse().join('.')}` : null].filter(Boolean).join(' · ')),
      eps,
      h('div', { class: 'rel-row' },
        h('span', { style: 'display:flex;flex-direction:column;gap:2px;min-width:0' },
          h('b', { style: 'font-size:14px' }, `${r.quality} · ${fmtSize(r.sizeBytes)}`),
          h('span', { style: 'font-size:12px;font-weight:700;color:var(--good)' }, `↑${r.seeders ?? 0} ↓${r.leechers ?? 0}`)),
        link));
  });
  return h('section', { style: 'display:flex;flex-direction:column;gap:14px', 'aria-label': 'Сезони' },
    h('h2', { class: 'h-section', style: 'margin:0' }, 'Сезони'),
    h('div', { class: 'grid-wide' }, tiles));
}
