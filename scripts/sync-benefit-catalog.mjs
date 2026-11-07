import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_URL = 'https://service.taipei/TGC_TPOB_API/api/Search/Search';
const CATALOG_URL = 'https://service.taipei/search-item';
const TERMS = ['補助', '津貼', '減免', '扶助', '救助', '獎勵金', '慰問金'];

// 排除辦理補助的機關／團體、核銷請款與後續程序；保留可能由個人、家庭、住戶、勞工或學生提出的案件。
// 這是產品候選篩選，不是官方資格分類；畫面必須標示需回官方頁面確認。
const EXCLUDED_NAME =
  /(核銷|補助案變更|補助計畫變更|撥款請領|補助請款|查驗申請|初審|複審|第二階段|第一階段|延續案|重新核費|溢領款|方式變更|竣工審查|民間團體|團體辦理|學校申請|補助民間|機構及團體|幼兒園辦理|國中小學|公、私立國中小|社區發展協會|合作社及事業體|商圈|市\(商\)場|市場|攤販|地下街|觀光活動|藝文補助|文化資產補助|電影|公共藝術|體育活動經費|基層競技|環境教育基金|社區園圃|都市田園|農業振興|工商團體|創新創意創業平臺|花博農民市集|產業發展創新|產業活動|服務業汰換|道路路燈旗幟|舉辦國際|民營路外公共停車場|自行車停放架|設置太陽光電|檢驗人員健康檢查|住宅社區創能|初設戶籍登記|數位卡證|陽明教養院入院|社會救助專戶|工務建設科學研究|優異客家藝文團體|客家歌謠班)/;

const response = await fetch(SOURCE_URL, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ condition: {} }),
});
if (!response.ok) throw new Error(`台北服務通回應 ${response.status}`);
const payload = await response.json();
const all = payload?.data?.grid;
if (!Array.isArray(all)) throw new Error('台北服務通格式不符：找不到 data.grid');

const keywordMatches = all.filter((item) => {
  const text = [item.caseSetName, item.remark, ...(Array.isArray(item.tags) ? item.tags : [])]
    .filter(Boolean)
    .join(' ');
  return TERMS.some((term) => text.includes(term));
});

const programs = keywordMatches
  .filter((item) => typeof item.caseSetName === 'string' && !EXCLUDED_NAME.test(item.caseSetName))
  .map((item) => ({
    id: String(item.caseSetId),
    name: String(item.caseSetName).trim(),
    summary: String(item.remark ?? '').trim(),
    tags: Array.isArray(item.tags) ? item.tags.map(String).filter(Boolean) : [],
    online: Boolean(item.online),
    counter: Boolean(item.counter),
    applicationMethods: String(item.title ?? '').trim(),
    officialUrl: `https://service.taipei/case-detail/${encodeURIComponent(String(item.caseSetId))}`,
  }))
  .sort((left, right) => left.id.localeCompare(right.id, 'en'));

if (all.length < 1_000 || keywordMatches.length < 150 || programs.length < 100) {
  throw new Error(`來源筆數異常：all=${all.length}, keyword=${keywordMatches.length}, candidates=${programs.length}`);
}
const duplicateIds = programs.filter((item, index) => programs.findIndex((candidate) => candidate.id === item.id) !== index);
if (duplicateIds.length) throw new Error(`候選案件 ID 重複：${duplicateIds.map((item) => item.id).join(', ')}`);

const snapshot = {
  source: {
    name: '台北服務通申辦服務目錄',
    provider: '臺北市政府',
    endpoint: SOURCE_URL,
    catalogUrl: CATALOG_URL,
    fetchedAt: new Date().toISOString(),
    filterVersion: 1,
    terms: TERMS,
    totalServiceCount: all.length,
    keywordMatchCount: keywordMatches.length,
    candidateCount: programs.length,
    note: '候選數是本專案依名稱、摘要與標籤篩選所得，不是官方公布的補助總數或資格分類。',
  },
  programs,
};

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(repoRoot, 'apps/web/src/data/benefit-catalog.json');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
console.log(
  `Wrote ${programs.length} candidates from ${keywordMatches.length} keyword matches (${all.length} total services) to ${output}`,
);
