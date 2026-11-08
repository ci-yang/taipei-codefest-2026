/* 城市生存雷達：公開點位、明示試算；位置與計時僅存於當次記憶體。 */
(() => {
  'use strict';
  const MODES = { wifi: ['wifi', 'Wi-Fi', '找一片訊號綠洲'], toilet: ['toilet', '倒數', '離下一間廁所，還有幾步？'], gold: ['store', '含金量', '這一刻，值多少城市含金量？'], battery: ['charge', '生存圈', '把剩下的電，留給下一站'] };
  const token = name => window.getComputedStyle?.(document.documentElement).getPropertyValue(name).trim() || '';
  const DEMO = Object.freeze({ lat: 25.0375, lng: 121.5637 });
  const valid = point => point && Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
  const meters = value => value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${Math.round(value)} m`;
  const timeLabel = value => `${Math.floor(Math.max(0, Math.ceil(value)) / 60).toString().padStart(2, '0')}:${(Math.max(0, Math.ceil(value)) % 60).toString().padStart(2, '0')}`;
  const money = (value, digits = 0) => Number(value).toLocaleString('zh-TW', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const safeUrl = value => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; } };

  function create({ map, stores, icon, escapeHtml: esc, distance, t, guideHost: guideHostOption, onSelectResource, onShowDetails, onRequestPosition, onUseDemoPosition, onOpenExplore }) {
    const host = document.querySelector('#highlight-host');
    const launch = document.querySelector('#highlight-launch');
    const guideHost = guideHostOption || document.querySelector('#guide-timer');
    if (!host || !window.FriendlyHighlightMath) return { update() {}, open() {}, close() {}, openToilet() {}, pauseGuide() {}, handleResource() { return false; }, destroy() {} };
    const math = window.FriendlyHighlightMath;
    const byId = new Map(stores.map(store => [String(store.id), store]));
    const toilets = stores.filter(store => valid(store) && store.services.includes('toilet'));
    const chargers = stores.filter(store => valid(store) && store.services.includes('charge'));
    const seenWifi = new Set();
    const wifiPoints = stores.filter(store => {
      if (!valid(store) || !store.services.includes('wifi')) return false;
      const key = `${store.lat.toFixed(5)},${store.lng.toFixed(5)}`;
      if (seenWifi.has(key)) return false;
      seenWifi.add(key); return true;
    });
    let snapshot = { view: 'home', urgency: null, position: null, gpsPending: false };
    let mode = null; let selected = null; let routeClient; let routeGeneration = 0; let routeKey = ''; let destroyed = false;
    let toiletRoute = null; let toiletStatus = 'idle'; let toiletError = ''; let wifiSummary = null; let injectedRoute = false; let lastGuideKey = ''; let lastGuideHtml = '';
    let timer = { status: 'idle', total: 0, remaining: 0, deadline: 0, speed: 1 };
    let gold = { running: false, elapsed: 0, startedAt: 0 };
    let battery = null; let batteryState = 'checking'; let manualBattery = false; let manualPercent = 18; let drain = 20; let deviceWasLow = false;
    let budget = null; let candidateChargers = []; let lastPositionKey = ''; let lastBatteryKey = '';
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!map.getPane('highlight-vectors')) { map.createPane('highlight-vectors'); map.getPane('highlight-vectors').style.zIndex = '410'; map.getPane('highlight-vectors').style.pointerEvents = 'none'; }
    if (!map.getPane('highlight-mask')) { map.createPane('highlight-mask'); map.getPane('highlight-mask').style.zIndex = '450'; map.getPane('highlight-mask').style.pointerEvents = 'none'; }
    const renderer = L.canvas({ padding: 0.3, pane: 'highlight-vectors' });
    const maskRenderer = L.canvas({ padding: 0.3, pane: 'highlight-mask' });
    const circles = L.layerGroup().addTo(map);
    const pulses = L.layerGroup().addTo(map);
    const routeLayer = L.layerGroup().addTo(map);
    const batteryLayer = L.layerGroup().addTo(map);
    // guide 專用：充電導引的生存圈；clearLayers() 不碰它，只依 view／urgency 清除。
    const guideLayer = L.layerGroup().addTo(map);
    const active = () => Boolean(mode && snapshot.view === 'map');
    const guiding = urgency => snapshot.view === 'guide' && snapshot.urgency === urgency && Boolean(snapshot.selectedStore);
    const isDemo = () => snapshot.position?.source === 'demo';
    const currentPercent = () => manualBattery ? manualPercent : battery ? Number((battery.level * 100).toFixed(6)) : null;
    const currentCharging = () => !manualBattery && Boolean(battery?.charging);
    const positionKey = () => valid(snapshot.position) ? `${snapshot.position.lat},${snapshot.position.lng}:${snapshot.position.source || 'gps'}` : '';
    const nearby = list => list.slice().sort((a, b) => distance(snapshot.position || map.getCenter(), a) - distance(snapshot.position || map.getCenter(), b)).slice(0, 5);
    const button = (action, label, options = '') => `<button type="button" class="hl-button" data-hl-action="${action}" ${options}>${label}</button>`;
    const primary = (action, label, options = '') => `<button type="button" class="hl-button hl-primary" data-hl-action="${action}" ${options}>${label}</button>`;
    const sourceLink = (url, label) => safeUrl(url) ? `<a href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>` : esc(label);

    function locationTools() {
      return `<div class="hl-location"><span class="hl-location-label ${isDemo() ? 'hl-demo' : ''}">${icon('location', 15)}${snapshot.gpsPending ? '正在取得 GPS…' : isDemo() ? '展示位置 · 臺北市政府' : snapshot.position ? '使用本次 GPS 位置' : '尚未定位 · 非您的位置'}</span><div class="hl-small-actions">${button('gps', isDemo() ? '改用 GPS' : '定位', snapshot.gpsPending ? 'disabled' : '')}${button('demo', '市府試玩')}</div></div>`;
    }
    function resourceRows(list, service, action = 'select') {
      return list.map(store => `<button type="button" class="hl-resource-row ${selected?.id === store.id ? 'is-selected' : ''}" data-hl-action="${action}" data-hl-resource="${esc(store.id)}"><span class="hl-resource-icon">${icon(service, 20)}</span><span class="hl-resource-copy"><strong>${esc(store.name)}</strong><small>${esc(store.address || '地址待補')}</small></span><span class="hl-resource-distance">${meters(distance(snapshot.position || map.getCenter(), store))}${icon('chevron', 14)}</span></button>`).join('');
    }
    function targetHtml() {
      return selected ? `<div class="hl-target"><span class="hl-eyebrow">已選廁所</span><strong>${esc(selected.name)}</strong><span>${esc(selected.address || '地址待補')}</span><small>${sourceLink(selected.sourceUrl, selected.sourceName || '公開資源名冊')}</small></div>` : `<p class="hl-instruction">先選一間廁所。可點地圖上的廁所，或從下面的公開名冊挑選。</p>`;
    }
    function toiletChoices() {
      return `<details class="hl-details hl-picker" ${selected ? '' : 'open'}><summary>${selected ? '換一間廁所' : '選一間附近廁所'}<span>直線距離${snapshot.position ? '' : ' · 依地圖中心'}</span></summary><div>${resourceRows(nearby(toilets), 'toilet')}</div></details>`;
    }
    function renderWifi() {
      wifiSummary ||= math.wifiSummary(stores, map.getCenter(), { radiusM: 300, signalM: 50 });
      const count = wifiSummary.count;
      return `<article class="hl-card hl-wifi-card"><div class="hl-hero"><div class="hl-radar-art" aria-hidden="true"><i></i><i></i><i></i>${icon('wifi', 34)}</div><div class="hl-hero-copy"><span class="hl-eyebrow">畫面中心 · 半徑 300 m</span><h3>${count === 0 ? 'Wi-Fi 沙漠' : count <= 2 ? 'Wi-Fi 綠洲' : 'Wi-Fi 風暴'}</h3><p>${count === 0 ? '這一帶沒有名冊點位，移動地圖再找找。' : '公開點位在這裡匯聚。拖動地圖，看密度如何變化。'}</p></div></div><div class="hl-metrics"><div><strong>${esc(count)}</strong><span>個去重點位群</span></div><div><strong>${esc(Number(wifiSummary.coveragePercent || 0).toFixed(1))}<small>%</small></strong><span>估算幾何覆蓋率</span></div></div><div class="hl-legend"><span><i class="hl-dot"></i>50 m 試算半徑</span><span><i class="hl-dot hl-dot-outline"></i>100 m 外圈示意</span></div><p class="hl-note">這是名冊點位密度，並非實測訊號或連線可用率。</p></article><details class="hl-details"><summary>怎麼估算？</summary><p>以目前地圖中心 300 m 圓形區域為統計範圍；同座標四捨五入至小數點 5 位合併為一群，每點假設 50 m 半徑，以抽樣估計圓聯集覆蓋。0 群是沙漠、1～2 群是綠洲、3 群以上是風暴。</p><p>100 m 外圈僅是視覺示意；畫面最多繪製 120 群與 12 個脈動，統計使用完整公開名冊。</p><p>${sourceLink(stores.find(store => store.services.includes('wifi'))?.sourceUrl, '公開 Wi-Fi 資源名冊')}</p></details>`;
    }
    function renderToilet() {
      const usable = toiletStatus === 'ready' && toiletRoute;
      const estimate = usable ? math.toiletEstimate(toiletRoute.distanceM) : null;
      const running = timer.status === 'running';
      const stateText = { idle: '選廁所後，計算本機步行路程', loading: '正在本機計算步行道路…', 'waiting-location': '需要位置才能計算步行路程', error: toiletError, ready: '本機道路估算 · 未驗證入口' }[toiletStatus];
      return `${selected ? '' : toiletChoices()}<article class="hl-card">${targetHtml()}<div class="hl-water-hero"><div class="hl-water-ball ${running ? 'is-running' : ''}" aria-hidden="true"><div class="hl-water-fill" style="height:${timer.total ? Math.max(0, timer.remaining / timer.total * 100) : 72}%"></div><span>${icon('toilet', 32)}</span></div><div class="hl-timer-copy"><span class="hl-eyebrow">預估步行倒數</span><strong id="hl-countdown">${usable ? timeLabel(timer.remaining) : '—:—'}</strong><span id="hl-timer-state">${timer.status === 'finished' ? '估計時間到 · 尚未確認抵達' : running ? `倒數中${timer.speed > 1 ? ' · 20 倍展示' : ''}` : timer.status === 'paused' ? '已暫停' : '準備好了再開始'}</span></div></div>${estimate ? `<div class="hl-route-metrics"><span>${icon('walk', 17)}約 <strong>${esc(estimate.steps)}</strong> 步</span><span>${icon('route', 17)}${meters(toiletRoute.distanceM)} 道路＋接線</span></div>` : ''}<p class="hl-note ${toiletStatus === 'error' ? 'hl-error' : ''}" role="status">${esc(stateText)}</p><div class="hl-actions">${running ? primary('pause-timer', '暫停') : primary('start-timer', timer.status === 'paused' ? '繼續倒數' : '開始倒數', usable && timer.remaining > 0 ? '' : 'disabled')}${button('reset-timer', '重置', usable ? '' : 'disabled')}${toiletStatus === 'error' ? button('retry-route', '重試道路') : ''}</div><label class="hl-switch"><input id="hl-speed" type="checkbox" ${timer.speed === 20 ? 'checked' : ''}>20 倍加速試玩<span>展示用</span></label>${timer.status === 'finished' ? primary('arrive-gold', '我已抵達 · 看含金量') : ''}</article>${selected ? toiletChoices() : ''}<details class="hl-details"><summary>步數與倒數的假設</summary><p>步長 0.7 m、每分鐘 100 步。步數與秒數由本機步行道路長度換算，不是計步器讀值。藍色實線為 OSM 道路，虛線為估計接線；${usable ? `接線 ${meters(toiletRoute.connectorDistanceM)}。` : ''}未驗證入口與無障礙通行。</p><p>歸零只代表估計時間到了，不判定實際抵達，也不衡量身體忍耐能力。更換廁所或位置會重算；原本的目的地路線保留。</p></details>`;
    }
    function priceInfo() {
      if (!selected) return null;
      const district = math.districtFromAddress(selected.address || '');
      const sample = window.FRIENDLY_PRICE_SAMPLE;
      const row = sample?.districts?.find(entry => entry.district === district);
      if (!district || !row || !(row.maxTotalPrice > 0)) return { district, sample, row: null };
      return { district, sample, row, result: math.mortgage(row.maxTotalPrice, { ltv: .8, annualRate: .025, years: 30, daysPerMonth: 30 }) };
    }
    function goldElapsed() { return gold.elapsed + (gold.running ? (Date.now() - gold.startedAt) / 1000 : 0); }
    function renderGold() {
      const info = priceInfo();
      if (!info?.row) return `${selected ? '' : toiletChoices()}<article class="hl-card">${targetHtml()}<div class="hl-gold-empty" aria-hidden="true"><span class="hl-coin">$</span></div><h3>${selected ? '這一區的樣本待補' : '把一刻，換成城市含金量'}</h3><p class="hl-note">${selected ? `${esc(info?.district || '地址未提供可辨識的臺北行政區')}，目前沒有可用的官方住宅樣本。不以零元替代缺值。` : '選一間廁所，看看地址所在行政區的住宅交易樣本。'}</p></article>${selected ? toiletChoices() : ''}`;
      const { district, row, sample, result } = info; const source = sample.source || {};
      return `<article class="hl-card hl-gold-card">${targetHtml()}<div class="hl-gold-hero"><div class="hl-coin ${gold.running ? 'is-running' : ''}" aria-hidden="true"><span>$</span></div><div class="hl-hero-copy"><span class="hl-eyebrow">${esc(district)} · 住宅樣本換算</span><strong class="hl-price-rate">${money(result.perSecond, 3)}<small>元／秒</small></strong><p>把區域房價，換成一秒的房貸試算</p></div></div><div class="hl-total"><span>本次趣味累計</span><strong><small>NT$</small> <span id="hl-gold-total">${money(goldElapsed() * result.perSecond, 2)}</span></strong><span id="hl-gold-state">${gold.running ? '體驗計時中' : gold.elapsed > 0 ? '已停止' : '按「我已抵達」才開始'}</span></div><div class="hl-actions">${gold.running ? primary('stop-gold', '停止累計') : primary('start-gold', gold.elapsed ? '繼續體驗' : '我已抵達 · 開始體驗')}${button('reset-gold', '重設')}</div><p class="hl-note hl-gold-notice">趣味試算，非真實收費、收益或廁所估值。</p></article>${toiletChoices()}<details class="hl-details"><summary>樣本、來源與完整公式</summary><dl class="hl-facts"><div><dt>行政區</dt><dd>${esc(district)}（依資源地址）</dd></div><div><dt>本批住宅最高總價</dt><dd>NT$ ${money(row.maxTotalPrice)}</dd></div><div><dt>樣本期間／批次</dt><dd>${esc(source.registrationPeriod || source.period || source.batch || '待補')}（登記日期）</dd></div><div><dt>成交日期篩選範圍</dt><dd>${esc(source.transactionPeriod || '待補')}</dd></div><div><dt>本筆成交日期</dt><dd>${esc(row.transactionDate || '待補')}</dd></div><div><dt>符合篩選筆數</dt><dd>${esc(row.sampleCount ?? row.count ?? '見資料檔')} 筆</dd></div><div><dt>每月本息試算</dt><dd>NT$ ${money(result.monthly, 2)}</dd></div></dl><p>貸款 8 成、年利率 2.5%、30 年本息攤還；每月以 30 天換算。不是銀行報價，也不是歷年市場最高價。</p><p class="hl-formula">P = 樣本總價 × 0.8<br>r = 0.025 ÷ 12，n = 360<br>月付 = P × r × (1+r)ⁿ ÷ ((1+r)ⁿ−1)<br>每秒 = 月付 ÷ (30 × 24 × 60 × 60)</p><p>${sourceLink(source.url || source.datasetUrl, source.name || '官方不動產實價登錄資料')}<br>${esc((source.filters || []).join('；') || source.filterDescription || source.filter || '')}</p><p>本批 ${esc(source.recordCount ?? '待補')} 筆中共 ${esc(source.sampleCount ?? '待補')} 筆符合篩選；本筆來源 ${esc(source.csvFilename || 'CSV')} 第 ${esc(row.sourceCsvRow ?? '待補')} 列，交易編號 ${esc(row.recordId || '待補')}。<br>${esc((source.limitations || []).join('；'))}</p></details>`;
    }
    function refreshBudget() {
      const percent = currentPercent();
      budget = percent === null ? null : math.batteryBudget(percent, { reservePercent: 5, drainPerHour: drain, speedKmh: 4, charging: currentCharging() });
      candidateChargers = budget?.active && budget.radiusM > 0 && valid(snapshot.position) ? chargers.filter(store => distance(snapshot.position, store) <= budget.radiusM).sort((a, b) => distance(snapshot.position, a) - distance(snapshot.position, b)) : [];
    }
    function renderBattery() {
      refreshBudget(); const percent = currentPercent(); const hasPosition = valid(snapshot.position);
      const status = currentCharging() ? '裝置正在充電 · 已停止警戒' : percent === null ? batteryState === 'checking' ? '正在確認裝置支援…' : '此瀏覽器無法讀取裝置電量' : percent >= 20 ? '電量達 20% · 一般探索' : percent <= 5 ? '已到保留電量 · 試算範圍為零' : hasPosition ? '低電量縮圈中' : '取得位置後，顯示估算範圍';
      return `<article class="hl-card hl-battery-card"><div class="hl-battery-hero"><div class="hl-battery-art ${budget?.active ? 'is-low' : ''}" aria-hidden="true"><span style="width:${percent || 0}%"></span>${icon('charge', 30)}</div><div><span class="hl-eyebrow">${manualBattery ? '手動試玩 · 非裝置電量' : battery ? '裝置回報電量' : '裝置電量不可用'}</span><strong class="hl-battery-value">${percent ?? '—'}<small>%</small></strong></div></div><p class="hl-note" role="status">${status}</p><div class="hl-actions">${primary('manual-battery', manualBattery ? '回到 18% 試玩' : '試玩 18% 電量')}${battery ? button('device-battery', '使用裝置電量', manualBattery ? '' : 'disabled') : ''}</div><label class="hl-range-label" for="hl-battery-range"><span>試玩電量</span><output id="hl-battery-output">${manualPercent}%</output></label><input id="hl-battery-range" class="hl-range" type="range" min="0" max="100" step="1" value="${manualPercent}" ${manualBattery ? '' : 'disabled'} aria-label="手動試玩電量百分比"><div class="hl-range-ticks"><span>0%</span><span>20% 啟動門檻</span><span>100%</span></div>${budget?.active ? `<div class="hl-metrics"><div><strong>${Math.round(budget.seconds / 60)}<small>分</small></strong><span>依假設可用時間</span></div><div><strong>${meters(budget.radiusM)}</strong><span>直線半徑上限</span></div></div>` : ''}<p class="hl-note">保留 5% · 每小時耗電 ${drain} 個百分點 · 步速 4 km/h。不是實測續航，也不是道路可達範圍。</p></article>${budget?.active && hasPosition ? `<section class="hl-charge-list"><h3>${icon('charge', 18)}圈內 ${candidateChargers.length} 筆充電候選</h3><p class="hl-note">點選查看資源；不保證道路可達、營業或插座可用。</p>${candidateChargers.length ? resourceRows(candidateChargers.slice(0, 6), 'charge', 'charge-detail') : '<p class="hl-empty">此試算範圍內沒有充電名冊點位。可調整假設或回一般探索。</p>'}</section>` : ''}<details class="hl-details"><summary>調整耗電假設與計算方式</summary><label class="hl-setting">每小時耗電（百分點）<select id="hl-drain"><option value="10" ${drain === 10 ? 'selected' : ''}>10%</option><option value="20" ${drain === 20 ? 'selected' : ''}>20%</option><option value="30" ${drain === 30 ? 'selected' : ''}>30%</option></select></label><p>可用秒數 = max(電量−5, 0) ÷ 每小時耗電 × 3600。半徑 = 可用時數 × 4 km。只有電量低於 20% 且未充電時顯示圈外深灰；5% 以下範圍為零。</p><p>此估計未納入坡度、道路、身體狀況與耗電差異；充電名冊也需現場確認。</p></details>`;
    }
    function render() {
      if (destroyed) return;
      const visible = active(); host.hidden = !visible; document.body.classList.toggle('hl-active', visible);
      document.body.classList.toggle('hl-animation-paused', document.hidden || !visible || Boolean(document.querySelector('#panel-content')?.hidden));
      if (!visible) { clearLayers(); return; }
      const focused = host.contains(document.activeElement) ? document.activeElement : null;
      const focusKey = focused ? { id: focused.id, mode: focused.dataset.hlMode, action: focused.dataset.hlAction, resource: focused.dataset.hlResource } : null;
      const details = new Set([...host.querySelectorAll('details[open]')].map(el => el.querySelector('summary')?.textContent));
      host.dataset.mode = mode;
      host.innerHTML = `<header class="hl-header"><div><span class="hl-eyebrow">CITY SURVIVAL RADAR</span><h2>城市生存雷達</h2></div><button type="button" class="hl-close" data-hl-action="close" aria-label="關閉雷達，回一般探索">${icon('close', 22)}</button></header><div class="hl-tabs" role="group" aria-label="城市雷達模式">${Object.entries(MODES).map(([key, [glyph, label]]) => `<button type="button" data-hl-mode="${key}" aria-pressed="${key === mode}" class="${key === mode ? 'is-active' : ''}">${icon(glyph, 21)}<span>${label}</span></button>`).join('')}</div><p class="hl-mode-intro">${MODES[mode][2]}</p>${locationTools()}<div class="hl-mode-body">${mode === 'wifi' ? renderWifi() : mode === 'toilet' ? renderToilet() : mode === 'gold' ? renderGold() : renderBattery()}</div><p class="hl-prototype-note">城市資源試玩 · 公開資料 × 明示估算</p>`;
      for (const el of host.querySelectorAll('details')) if (details.has(el.querySelector('summary')?.textContent)) el.open = true;
      if (focusKey) {
        const next = [...host.querySelectorAll('button, input, select')].find(el => focusKey.id ? el.id === focusKey.id : focusKey.mode ? el.dataset.hlMode === focusKey.mode : el.dataset.hlAction === focusKey.action && el.dataset.hlResource === focusKey.resource);
        (next || host.querySelector('.hl-actions .hl-primary'))?.focus({ preventScroll: true });
      }
      syncAnimation();
    }
    // guide 畫面內的精簡工具：廁所顯示 app 注入的導引步行距離；充電顯示生存圈狀態。只寫 guideHost。
    function renderGuide() {
      if (destroyed || !guideHost) return;
      const toilet = guiding('toilet') && Boolean(snapshot.selectedStore.services?.includes('toilet'));
      const charge = guiding('charge');
      guideHost.hidden = !(toilet || charge);
      if (toilet) {
        guideHost.dataset.mode = 'toilet';
        paintGuide(guideWalkHtml(snapshot.selectedStore));
      } else if (charge) {
        refreshBudget(); const percent = currentPercent();
        guideHost.dataset.mode = 'charge';
        paintGuide(`<div class="hl-guide-battery"><span class="hl-guide-battery-copy">${icon('charge', 18)}${budget?.active ? `生存圈：${manualBattery ? '試玩' : '裝置'} ${esc(percent)}% · 直線半徑上限 ${meters(budget.radiusM)}` : percent === null ? '裝置電量不可用 · 低於 20% 才顯示生存圈' : `電量 ${esc(percent)}% · 低於 20% 才顯示生存圈`}</span>${manualBattery ? button('device-battery', '使用裝置電量', battery ? '' : 'disabled') : button('manual-battery', '試玩 18%')}</div><p class="hl-note">保留 5% · 每小時耗電 ${drain} 個百分點 · 步速 4 km/h。不是實測續航，也不是道路可達範圍。</p>`);
      } else { paintGuide(''); delete guideHost.dataset.mode; }
    }
    // 路線失敗才退回直線，並在數字前標「直線」，不把直線冒充步行距離。
    function guideWalkHtml(store) {
      const route = snapshot.guideRoute; const status = snapshot.guideStatus;
      const label = value => value >= 1000 ? t('unit.km', { n: (value / 1000).toFixed(1) }) : t('unit.m', { n: Math.round(value) });
      let kind = 'walk'; let value; let caption;
      if (route) { value = label(route.distanceM); caption = [t('guide.walk.minutes', { n: Math.ceil(route.estimateMinutes) }), t('guide.walk.steps', { n: math.toiletEstimate(route.distanceM).steps }), t('guide.walk.estimate')].join(' · '); }
      else if (['error', 'unavailable'].includes(status)) { kind = 'straight'; value = valid(snapshot.position) && valid(store) ? t('common.straight', { d: label(distance(snapshot.position, store)) }) : t('guide.need.location'); caption = t('guide.walk.fallback'); }
      else { kind = 'pending'; value = t('guide.walk.pending'); caption = t(status === 'waiting-location' ? 'guide.walk.waiting' : 'guide.walk.computing'); }
      return `<div class="hl-guide-walk" data-kind="${kind}"><span class="hl-eyebrow">${icon('toilet', 16)}${esc(t('guide.walk.title'))}</span><strong class="hl-walk-distance">${esc(value)}</strong><span class="hl-guide-walk-caption">${esc(caption)}</span></div>`;
    }
    // 同內容不重寫，避免地圖移動觸發的 update() 在點擊途中換掉按鈕。
    function paintGuide(html) { if (html === lastGuideHtml) return; lastGuideHtml = html; guideHost.innerHTML = html; }
    function openToilet(store, route) {
      if (destroyed || !store?.services?.includes('toilet') || !valid(store) || !route) return;
      routeGeneration += 1; routeClient?.cancel();
      if (selected?.id !== store.id) gold = { running: false, elapsed: 0, startedAt: 0 };
      selected = store; toiletRoute = route; toiletStatus = 'ready'; toiletError = ''; injectedRoute = true;
      routeKey = `${store.id}:${positionKey()}`; resetTimer();
      render(); renderGuide();
    }
    // app 離開 guide 時呼叫：暫停倒數、清 guide 生存圈與 guideHost，不動地圖雷達本身。
    function pauseGuide() { if (destroyed) return; pauseTimer(); guideLayer.clearLayers(); lastGuideKey = ''; renderGuide(); }
    function clearLayers() { circles.clearLayers(); pulses.clearLayers(); routeLayer.clearLayers(); batteryLayer.clearLayers(); }
    function drawWifi() {
      circles.clearLayers(); pulses.clearLayers();
      const center = map.getCenter(); const bounds = map.getBounds().pad(.12);
      const points = wifiPoints.filter(point => bounds.contains([point.lat, point.lng])).sort((a, b) => distance(center, a) - distance(center, b)).slice(0, 120);
      L.circle(center, { radius: 300, renderer, color: token('--color-primary'), weight: 1.5, dashArray: '4 6', fill: false, opacity: .6, interactive: false }).addTo(circles);
      const wifi = token('--tp-primary-500');
      points.forEach((point, index) => {
        L.circle([point.lat, point.lng], { radius: 100, renderer, color: wifi, weight: 1, fill: false, opacity: .16, interactive: false }).addTo(circles);
        L.circle([point.lat, point.lng], { radius: 50, renderer, color: wifi, weight: 1.5, fillColor: wifi, fillOpacity: .035, opacity: .25, interactive: false }).addTo(circles);
        if (index < 12) L.marker([point.lat, point.lng], { icon: L.divIcon({ className: 'hl-pulse-marker', html: '<span></span>', iconSize: [24, 24], iconAnchor: [12, 12] }), interactive: false, keyboard: false }).addTo(pulses);
      });
    }
    function drawToilet() {
      routeLayer.clearLayers();
      if (toiletRoute) {
        const route = token('--cat-toilet');
        toiletRoute.roadSegments.forEach(segment => L.polyline(segment, { renderer, color: route, weight: 5, opacity: .95, interactive: false }).addTo(routeLayer));
        toiletRoute.connectors.forEach(segment => L.polyline(segment, { renderer, color: route, weight: 4, dashArray: '4 7', opacity: .8, interactive: false }).addTo(routeLayer));
      }
      if (selected) L.marker([selected.lat, selected.lng], { icon: L.divIcon({ className: 'hl-toilet-pin', html: icon('toilet', 23), iconSize: [42, 42], iconAnchor: [21, 21] }), interactive: false, keyboard: false, zIndexOffset: 1100 }).addTo(routeLayer);
    }
    function drawBattery() { paintBudget(batteryLayer, true); }
    function drawGuide() {
      guideLayer.clearLayers();
      if (guiding('charge')) paintBudget(guideLayer, false);
    }
    function paintBudget(layer, withChargers) {
      layer.clearLayers(); refreshBudget();
      if (!budget?.active || !valid(snapshot.position)) return;
      const center = snapshot.position; const outer = [[-85, -179], [-85, 179], [85, 179], [85, -179]];
      const rings = [outer];
      if (budget.radiusM > 0) {
        const hole = [];
        for (let i = 0; i <= 96; i += 1) { const angle = i / 96 * Math.PI * 2; hole.push([center.lat + Math.sin(angle) * budget.radiusM / 111320, center.lng + Math.cos(angle) * budget.radiusM / (111320 * Math.cos(center.lat * Math.PI / 180))]); }
        rings.push(hole);
        L.circle([center.lat, center.lng], { renderer, radius: budget.radiusM, color: token('--cat-charge'), weight: 3, fillColor: token('--cat-charge'), fillOpacity: .05, interactive: false }).addTo(layer);
      }
      L.polygon(rings, { renderer: maskRenderer, stroke: false, fillColor: token('--color-shadow'), fillOpacity: .62, fillRule: 'evenodd', interactive: false }).addTo(layer);
      if (withChargers) candidateChargers.slice(0, 80).forEach(store => L.marker([store.lat, store.lng], { icon: L.divIcon({ className: 'hl-charge-pin', html: `<span>${icon('charge', 20)}</span>`, iconSize: [32, 32], iconAnchor: [16, 16] }), keyboard: false, zIndexOffset: 800 }).on('click', () => openCharge(store)).addTo(layer));
    }
    function drawLayers() {
      clearLayers(); if (!active()) return;
      if (mode === 'wifi') drawWifi();
      else if (mode === 'toilet' || mode === 'gold') drawToilet();
      else drawBattery();
    }
    function onMapMove() {
      if (!active()) return;
      if (mode === 'wifi') { wifiSummary = math.wifiSummary(stores, map.getCenter(), { radiusM: 300, signalM: 50 }); render(); drawWifi(); }
      else if (mode === 'battery') drawBattery();
      else if (!selected) render();
    }
    function resetTimer() { timer = { status: toiletRoute ? 'ready' : 'idle', total: toiletRoute ? math.toiletEstimate(toiletRoute.distanceM).seconds : 0, remaining: toiletRoute ? math.toiletEstimate(toiletRoute.distanceM).seconds : 0, deadline: 0, speed: timer.speed }; }
    function remainingSeconds() { return timer.status === 'running' ? Math.max(0, (timer.deadline - Date.now()) / 1000 * timer.speed) : timer.remaining; }
    function pauseTimer() { if (timer.status !== 'running') return; timer.remaining = remainingSeconds(); timer.status = timer.remaining ? 'paused' : 'finished'; }
    function startTimer() { if (!toiletRoute || toiletStatus !== 'ready' || timer.remaining <= 0) return; timer.deadline = Date.now() + timer.remaining / timer.speed * 1000; timer.status = 'running'; }
    function pauseGold() { gold.elapsed = goldElapsed(); gold.running = false; }
    async function scheduleToiletRoute(force = false) {
      const key = selected && positionKey() ? `${selected.id}:${positionKey()}` : '';
      if (!force && key && key === routeKey) return;
      routeGeneration += 1; const generation = routeGeneration; routeClient?.cancel(); toiletRoute = null; injectedRoute = false; resetTimer(); toiletError = '';
      if (!selected) toiletStatus = 'idle';
      else if (!valid(snapshot.position) || snapshot.gpsPending) toiletStatus = 'waiting-location';
      else toiletStatus = 'loading';
      routeKey = toiletStatus === 'loading' ? key : '';
      render(); drawLayers();
      if (toiletStatus !== 'loading') return;
      try {
        if (!window.FriendlyRouteClient) throw new Error('本機路由尚未載入，請連線後重新開啟。');
        routeClient ||= window.FriendlyRouteClient.createClient();
        const result = await routeClient.route({ points: [snapshot.position, selected].map(({ lat, lng }) => ({ lat, lng })), stores: [], radius: 250 });
        if (destroyed || generation !== routeGeneration) return;
        toiletRoute = result; toiletStatus = 'ready'; resetTimer(); render(); drawLayers();
      } catch (error) {
        if (destroyed || generation !== routeGeneration) return;
        toiletStatus = 'error'; toiletError = error.message || '本機道路計算失敗，請重試。'; render(); drawLayers();
      }
    }
    function selectToilet(store) {
      if (!store?.services.includes('toilet') || !valid(store)) return;
      if (selected?.id === store.id) { render(); return; }
      selected = store; gold = { running: false, elapsed: 0, startedAt: 0 }; onSelectResource?.(store);
      map.panTo([store.lat, store.lng], { animate: !motionQuery.matches }); scheduleToiletRoute();
    }
    function openCharge(store) { onSelectResource?.(store); onShowDetails?.(store); map.panTo([store.lat, store.lng], { animate: !motionQuery.matches }); }
    function fitBattery() {
      refreshBudget(); if (!valid(snapshot.position)) return;
      const radius = Math.max(budget?.radiusM || 0, 180);
      const { lat, lng } = snapshot.position;
      const latitudeDelta = radius / 111320;
      const longitudeDelta = radius / (111320 * Math.max(.001, Math.cos(lat * Math.PI / 180)));
      map.fitBounds([[lat - latitudeDelta, lng - longitudeDelta], [lat + latitudeDelta, lng + longitudeDelta]], { padding: [38, 38], maxZoom: 17, animate: !motionQuery.matches });
    }
    function open(nextMode = 'wifi') {
      const next = Object.hasOwn(MODES, nextMode) ? nextMode : 'wifi';
      if (mode !== next) { pauseTimer(); pauseGold(); }
      mode = next; onOpenExplore?.();
      if (!selected && snapshot.selectedStore?.services.includes('toilet')) selected = snapshot.selectedStore;
      if (mode === 'wifi') wifiSummary = math.wifiSummary(stores, map.getCenter(), { radiusM: 300, signalM: 50 });
      if (mode === 'toilet' && selected) scheduleToiletRoute();
      render(); drawLayers();
    }
    function close() { pauseTimer(); pauseGold(); mode = null; render(); }
    function click(event) {
      const target = event.target.closest('[data-hl-mode], [data-hl-action]'); if (!target) return;
      if (target.dataset.hlMode) { open(target.dataset.hlMode); return; }
      const action = target.dataset.hlAction;
      if (action === 'close') { close(); return; }
      if (action === 'gps') { onRequestPosition?.(); return; }
      if (action === 'demo') { onUseDemoPosition?.({ ...DEMO }); map.setView([DEMO.lat, DEMO.lng], 17, { animate: false }); if (mode === 'battery') fitBattery(); return; }
      if (action === 'select') { selectToilet(byId.get(target.dataset.hlResource)); return; }
      if (action === 'charge-detail') { const store = byId.get(target.dataset.hlResource); if (store) openCharge(store); return; }
      if (action === 'retry-route') { scheduleToiletRoute(true); return; }
      if (action === 'start-timer') startTimer();
      else if (action === 'pause-timer') pauseTimer();
      else if (action === 'reset-timer') resetTimer();
      else if (action === 'arrive-gold') { open('gold'); return; }
      else if (action === 'start-gold' && priceInfo()?.row) { gold.startedAt = Date.now(); gold.running = true; }
      else if (action === 'stop-gold') pauseGold();
      else if (action === 'reset-gold') gold = { running: false, elapsed: 0, startedAt: 0 };
      else if (action === 'manual-battery') { manualBattery = true; manualPercent = 18; if (active()) { drawBattery(); fitBattery(); } drawGuide(); }
      else if (action === 'device-battery') { manualBattery = false; if (active()) drawBattery(); drawGuide(); }
      render(); renderGuide();
    }
    function input(event) {
      if (event.target.id !== 'hl-battery-range') return;
      manualBattery = true; manualPercent = Math.max(0, Math.min(100, Number(event.target.value))); refreshBudget(); drawBattery();
      const output = host.querySelector('#hl-battery-output'); if (output) output.textContent = `${manualPercent}%`;
      // Keep the same slider node while dragging; refresh the card once the gesture finishes.
    }
    function change(event) {
      if (event.target.id === 'hl-speed') {
        const wasRunning = timer.status === 'running'; pauseTimer(); timer.speed = event.target.checked ? 20 : 1; if (wasRunning) startTimer(); render();
      } else if (event.target.id === 'hl-drain') { drain = Number(event.target.value); render(); drawBattery(); }
      else if (event.target.id === 'hl-battery-range') { render(); drawBattery(); }
    }
    function syncAnimation() { document.body.classList.toggle('hl-animation-paused', document.hidden || !active() || Boolean(document.querySelector('#panel-content')?.hidden)); }
    function tick() {
      if (destroyed) return;
      if (timer.status === 'running') {
        timer.remaining = remainingSeconds();
        if (timer.remaining <= 0) { timer.status = 'finished'; if (active() && mode === 'toilet') render(); }
        const label = host.querySelector('#hl-countdown'); if (label) label.textContent = timeLabel(timer.remaining);
        const fill = host.querySelector('.hl-water-fill'); if (fill) fill.style.height = `${timer.total ? timer.remaining / timer.total * 100 : 0}%`;
      }
      if (gold.running && active() && mode === 'gold') { const label = host.querySelector('#hl-gold-total'); const info = priceInfo(); if (label && info?.result) label.textContent = money(goldElapsed() * info.result.perSecond, 2); }
    }
    // 只在地圖頁自動開生存圈；在其他畫面跳過時不記為已低電量，下次在地圖頁收到電量事件仍會觸發。
    function batteryChanged() {
      const isLow = Boolean(battery && battery.level < .2 && !battery.charging);
      if (isLow && !deviceWasLow && !manualBattery) {
        if (snapshot.view === 'map') { deviceWasLow = true; open('battery'); return; }
        drawGuide(); renderGuide(); return;
      }
      deviceWasLow = isLow;
      if (!manualBattery && mode === 'battery') { render(); drawBattery(); }
      drawGuide(); renderGuide();
    }
    if (typeof navigator.getBattery === 'function') {
      Promise.resolve().then(() => navigator.getBattery()).then(value => {
        if (destroyed) return;
        if (!value || !Number.isFinite(value.level) || value.level < 0 || value.level > 1 || typeof value.charging !== 'boolean') throw new Error('電量讀值不可用');
        battery = value; batteryState = 'ready';
        battery.addEventListener('levelchange', batteryChanged); battery.addEventListener('chargingchange', batteryChanged); batteryChanged();
      }).catch(() => { batteryState = 'unsupported'; if (mode === 'battery') render(); });
    } else batteryState = 'unsupported';
    const interval = window.setInterval(tick, 200);
    const visibility = () => { syncAnimation(); tick(); };
    const panelObserver = new MutationObserver(syncAnimation);
    const panelContent = document.querySelector('#panel-content');
    if (panelContent) panelObserver.observe(panelContent, { attributes: true, attributeFilter: ['hidden'] });
    const launchClick = event => { const target = event.target.closest('[data-hl-mode]'); open(target?.dataset.hlMode || 'wifi'); };
    if (launch) {
      launch.innerHTML = `<div class="hl-launch-heading"><span>${icon('compass', 20)}城市生存雷達</span><small>試玩四種城市感受</small></div><div class="hl-launch-modes">${Object.entries(MODES).map(([key, [glyph, label]]) => `<button type="button" data-hl-mode="${key}">${icon(glyph, 22)}<span>${label}</span></button>`).join('')}</div>`;
      launch.addEventListener('click', launchClick);
    }
    host.addEventListener('click', click); host.addEventListener('input', input); host.addEventListener('change', change); guideHost?.addEventListener('click', click);
    document.addEventListener('visibilitychange', visibility); motionQuery.addEventListener('change', syncAnimation);
    map.on('moveend', onMapMove);
    return {
      update(nextSnapshot) {
        if (destroyed) return;
        const previousView = snapshot.view; const previousUrgency = snapshot.urgency; const wasPending = snapshot.gpsPending; snapshot = nextSnapshot;
        const nextKey = positionKey();
        if (lastPositionKey !== nextKey) {
          lastPositionKey = nextKey; lastBatteryKey = '';
          if (selected && !injectedRoute) scheduleToiletRoute();
        }
        else if (selected && wasPending && !snapshot.gpsPending && toiletStatus === 'waiting-location') scheduleToiletRoute();
        const key = `${currentPercent()}:${currentCharging()}:${nextKey}:${drain}`;
        if (key !== lastBatteryKey) { lastBatteryKey = key; if (mode === 'battery' && active()) drawBattery(); }
        if (previousView === 'guide' && (snapshot.view !== 'guide' || previousUrgency !== snapshot.urgency)) pauseTimer();
        const guideKey = `${snapshot.view}:${snapshot.urgency}:${snapshot.selectedStore?.id || ''}:${key}`;
        if (guideKey !== lastGuideKey) { lastGuideKey = guideKey; drawGuide(); }
        if (mode) { render(); if (previousView !== snapshot.view) drawLayers(); }
        renderGuide(); syncAnimation();
      },
      open,
      close,
      openToilet,
      pauseGuide,
      handleResource(store) { if (active() && (mode === 'toilet' || mode === 'gold') && store?.services.includes('toilet')) { selectToilet(store); return true; } return false; },
      destroy() {
        destroyed = true; routeGeneration += 1; routeClient?.cancel(); clearInterval(interval); panelObserver.disconnect();
        map.off('moveend', onMapMove); clearLayers(); guideLayer.clearLayers(); [circles, pulses, routeLayer, batteryLayer, guideLayer].forEach(layer => map.removeLayer(layer));
        battery?.removeEventListener('levelchange', batteryChanged); battery?.removeEventListener('chargingchange', batteryChanged);
        document.removeEventListener('visibilitychange', visibility); motionQuery.removeEventListener('change', syncAnimation);
        host.removeEventListener('click', click); host.removeEventListener('input', input); host.removeEventListener('change', change); guideHost?.removeEventListener('click', click); launch?.removeEventListener('click', launchClick);
        if (guideHost) { guideHost.innerHTML = ''; guideHost.hidden = true; lastGuideHtml = ''; }
        host.innerHTML = ''; host.hidden = true; document.body.classList.remove('hl-active', 'hl-animation-paused');
      },
    };
  }
  window.FriendlyHighlights = Object.freeze({ create });
})();
