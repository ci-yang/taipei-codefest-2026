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
const BANNED = ['保證', '一定領得到', '一定可以', '一定會', '已受理', '包准', '穩拿', '百分之百'];
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
    readFileSync(join(pageDir, 'index.html'), 'utf8'),
    readFileSync(join(pageDir, 'app.js'), 'utf8'),
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
  const code = ['app.js', 'bridge.js'].map((f) => readFileSync(join(pageDir, f), 'utf8')).join('\n');
  for (const api of ['localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'fetch(', 'XMLHttpRequest', 'sendBeacon', 'userinfo']) {
    assert.ok(!code.includes(api), `uses ${api}`);
  }
});

function loadApp() {
  const context = { window: {} };
  context.window.window = context.window;
  vm.runInNewContext(readFileSync(join(pageDir, 'app.js'), 'utf8'), context);
  return context.window.SituationApp;
}

test('rendered detail page shows the four steps, sources and check dates', () => {
  const app = loadApp();
  for (const situation of data.situations) {
    const html = app.renderSituation(data, situation.id, '');
    for (const title of ['去哪個窗口', '要帶什麼', '打哪支電話', '開口怎麼說', '資料來源']) assert.ok(html.includes(title), `${situation.id} lacks ${title}`);
    assert.ok(html.includes(`查核 ${data.checkedOn}`));
  }
  assert.equal(app.renderSituation(data, 'nope', ''), null);
});

test('choosing a district shows that welfare center as a tel: link', () => {
  const app = loadApp();
  const html = app.renderSituation(data, 'food', '北投區');
  assert.ok(html.includes('北投社會福利服務中心'));
  assert.ok(html.includes('href="tel:0228945933"'));
  assert.ok(!html.includes('中山社會福利服務中心'));
});

test('labor page lists every free lawyer consultation place', () => {
  const html = loadApp().renderSituation(data, 'labor', '');
  for (const row of data.directories.laborConsult.rows) assert.ok(html.includes(row.name));
});
