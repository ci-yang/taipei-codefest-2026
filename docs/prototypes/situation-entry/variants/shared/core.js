/* Shared logic for the three design variants (BRA-592 design exploration).
 * Pure helpers over SITUATION_DATA: which call comes first right now, which script to read, source footnotes.
 * No storage, no network: the chosen district lives only in page memory.
 * Preview overrides (read-only, for screenshots): ?t=day|night and ?d=<行政區>. */
(function (root) {
  'use strict';

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function formatDial(dial) {
    if (dial === '1999') return '1999';
    return `02-${dial.slice(2, 6)}-${dial.slice(6)}`;
  }

  // Office hours used by 社福中心 per the food FAQ: weekdays 8:30–17:30. Public holidays are not known here,
  // which is why every variant also lets the user flip the period by hand.
  function detectPeriod(date) {
    const day = date.getDay();
    const minutes = date.getHours() * 60 + date.getMinutes();
    const weekday = day >= 1 && day <= 5;
    return weekday && minutes >= 8 * 60 + 30 && minutes < 17 * 60 + 30 ? 'day' : 'night';
  }

  function readPreview(search) {
    const params = new URLSearchParams(search || '');
    const t = params.get('t');
    return { period: t === 'day' || t === 'night' ? t : null, district: params.get('d') || '' };
  }

  function districts(data) {
    return [...new Set(data.directories.welfareCenters.rows.map((row) => row.district))];
  }

  function centersIn(data, district) {
    return data.directories.welfareCenters.rows.filter((row) => row.district === district);
  }

  function findSituation(data, id) {
    return data.situations.find((item) => item.id === id) || null;
  }

  function needsDistrict(situation) {
    return situation.call.some((entry) => entry.fromDirectory);
  }

  // Turns a call entry into something dialable. A directory entry needs a district; without one it stays open.
  function resolveCall(data, entry, district) {
    if (entry.fromDirectory) {
      const centers = district ? centersIn(data, district) : [];
      if (!centers.length) return { entry, open: true, who: entry.label, sources: entry.sources };
      const [center, ...more] = centers;
      return {
        entry, open: false, who: center.name, dial: center.phone.dial, display: center.phone.display,
        address: center.address, note: '', more, sources: entry.sources,
      };
    }
    const dial = entry.number.replace(/\D/g, '');
    const [, name, aside] = /^(.*?)(?:（(.*)）)?$/.exec(entry.label);
    return { entry, open: false, who: name, aside: aside || '', dial, display: formatDial(dial), note: entry.note, more: [], sources: entry.sources };
  }

  /* The one step to show first.
   * day: the district 社福中心 when the situation has one, else the first listed number.
   * night/holiday: 1999 when the situation lists it, else the first listed number. */
  function plan(data, situation, period, district) {
    const calls = situation.call;
    const hotline = calls.find((entry) => entry.number === '1999');
    const directory = calls.find((entry) => entry.fromDirectory);
    const firstEntry = period === 'day' ? (directory || calls[0]) : (hotline || calls[0]);
    const first = resolveCall(data, firstEntry, district);
    const usesHotline = firstEntry === hotline;
    const say = (usesHotline && situation.say.find((entry) => entry.text.includes('1999')))
      || situation.say.find((entry) => !entry.text.includes('1999'))
      || situation.say[0];
    const timeNote = period === 'night'
      ? situation.window.find((entry) => entry.text.includes('晚上')) || null
      : situation.window.find((entry) => entry.text.includes('上班時間')) || null;
    const others = calls.filter((entry) => entry !== firstEntry).map((entry) => resolveCall(data, entry, district));
    const otherSay = situation.say.filter((entry) => entry !== say);
    const facts = situation.window.filter((entry) => entry !== timeNote);
    return { first, say, otherSay, timeNote, others, facts };
  }

  // Footnote numbering: every source a situation cites, in first-use order.
  function sourceIndex(data, situation) {
    const directory = data.directories[situation.directory];
    const ids = [];
    const add = (list) => list.forEach((id) => { if (!ids.includes(id)) ids.push(id); });
    ['call', 'say', 'window', 'bring', 'cautions'].forEach((key) => situation[key].forEach((entry) => add(entry.sources)));
    add(directory.sources);
    const number = new Map(ids.map((id, index) => [id, index + 1]));
    return {
      list: ids.map((id) => ({ id, n: number.get(id), ...data.sources[id] })),
      refs: (sourceIds) => sourceIds.map((id) => {
        if (!number.has(id)) throw new Error(`Unknown source id: ${id}`);
        return number.get(id);
      }),
    };
  }

  // "＿＿" in a script becomes a visible blank the reader fills in. A known district fills "臺北市＿＿區".
  function scriptHtml(text, blankClass, district) {
    const parts = district ? text.split('臺北市＿＿區') : [text];
    const blanks = (part) => esc(part).split('＿＿').join(`<span class="${blankClass}" aria-label="填空">　　</span>`);
    return parts.map(blanks).join(`臺北市<strong class="${blankClass} is-filled">${esc(district)}</strong>`);
  }

  function periodText(period) {
    return period === 'day' ? '現在是平日上班時間' : '現在是晚上或假日';
  }

  // '白天打給社福中心：「…」' -> { lead: '白天打給社福中心', quote: '…' }. Text without 「」 is all quote.
  function splitScript(text) {
    const match = /^(.*?)[：:]?「(.*)」$/.exec(text);
    return match ? { lead: match[1], quote: match[2] } : { lead: '', quote: text };
  }

  // Small footnote buttons; they open the page's <details data-sources> and scroll to the entry.
  function refsHtml(index, sourceIds) {
    return index.refs(sourceIds)
      .map((n) => `<button type="button" class="ref" data-ref="${n}" aria-label="看來源 ${n}">${n}</button>`).join('');
  }

  function wireRefs(container) {
    container.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-ref]');
      if (!button) return;
      const box = container.querySelector('details[data-sources]');
      const item = container.querySelector(`#src-${button.dataset.ref}`);
      if (box) box.open = true;
      if (item) {
        item.scrollIntoView({ block: 'center', behavior: 'smooth' });
        item.classList.remove('is-flash');
        void item.offsetWidth;
        item.classList.add('is-flash');
      }
    });
  }

  function sourcesListHtml(index) {
    return index.list.map((s) => `<li id="src-${s.n}"><span class="src-n">${s.n}</span><span class="src-body">`
      + `<a href="${esc(s.url)}" rel="noopener">${esc(s.title)}</a>`
      + `<span class="src-meta">${esc(s.publisher)}，查核 ${esc(s.checkedOn)}</span></span></li>`).join('');
  }

  // Dial taps on [data-dial] go through the existing SituationBridge, same messages as the main prototype.
  function wireCalls(doc, container, statusEl, bridge) {
    function show(text) { statusEl.textContent = text; statusEl.hidden = !text; }
    container.addEventListener('click', async (event) => {
      const link = event.target.closest('a[data-dial]');
      if (!link || !bridge.available()) return; // plain browser: let tel: open the dialer
      event.preventDefault();
      const dial = link.dataset.dial;
      show(`正在撥打 ${formatDial(dial)}…`);
      const failed = () => show(`這台裝置沒辦法直接撥號，請手動撥打 ${formatDial(dial)}。`);
      const result = await bridge.call(dial, failed);
      if (result === 'opened') show('');
      else if (result === 'unconfirmed') show(`若沒有跳出撥號畫面，請直接撥 ${formatDial(dial)}。`);
      else if (result === 'busy') show('上一通撥號還在處理，請稍等。');
      else failed();
    });
    return { clear: () => show('') };
  }

  function parseRoute(hash) {
    const match = /^#\/([a-z]+)$/.exec(hash || '');
    return match ? match[1] : null;
  }

  /* Page state lives in memory only: { id, period, district }.
   * Markup hooks: [data-district="X"] picks a district, [data-clear-district] asks again,
   * [data-flip-period] switches day/night, [data-dial] dials, button[data-ref] opens a source. */
  function start(render, titleOf) {
    const doc = root.document;
    const data = root.SITUATION_DATA;
    const app = doc.getElementById('app');
    const preview = readPreview(root.location.search);
    const state = { id: null, period: preview.period || detectPeriod(new Date()), district: preview.district };
    const calls = wireCalls(doc, app, doc.getElementById('call-status'), root.SituationBridge);
    wireRefs(app);

    function draw(focusSelector) {
      state.id = parseRoute(root.location.hash);
      if (state.id && !findSituation(data, state.id)) state.id = null;
      app.innerHTML = render(data, state);
      doc.title = titleOf(data, state);
      doc.documentElement.dataset.period = state.period;
      const focus = focusSelector && app.querySelector(focusSelector);
      if (focus) focus.focus({ preventScroll: false });
    }

    root.addEventListener('hashchange', () => { calls.clear(); draw(); root.scrollTo(0, 0); });
    app.addEventListener('click', (event) => {
      const pick = event.target.closest('[data-district]');
      if (pick) { state.district = pick.dataset.district; draw('[data-focus-after-pick]'); return; }
      if (event.target.closest('[data-clear-district]')) { state.district = ''; draw('[data-district]'); return; }
      if (event.target.closest('[data-flip-period]')) { state.period = state.period === 'day' ? 'night' : 'day'; draw('[data-flip-period]'); }
    });
    draw();
  }

  root.VariantCore = Object.freeze({
    start,
    esc, formatDial, detectPeriod, readPreview, districts, centersIn, findSituation, needsDistrict,
    plan, sourceIndex, scriptHtml, periodText, splitScript, refsHtml, wireRefs, sourcesListHtml, wireCalls, parseRoute,
  });
})(typeof window === 'undefined' ? globalThis : window);
