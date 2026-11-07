/* 情境入口「我遇到了……」— 行動卡版（BRA-592，取自設計方向 B）.
 * Each situation is one card: who to call now, a big number, a dial button, a script to read, a checklist.
 * Rendering is pure (data + state -> HTML string) so tests run it without a DOM.
 * No storage, no network: the district and the ticked boxes live only in page memory. */
(function (root) {
  'use strict';
  const C = root.SituationCore;
  const { esc } = C;

  const PHONE = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>';
  const SUN = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></g></svg>';
  const MOON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M20 14.6A8.5 8.5 0 0 1 9.4 4a8.5 8.5 0 1 0 10.6 10.6z"/></svg>';

  // Entries the official pages leave open: highlight 「待確認」 where the text says it, or tag the entry.
  function entryText(entry) {
    const text = esc(entry.text);
    if (!entry.pending) return text;
    return text.includes('待確認')
      ? text.split('待確認').join('<mark class="pending">待確認</mark>')
      : `<mark class="pending">待確認</mark>${text}`;
  }

  function periodTag(state) {
    const night = state.period === 'night';
    return `<button type="button" class="period" data-flip-period aria-label="${C.periodText(state.period)}，點一下切換">`
      + `${night ? MOON : SUN}<span>${night ? '晚上／假日' : '白天'}</span><span class="period-swap">切換</span></button>`;
  }

  /* Night keeps the daytime colours (TownPass has no dark theme); this one light strip says the content switched. */
  function nightNote(state, text) {
    if (state.period !== 'night') return '';
    return `<p class="night-note" data-night-note>${MOON}<span>${text}</span></p>`;
  }

  // Escaped hours text whose "8:30–12:00" ranges never break across lines.
  function hoursHtml(text) {
    return esc(text).replace(/(\d{1,2}:\d{2}–\d{1,2}:\d{2})/g, '<span class="nw">$1</span>');
  }

  // The first call's own hours, and whether now is inside them.
  function statusText(status) {
    if (status.pending) return status.hours;
    if (status.hours === '24 小時') return '24 小時都可以打';
    return status.open ? `服務時間內：${status.hours}` : `不在服務時間，${status.next}（${status.hours}）`;
  }

  /* What the home card says under 「現在打」: the same first call the situation card shows, with the
   * call's short note (e.g. 轉分機 7019) and its own service hours. */
  function nowCall(data, situation, state) {
    const p = C.plan(data, situation, state.period, state.district, state.moment);
    const f = p.first;
    const brief = f.entry.brief || '';
    const hours = statusText(p.status);
    if (f.open) return { who: f.who, number: '', hint: '進去選你住的區，就給你電話', brief, hours, open: p.status.open, entry: f.entry };
    return { who: f.who, number: f.display, hint: f.aside || '', brief, hours, open: p.status.open, entry: f.entry };
  }

  function homeCard(data, situation, state) {
    const now = nowCall(data, situation, state);
    const number = now.number
      ? `<span class="mini-number">${esc(now.number)}</span>`
      : `<span class="mini-pick">${esc(now.hint)}</span>`;
    const brief = now.brief ? `<span class="mini-brief">${esc(now.brief)}</span>` : '';
    return `<a class="mini${situation.urgent ? ' is-urgent' : ''}" href="#/${esc(situation.id)}" data-situation="${esc(situation.id)}">`
      + `<span class="mini-band"><span>${esc(situation.title)}</span><span class="mini-go" aria-hidden="true">›</span></span>`
      + `<span class="mini-body"><span class="mini-sub">${esc(situation.subtitle)}</span>`
      + `<span class="mini-now"><span class="mini-label${now.open ? '' : ' is-closed'}">${now.open ? '現在打' : '上班再打'}</span><span class="mini-who">${esc(now.who)}</span>${number}${brief}`
      + `<span class="mini-hours${now.open ? '' : ' is-closed'}">${hoursHtml(now.hours)}</span></span>`
      + `</span></a>`;
  }

  /* Always-visible emergency strip (fixed to the bottom on every page). Numbers only, no questions asked,
   * no promises: the four lines are 24-hour per their official pages (see data emergencyLines). */
  function emergencyBar(data) {
    const calls = data.emergencyLines.map((line) => `<a class="sos-call" href="tel:${esc(line.number)}" data-dial="${esc(line.number)}"`
      + ` aria-label="撥 ${esc(line.number)}，${esc(line.label)}"><b>${esc(line.number)}</b><span>${esc(line.label)}</span></a>`).join('');
    return `<nav class="sos" aria-label="緊急電話"><p class="sos-head">有危險，直接打（24 小時）</p><div class="sos-row">${calls}</div></nav>`;
  }

  /* Home groups: situations marked urgent (110／113／1925 first) go on top, then each category in data order.
   * Adding a situation or a category is a data change only. */
  function groups(data) {
    const urgent = data.situations.filter((s) => s.urgent);
    const byCategory = data.categories.map((c) => ({
      id: c.id, title: c.title, urgent: false,
      situations: data.situations.filter((s) => !s.urgent && s.category === c.id),
    }));
    return [
      ...(urgent.length ? [{ id: 'urgent', title: '有危險，先打這些', urgent: true, situations: urgent }] : []),
      ...byCategory,
    ].filter((g) => g.situations.length);
  }

  /* Home search and category filter. The query lives in page memory only: never stored, never put in
   * the URL, never sent anywhere. Plain substring match on title + subtitle + keywords (no tokenizer);
   * several words separated by spaces must all match. 臺 and 台 count as the same character. */
  const ALL = 'all';
  const NO_FILTER = Object.freeze({ query: '', category: ALL });

  function words(query) {
    return String(query || '').replace(/臺/g, '台').toLowerCase().split(/\s+/).filter(Boolean);
  }

  function matches(situation, query) {
    const terms = words(query);
    if (!terms.length) return true;
    const hay = [situation.title, situation.subtitle, ...(situation.keywords || [])].join('\n').replace(/臺/g, '台').toLowerCase();
    return terms.every((term) => hay.includes(term));
  }

  function inCategory(situation, category) {
    return !category || category === ALL || situation.category === category;
  }

  // 「全部」 keeps the grouped deck; a picked category shows only its own group. Search narrows both.
  function filteredGroups(data, filter = NO_FILTER) {
    return groups(data)
      .map((g) => ({ ...g, situations: g.situations.filter((s) => inCategory(s, filter.category) && matches(s, filter.query)) }))
      .filter((g) => g.situations.length);
  }

  const SEARCH_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>';
  const CLEAR_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>';

  // No <form> and no name attribute: pressing Enter can never turn the query into a URL.
  function searchBox(filter) {
    return `<div class="search" role="search">`
      + `<label class="search-field">${SEARCH_ICON}`
      + `<input type="search" data-search value="${esc(filter.query)}" placeholder="例如：被騙、房東、沒錢吃飯"`
      + ` aria-label="找卡片：打你遇到的事" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search"></label>`
      + `<button type="button" class="search-clear" data-clear-search aria-label="清除搜尋"${filter.query ? '' : ' hidden'}>${CLEAR_ICON}</button>`
      + `</div>`;
  }

  // Category chips: 「全部」 + one per category, one picked at a time; counts follow the current query.
  function categoryChips(data, filter) {
    const pool = data.situations.filter((s) => matches(s, filter.query));
    const chip = (id, title, count) => {
      const on = (filter.category || ALL) === id;
      return `<button type="button" class="cat${on ? ' is-on' : ''}${count ? '' : ' is-empty'}" data-category="${esc(id)}" aria-pressed="${on}">`
        + `${esc(title)}<span class="cat-count">${count}</span></button>`;
    };
    return chip(ALL, '全部', pool.length)
      + data.categories.map((c) => chip(c.id, c.title, pool.filter((s) => s.category === c.id).length)).join('');
  }

  const isFiltered = (filter) => words(filter.query).length > 0 || !inCategory({}, filter.category);

  /* How many cards are showing, for screen readers only (the chips already show counts on screen).
   * Lives in one persistent sr-only live region so it is announced after every keystroke. */
  function resultCountText(data, filter) {
    if (!isFiltered(filter)) return '';
    const shown = filteredGroups(data, filter).reduce((n, g) => n + g.situations.length, 0);
    const where = filter.category && filter.category !== ALL
      ? `「${data.categories.find((c) => c.id === filter.category).title}」裡` : '';
    if (!words(filter.query).length) return `${where}有 ${shown} 張卡。`;
    return shown ? `${where}有 ${shown} 張卡符合「${filter.query.trim()}」。` : `沒有卡片符合「${filter.query.trim()}」，可以先打 1999 市民熱線。`;
  }

  /* Enter closes the phone keyboard, Esc clears the search — but never while an IME is composing
   * (注音／倉頡 use Enter to commit a word and Esc to cancel it). */
  function searchKeyAction(event, query) {
    if (event.isComposing || event.keyCode === 229) return null;
    if (event.key === 'Enter') return 'close';
    if (event.key === 'Escape' && query) return 'clear';
    return null;
  }

  /* Nothing matched: point to a next step instead of a dead end. 1999 is the city's 24-hour hotline
   * (rdec-1999); the emergency strip stays on screen below. No promise of what the call will lead to. */
  function noMatch(data, filter) {
    const src = data.sources['rdec-1999'];
    const elsewhere = filter.category && filter.category !== ALL
      ? data.situations.filter((s) => matches(s, filter.query)).length : 0;
    const widen = elsewhere
      ? `<button type="button" class="nomatch-alt" data-category="${ALL}">改在全部分類找（${elsewhere} 張符合）</button>` : '';
    return `<section class="nomatch" aria-labelledby="nomatch-title">`
      + `<p class="nomatch-q">沒有卡片寫到「${esc(filter.query.trim())}」。</p>`
      + `<h2 class="nomatch-title" id="nomatch-title">不確定找誰，<span class="nw">先打 1999 市民熱線</span></h2>`
      + `<p class="nomatch-body">1999 是臺北市的市民熱線，24 小時有人接。說出你遇到的事，問該找哪個單位。</p>`
      + `<a class="dial" href="tel:1999" data-dial="1999">${PHONE}撥 1999</a>`
      + `<p class="nomatch-sos">有危險別等：畫面最底下的緊急電話 110、119、113、1925 一直都在。</p>`
      + `<p class="nomatch-more">也可以換個說法，像「沒錢」「房東」「找不到人」。</p>`
      + widen
      + `<button type="button" class="nomatch-alt" data-reset-filter>清除搜尋，看全部卡片</button>`
      + `<p class="nomatch-src">出處：<a href="${esc(src.url)}" rel="noopener">${esc(src.short)}</a></p>`
      + `</section>`;
  }

  // The part of the home page that changes while typing; the search box itself is never redrawn.
  function renderResults(data, state, filter = NO_FILTER) {
    const list = filteredGroups(data, filter);
    const shown = list.reduce((n, g) => n + g.situations.length, 0);
    const deck = list.map((g) => `<section class="group${g.urgent ? ' is-urgent' : ''}" aria-labelledby="group-${esc(g.id)}">`
      + `<h2 class="group-title" id="group-${esc(g.id)}">${esc(g.title)}</h2>`
      + `<div class="deck">${g.situations.map((s) => homeCard(data, s, state)).join('')}</div></section>`).join('');
    const intro = isFiltered(filter) ? ''
      : '<p class="intro">挑最接近你現在狀況的那張卡。每張都寫好現在打給誰、開口怎麼說、要準備什麼。</p>';
    return intro
      + (shown ? `<nav class="groups" aria-label="選擇情境">${deck}</nav>` : noMatch(data, filter));
  }

  function renderHome(data, state, filter = NO_FILTER) {
    const night = state.period === 'night';
    const lineSources = [...new Set(data.emergencyLines.flatMap((line) => line.sources))]
      .map((id) => `<a href="${esc(data.sources[id].url)}" rel="noopener">${esc(data.sources[id].short)}</a>`).join('、');
    return `<header class="top"><h1>我遇到了……</h1>${periodTag(state)}</header>`
      + nightNote(state, '現在是晚上或假日，卡片先給晚上打得通的電話')
      + searchBox(filter)
      + `<div class="cats" role="group" aria-label="依分類篩選" data-cats>${categoryChips(data, filter)}</div>`
      + `<p class="sr-only" role="status" aria-live="polite" data-result-count>${esc(resultCountText(data, filter))}</p>`
      + `<div class="results" data-results>${renderResults(data, state, filter)}</div>`
      + `<section class="trust" aria-label="這頁怎麼做的">`
      + `<p class="trust-title">${night ? '現在是晚上或假日' : '現在是平日上班時間'}</p>`
      + `<p class="trust-lead">${night
        ? '社福中心下班了，卡片先給晚上打得通的電話。'
        : '社福中心有人接，卡片先給你那一區的電話。'}每支電話照它自己的服務時段挑；遇到國定假日，按右上角切換。</p>`
      + `<ul class="trust-list">`
      + `<li>電話、窗口、要帶的東西，都抄自臺北市政府、衛福部、警政署、健保署的官方頁面和開放資料，每一條都標了出處。</li>`
      + `<li>底下的緊急電話：${lineSources}。</li>`
      + `<li>官方沒寫清楚的，標「待確認」，打電話時再問。</li>`
      + `<li>不用登入。選了哪一區、勾了什麼，只留在這個畫面，重新整理就清空。</li>`
      + `</ul><p class="trust-date">資料查核日 ${esc(data.checkedOn)}，以官方最新公告為準。</p></section>`;
  }

  function districtPicker(data) {
    const chips = C.districts(data).map((d) => `<button type="button" class="chip" data-district="${esc(d)}">${esc(d.replace(/區$/, ''))}</button>`).join('');
    return `<div class="pick"><p class="pick-q">你住哪一區？</p><p class="pick-hint">點一下，就給你那一區社福中心的電話。</p><div class="chips">${chips}</div></div>`;
  }

  // A second number for the same line (健保：用手機打改撥 02-4128-678), shown right under the main dial
  // and written exactly as the official page prints it.
  function altLine(entry) {
    if (!entry.alt) return '';
    const dial = entry.alt.number.replace(/\D/g, '');
    return `<p class="also">${esc(entry.alt.label)}：<a href="tel:${esc(dial)}" data-dial="${esc(dial)}" data-show="${esc(entry.alt.number)}">${esc(entry.alt.number)}</a></p>`;
  }

  function callBlock(data, p, index, state) {
    const f = p.first;
    if (f.open) return districtPicker(data);
    const area = state.district && f.entry.fromDirectory
      ? `<button type="button" class="area" data-clear-district>${esc(state.district)}<span>換區</span></button>` : '';
    const sub = [f.aside, f.note, f.address].filter(Boolean).join('。');
    const more = f.more.map((c) => `<p class="also">同區另有${esc(c.name.replace(/^.*?\(|\)$/g, ''))}：`
      + `<a href="tel:${esc(c.phone.dial)}" data-dial="${esc(c.phone.dial)}">${esc(c.phone.display)}</a></p>`).join('');
    const hours = `<p class="hours${p.status.open ? '' : ' is-closed'}">${hoursHtml(statusText(p.status))}</p>`;
    return `<p class="who" tabindex="-1" data-focus-after-pick>${esc(f.who)}${area}</p>`
      + `<p class="number">${esc(f.display)}</p>${hours}`
      + (sub ? `<p class="sub with-ref"><span>${esc(sub)}</span>${C.refsHtml(index, f.sources)}</p>` : '')
      + `<a class="dial" href="tel:${esc(f.dial)}" data-dial="${esc(f.dial)}">${PHONE}撥出這支電話</a>${altLine(f.entry)}${more}`;
  }

  function checklist(situation, index, checked) {
    return situation.bring.map((entry, i) => {
      const key = `${situation.id}:${i}`;
      return `<li><label class="check"><input type="checkbox" data-check="${key}"${checked.has(key) ? ' checked' : ''}>`
        + `<span class="box" aria-hidden="true"></span><span class="check-text">${entryText(entry)}</span></label>`
        + `${C.refsHtml(index, entry.sources)}</li>`;
    }).join('');
  }

  function tally(situation, checked) {
    const done = situation.bring.filter((_, i) => checked.has(`${situation.id}:${i}`)).length;
    return `已備好 ${done}／${situation.bring.length}`;
  }

  function row(title, body) {
    return `<details class="row"><summary>${title}</summary><div class="row-body">${body}</div></details>`;
  }

  function renderCard(data, situation, state, checked) {
    const index = C.sourceIndex(data, situation);
    const p = C.plan(data, situation, state.period, state.district, state.moment);
    const script = C.splitScript(p.say.text);
    const timeNote = p.timeNote ? `<p class="time with-ref"><span>${entryText(p.timeNote)}</span>${C.refsHtml(index, p.timeNote.sources)}</p>` : '';
    const others = p.others.map((c) => (c.open
      ? `<li><strong>${esc(c.who)}</strong><span>選了你住的區就會顯示。</span>${districtPicker(data)}</li>`
      : `<li><strong>${esc(c.who)}</strong>${c.note ? `<span>${esc(c.note)}</span>` : ''}`
        + `<span>${hoursHtml(C.hoursText(c.entry.hours))}</span>`
        + `<span class="line-row"><a class="line-dial" href="tel:${esc(c.dial)}" data-dial="${esc(c.dial)}">${PHONE}${esc(c.display)}</a>${C.refsHtml(index, c.sources)}</span>${altLine(c.entry)}</li>`)).join('');
    const sayOthers = p.otherSay.map((e) => {
      const s = C.splitScript(e.text);
      return `<li class="with-ref"><span><strong>${esc(s.lead || '另一種說法')}</strong><br>「${C.scriptHtml(s.quote, 'blank', state.district)}」</span>${C.refsHtml(index, e.sources)}</li>`;
    }).join('');
    const facts = p.facts.map((e) => `<li class="with-ref"><span>${entryText(e)}</span>${C.refsHtml(index, e.sources)}</li>`).join('');
    const cautions = situation.cautions.map((e) => `<li class="with-ref"><span>${entryText(e)}</span>${C.refsHtml(index, e.sources)}</li>`).join('');
    const directory = situation.directory ? data.directories[situation.directory] : null;
    const places = situation.directory === 'laborConsult'
      ? row(esc(directory.title), `<ul class="list">${directory.rows.map((r) => `<li><strong>${esc(r.name)}</strong>`
        + `<span>${esc(r.address)}</span><span>${esc(r.hours)}</span></li>`).join('')}</ul>${C.refsHtml(index, directory.sources)}`)
      : '';

    return `<header class="top"><a class="back" href="#/" aria-label="回到所有卡片">‹</a>${periodTag(state)}</header>`
      + `<article class="card${situation.urgent ? ' is-urgent' : ''}" aria-labelledby="card-title">`
      + `<div class="band"><h1 id="card-title">${esc(situation.title)}</h1><p class="band-sub">${esc(situation.subtitle)}</p></div>`
      + `<section class="part call" aria-label="現在打給誰">${nightNote(state, '現在是晚上或假日，先給晚上打得通的電話')}<p class="label">${p.status.open ? '現在打給' : '上班時間打給'}</p>${callBlock(data, p, index, state)}${timeNote}</section>`
      + `<section class="part say" aria-label="接通後照著說"><p class="label">接通後照著說</p>`
      + `<p class="script">「${C.scriptHtml(script.quote, 'blank', state.district)}」</p>`
      + `<p class="script-src">空格換成你的情況。${C.refsHtml(index, p.say.sources)}</p></section>`
      + `<section class="part bring" aria-label="要準備的東西"><p class="label label-row"><span>要準備的東西</span>`
      + `<span class="tally" data-tally="${esc(situation.id)}">${tally(situation, checked)}</span></p>`
      + `<ul class="checks">${checklist(situation, index, checked)}</ul></section>`
      + `<section class="part know" aria-label="先知道"><p class="label">先知道</p><ul class="know-list">${cautions}</ul></section>`
      + `<p class="card-foot">可以截圖，或直接把手機拿給窗口的人看。</p>`
      + `</article>`
      + `<div class="rows">`
      + (others ? row('其他電話', `<ul class="list">${others}</ul>`) : '')
      + (sayOthers ? row('其他時段怎麼說', `<ul class="list">${sayOthers}</ul>`) : '')
      + row('怎麼申請、誰可以申請', `<ul class="list">${facts}</ul>`)
      + places
      + `<details class="row" data-sources><summary>資料來源</summary><div class="row-body"><ol class="src-list">${C.sourcesListHtml(index)}</ol></div></details>`
      + `</div><p class="foot">整理自臺北市官方頁面與開放資料，查核日 ${esc(data.checkedOn)}，以官方最新公告為準。</p>`;
  }

  function render(data, state, checked, filter = NO_FILTER) {
    const situation = state.id && C.findSituation(data, state.id);
    return (situation ? renderCard(data, situation, state, checked) : renderHome(data, state, filter)) + emergencyBar(data);
  }

  function titleOf(data, state) {
    const s = state.id && C.findSituation(data, state.id);
    return s ? `${s.title}｜我遇到了……` : '我遇到了……';
  }

  root.SituationApp = Object.freeze({ renderHome, renderResults, renderCard, render, nowCall, groups, filteredGroups, matches, titleOf, emergencyBar, resultCountText, searchKeyAction });

  if (root.document) {
    root.document.addEventListener('DOMContentLoaded', () => {
      const checked = new Set(); // page memory only; gone on reload
      const filter = { query: '', category: ALL }; // page memory only; never in storage or the URL
      let shownState = null;
      const app = root.document.getElementById('app');
      C.start((data, state) => { shownState = state; return render(data, state, checked, filter); }, titleOf);

      // Redraw the chips and the cards only, so the search box keeps focus and caret while typing.
      function refilter(focusSelector) {
        const data = root.SITUATION_DATA;
        const results = app.querySelector('[data-results]');
        const cats = app.querySelector('[data-cats]');
        if (!results || !cats) return;
        cats.innerHTML = categoryChips(data, filter);
        results.innerHTML = renderResults(data, shownState, filter);
        const count = app.querySelector('[data-result-count]');
        if (count) count.textContent = resultCountText(data, filter);
        const clear = app.querySelector('[data-clear-search]');
        if (clear) clear.hidden = !filter.query;
        const focus = focusSelector && app.querySelector(focusSelector);
        if (focus) focus.focus();
      }
      function clearSearch() {
        const input = app.querySelector('[data-search]');
        filter.query = '';
        if (input) input.value = '';
        refilter('[data-search]');
      }

      app.addEventListener('input', (event) => {
        if (!event.target.matches('[data-search]')) return;
        filter.query = event.target.value;
        refilter();
      });
      app.addEventListener('keydown', (event) => {
        if (!event.target.matches('[data-search]')) return;
        const action = searchKeyAction(event, filter.query);
        if (action) event.preventDefault();
        if (action === 'clear') clearSearch();
        if (action === 'close') event.target.blur(); // closes the phone keyboard
      });
      app.addEventListener('click', (event) => {
        if (event.target.closest('[data-clear-search]')) { clearSearch(); return; }
        if (event.target.closest('[data-reset-filter]')) {
          filter.category = ALL;
          clearSearch();
          return;
        }
        const cat = event.target.closest('[data-category]');
        if (!cat) return;
        filter.category = cat.dataset.category;
        refilter(`.cats [data-category="${filter.category}"]`);
      });
      app.addEventListener('change', (event) => {
        const key = event.target.dataset && event.target.dataset.check;
        if (!key) return;
        if (event.target.checked) checked.add(key); else checked.delete(key);
        const id = key.split(':')[0];
        const label = app.querySelector(`[data-tally="${id}"]`);
        const situation = C.findSituation(root.SITUATION_DATA, id);
        if (label && situation) label.textContent = tally(situation, checked);
      });
    });
  }
})(typeof window === 'undefined' ? globalThis : window);
