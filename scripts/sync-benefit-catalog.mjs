import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATASET_ID = '73c24d1c-e1f0-44ce-8a31-cf835ef37e74';
const SOURCE_URL = `https://data.ntpc.gov.tw/api/datasets/${DATASET_ID}/json?page=0&size=1000`;
const CATALOG_URL = `https://data.ntpc.gov.tw/datasets/${DATASET_ID}`;
const WELFARE_URL = 'https://welfare.ntpc.gov.tw/viewService/list6';

const response = await fetch(SOURCE_URL);
if (!response.ok) throw new Error(`新北市資料開放平臺回應 ${response.status}`);
const rows = await response.json();
if (!Array.isArray(rows)) throw new Error('新北市福利補助資料格式不符：預期為陣列');

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function dateValue(value) {
  if (typeof value !== 'string') return '';
  try {
    const parsed = JSON.parse(value);
    return text(parsed?.date);
  } catch {
    return value.trim();
  }
}

const programs = rows
  .map((item) => {
    const id = String(item.id ?? '').trim();
    return {
      id,
      name: text(item.name),
      summary: text(item.service_desc),
      contacts: text(item.cont1),
      requiredDocuments: text(item.cont2),
      applicationMethods: text(item.cont3),
      deliveryMethod: text(item.cont4),
      processingTime: text(item.cont5),
      notes: text(item.cont6),
      benefitContent: text(item.cont7),
      officialUrl: `https://welfare.ntpc.gov.tw/viewService/show/${encodeURIComponent(id)}?actionName=list6&fromOpa=1`,
      formUrl: text(item.curl),
      lastUpdated: dateValue(item.last_updated),
      dateCreated: dateValue(item.date_created),
    };
  })
  .filter((item) => item.id && item.name)
  .sort((left, right) => left.name.localeCompare(right.name, 'zh-Hant'));

if (programs.length < 140) throw new Error(`來源筆數異常：${programs.length}`);
const duplicateIds = programs.filter((item, index) => programs.findIndex((candidate) => candidate.id === item.id) !== index);
if (duplicateIds.length) throw new Error(`福利 ID 重複：${duplicateIds.map((item) => item.id).join(', ')}`);

const snapshot = {
  source: {
    name: '新北市政府福利補助資訊',
    provider: '新北市政府研究發展考核委員會',
    endpoint: SOURCE_URL,
    catalogUrl: CATALOG_URL,
    welfareUrl: WELFARE_URL,
    fetchedAt: new Date().toISOString(),
    totalServiceCount: programs.length,
    candidateCount: programs.length,
    updateFrequency: '每日',
    license: '政府資料開放授權條款第 1 版',
    note: '完整收錄官方開放資料，不以關鍵字刪除；畫面只依使用者已填身分做保守排序與排除。',
  },
  programs,
};

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(repoRoot, 'apps/web/src/data/benefit-catalog.json');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
console.log(`Wrote ${programs.length} New Taipei welfare programs to ${output}`);
