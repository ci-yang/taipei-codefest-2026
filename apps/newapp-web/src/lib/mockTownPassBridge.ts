/**
 * 在一般瀏覽器裡模擬台北通 flutterObject（demo 備援與本機開發；做法同 apps/web/src/composables/mockTownPassBridge.ts、
 * docs/townpass-integration.md 3.4）。只在網址帶 ?mockBridge=1 或 VITE_MOCK_BRIDGE=1 時安裝；
 * 真的在台北通殼內（flutterObject 已存在）不覆蓋。回覆格式照官方：event.data = JSON 字串 {"name","data"}。
 * 帳號是假資料，對齊開源殼固定假帳號的生日與地址格式（birthday YYYY/MM/DD、addresses[0].city）。
 */
type Listener = (event: { data: unknown }) => void;

const MOCK_USER = {
  id: '00000000-0000-0000-0000-000000000000',
  account: 'demo',
  realName: '測試市民',
  idNo: 'A000000000',
  birthday: '1990/01/01',
  addresses: [{ zip3: 110, city: '臺北市', town: '信義區', village: '', street: '市府路', usageType: '0', seq: 1, priority: true }],
};

export function installMockTownPassBridge(force = false): boolean {
  if (typeof window === 'undefined') return false;
  const enabled =
    force ||
    new URLSearchParams(window.location.search).get('mockBridge') === '1' ||
    import.meta.env?.VITE_MOCK_BRIDGE === '1';
  if (!enabled || window.flutterObject) return false;

  const listeners = new Set<Listener>();
  const reply = (name: string, data: unknown) =>
    setTimeout(() => listeners.forEach((l) => l({ data: JSON.stringify({ name, data }) })), 150);

  window.flutterObject = {
    postMessage(raw: string) {
      const { name, data } = JSON.parse(raw) as { name: string; data: unknown };
      console.info('[mockBridge] ←', name, data);
      switch (name) {
        case 'userinfo':
          return void reply(name, MOCK_USER);
        case 'phone_call':
          return void reply(name, typeof data === 'string' && data.length > 0);
        case 'open_link':
          if (typeof data === 'string') window.open(data, '_blank', 'noopener');
          return; // 官方 App 成功時不回覆
        default:
          console.warn('[mockBridge] 未模擬的 handler：', name);
      }
    },
    addEventListener: (_type: 'message', l: Listener) => void listeners.add(l),
    removeEventListener: (_type: 'message', l: Listener) => void listeners.delete(l),
  };
  console.info('[mockBridge] 已安裝模擬 flutterObject');
  return true;
}
