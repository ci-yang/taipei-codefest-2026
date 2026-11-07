import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { buildData, renderModule } from '../build-data.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const pageDir = join(here, '..');
const data = buildData();
const FIELDS = ['window', 'bring', 'call', 'say'];
const BANNED = ['保證', '一定', '領得到', '一定核准', '一定領得到', '領得到救助金', '一定可以', '一定會', '已受理', '包准', '穩拿', '百分之百'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function allEntries(situation) {
  return [...FIELDS.flatMap((field) => situation[field]), ...situation.cautions];
}

const bridge = (() => {
  const context = { window: {} };
  vm.runInNewContext(readFileSync(join(pageDir, 'bridge.js'), 'utf8'), context);
  return context.window.SituationBridge;
})();

test('the eight first-batch situations exist in order', () => {
  assert.deepEqual(data.situations.map((s) => s.id), ['food', 'emergency', 'rental', 'labor', 'discharge', 'missing', 'fraud', 'nhi']);
});

function validHours(hours) {
  if (hours === '24h' || hours === null) return true;
  return hours.days === 'weekdays' && hours.spans.length > 0
    && hours.spans.every(([from, to]) => /^\d{2}:\d{2}$/.test(from) && /^\d{2}:\d{2}$/.test(to) && from < to);
}

for (const situation of data.situations) {
  test(`${situation.id}: has all four fields, each non-empty`, () => {
    for (const field of FIELDS) {
      assert.ok(Array.isArray(situation[field]) && situation[field].length > 0, `${situation.id}.${field} is empty`);
    }
  });

  test(`${situation.id}: every entry cites a known source with url and check date`, () => {
    for (const entry of allEntries(situation)) {
      assert.ok(entry.sources.length > 0, `entry without source: ${entry.text || entry.label}`);
      for (const id of entry.sources) {
        const source = data.sources[id];
        assert.ok(source, `unknown source ${id}`);
        assert.match(source.url, /^https:\/\/([a-z0-9-]+\.)*(gov\.taipei|gov\.tw|data\.taipei)\//, `${id} is not an official https url`);
        assert.match(source.checkedOn, ISO_DATE, `${id} has no check date`);
      }
    }
  });

  test(`${situation.id}: uncertain entries say 待確認`, () => {
    for (const entry of allEntries(situation).filter((e) => e.pending)) {
      assert.match(entry.text, /待確認/);
    }
  });

  test(`${situation.id}: every call is dialable or comes from the district directory`, () => {
    for (const entry of situation.call) {
      if (entry.fromDirectory) { assert.equal(situation.directory, 'welfareCenters'); continue; }
      const dial = entry.number.replace(/\D/g, '');
      assert.ok(bridge.dialable(dial), `${entry.number} is not on the bridge allowlist`);
    }
  });

  test(`${situation.id}: every call has an id and its own service hours (or null when the page does not say)`, () => {
    const ids = situation.call.map((entry) => entry.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const entry of situation.call) {
      assert.match(entry.id || '', /^[a-z0-9-]+$/, `${entry.label} has no id`);
      assert.ok(validHours(entry.hours), `${entry.id} has malformed hours`);
    }
    for (const entry of [...situation.say, ...situation.window].filter((e) => e.for)) {
      for (const id of entry.for) assert.ok(id === '@closed' || ids.includes(id), `${situation.id} tags unknown call ${id}`);
    }
  });
}

test('emergency lines: 110／119／113／1925, each dialable and sourced', () => {
  assert.deepEqual(data.emergencyLines.map((line) => line.number), ['110', '119', '113', '1925']);
  for (const line of data.emergencyLines) {
    assert.ok(bridge.dialable(line.number));
    assert.ok(line.sources.length && line.sources.every((id) => data.sources[id]?.url), `${line.number} has no source`);
  }
});

test('no guarantee wording anywhere in the shipped data or page', () => {
  const shipped = [
    renderModule(data),
    ...['index.html', 'app.js', 'core.js'].map((f) => readFileSync(join(pageDir, f), 'utf8')),
  ].join('\n');
  for (const word of BANNED) assert.ok(!shipped.includes(word), `found banned wording: ${word}`);
});

test('directories come from the open-data snapshots with sources', () => {
  assert.equal(data.directories.welfareCenters.rows.length, 13);
  assert.equal(new Set(data.directories.welfareCenters.rows.map((r) => r.district)).size, 12);
  for (const row of data.directories.welfareCenters.rows) assert.match(row.phone.dial, /^02\d{8}$/);
  assert.equal(data.directories.laborConsult.rows.length, 5);
  for (const dir of Object.values(data.directories)) assert.ok(dir.sources.every((id) => data.sources[id]));
});

test('generated situations-data.js matches data/situation/', () => {
  assert.equal(readFileSync(join(pageDir, 'situations-data.js'), 'utf8'), renderModule(data));
});

test('page never touches storage or sends what the user picked', () => {
  const code = ['app.js', 'core.js', 'bridge.js'].map((f) => readFileSync(join(pageDir, f), 'utf8')).join('\n');
  for (const api of ['localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'fetch(', 'XMLHttpRequest', 'sendBeacon', 'userinfo']) {
    assert.ok(!code.includes(api), `uses ${api}`);
  }
});

test('every situation belongs to a known category, and categories are unique', () => {
  const ids = data.categories.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const situation of data.situations) assert.ok(ids.includes(situation.category), `${situation.id} has unknown category ${situation.category}`);
});

function loadApp() {
  const context = { window: {} };
  context.window.window = context.window;
  for (const file of ['core.js', 'app.js']) vm.runInNewContext(readFileSync(join(pageDir, file), 'utf8'), context);
  return { app: context.window.SituationApp, core: context.window.SituationCore };
}

const PERIODS = ['day', 'night'];
const state = (id, period, district = '') => ({ id, period, district });

// Every number a home card shows under 「現在打」 must be a call entry in situations.json, or a welfare
// center from the open-data snapshot, and that entry must cite sources that exist.
function knownNumbers() {
  const known = new Map();
  for (const situation of data.situations) {
    for (const entry of situation.call.filter((e) => !e.fromDirectory)) {
      known.set(entry.number.replace(/\D/g, ''), entry.sources);
    }
  }
  for (const row of data.directories.welfareCenters.rows) known.set(row.phone.dial, data.directories.welfareCenters.sources);
  return known;
}

test('home: every 「現在打」 number traces back to data/situation/ with a source', () => {
  const { app, core } = loadApp();
  const known = knownNumbers();
  for (const period of PERIODS) {
    for (const district of ['', '北投區']) {
      const html = app.renderHome(data, state(null, period, district));
      const shown = [...html.matchAll(/<span class="mini-number">([^<]+)<\/span>/g)].map((m) => m[1]);
      assert.ok(shown.length > 0, `${period}/${district || 'no district'} shows no number`);
      for (const display of shown) {
        const dial = display.replace(/\D/g, '');
        assert.ok(known.has(dial), `home shows ${display} that is not in data/situation/`);
        for (const id of known.get(dial)) assert.ok(data.sources[id]?.url, `${display} cites unknown source ${id}`);
      }
      for (const situation of data.situations) {
        const now = app.nowCall(data, situation, state(null, period, district));
        if (now.number) assert.equal(core.formatDial(now.number.replace(/\D/g, '')), now.number);
      }
    }
  }
});

test('home: the labor lawyer number is the one the Labor Bureau open data lists (ext. 7019)', () => {
  const { app } = loadApp();
  const now = app.nowCall(data, data.situations.find((s) => s.id === 'labor'), state(null, 'day'));
  assert.equal(now.number, '02-2720-8889');
  assert.deepEqual(now.entry.sources, ['d8-labor-lawyer']);
  assert.match(now.entry.note, /分機 7019/);
  const csv = readFileSync(join(here, '../../../../data/situation/labor-lawyer-consultation.csv'), 'utf8');
  assert.ok(csv.includes('請撥02-27208889分機7019'), 'open-data snapshot no longer lists 02-27208889 ext. 7019');
});

test('home: day asks for the district, night gives 1999 for the welfare situations', () => {
  const { app } = loadApp();
  const day = app.renderHome(data, state(null, 'day'));
  const night = app.renderHome(data, state(null, 'night'));
  assert.ok(day.includes('進去選你住的區'));
  assert.ok(night.includes('<span class="mini-number">1999</span>'));
  assert.ok(night.includes('現在是晚上或假日') && day.includes('現在是平日上班時間'));
});

test('home: cards are grouped under each category title, in data order', () => {
  const { app } = loadApp();
  const html = app.renderHome(data, state(null, 'day'));
  const positions = data.categories.map((c) => html.indexOf(`>${c.title}</h2>`));
  assert.ok(positions.every((p) => p >= 0), 'a category title is missing');
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  for (const situation of data.situations) {
    const group = html.indexOf(`>${data.categories.find((c) => c.id === situation.category).title}</h2>`);
    const card = html.indexOf(`data-situation="${situation.id}"`);
    assert.ok(card > group, `${situation.id} is not under its category`);
  }
});

test('home: an urgent situation is added by data alone and goes first with the urgent style', () => {
  const { app } = loadApp();
  const urgent = { ...data.situations[0], id: 'urgenttest', title: '測試緊急', urgent: true };
  const extended = { ...data, situations: [...data.situations, urgent] };
  const html = app.renderHome(extended, state(null, 'night'));
  assert.ok(html.indexOf('data-situation="urgenttest"') < html.indexOf(`data-situation="${data.situations[0].id}"`));
  assert.match(html, /class="mini is-urgent" href="#\/urgenttest"/);
  assert.match(app.renderCard(extended, urgent, state('urgenttest', 'day'), new Set()), /class="card is-urgent"/);
});

test('card: every situation, day and night, has the call, script, checklist, 先知道 and dated sources', () => {
  const { app } = loadApp();
  for (const situation of data.situations) {
    for (const period of PERIODS) {
      const html = app.renderCard(data, situation, state(situation.id, period), new Set());
      for (const title of ['現在打給', '接通後照著說', '要準備的東西', '先知道', '資料來源']) assert.ok(html.includes(title), `${situation.id}/${period} lacks ${title}`);
      assert.ok(html.includes(`查核 ${data.checkedOn}`));
      assert.equal((html.match(/type="checkbox"/g) || []).length, situation.bring.length);
      for (const entry of situation.cautions) assert.ok(html.includes(entry.text.slice(0, 12)), `${situation.id} hides a caution`);
    }
  }
});

test('card: entries the official pages leave open are marked 待確認', () => {
  const { app } = loadApp();
  for (const situation of data.situations) {
    const html = app.renderCard(data, situation, state(situation.id, 'day', '北投區'), new Set());
    assert.ok(html.includes('<mark class="pending">待確認</mark>'), `${situation.id} shows no 待確認`);
  }
});

test('card: daytime welfare situations ask for the district before giving a number', () => {
  const { app } = loadApp();
  for (const id of ['food', 'emergency']) {
    const situation = data.situations.find((s) => s.id === id);
    const before = app.renderCard(data, situation, state(id, 'day'), new Set());
    assert.ok(before.includes('你住哪一區？'));
    assert.ok(!before.includes('class="dial"'), `${id} offers a dial button before the district is known`);
    const after = app.renderCard(data, situation, state(id, 'day', '北投區'), new Set());
    assert.ok(after.includes('北投社會福利服務中心'));
    assert.ok(after.includes('class="dial" href="tel:0228945933"'));
  }
  const labor = app.renderCard(data, data.situations.find((s) => s.id === 'labor'), state('labor', 'day'), new Set());
  assert.ok(!labor.includes('你住哪一區？'), 'labor has no district window and should not ask');
});

test('card: the script fills in the chosen district', () => {
  const { app } = loadApp();
  const html = app.renderCard(data, data.situations.find((s) => s.id === 'emergency'), state('emergency', 'day', '萬華區'), new Set());
  assert.ok(html.includes('臺北市<strong class="blank is-filled">萬華區</strong>'));
});

test('card: night puts 1999 first for food and emergency', () => {
  const { app } = loadApp();
  for (const id of ['food', 'emergency']) {
    const html = app.renderCard(data, data.situations.find((s) => s.id === id), state(id, 'night'), new Set());
    assert.ok(html.includes('<p class="number">1999</p>'), `${id} night does not lead with 1999`);
  }
});

test('card: ticked boxes come from page memory and show in the tally', () => {
  const { app } = loadApp();
  const situation = data.situations.find((s) => s.id === 'labor');
  const html = app.renderCard(data, situation, state('labor', 'day'), new Set(['labor:0', 'labor:2']));
  assert.equal((html.match(/ checked>/g) || []).length, 2);
  assert.ok(html.includes(`已備好 2／${situation.bring.length}`));
});

test('labor card lists every free lawyer consultation place', () => {
  const { app } = loadApp();
  const html = app.renderCard(data, data.situations.find((s) => s.id === 'labor'), state('labor', 'day'), new Set());
  for (const row of data.directories.laborConsult.rows) assert.ok(html.includes(row.name));
});

// A weekday at hh:mm, as the page would compute it from the clock for a period.
function at(period, hhmm, weekday = true) {
  const { core } = loadApp();
  const [h, m] = hhmm.split(':').map(Number);
  const date = new Date(2026, 10, weekday ? 11 : 14, h, m); // Wed 11 / Sat 14 Nov 2026
  return core.momentFor(period, date);
}
const find = (id) => data.situations.find((s) => s.id === id);
const firstCall = (id, moment, period = 'day') => loadApp().core.plan(data, find(id), period, '北投區', moment);

test('hours: the labor lawyer line is offered only inside its own 14:00–17:00', () => {
  for (const time of ['09:15', '13:15']) {
    const p = firstCall('labor', at('day', time));
    assert.notEqual(p.first.entry.id, 'labor-lawyer', `lawyer offered at ${time}`);
  }
  assert.notEqual(firstCall('labor', at('night', '17:15'), 'night').first.entry.id, 'labor-lawyer', 'lawyer offered at 17:15');
  assert.equal(firstCall('labor', at('day', '14:30')).first.entry.id, 'labor-lawyer');
  assert.equal(firstCall('labor', at('day', '09:15')).first.entry.id, 'labor-1999');
});

test('hours: 1966 lunch break and the rental line before 9:00 show when they open next', () => {
  const lunch = firstCall('discharge', at('day', '12:15'));
  assert.equal(lunch.first.entry.id, 'ltc-1966');
  assert.equal(lunch.status.open, false);
  assert.equal(lunch.status.next, '今天 13:30 起');
  const early = firstCall('rental', at('day', '08:45'));
  assert.equal(early.status.open, false);
  assert.equal(early.status.next, '今天 9:00 起');
  assert.equal(firstCall('rental', at('day', '10:00')).status.open, true);
});

test('hours: a holiday (night toggle during office hours) closes weekday lines but not 24-hour ones', () => {
  const holiday = at('night', '10:00');
  assert.equal(holiday.workday, false);
  const nhi = firstCall('nhi', holiday, 'night');
  assert.equal(nhi.status.open, false);
  assert.equal(nhi.status.next, '下個上班日 8:30 起');
  assert.match(nhi.timeNote.text, /健保專線現在沒開/);
  assert.equal(firstCall('fraud', holiday, 'night').first.display, '165');
  assert.equal(firstCall('missing', holiday, 'night').first.display, '110');
  assert.equal(firstCall('food', holiday, 'night').first.display, '1999');
});

test('emergency at night: 1999 takes the request to be logged; 6962 is only a daytime extension', () => {
  const { app } = loadApp();
  const night = app.renderCard(data, find('emergency'), { id: 'emergency', period: 'night', district: '', moment: at('night', '21:00') }, new Set());
  const call = night.slice(night.indexOf('現在打給'), night.indexOf('接通後照著說'));
  const script = night.slice(night.indexOf('接通後照著說'), night.indexOf('要準備的東西'));
  assert.ok(call.includes('<p class="number">1999</p>'));
  assert.match(call, /24 小時接聽/);
  assert.match(call, /登錄並轉辦/);
  assert.match(call, /上班時間才(會)?處理/);
  assert.ok(!call.includes('6962'), 'night call block still says 轉 6962');
  assert.match(script, /登錄/);
  assert.match(script, /上班時間/);
  const day = app.renderCard(data, find('emergency'), { id: 'emergency', period: 'day', district: '', moment: at('day', '10:00') }, new Set());
  assert.ok(day.includes('6962'));
});

test('home: a call card shows its short note and its own hours (轉分機 7019, 14:00–17:00)', () => {
  const { app } = loadApp();
  const html = app.renderHome(data, { id: null, period: 'day', district: '', moment: at('day', '14:30') });
  const start = html.indexOf('data-situation="labor"');
  const card = html.slice(start, html.indexOf('</a>', start)).replace(/<[^>]+>/g, '');
  assert.match(card, /接通後轉分機 7019/);
  assert.match(card, /週一至週五 14:00–17:00/);
});

test('short numbers: 110／113／119／1925 and 0800 are shown and dialed as themselves', () => {
  const { core } = loadApp();
  for (const short of ['110', '113', '119', '165', '1925', '1966', '1999']) assert.equal(core.formatDial(short), short);
  assert.equal(core.formatDial('0800030598'), '0800-030-598');
  assert.equal(core.formatDial('024128518'), '02-412-8518');
  assert.equal(core.formatDial('0227208889'), '02-2720-8889');
  const { app } = loadApp();
  const html = app.renderCard(data, find('missing'), { id: 'missing', period: 'night', district: '' }, new Set());
  assert.ok(html.includes('<p class="number">110</p>'));
  assert.ok(html.includes('href="tel:110" data-dial="110"'));
  assert.ok(!/02-0-|02--/.test(html));
});

test('emergency strip: on the home page and every card, day and night, with all four lines', () => {
  const { app } = loadApp();
  const pages = [{ id: null }, ...data.situations.map((s) => ({ id: s.id }))];
  for (const page of pages) {
    for (const period of PERIODS) {
      const html = app.render(data, { ...page, period, district: '' }, new Set());
      const strip = html.slice(html.indexOf('<nav class="sos"'));
      assert.ok(strip.startsWith('<nav class="sos"'), `${page.id || 'home'}/${period} has no emergency strip`);
      for (const n of ['110', '119', '113', '1925']) assert.ok(strip.includes(`data-dial="${n}"`), `${page.id || 'home'} strip lacks ${n}`);
    }
  }
});

test('emergency strip copy asks nothing and promises nothing', () => {
  const { app } = loadApp();
  const strip = app.emergencyBar(data);
  for (const word of ['安全', '保密', '請說明', '發生什麼']) assert.ok(!strip.includes(word), `strip says ${word}`);
});

test('source buttons: one per entry, never two side by side', () => {
  const { app } = loadApp();
  for (const situation of data.situations) {
    const html = app.renderCard(data, situation, { id: situation.id, period: 'day', district: '北投區' }, new Set());
    assert.ok(!/<\/button><button type="button" class="ref"/.test(html), `${situation.id} has adjacent source buttons`);
  }
});

test('ticked items keep readable text (no strike-through)', () => {
  assert.ok(!readFileSync(join(pageDir, 'styles.css'), 'utf8').includes('line-through'));
});

const plainText = (html) => html.replace(/<[^>]+>/g, '');

test('nhi: the card gives the landline 0800-030-598 and the mobile 02-4128-678, and says which is which', () => {
  const { app } = loadApp();
  const html = app.renderCard(data, find('nhi'), { id: 'nhi', period: 'day', district: '', moment: at('day', '10:00') }, new Set());
  const call = html.slice(html.indexOf('現在打給'), html.indexOf('接通後照著說'));
  assert.ok(call.includes('<p class="number">0800-030-598</p>'));
  assert.ok(call.includes('href="tel:024128678" data-dial="024128678" data-show="02-4128-678"'), 'no dial link for the mobile number');
  assert.match(plainText(call), /市話打這支，免付費/);
  assert.match(plainText(call), /用手機打，改撥：02-4128-678/);
  const home = app.renderHome(data, { id: null, period: 'day', district: '', moment: at('day', '10:00') });
  const start = home.indexOf('data-situation="nhi"');
  assert.match(plainText(home.slice(start, home.indexOf('</a>', start))), /手機改撥 02-4128-678/);
});

test('nhi: the mobile number is on the bridge allowlist', () => {
  const alt = find('nhi').call[0].alt;
  assert.equal(alt.number, '02-4128-678');
  assert.ok(alt.sources.every((id) => data.sources[id]?.url));
  assert.ok(bridge.dialable(alt.number.replace(/\D/g, '')));
});

test('nhi: insured people in arrears are told plainly that care is not affected; the uninsured get their own path', () => {
  const s = find('nhi');
  const text = [s.title, s.subtitle, ...allEntries(s).map((e) => e.text)].join('\n');
  assert.match(s.subtitle, /目前不影響看病/);
  assert.match(text, /「目前健保欠費也不會導致民眾被鎖卡或影響就醫權利」/);
  assert.match(text, /還沒有加入健保的人：如果是急重症/);
  const insured = allEntries(s).filter((e) => /已經有健保/.test(e.text));
  assert.ok(insured.length > 0 && insured.every((e) => !e.pending && !/待確認/.test(e.text)), 'insured-in-arrears care is still 待確認');
  const pending = [...s.window, ...s.cautions].filter((e) => e.pending);
  assert.ok(pending.length && pending.every((e) => /還沒有健保/.test(e.text)), 'only the uninsured, non-urgent case stays 待確認');
});

// Rendered call section for a situation at a given clock (weekday by default).
function closedHint(id, date) {
  const { app, core } = loadApp();
  const view = core.viewAt(null, date);
  const html = app.renderCard(data, find(id), { id, period: view.period, district: '', moment: view.moment }, new Set());
  return plainText(html.slice(html.indexOf('aria-label="現在打給誰"'), html.indexOf('接通後照著說')));
}

test('closed lines give one reopening hint that matches why they are closed', () => {
  const wed = (h, m) => new Date(2026, 10, 11, h, m);
  const lunch = closedHint('rental', wed(12, 45));
  assert.match(lunch, /今天 13:30 起/);
  assert.ok(!/下個上班日|明天|晚上|假日/.test(lunch), `lunch hint contradicts itself: ${lunch}`);
  const discharge = closedHint('discharge', wed(12, 45));
  assert.match(discharge, /今天 13:30 起/);
  assert.ok(!/晚上|假日|下個上班日/.test(discharge), `1966 lunch says 晚上假日: ${discharge}`);
  assert.match(closedHint('rental', wed(18, 0)), /明天 9:00 起/);
  assert.match(closedHint('rental', new Date(2026, 10, 13, 18, 0)), /週一 9:00 起/); // Friday evening
  assert.match(closedHint('nhi', new Date(2026, 10, 14, 10, 0)), /週一 8:30 起/); // Saturday
  assert.match(closedHint('rental', wed(8, 0)), /今天 9:00 起/);
});

test('period: the clock is re-read for each view, a manual pick sticks', () => {
  const { core } = loadApp();
  const afternoon = core.viewAt(null, new Date(2026, 10, 11, 14, 30));
  const evening = core.viewAt(null, new Date(2026, 10, 11, 17, 45));
  assert.equal(afternoon.period, 'day');
  assert.equal(firstCall('labor', afternoon.moment).first.entry.id, 'labor-lawyer');
  assert.equal(evening.period, 'night');
  assert.notEqual(firstCall('labor', evening.moment, 'night').first.entry.id, 'labor-lawyer');
  const pinned = core.viewAt('day', new Date(2026, 10, 11, 17, 45));
  assert.equal(pinned.period, 'day');
  assert.equal(pinned.moment.minutes, 14 * 60 + 30);
});

// Runs core.start() against a minimal fake page whose clock the test moves.
function startPage(hash) {
  let now = new Date(2026, 10, 11, 14, 30);
  class FakeDate extends Date { constructor(...args) { super(...(args.length ? args : [now.getTime()])); } }
  const listeners = {};
  const on = (target) => (type, fn) => { (listeners[`${target}:${type}`] ||= []).push(fn); };
  const app = { innerHTML: '', addEventListener: on('app'), querySelector: () => null };
  const doc = {
    visibilityState: 'visible', documentElement: { dataset: {} }, title: '',
    getElementById: (id) => (id === 'app' ? app : { hidden: true, textContent: '' }),
    querySelector: () => null, addEventListener: on('doc'),
  };
  const win = { document: doc, location: { search: '', hash }, addEventListener: on('win'), scrollTo() {} };
  win.window = win;
  const context = { window: win, Date: FakeDate, URLSearchParams };
  vm.runInNewContext(readFileSync(join(pageDir, 'core.js'), 'utf8'), context);
  win.SITUATION_DATA = data;
  win.SituationBridge = { available: () => false, call: async () => 'unsupported' };
  const seen = [];
  win.SituationCore.start((d, state) => { seen.push({ ...state }); return ''; }, () => '');
  const fire = (key, event = {}) => (listeners[key] || []).forEach((fn) => fn(event));
  return { seen, fire, setNow: (date) => { now = date; } };
}

test('page: redraw, route change and coming back all re-read the clock; the manual toggle survives them', () => {
  const page = startPage('#/labor');
  assert.equal(page.seen.at(-1).period, 'day');
  page.setNow(new Date(2026, 10, 11, 17, 45));
  page.fire('doc:visibilitychange');
  assert.equal(page.seen.at(-1).period, 'night', 'coming back at 17:45 still shows the 14:30 card');
  assert.notEqual(firstCall('labor', page.seen.at(-1).moment, 'night').first.entry.id, 'labor-lawyer');
  page.setNow(new Date(2026, 10, 11, 14, 30));
  page.fire('win:hashchange');
  assert.equal(page.seen.at(-1).period, 'day');
  page.fire('app:click', { target: { closest: (sel) => (sel === '[data-flip-period]' ? {} : null) } });
  assert.equal(page.seen.at(-1).period, 'night');
  page.setNow(new Date(2026, 10, 11, 15, 0));
  page.fire('doc:visibilitychange');
  assert.equal(page.seen.at(-1).period, 'night', 'the manual pick was dropped on redraw');
});
