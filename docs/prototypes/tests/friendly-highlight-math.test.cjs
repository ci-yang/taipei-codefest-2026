const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const vm = require('node:vm');

const prototypeRoot = path.resolve(__dirname, '..');
const mathPath = path.join(prototypeRoot, 'friendly-route/highlight-math.js');
const math = require(mathPath);
const prices = require('../friendly-route/price-data.js');
const center = { lat: 0, lng: 0 };
const hotspot = (northM, eastM = 0) => ({
  lat: northM / 111195.0802335,
  lng: eastM / 111195.0802335,
  services: ['wifi'],
});

test('browser globals work without a module loader', () => {
  const context = { window: {} };
  vm.runInNewContext(readFileSync(mathPath, 'utf8'), context);
  vm.runInNewContext(readFileSync(path.join(prototypeRoot, 'friendly-route/price-data.js'), 'utf8'), context);
  assert.equal(context.window.FriendlyHighlightMath.toiletEstimate(70).seconds, 60);
  assert.equal(context.window.FRIENDLY_PRICE_SAMPLE.districts.length, 12);
});

test('Wi-Fi deduplicates to five decimals and ignores non-Wi-Fi or malformed points', () => {
  const first = { lat: 25.033111, lng: 121.565111, services: ['wifi'], id: 'first' };
  const duplicate = { lat: 25.033114, lng: 121.565114, services: ['wifi'], id: 'duplicate' };
  const input = [first, duplicate, null,
    { ...first, services: ['toilet'], lng: 121.5652 },
    { ...first, lat: null }, { ...first, lat: NaN },
    { ...first, lat: '25.03311' }, { ...first, lat: 91 }];
  const result = math.wifiSummary(input, first);
  assert.deepEqual(result.points, [first]);
  assert.equal(result.count, 1);
  assert.equal(result.label, 'Wi-Fi綠洲');
  assert.equal(result.coveragePercent, math.wifiSummary([first], first).coveragePercent);
  assert.equal(input.length, 8);
});

test('Wi-Fi density counts a 300 m radius while retaining deduplicated distant display points', () => {
  const result = math.wifiSummary([hotspot(0), hotspot(100), hotspot(-100), hotspot(1000)], center);
  assert.equal(result.count, 3);
  assert.equal(result.points.length, 4);
  assert.equal(result.label, 'Wi-Fi風暴');
  assert.equal(math.wifiSummary([hotspot(0), hotspot(100)], center).label, 'Wi-Fi綠洲');
  assert.equal(math.wifiSummary([], center).label, 'Wi-Fi沙漠');
});

test('Wi-Fi coverage approximates circle area and counts overlapping coverage only once', () => {
  const one = math.wifiSummary([hotspot(0)], center);
  const analyticPercent = 100 * 50 ** 2 / 300 ** 2;
  assert.ok(Math.abs(one.coveragePercent - analyticPercent) < 0.25);
  const overlap = math.wifiSummary([hotspot(0), hotspot(0, 10)], center);
  assert.ok(overlap.coveragePercent >= one.coveragePercent);
  assert.ok(overlap.coveragePercent < one.coveragePercent * 1.3);
  assert.equal(math.wifiSummary([hotspot(0)], center, { signalM: 300 }).coveragePercent, 100);
  assert.equal(math.wifiSummary([hotspot(0)], center, { signalM: 0 }).coveragePercent, 0);
});

test('Wi-Fi hotspots from 300 to 350 m may cover the statistical circle without increasing its count', () => {
  const overlap = math.wifiSummary([hotspot(325)], center);
  assert.equal(overlap.count, 0);
  assert.ok(overlap.coveragePercent > 0);
  assert.ok(overlap.coveragePercent < 1);
  assert.equal(math.wifiSummary([hotspot(351)], center).coveragePercent, 0);
  assert.equal(math.wifiSummary([hotspot(299)], center).count, 1);
  assert.equal(math.wifiSummary([hotspot(301)], center).count, 0);
});

test('toilet distance uses 0.7 m steps at 100 steps per minute with separate ceiling', () => {
  assert.deepEqual(math.toiletEstimate(0), { steps: 0, seconds: 0 });
  assert.deepEqual(math.toiletEstimate(70), { steps: 100, seconds: 60 });
  assert.deepEqual(math.toiletEstimate(1), { steps: 2, seconds: 1 });
  assert.deepEqual(math.toiletEstimate(210), { steps: 300, seconds: 180 });
  for (const invalid of [-1, NaN, Infinity, '70', null]) assert.throws(() => math.toiletEstimate(invalid));
});

test('battery estimates enforce the 20 percent threshold, charging state, and reserve floor', () => {
  assert.deepEqual(math.batteryBudget(20), { active: false, seconds: 0, radiusM: 0 });
  const nineteen = math.batteryBudget(19);
  assert.equal(nineteen.active, true);
  assert.ok(Math.abs(nineteen.seconds - 2520) < 1e-10);
  assert.ok(Math.abs(nineteen.radiusM - 2800) < 1e-10);
  assert.deepEqual(math.batteryBudget(8), { active: true, seconds: 540, radiusM: 600 });
  assert.deepEqual(math.batteryBudget(5), { active: true, seconds: 0, radiusM: 0 });
  assert.deepEqual(math.batteryBudget(0), { active: true, seconds: 0, radiusM: 0 });
  assert.deepEqual(math.batteryBudget(19, { charging: true }), { active: false, seconds: 0, radiusM: 0 });
  assert.equal(math.batteryBudget(15, { drainPerHour: 10, speedKmh: 3 }).radiusM, 3000);
});

