/* Shared logic for the main page (variant B) and the three design-record variants (BRA-592).
 * Pure helpers over SITUATION_DATA: which call comes first right now, which script to read, source footnotes.
 * No storage, no network: the chosen district lives only in page memory.
 * Preview overrides (read-only, for screenshots): ?t=day|night, ?at=HHMM and ?d=<行政區>. */
(function (root) {
  'use strict';

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  // Short codes (110, 1999 …) stay as dialed; 0800 and Taipei landlines get dashes.
  function formatDial(dial) {
    if (/^\d{3,4}$/.test(dial)) return dial;
    if (/^0800\d{6}$/.test(dial)) return `0800-${dial.slice(4, 7)}-${dial.slice(7)}`;
    if (/^02\d{8}$/.test(dial)) return `02-${dial.slice(2, 6)}-${dial.slice(6)}`;
    if (/^02\d{7}$/.test(dial)) return `02-${dial.slice(2, 5)}-${dial.slice(5)}`;
    return dial;
  }

  const OFFICE_OPEN = 8 * 60 + 30;
  const OFFICE_CLOSE = 17 * 60 + 30;
  const FORCED_DAY_MINUTES = 14 * 60 + 30;

  // Office hours used by 社福中心 per the food FAQ: weekdays 8:30–17:30. Public holidays are not known here,
  // which is why every variant also lets the user flip the period by hand.
  function detectPeriod(date) {
    const day = date.getDay();
    const minutes = date.getHours() * 60 + date.getMinutes();
    const weekday = day >= 1 && day <= 5;
    return weekday && minutes >= OFFICE_OPEN && minutes < OFFICE_CLOSE ? 'day' : 'night';
  }

  /* The moment each number's own hours are checked against: { workday, minutes, day } (day: 0 = Sunday).
   * `day` only words the reopening hint (明天／週一); `workday` decides whether weekday hours apply.
   * The period toggle wins over the clock: 'night' during office hours means a public holiday (no weekday
   * hours apply); 'day' outside office hours means "show me the daytime card" and uses 14:30. */
  function momentFor(period, date) {
    const day = date.getDay();
    const minutes = date.getHours() * 60 + date.getMinutes();
    const weekday = day >= 1 && day <= 5;
    const inOffice = weekday && minutes >= OFFICE_OPEN && minutes < OFFICE_CLOSE;
    if (period === 'day') return { workday: true, minutes: inOffice ? minutes : FORCED_DAY_MINUTES, day: weekday ? day : 3 };
    return { workday: inOffice ? false : weekday, minutes, day };
  }

  function toMinutes(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }

  function clockText(hhmm) {
    return hhmm.replace(/^0/, '');
  }

  /* hours: '24h' | { days: 'weekdays', spans: [['09:00', '12:30'], …] } | null (official page does not say). */
  function isOpen(hours, moment) {
    if (hours === '24h') return true;
    if (!hours) return false;
    return moment.workday && hours.spans.some(([from, to]) => moment.minutes >= toMinutes(from) && moment.minutes < toMinutes(to));
  }

  function hoursText(hours) {
    if (hours === '24h') return '24 小時';
    if (!hours) return '服務時段待確認';
    return `週一至週五 ${hours.spans.map(([from, to]) => `${clockText(from)}–${clockText(to)}`).join('、')}`;
  }

  /* When a closed number opens again, worded by why it is closed: lunch break or before opening -> 今天,
   * after hours Mon–Thu -> 明天, Friday evening or the weekend -> 週一, a holiday (night toggle on a weekday
   * during office hours) -> 下個上班日. Public holidays are not known, hence the manual toggle. */
  function nextOpenText(hours, moment) {
    if (!hours || hours === '24h') return '';
    const first = clockText(hours.spans[0][0]);
    if (!moment.workday) {
      const weekend = moment.day === 0 || moment.day === 6;
      return weekend ? `週一 ${first} 起` : `下個上班日 ${first} 起`;
    }
    const later = hours.spans.find(([from]) => toMinutes(from) > moment.minutes);
    if (later) return `今天 ${clockText(later[0])} 起`;
    return moment.day === 5 ? `週一 ${first} 起` : `明天 ${first} 起`;
  }

  // Preview overrides for screenshots: ?t=day|night picks a fixed Wednesday (14:30 or 21:00); ?at=0915 sets the time.
  function readPreview(search) {
    const params = new URLSearchParams(search || '');
    const t = params.get('t');
    const at = /^(\d{2})(\d{2})$/.exec(params.get('at') || '');
    return {
      period: t === 'day' || t === 'night' ? t : null,
      district: params.get('d') || '',
      at: at ? Number(at[1]) * 60 + Number(at[2]) : null,
    };
  }

  function previewDate(preview) {
    const minutes = preview.at ?? (preview.period === 'night' ? 21 * 60 : FORCED_DAY_MINUTES);
    return new Date(2026, 10, 11, Math.floor(minutes / 60), minutes % 60); // a Wednesday
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

  function defaultMoment(period) {
    return period === 'day' ? { workday: true, minutes: FORCED_DAY_MINUTES, day: 3 } : { workday: true, minutes: 21 * 60, day: 3 };
  }

  /* Period and moment for one draw. Without a manual pick the period follows the clock, read anew on every
   * draw; a manual pick (the 白天／晚上 toggle, or ?t= in a preview) stays until the user flips it again. */
  function viewAt(manualPeriod, date) {
    const period = manualPeriod || detectPeriod(date);
    return { period, moment: momentFor(period, date) };
  }

  function forEntry(list, id) {
    return list.find((entry) => entry.for && entry.for.includes(id)) || null;
  }

  /* The one step to show first: the first call, in data order, whose own hours are open at `moment`.
   * Data order is the priority (e.g. district 社福中心 before 1999). When nothing listed is open, the first
   * call is shown with when it opens next. Scripts and time notes tagged `for` a call id follow that call;
   * '@closed' tags the note shown when nothing is open. */
  function plan(data, situation, period, district, moment = defaultMoment(period)) {
    const calls = situation.call;
    const firstEntry = calls.find((entry) => isOpen(entry.hours, moment)) || calls[0];
    const first = resolveCall(data, firstEntry, district);
    const isOpenNow = isOpen(firstEntry.hours, moment);
    const status = {
      open: isOpenNow,
      hours: hoursText(firstEntry.hours),
      next: isOpenNow ? '' : nextOpenText(firstEntry.hours, moment),
      pending: !firstEntry.hours,
    };
    const say = forEntry(situation.say, firstEntry.id) || situation.say.find((entry) => !entry.for) || situation.say[0];
    const timeNote = (!isOpenNow && forEntry(situation.window, '@closed')) || forEntry(situation.window, firstEntry.id);
    const others = calls.filter((entry) => entry !== firstEntry).map((entry) => resolveCall(data, entry, district));
    const otherSay = situation.say.filter((entry) => entry !== say);
    const facts = situation.window.filter((entry) => entry !== timeNote);
    return { first, status, say, otherSay, timeNote, others, facts };
  }

  // Footnote numbering: every source a situation cites, in first-use order.
  function sourceIndex(data, situation) {
    const directory = situation.directory ? data.directories[situation.directory] : null;
    const ids = [];
    const add = (list) => list.forEach((id) => { if (!ids.includes(id)) ids.push(id); });
    ['call', 'say', 'window', 'bring', 'cautions'].forEach((key) => situation[key].forEach((entry) => add(entry.sources)));
    if (directory) add(directory.sources);
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

  // One footnote button per entry (44px to tap), listing every source it cites; it opens the page's
  // <details data-sources>, scrolls to the first one and flashes them all.
  function refsHtml(index, sourceIds) {
    const numbers = [...new Set(index.refs(sourceIds))].sort((a, b) => a - b);
    if (!numbers.length) return '';
    const label = numbers.join('、');
    return `<button type="button" class="ref" data-ref="${numbers.join(' ')}" aria-label="看來源 ${label}"><span>${label}</span></button>`;
  }

  function wireRefs(container) {
    container.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-ref]');
      if (!button) return;
      const box = container.querySelector('details[data-sources]');
      const items = button.dataset.ref.split(' ').map((n) => container.querySelector(`#src-${n}`)).filter(Boolean);
      if (box) box.open = true;
      if (items.length) items[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
      items.forEach((item) => {
        item.classList.remove('is-flash');
        void item.offsetWidth;
        item.classList.add('is-flash');
      });
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
      const shown = link.dataset.show || formatDial(dial); // data-show: the number as the agency prints it
      show(`正在撥打 ${shown}…`);
      const failed = () => show(`這台裝置沒辦法直接撥號，請手動撥打 ${shown}。`);
      const result = await bridge.call(dial, failed);
      if (result === 'opened') show('');
      else if (result === 'unconfirmed') show(`若沒有跳出撥號畫面，請直接撥 ${shown}。`);
      else if (result === 'busy') show('上一通撥號還在處理，請稍等。');
      else failed();
    });
    return { clear: () => show('') };
  }

  function parseRoute(hash) {
    const match = /^#\/([a-z]+)$/.exec(hash || '');
    return match ? match[1] : null;
  }

  /* Page state lives in memory only: { id, manualPeriod, period, district, moment }.
   * Markup hooks: [data-district="X"] picks a district, [data-clear-district] asks again,
   * [data-flip-period] switches day/night, [data-dial] dials, button[data-ref] opens a source. */
  function start(render, titleOf) {
    const doc = root.document;
    const data = root.SITUATION_DATA;
    const app = doc.getElementById('app');
    const preview = readPreview(root.location.search);
    const clock = () => (preview.period || preview.at !== null ? previewDate(preview) : new Date());
    const state = { id: null, manualPeriod: preview.period, period: null, district: preview.district, moment: null };
    const calls = wireCalls(doc, app, doc.getElementById('call-status'), root.SituationBridge);
    wireRefs(app);

    function draw(focusSelector) {
      state.id = parseRoute(root.location.hash);
      if (state.id && !findSituation(data, state.id)) state.id = null;
      Object.assign(state, viewAt(state.manualPeriod, clock()));
      app.innerHTML = render(data, state);
      doc.title = titleOf(data, state);
      const focus = focusSelector && app.querySelector(focusSelector);
      if (focus) focus.focus({ preventScroll: false });
    }

    root.addEventListener('hashchange', () => { calls.clear(); draw(); root.scrollTo(0, 0); });
    app.addEventListener('click', (event) => {
      const pick = event.target.closest('[data-district]');
      if (pick) { state.district = pick.dataset.district; draw('[data-focus-after-pick]'); return; }
      if (event.target.closest('[data-clear-district]')) { state.district = ''; draw('[data-district]'); return; }
      if (event.target.closest('[data-flip-period]')) { state.manualPeriod = state.period === 'day' ? 'night' : 'day'; draw('[data-flip-period]'); }
    });
    // Coming back to the page (app switch, screen unlock) re-reads the clock, like a redraw or a route change.
    doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'visible') draw(); });
    draw();
  }

  root.SituationCore = Object.freeze({
    start,
    esc, formatDial, detectPeriod, momentFor, viewAt, isOpen, hoursText, nextOpenText, readPreview, previewDate, districts, centersIn, findSituation, needsDistrict,
    plan, sourceIndex, scriptHtml, periodText, splitScript, refsHtml, wireRefs, sourcesListHtml, wireCalls, parseRoute,
  });
})(typeof window === 'undefined' ? globalThis : window);
