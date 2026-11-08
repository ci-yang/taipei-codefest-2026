/**
 * 原創 3D 卡通插畫（SVG 字串，spec 7.10、ADR-018，sa-3-s2.md W10）。
 * 逐字取自 .plan/.1108/sprint/prototype/index.html 的 ILLUS／TONE（使用者定案原型），不重畫。
 * 鍵：補助序號 1～10、101～103（補助通改版拿掉開始頁「我的資料」5 張卡插畫，ADR-023）。
 * 官方網頁整理 201～215 不另畫，借用主題相近的既有插畫（ART_ALIAS，ADR-035）。
 * 漸層 #g-* 由 components/IllusDefs.vue 在 App 裡定義一次；不載入任何外部圖片。
 */
const G = (c: string): string => `url(#g-${c})`;
const HI = (x: number, y: number, rx: number, ry: number, r = 0): string => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${r} ${x} ${y})" fill="url(#g-hi)"/>`;
const SH = (x: number, y: number, rx: number): string => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${(rx * 0.15).toFixed(1)}" fill="url(#g-sh)"/>`;
const coin = (x: number, y: number): string => `<path d="M${x - 17} ${y}v6a17 6.5 0 0 0 34 0v-6z" fill="#AD7B2B"/><ellipse cx="${x}" cy="${y}" rx="17" ry="6.5" fill="${G('gold')}"/><ellipse cx="${x}" cy="${y}" rx="10" ry="3.6" fill="none" stroke="#E7A43C" stroke-width="1.6"/>`;
const coins = (x: number, y: number, n: number): string => Array.from({ length: n }, (_, i) => coin(x, y - i * 7)).join('');
const house = (x: number, y: number, s: number, roof: string, edge: string): string => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="16" y="-86" width="11" height="22" rx="3" fill="${G(roof)}"/><rect x="-34" y="-56" width="68" height="56" rx="10" fill="${G('cream')}"/><path d="M-43 -51L0 -86L43 -51" fill="${G(roof)}" stroke="${edge}" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/><rect x="-10" y="-31" width="20" height="31" rx="9" fill="${G('char')}"/><circle cx="5" cy="-15" r="2" fill="#F5BA4B"/><rect x="-28" y="-46" width="13" height="13" rx="4" fill="${G('sky')}"/><rect x="15" y="-46" width="13" height="13" rx="4" fill="${G('sky')}"/>${HI(-16, -66, 12, 4, -38)}${HI(-20, -24, 6, 12)}</g>`;
const cube = (x: number, y: number, s: number, t: string, l: string, r: string): string => `<g transform="translate(${x} ${y})" stroke-linejoin="round" stroke-width="5"><path d="M0 ${-s}L${s * .87} ${-s / 2}L0 0L${-s * .87} ${-s / 2}Z" fill="${t}" stroke="${t}"/><path d="M${-s * .87} ${-s / 2}L0 0L0 ${s}L${-s * .87} ${s / 2}Z" fill="${l}" stroke="${l}"/><path d="M${s * .87} ${-s / 2}L0 0L0 ${s}L${s * .87} ${s / 2}Z" fill="${r}" stroke="${r}"/><ellipse cx="${-s * .3}" cy="${-s * .62}" rx="${s * .3}" ry="${s * .1}" fill="#fff" opacity=".55"/></g>`;
const ILLUS: Record<string, string> = {
  1: `${SH(100, 130, 72)}${house(86, 128, 1.05, 'orange', '#E6692C')}${coins(150, 122, 3)}${coin(160, 104)}`,
  2: `${SH(100, 130, 62)}<rect x="50" y="100" width="100" height="24" rx="7" fill="${G('orange')}"/><rect x="58" y="104" width="88" height="14" rx="4" fill="#fff6ec"/><rect x="58" y="80" width="88" height="22" rx="7" fill="${G('sky')}"/><rect x="64" y="84" width="78" height="12" rx="4" fill="#fff6ec"/><path d="M74 66v14q26 14 52 0v-14z" fill="${G('char')}"/><path d="M100 36L152 56L100 76L48 56Z" fill="${G('char')}" stroke="#171B1D" stroke-width="4" stroke-linejoin="round"/>${HI(86, 52, 18, 4, -20)}<path d="M100 56Q134 60 142 63V86" fill="none" stroke="#F5BA4B" stroke-width="3.5" stroke-linecap="round"/><circle cx="142" cy="90" r="6" fill="${G('gold')}"/><circle cx="100" cy="56" r="4.5" fill="${G('gold')}"/>`,
  3: `${SH(100, 132, 72)}<rect x="34" y="36" width="132" height="82" rx="22" fill="${G('orange')}"/><rect x="44" y="48" width="112" height="32" rx="10" fill="${G('sky')}"/><path d="M82 48v32M118 48v32" stroke="#E6692C" stroke-width="4"/>${HI(62, 56, 14, 4, -12)}${HI(98, 56, 12, 3, -12)}<rect x="34" y="88" width="132" height="8" fill="#fff6ec" opacity=".9"/><circle cx="156" cy="106" r="5.5" fill="${G('gold')}"/><circle cx="44" cy="106" r="4.5" fill="#ffe3d6"/>${HI(70, 42, 30, 4)}<circle cx="70" cy="118" r="15" fill="${G('char')}"/><circle cx="70" cy="118" r="5.5" fill="${G('cream')}"/><circle cx="130" cy="118" r="15" fill="${G('char')}"/><circle cx="130" cy="118" r="5.5" fill="${G('cream')}"/>`,
  4: `${SH(100, 130, 74)}${house(92, 128, 1.15, 'mint', '#5AB4C5')}<rect x="155" y="98" width="7" height="30" rx="3" fill="#9a6a3c"/><circle cx="158" cy="90" r="20" fill="${G('green')}"/>${HI(151, 82, 8, 5, -30)}`,
  5: `${SH(104, 132, 62)}<circle cx="90" cy="100" r="28" fill="none" stroke="${G('char')}" stroke-width="9"/><path d="M90 74v52M64 100h52M72 82l36 36M108 82l-36 36" stroke="#738995" stroke-width="2.2"/><circle cx="90" cy="100" r="7" fill="${G('cream')}"/><path d="M92 100H134L148 120" fill="none" stroke="#30383D" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="148" cy="122" r="9" fill="${G('char')}"/><rect x="84" y="76" width="54" height="15" rx="7.5" fill="${G('mint')}"/><rect x="78" y="34" width="15" height="52" rx="7.5" fill="${G('mint')}"/><rect x="96" y="62" width="36" height="7" rx="3.5" fill="${G('char')}"/><path d="M84 37q-3 -9 -15 -9" fill="none" stroke="#30383D" stroke-width="5" stroke-linecap="round"/>${HI(83, 48, 3, 10)}${HI(104, 80, 14, 3)}`,
  6: `${SH(100, 132, 70)}<path d="M146 128V62q0-24-22-24q-16 0-16 16" fill="none" stroke="${G('orange')}" stroke-width="11" stroke-linecap="round"/>${HI(143, 76, 2.5, 16)}<ellipse cx="80" cy="126" rx="42" ry="8" fill="${G('cream')}"/><path d="M110 92q18 0 18 13q0 13-20 13" fill="none" stroke="#93D4DF" stroke-width="7" stroke-linecap="round"/><path d="M50 84h60v8q0 32-30 32q-30 0-30-32z" fill="${G('mint')}"/><ellipse cx="80" cy="84" rx="30" ry="6.5" fill="#b8743f"/><ellipse cx="80" cy="84" rx="30" ry="6.5" fill="none" stroke="#EDF8FA" stroke-width="2"/>${HI(62, 100, 5, 12)}<path d="M72 70q-7-8 0-16q7-8 0-16M90 70q-7-8 0-16q7-8 0-16" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="4" stroke-linecap="round"/>`,
  7: `${SH(104, 132, 64)}<path d="M80 44q0-28 12-28q12 0 12 28z" fill="${G('gold')}"/><rect x="66" y="40" width="52" height="16" rx="6" fill="${G('mint')}"/><rect x="70" y="54" width="44" height="72" rx="16" fill="${G('cream')}"/><rect x="74" y="80" width="36" height="42" rx="12" fill="#fffdf8"/><path d="M98 66h10M98 78h10M98 90h10" stroke="#c9bba7" stroke-width="2.5" stroke-linecap="round"/>${HI(80, 76, 4, 16)}<circle cx="146" cy="110" r="20" fill="${G('red')}"/><path d="M146 92v-10" stroke="#7a4a20" stroke-width="4" stroke-linecap="round"/><ellipse cx="156" cy="86" rx="10" ry="5" transform="rotate(-25 156 86)" fill="${G('green')}"/>${HI(139, 103, 6, 4, -35)}`,
  8: `${SH(100, 134, 66)}<path d="M150 76L170 48" stroke="#30383D" stroke-width="6" stroke-linecap="round"/><circle cx="170" cy="48" r="6" fill="${G('char')}"/><path d="M76 112l-6 12M124 112l6 12" stroke="#30383D" stroke-width="5" stroke-linecap="round"/><path d="M46 74H154Q154 118 100 118Q46 118 46 74Z" fill="${G('mint')}"/><path d="M50 74A48 48 0 0 1 100 26V74Z" fill="${G('orange')}"/>${HI(70, 46, 12, 5, -45)}${HI(80, 88, 24, 5)}<circle cx="70" cy="124" r="12" fill="${G('char')}"/><circle cx="70" cy="124" r="4.5" fill="${G('cream')}"/><circle cx="130" cy="124" r="12" fill="${G('char')}"/><circle cx="130" cy="124" r="4.5" fill="${G('cream')}"/>`,
  9: `${SH(100, 132, 66)}<path d="M80 52v-10q0-8 8-8h24q8 0 8 8v10" fill="none" stroke="${G('char')}" stroke-width="7"/><rect x="44" y="50" width="112" height="78" rx="18" fill="${G('cream')}"/><rect x="44" y="64" width="112" height="6" fill="#e8dccb"/><rect x="90" y="72" width="20" height="46" rx="5" fill="${G('red')}"/><rect x="77" y="85" width="46" height="20" rx="5" fill="${G('red')}"/>${HI(70, 58, 20, 4)}<g transform="translate(160 116) rotate(-30)"><rect x="-15" y="-7" width="30" height="14" rx="7" fill="${G('cream')}"/><path d="M0 -7h-8a7 7 0 0 0 0 14h8z" fill="${G('orange')}"/></g>`,
  10: `${SH(100, 134, 58)}<circle cx="100" cy="82" r="35" fill="none" stroke="${G('red')}" stroke-width="22"/><circle cx="100" cy="82" r="35" fill="none" stroke="#fff6ec" stroke-width="22" stroke-dasharray="27.5 27.5" stroke-dashoffset="14"/><circle cx="100" cy="82" r="35" fill="none" stroke="#e7d4b8" stroke-width="2" stroke-dasharray="6 5"/><circle cx="100" cy="82" r="24" fill="none" stroke="#000" stroke-opacity=".12" stroke-width="3"/>${HI(82, 56, 16, 5, -30)}${HI(124, 104, 6, 3, -30)}`,
  101: `${SH(100, 134, 66)}${cube(76, 106, 22, '#F4B992', '#FD853A', '#E6692C')}${cube(124, 106, 22, '#EDF8FA', '#93D4DF', '#5AB4C5')}${cube(100, 62, 22, '#F4D69E', '#F5BA4B', '#E7A43C')}`,
  102: `${SH(104, 132, 66)}<rect x="86" y="80" width="80" height="14" rx="7" fill="${G('gold')}"/><rect x="138" y="90" width="10" height="18" rx="3" fill="${G('gold')}"/><rect x="153" y="90" width="10" height="24" rx="3" fill="${G('gold')}"/><circle cx="66" cy="86" r="29" fill="${G('gold')}"/><circle cx="58" cy="80" r="8.5" fill="#AD7B2B"/>${HI(56, 70, 10, 5, -35)}${HI(116, 83, 22, 2.5)}<path d="M58 80m-8 0a8 8 0 0 1 16 0" fill="none" stroke="#30383D" stroke-width="0"/><rect x="34" y="104" width="30" height="22" rx="7" transform="rotate(-14 49 115)" fill="${G('mint')}"/>`,
  103: `${SH(100, 134, 54)}<rect x="93" y="28" width="14" height="12" rx="5" fill="${G('mint')}"/><circle cx="100" cy="82" r="46" fill="${G('mint')}"/><circle cx="100" cy="82" r="36" fill="${G('cream')}"/><path d="M100 50v6M100 108v6M68 82h6M126 82h6" stroke="#9a8f80" stroke-width="3" stroke-linecap="round"/><path d="M100 54L111 82H89Z" fill="${G('orange')}"/><path d="M89 82H111L100 110Z" fill="${G('char')}"/><circle cx="100" cy="82" r="5" fill="${G('gold')}"/>${HI(80, 56, 16, 6, -35)}`,
};

/** 官方網頁整理借用的插畫：租屋→房子（4）、生育→嬰兒車（8）、育兒托育→積木（101）、失業→羅盤（103）、
 * 特殊境遇→房子與錢幣（1）、輔具→輪椅（5）、健保與兒童醫療→醫藥箱（9）、孕婦乘車→車子（3）、照顧長者→茶杯（6） */
export const ART_ALIAS: Record<number, number> = {
  201: 4, 202: 4, 203: 4, 204: 4, 205: 4,
  206: 8, 207: 101, 208: 101, 209: 103, 210: 1,
  211: 5, 212: 9, 213: 9, 214: 3, 215: 6,
};

function artKey(key: number | string): string {
  const alias = ART_ALIAS[Number(key)];
  return String(alias ?? key);
}

/** 插畫底色（依補助序號）；2026-11-08 改淺色台北通主題，取 tp_colors.dart 的 primary／secondary／orange／red 淺階 */
export const TONE: Record<number, string> = { 1: '#fbe7d9', 2: '#fdf8ed', 3: '#edf8fa', 4: '#dbf1f5', 5: '#fdf8ed', 6: '#fcf2df', 7: '#faeeee', 8: '#fbe7d9', 9: '#edf8fa', 10: '#fcf2df', 101: '#faeeee', 102: '#fcf2df', 103: '#dbf1f5' };

const FALLBACK_TONE = '#dbf1f5';

export function toneOf(no: number): string {
  return TONE[no] ?? TONE[ART_ALIAS[no] ?? -1] ?? FALLBACK_TONE;
}

/** 有沒有這張插畫（28 項補助都要有，測試用） */
export function hasArt(key: number | string): boolean {
  return Object.prototype.hasOwnProperty.call(ILLUS, artKey(key));
}

/** 回整張 <svg> 字串（輪播大卡、清單列、彈窗共用） */
export function art(key: number | string): string {
  return `<svg viewBox="0 0 200 150" aria-hidden="true" focusable="false">${ILLUS[artKey(key)] ?? ''}</svg>`;
}
