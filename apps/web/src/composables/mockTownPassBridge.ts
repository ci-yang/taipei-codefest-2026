/**
 * mockTownPassBridge — 在一般瀏覽器裡模擬 TownPass 的 flutterObject，給 demo 備援與本機開發用。
 * 只在 URL 帶 ?mockBridge=1 或 VITE_MOCK_BRIDGE=1 時安裝；真的在 TownPass 殼內（flutterObject 已存在）時不覆蓋。
 * 回覆格式照官方 TPWebStringMessageReply：event.data = JSON 字串 {"name","data"}。
 * 使用者資料全部是假資料。
 */
type Listener = (event: { data: unknown }) => void;

const MOCK_USER = {
  id: '00000000-0000-0000-0000-000000000000',
  account: 'demo',
  username: 'Demo',
  realName: '測試市民',
  idNo: 'A000000000',
  email: 'demo@example.com',
  phoneNo: '0900000000',
  birthday: '1990/01/01',
  memberType: 'personal',
  verifyLevel: '1',
  addresses: [
    { zip3: 110, city: '臺北市', town: '信義區', village: '', street: '市府路', usageType: '0', seq: 1, priority: true },
  ],
  residentAddress: '臺北市信義區市府路1號',
  citizen: true,
  nativePeople: false,
  cityInternetUid: '',
};

// 臺北市政府附近
const MOCK_POSITION = { latitude: 25.0375, longitude: 121.5637, timestamp: 0, accuracy: 10, floor: null, is_mocked: true };

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
          return reply(name, MOCK_USER);
        case 'location':
          return reply(name, { ...MOCK_POSITION, timestamp: Date.now() });
        case 'deviceinfo':
          return reply(name, { systemName: 'MockOS', isPhysicalDevice: false, model: 'Browser' });
        case 'launch_map':
          if (typeof data === 'string') window.open(data, '_blank');
          return reply(name, typeof data === 'string');
        case 'phone_call':
          return reply(name, typeof data === 'string');
        case 'notify': {
          const d = data as { title?: string; content?: string } | null;
          if (!d || typeof d !== 'object') return reply(name, false);
          console.info(`[mockBridge] 通知：${d.title} / ${d.content}`);
          return; // 官方 App 成功時不回覆
        }
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
