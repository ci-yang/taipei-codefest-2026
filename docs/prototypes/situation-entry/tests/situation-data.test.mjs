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

test('the three pain-point situations exist in order', () => {
  assert.deepEqual(data.situations.map((s) => s.id), ['food', 'labor', 'emergency']);
});

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
        assert.match(source.url, /^https:\/\/([a-z-]+\.gov\.taipei|data\.taipei)\//, `${id} is not an official https url`);
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
      if (entry.fromDirectory) assert.equal(situation.directory, 'welfareCenters');
      else assert.match(entry.number.replace(/\D/g, ''), /^(1999|02\d{8})$/);
    }
  });
}

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