test('address matching requires a district and rejects explicit other cities or ambiguous districts', () => {
  assert.equal(math.districtFromAddress('106臺北市大安區信義路'), '大安區');
  assert.equal(math.districtFromAddress('台北市中正區'), '中正區');
  assert.equal(math.districtFromAddress('文山區'), '文山區');
  for (const address of [null, undefined, '', '臺北市', '臺北市中山北路',
    '基隆市中正區', '臺中市大安區', '新北市中山區', '臺北縣中正區',
    '新北市某地址（鄰近臺北市中山區）', '中正區與大安區交界']) {
    assert.equal(math.districtFromAddress(address), null, String(address));
  }
});

test('zero-interest mortgage is simple principal division; positive-rate payments amortize the principal', () => {
  const zeroInterest = math.mortgage(3600000, { ltv: 1, annualRate: 0 });
  assert.equal(zeroInterest.monthly, 10000);
  assert.equal(zeroInterest.perSecond, 10000 / 2592000);
  const result = math.mortgage(52500000);
  assert.ok(Math.abs(result.monthly - 165950.78) < 0.005);
  assert.ok(Math.abs(result.perSecond - 0.06402421971583408) < 1e-12);
  // Independently pay down the debt month by month instead of repeating the formula.
  let remaining = 42000000;
  for (let month = 0; month < 360; month += 1) remaining = remaining * (1 + 0.025 / 12) - result.monthly;
  assert.ok(Math.abs(remaining) < 0.001);
  assert.deepEqual(math.mortgage(0), { monthly: 0, perSecond: 0 });
  assert.deepEqual(math.mortgage(52500000, { ltv: 0 }), { monthly: 0, perSecond: 0 });
});

test('public numeric boundaries fail clearly instead of displaying NaN or infinite estimates', () => {
  for (const call of [
    () => math.wifiSummary(null, center), () => math.wifiSummary([], { lat: null, lng: 0 }),
    () => math.wifiSummary([], center, { radiusM: 0 }), () => math.wifiSummary([], center, { signalM: -1 }),
    () => math.batteryBudget(101), () => math.batteryBudget(-1), () => math.batteryBudget('19'),
    () => math.batteryBudget(19, { reservePercent: -1 }), () => math.batteryBudget(19, { drainPerHour: 0 }),
    () => math.batteryBudget(19, { speedKmh: -1 }), () => math.batteryBudget(19, { charging: 1 }),
    () => math.mortgage(-1), () => math.mortgage(1, { ltv: 1.1 }),
    () => math.mortgage(1, { annualRate: -1 }), () => math.mortgage(1, { years: 0 }),
    () => math.mortgage(1, { years: 0.01 }), () => math.mortgage(1, { daysPerMonth: 0 }),
  ]) assert.throws(call, { name: /TypeError|RangeError/ });
});

test('all published prices, sample counts and winning row IDs are independently traced to the raw official CSV', (t) => {
  const csvPath = path.join(prototypeRoot, 'data/taipei-price-20261107/a_lvr_land_a.csv');
  assert.equal(createHash('sha256').update(readFileSync(csvPath)).digest('hex'), prices.source.csvSha256);
  const parsed = spawnSync('python3', ['-c',
    'import csv,json,sys\nwith open(sys.argv[1],encoding="utf-8-sig",newline="") as f:\n r=csv.DictReader(f)\n next(r)\n rows=[]\n for row in r:\n  row["csvRow"]=r.line_num\n  rows.append(row)\nprint(json.dumps(rows))', csvPath],
  { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
  assert.equal(parsed.status, 0, parsed.stderr);
  const raw = JSON.parse(parsed.stdout);
  assert.equal(raw.length, 476);
  const eligible = raw.filter((row) => row['主要用途'] === '住家用'
    && row['交易標的'] === '房地(土地+建物)' && row['備註'].trim() === ''
    && Number(row['交易年月日']) >= 1150101 && Number(row['交易年月日']) <= 1151031
    && /建物1車位0$/.test(row['交易筆棟數'])
    && row['車位移轉總面積平方公尺'].trim() !== '' && Number(row['車位移轉總面積平方公尺']) === 0
    && row['車位總價元'].trim() !== '' && Number(row['車位總價元']) === 0
    && Number(row['總價元']) > 0 && Number(row['建物移轉總面積平方公尺']) > 0);
  assert.equal(eligible.length, 44);
  assert.equal(prices.source.recordCount, raw.length);
  assert.equal(prices.source.sampleCount, eligible.length);
  assert.equal(prices.districts.length, 12);
  for (const district of prices.districts) {
    const rows = eligible.filter((row) => row['鄉鎮市區'] === district.district);
    assert.equal(district.sampleCount, rows.length, district.district);
    assert.equal(district.maxTotalPrice, Math.max(...rows.map((row) => Number(row['總價元']))), district.district);
    const winner = raw.find((row) => row.csvRow === district.sourceCsvRow);
    assert.equal(winner['編號'], district.recordId);
    assert.equal(winner['鄉鎮市區'], district.district);
    assert.equal(Number(winner['總價元']), district.maxTotalPrice);
    assert.ok(rows.includes(winner));
  }
  assert.equal(prices.districts.find((row) => row.district === '大安區').maxTotalPrice, 52500000);
  t.diagnostic(`實測來源 ${raw.length} 筆，符合 ${eligible.length} 筆，${prices.districts.length} 區最高值與原始列全部一致`);
});

test('the offline builder reproducibly generates the browser price dataset', () => {
  const result = spawnSync('python3', [path.join(prototypeRoot, 'build-taipei-price-sample.py'), '--check'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
