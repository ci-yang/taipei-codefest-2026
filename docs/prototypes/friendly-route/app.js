/* 友善同行：位置只供當次使用，離線快取只含公開資料與 app shell。 */
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const data = window.FRIENDLY_RESOURCES;
  const basemap = window.FRIENDLY_DATA;
  const icons = window.FriendlyIcons;
  if (!data || !basemap || !icons || !window.L || !window.FriendlyBridge || !window.FriendlyOffline) {
    document.body.textContent = '必要資料尚未載入，請連線後重新開啟。尚未完成首次快取的裝置無法離線啟動。'; return;
  }
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const icon = (name, size = 22) => icons.icon(name, size);
  const URGENCIES = { toilet: { label: '廁所', title: '最近的廁所' }, charge: { label: '充電點', title: '最近的充電點' }, wifi: { label: '免費 Wi-Fi', title: '最近的免費 Wi-Fi' } };
  const VIEWS = ['home', 'result', 'guide', 'card', 'map'];
  const LANG_KEY = 'friendly-native-language-v1'; const STEP_FREE_KEY = 'friendly-step-free-v1';
  const SERVICES = { wifi: 'Wi-Fi', toilet: '廁所', charge: '充電', accessible: '無障礙' };
  const valid = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
  const stores = data.stores.map(s => ({ ...s, id: String(s.id) }));
  const byId = new Map(stores.map(s => [s.id, s]));
  const center = { lat: 25.0375, lng: 121.5637 };
  const state = { view: 'home', screen: 'home', urgency: null, result: null, resultIndex: 0, guideRoute: null, guideStatus: 'idle', guideMessage: '', guideGeneration: 0, prefs: { lang: 'zh-TW', stepFree: false }, prefsNotice: '', mode: 'free', detailId: null, position: null, gpsPending: false, gpsMessage: '', gpsGeneration: 0, filters: new Set(), selectedId: null, destination: null, route: null, routeIds: new Set(), routeStatus: 'idle', routeMessage: '', routeGeneration: 0, mapExpanded: false, panelCollapsed: false, online: navigator.onLine, searchGeneration: 0, searchController: null, searchQuery: '', searchResults: [], theme: 'light', heading: null, orientationEnabled: false, orientationMessage: '未使用方位感測，以正北為基準', activeSheet: null, cache: null, externalGeneration: 0 };
  let highlights; let toastTimer; let beforeSheet; let searchClient; let routeClient; let guideRouteClient; let renderedRoute; let selectedMarker; let gpsMarker; let referenceMarker; let tileLayer; let viewportFrame;
  const map = L.map('map', { zoomControl: false, attributionControl: false, preferCanvas: true }).setView([center.lat, center.lng], 17);
  const attribution = L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);
  attribution.addAttribution('© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a> (ODbL)');
  L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
  const canvas = L.canvas({ padding: 0.5 });
  const resourceLayer = L.layerGroup().addTo(map);
  const iconLayer = L.layerGroup().addTo(map);
  const destinationRouteLayer = L.layerGroup().addTo(map);
  const guideRouteLayer = L.layerGroup().addTo(map);
  const markers = new Map();
  const geoLayers = [];
  // 各區域之間沒有底圖，所以判斷要落在某一塊 region 內，不能用外包矩形 bounds。
  function basemapRegion(point) { return valid(point) ? basemap.regions.find(({ bounds: b }) => point.lat >= b[0][0] && point.lat <= b[1][0] && point.lng >= b[0][1] && point.lng <= b[1][1]) : undefined; }
  function isInBasemap(point) { return Boolean(basemapRegion(point)); }
  const BASEMAP_REGION_NAMES = basemap.regions.map(region => region.name).join('、');
  // 地圖畫在 canvas 上吃不到 CSS 變數，每次取用時讀 app-ui.css 的 token；換主題後下一次呼叫就是新色。
  const PALETTE_TOKENS = { bg: '--color-map', building: '--color-building', road: '--color-road', park: '--map-park', line: '--map-line', accent: '--color-primary', route: '--map-route', connector: '--map-connector', muted: '--color-muted', surface: '--color-surface', toilet: '--cat-toilet', charge: '--cat-charge', wifi: '--cat-wifi', accessible: '--cat-accessible', toiletText: '--cat-toilet-text', chargeText: '--cat-charge-text', wifiText: '--cat-wifi-text', accessibleText: '--cat-accessible-text' };
  // CSS 變數讀不到時 Leaflet 會吃到空字串而不畫，退回 grayscale-500。
  const PALETTE_FALLBACK = '#738995';
  function palette() {
    const style = window.getComputedStyle?.(document.documentElement);
    const read = token => style?.getPropertyValue(token).trim() || '';
    const muted = read(PALETTE_TOKENS.muted) || PALETTE_FALLBACK;
    return Object.fromEntries(Object.entries(PALETTE_TOKENS).map(([key, token]) => [key, read(token) || muted]));
  }
  function drawBasemap() {
    geoLayers.forEach(layer => map.removeLayer(layer)); geoLayers.length = 0;
    const colors = palette();
    geoLayers.push(L.geoJSON(basemap.map, { interactive: false, renderer: canvas, style: feature => {
      const p = feature.properties || {};
      if (p.highway) return { color: colors.road, weight: /^(primary|secondary|trunk)/.test(p.highway) ? 6 : 2.5, opacity: .95 };
      return { color: colors.line, weight: .5, opacity: .3, fillColor: p.leisure ? colors.park : colors.building, fillOpacity: .8 };
    }}).addTo(map));
    geoLayers.forEach(layer => layer.bringToBack());
    const labelLayer = L.layerGroup(); const names = new Set();
    basemap.map.features.filter(feature => feature.geometry.type === 'LineString' && feature.properties.name && /^(primary|secondary|tertiary)$/.test(feature.properties.highway || '')).forEach(feature => {
      const name = feature.properties.name; if (names.has(name)) return; names.add(name);
      const coords = feature.geometry.coordinates; const point = coords[Math.floor(coords.length / 2)];
      L.marker([point[1], point[0]], { icon: L.divIcon({ className: 'local-road-label', html: esc(name), iconSize: [100, 18], iconAnchor: [50, 9] }), interactive: false, keyboard: false }).addTo(labelLayer);
    });
    geoLayers.push(labelLayer); syncOnlineTiles();
  }
  function renderBasemapNotice() {
    const notice = $('#basemap-notice'); if (!notice) return;
    const outsideCoverage = !state.online && !isInBasemap(map.getCenter());
    notice.hidden = !outsideCoverage;
    notice.textContent = outsideCoverage ? '此區尚無離線底圖，可查看資源與直線距離' : '';
  }
  function syncOnlineTiles() {
    renderBasemapNotice();
    const bounds = map.getBounds(); const viewRegion = basemapRegion(bounds.getSouthWest()); const localView = Boolean(viewRegion) && viewRegion === basemapRegion(bounds.getNorthEast());
    const showLocal = !state.online || localView;
    for (const layer of geoLayers) { if (showLocal && !map.hasLayer(layer)) layer.addTo(map); else if (!showLocal && map.hasLayer(layer)) map.removeLayer(layer); }
    if ((showLocal || !state.online) && tileLayer) { map.removeLayer(tileLayer); tileLayer = null; }
    if (!showLocal && state.online && !tileLayer) {
      tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, crossOrigin: true, className: 'osm-tiles' }).addTo(map);
      tileLayer.bringToBack();
    }
  }
  function distance(a, b) {
    const r = Math.PI / 180; const x = (b.lat - a.lat) * r; const y = (b.lng - a.lng) * r;
    return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(Math.sin(x / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(y / 2) ** 2)));
  }
  function bearing(a, b) {
    const r = Math.PI / 180; const dl = (b.lng - a.lng) * r;
    return (Math.atan2(Math.sin(dl) * Math.cos(b.lat * r), Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos(dl)) / r + 360) % 360;
  }
  const directionName = angle => ['北', '東北', '東', '東南', '南', '西南', '西', '西北'][Math.round(angle / 45) % 8];
  const distanceLabel = meters => meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} 公尺`;
  const pointForDistance = () => state.position || { lat: map.getCenter().lat, lng: map.getCenter().lng };
  // 空集合是「尚未選類別」，不是「全部」：沒選就不列、不畫任何資源。
  const matches = store => state.filters.size > 0 && store.services.some(service => state.filters.has(service));
  const hitCategory = store => store.services.find(service => state.filters.has(service)) || null;
  const pinStyle = key => Object.hasOwn(SERVICES, key) ? `--pin:var(--cat-${key});--pin-on:var(--cat-${key}-on);--pin-text:var(--cat-${key}-text)` : '';
  const isVisible = store => valid(store) && map.getBounds().contains([store.lat, store.lng]);
  const matchesRoute = store => state.routeStatus !== 'ready' || state.routeIds.has(store.id);
  function visibleStores() { const from = pointForDistance(); return stores.filter(s => valid(s) && matches(s) && (state.routeStatus === 'ready' ? state.routeIds.has(s.id) : isVisible(s))).sort((a, b) => distance(from, a) - distance(from, b)); }
  const resourceScope = () => state.routeStatus === 'ready' ? '沿線' : '視窗內';
  function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false; toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4500); }
  function updateIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
  function cancelSearch() { state.searchGeneration += 1; state.searchController?.abort(); state.searchController = null; if ($('#search-submit')) $('#search-submit').disabled = false; }
  function closeSheet() {
    const wasOpen = $('#app-sheet').open;
    state.externalGeneration += 1; cancelSearch(); state.activeSheet = null; state.detailId = null; $('#app-sheet').close();
    if (!wasOpen) return;
    const restore = beforeSheet?.isConnected && !beforeSheet.closest('dialog') ? beforeSheet : $(focusTarget());
    if (document.documentElement.dataset.input === 'keyboard') restore?.focus({ preventScroll: true });
    else document.activeElement?.blur?.();
  }
  function openSheet(title, html, name) {
    state.externalGeneration += 1; beforeSheet = document.activeElement; state.activeSheet = name; $('#app-sheet').dataset.sheet = name === 'details' ? 'detail' : name; $('#sheet-title').textContent = title; $('#sheet-body').innerHTML = html;
    updateIcons($('#sheet-body')); if (!$('#app-sheet').open) $('#app-sheet').showModal();
  }
  const focusTarget = () => ({ home: '[data-urgency="toilet"]', result: '#result-back', guide: '#exit-guidance' }[state.screen] || '#search-trigger');
  function dateText(value) { return value ? String(value).slice(0, 10) : '待確認'; }
  function timeText(time) { return new Date(time).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }); }
  const isInferred = (store, service) => (store.inferredServices || []).includes(service);
  function serviceTag(store, key, includeMissing = true) {
    if (!store.services.includes(key)) return includeMissing ? `<span class="service-tag unknown">${icon(key, 16)}${SERVICES[key]} · 未標示</span>` : '';
    const inferred = isInferred(store, key);
    return `<span class="service-tag ${inferred ? 'inferred' : 'official'}">${icon(key, 16)}${SERVICES[key]} · ${inferred ? '推定' : '官方'}</span>`;
  }
  function tags(store) { return Object.keys(SERVICES).map(key => serviceTag(store, key)).join(''); }
  function inferenceHtml(store) {
    const rules = store.inferenceRules || [];
    if (!rules.length) return '';
    return `<div class="inference-note"><strong>橘色服務為常識推定</strong><span>${rules.map(rule => esc(rule.detail)).join(' ')}</span><span>不是單店官方保證，使用前請向現場確認。</span></div>`;
  }
  function serviceTags(store) { return store.services.map(key => serviceTag(store, key, false)).join(''); }
  function phoneFor(store) { return typeof store.normalizedPhone === 'string' && /^\+?\d{8,15}$/.test(store.normalizedPhone) ? store.normalizedPhone : null; }
  function sourceHtml(store) { return `<p class="source-line">來源：<a href="${esc(store.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(store.sourceName)}</a><br>資料更新：${esc(dateText(store.updatedAt))}</p>`; }
  function row(store) {
    const d = valid(store) ? distanceLabel(distance(pointForDistance(), store)) : '未提供座標';
    return `<button class="resource-row" data-resource="${esc(store.id)}" data-cat="${esc(hitCategory(store) || store.services[0] || '')}"><span class="resource-symbol">${icon(store.services.find(s => state.filters.has(s)) || store.services[0] || 'info', 23)}</span><span class="resource-copy"><strong>${esc(store.name)}</strong><span class="resource-card-address">${esc(store.address || '地址待確認')}</span><span class="resource-card-services">${serviceTags(store) || '服務未標示'}</span><span class="resource-card-meta"><span class="resource-card-source">${esc(store.sourceName)}</span><span class="resource-card-updated">更新 ${esc(dateText(store.updatedAt))}</span></span></span><span class="resource-distance">直線 ${d}${icon('chevron', 15)}</span></button>`;
  }
  function renderDestinationRoute() {
    if (renderedRoute !== state.route) {
      destinationRouteLayer.clearLayers(); renderedRoute = state.route;
      if (state.route) {
        const colors = palette();
        for (const segment of state.route.roadSegments) L.polyline(segment, { color: colors.route, weight: 5, opacity: .95, interactive: false }).addTo(destinationRouteLayer);
        for (const connector of state.route.connectors) L.polyline(connector, { color: colors.connector, weight: 4, dashArray: '4 7', opacity: .8, interactive: false }).addTo(destinationRouteLayer);
      }
    }
    $('#destination-route').hidden = !state.destination;
    const route = state.route;
    $('#destination-route-message').textContent = route ? `步行約 ${distanceLabel(route.distanceM)} · 估計 ${Math.ceil(route.estimateMinutes)} 分鐘 · 沿線 ${visibleStores().length} 筆` : state.routeMessage;
    $('#destination-route-note').textContent = route ? `路線兩側250m，非可達保證。實線為 OSM 步行道路；虛線為估計接線（${distanceLabel(route.connectorDistanceM)}），未驗證入口或無障礙通行。` : '本機臺北市步行路網；定位僅供本機計算。';
    $('#route-retry').hidden = !['waiting-location', 'error'].includes(state.routeStatus);
    $('#route-retry').disabled = state.gpsPending;
    $('#route-retry').textContent = state.routeStatus === 'waiting-location' ? '重新定位' : '重新計算';
  }
  function cancelDestinationRoute() {
    state.routeGeneration += 1; routeClient?.cancel(); state.route = null; state.routeIds = new Set();
    state.routeStatus = state.destination ? 'waiting-location' : 'idle'; state.routeMessage = '';
    renderDestinationRoute();
  }
  async function scheduleRoute() {
    cancelDestinationRoute();
    const generation = state.routeGeneration;
    if (!state.destination) { renderAll(); return; }
    if (!state.position || state.gpsPending) {
      state.routeMessage = state.gpsPending ? '正在取得定位，完成後計算目的地路線…' : '需要目前位置才能計算道路路線，請重新定位。'; renderAll(); return;
    }
    state.routeStatus = 'loading'; state.routeMessage = '正在本機計算步行路線…'; renderAll();
    try {
      if (!window.FriendlyRouteClient) throw new Error('本機路由程式未載入，請連線後重新開啟。');
      routeClient ||= window.FriendlyRouteClient.createClient();
      const route = await routeClient.route({ points: [state.position, state.destination].map(point => ({ lat: point.lat, lng: point.lng })), stores, radius: 250 });
      if (generation !== state.routeGeneration) return;
      state.route = route; state.routeIds = new Set(route.storeIds.map(String)); state.routeStatus = 'ready'; state.routeMessage = ''; renderAll();
      requestAnimationFrame(() => { if (generation === state.routeGeneration && (state.screen === 'map' || (state.screen === 'guide' && !guideStore()))) fitDestinationRoute(); });
    } catch (error) {
      if (generation !== state.routeGeneration) return;
      state.routeStatus = 'error'; state.routeMessage = error.name === 'AbortError' ? '路線計算已取消，可重新計算。' : error.message || '無法計算目的地路線，請重試。'; renderAll();
    }
  }
  function fitDestinationRoute() {
    if (!state.route) return;
    const size = map.getSize(); const stage = $('#map-stage').getBoundingClientRect();
    const status = $(state.screen === 'guide' ? '#guidance-hud' : '#map-status').getBoundingClientRect();
    const top = Math.max(96, status.bottom - stage.top + 18);
    let bottom = 32; let right = 32;
    if (state.mapExpanded && state.screen === 'map') {
      const panel = $('#bottom-panel').getBoundingClientRect();
      if (panel.width < size.x * .65 && panel.left >= stage.left + size.x * .4) right = panel.width + 36;
      else bottom = Math.min(size.y * .48, panel.height + 24);
    }
    if (state.screen === 'guide') bottom = 115;
    map.fitBounds(state.route.coordinates, { paddingTopLeft: [32, top], paddingBottomRight: [right, bottom], maxZoom: 17, animate: false });
  }
  function renderMapLayout() {
    $('#app').classList.toggle('map-expanded', state.mapExpanded && state.screen === 'map');
    $('#map-expand').setAttribute('aria-expanded', String(state.mapExpanded));
    $('#map-expand').setAttribute('aria-label', state.mapExpanded ? '還原地圖' : '展開地圖');
    $('#map-expand-label').textContent = state.mapExpanded ? '還原地圖' : '展開地圖';
    $('#panel-content').hidden = state.panelCollapsed;
    $('#bottom-panel').classList.toggle('is-collapsed', state.panelCollapsed);
    $('#panel-toggle').setAttribute('aria-expanded', String(!state.panelCollapsed));
    $('#panel-toggle-label').textContent = state.panelCollapsed ? '展開面板' : '收合面板';
  }
  function refreshMapLayout() {
    renderMapLayout(); syncHighlights();
    requestAnimationFrame(() => { map.invalidateSize({ animate: false }); if (state.route) fitDestinationRoute(); });
  }
  // 地圖上點 pin 或清單列只選取：聚焦地圖、面板換成選取卡；詳細資訊要按卡上的按鈕才開。
  function openResource(id) {
    const store = byId.get(String(id)); if (!store) return;
    if (state.screen === 'guide') { startGuide(store); return; }
    selectResource(store.id);
    if (!highlights?.handleResource(store)) requestAnimationFrame(() => $('#selected-card')?.scrollIntoView?.({ block: 'nearest' }));
  }
  function renderMarkers() {
    const colors = palette();
    for (const store of stores) {
      if (!valid(store)) continue;
      const match = matches(store) && matchesRoute(store); const key = hitCategory(store);
      const fill = match ? colors[key] || colors.muted : colors.muted; const stroke = match ? colors[`${key}Text`] || fill : fill;
      let marker = markers.get(store.id);
      if (!marker) { marker = L.circleMarker([store.lat, store.lng], { renderer: canvas }).on('click', () => openResource(store.id)).addTo(resourceLayer); markers.set(store.id, marker); }
      marker.setStyle({ radius: match ? 7 : 4, color: stroke, weight: match ? 2 : 1, opacity: match ? .9 : .2, fillColor: fill, fillOpacity: match ? .72 : .15 });
    }
    iconLayer.clearLayers();
    if (map.getZoom() >= 14.5) {
      const candidates = visibleStores().filter(s => isVisible(s) && s.id !== state.selectedId).slice(0, 60); const cells = new Set();
      for (const store of candidates) {
        const p = map.latLngToContainerPoint([store.lat, store.lng]); const cell = `${Math.floor(p.x / 52)},${Math.floor(p.y / 52)}`; if (cells.has(cell)) continue; cells.add(cell);
        const key = hitCategory(store);
        L.marker([store.lat, store.lng], { icon: L.divIcon({ className: 'resource-map-pin', iconSize: [44, 44], iconAnchor: [22, 22], html: `<button aria-label="${esc(store.name)}" style="${pinStyle(key)}">${icon(key, 22)}</button>` }), keyboard: false }).on('click', () => openResource(store.id)).addTo(iconLayer);
      }
    }
    if (selectedMarker) map.removeLayer(selectedMarker);
    const selected = byId.get(state.selectedId);
    const selectedKey = selected && (hitCategory(selected) || selected.services[0] || 'info');
    if (valid(selected)) selectedMarker = L.marker([selected.lat, selected.lng], { icon: L.divIcon({ className: 'resource-map-pin is-selected', iconSize: [48, 48], iconAnchor: [24, 24], html: `<button aria-label="${esc(selected.name)}，已選取" style="${pinStyle(selectedKey)}">${icon(selectedKey, 24)}</button>` }), keyboard: false, zIndexOffset: 1000 }).on('click', () => openResource(selected.id)).addTo(map);
    syncHighlights();
  }
  function syncHighlights() {
    highlights?.update({ view: state.screen, urgency: state.urgency, theme: state.theme, position: state.position, gpsPending: state.gpsPending,
      selectedStore: byId.get(state.selectedId) || null, filters: [...state.filters], destination: state.destination,
      route: state.route, routeStatus: state.routeStatus, routeIds: [...state.routeIds], guideRoute: state.guideRoute, guideStatus: state.guideStatus, visibleStores: visibleStores() });
  }
  function useDemoPosition(point) {
    if (!valid(point)) return;
    state.gpsGeneration += 1; state.gpsPending = false;
    state.position = { lat: point.lat, lng: point.lng, accuracy: 0, capturedAt: Date.now(), source: 'demo' };
    state.gpsMessage = '展示位置，非您的 GPS；可按定位返回實際位置。';
    focusPoint(point); if (state.destination) scheduleRoute(); else renderAll();
  }
  function renderFilters() {
    $('#category-filters').innerHTML = Object.entries(SERVICES).map(([key, label]) => { const on = state.filters.has(key); return `<button class="filter-chip ${on ? 'selected' : ''}" aria-pressed="${on}" data-service="${key}">${icon(on ? 'check' : key, 20)}<span>${label}</span></button>`; }).join('');
  }
  function renderPosition() {
    const p = state.position;
    $('#gps-button').disabled = state.gpsPending;
    $('#location-status').textContent = state.gpsPending ? '正在定位…' : p?.source === 'demo' ? '展示位置 · 非您的 GPS' : p ? `${p.accuracy > 100 ? '精度不足 · ' : ''}定位${p.accuracy !== null ? ` ±${Math.round(p.accuracy)} m` : '精度未知'} · ${timeText(p.capturedAt)}` : '目前非您的位置';
    const reason = String(state.gpsMessage || '').split('；')[0];
    const basis = state.gpsPending ? '正在定位…' : p?.source === 'demo' ? '依展示位置 · 非目前位置' : p ? `依目前位置${p.accuracy > 100 ? ' · 定位精度不足' : ''}` : `${reason || '定位未開啟'} · 依地圖中心估算`;
    $('#location-notice').innerHTML = `${esc(basis)}${p || state.gpsPending ? '' : ' <button class="text-button" data-action="gps">重新定位</button>'}`;
    if (gpsMarker) { map.removeLayer(gpsMarker); gpsMarker = null; }
    if (p) { const colors = palette(); gpsMarker = L.circleMarker([p.lat, p.lng], { radius: 8, color: colors.surface, weight: 3, fillColor: colors.accent, fillOpacity: 1, interactive: false }).addTo(map); }
  }
  function selectedCard(store) {
    const d = valid(store) ? distanceLabel(distance(pointForDistance(), store)) : '未提供座標';
    const cat = hitCategory(store) || store.services.find(key => Object.hasOwn(SERVICES, key)) || '';
    return `<div class="route-heading"><span class="route-kind">${icon('info', 17)} 資源資訊</span><button class="icon-button compact" data-action="clear" aria-label="關閉資源卡片">${icon('close')}</button></div><h2 class="resource-title">${esc(store.name)}</h2><p class="distance-value">${d}</p><p class="distance-caption">直線距離（非步行路線）${state.position ? '' : ' · 依地圖中心估算'}</p><div class="route-services">${serviceTags(store) || '服務未標示'}</div>${inferenceHtml(store)}${sourceHtml(store)}<div class="route-actions"><button class="primary-button" data-action="go" ${cat ? `data-cat="${cat}"` : ''} ${valid(store) ? '' : 'disabled'}>${icon('navigation', 19)}帶我去</button>${speakCategory(store) ? '<button class="secondary-button" data-action="speak">開口卡</button>' : ''}<button class="secondary-button" data-action="detail">詳細資訊</button></div>`;
  }
  const NO_CATEGORY_HTML = '<div class="empty-state" data-empty="no-category"><strong>先選一種服務</strong><p>點上面的類別，就會列出地圖視窗內的地點。</p></div>';
  function renderPanel() {
    const visible = visibleStores(); const store = byId.get(state.selectedId);
    const noCategory = state.filters.size === 0;
    $('#panel-summary').textContent = state.routeStatus === 'loading' ? '正在計算路線…' : state.routeStatus === 'ready' ? `沿線資源 · ${noCategory ? '尚未選類別' : `${visible.length} 筆`}` : `附近資源 · ${noCategory ? '尚未選類別' : `視窗內 ${visible.length} 筆`}`;
    $('#list-button').hidden = noCategory || visible.length <= 6; $('#list-button-label').textContent = `全部 ${visible.length} 筆`;
    $('#bottom-panel').classList.toggle('has-selection', Boolean(store)); $('#selected-card').hidden = !store; $('#nearby-preview').hidden = Boolean(store);
    if (store) $('#selected-card').innerHTML = selectedCard(store);
    else $('#nearby-preview').innerHTML = noCategory ? NO_CATEGORY_HTML : visible.length ? visible.slice(0, 6).map(row).join('') : `<p class="empty-copy">${state.routeStatus === 'ready' ? '沿線沒有符合所選類別的資源，可試著調整類別。' : '視窗內沒有符合的資源，試著縮放地圖或搜尋其他地點。'}</p>`;
    if (state.activeSheet === 'list') {
      $('#sheet-title').textContent = state.routeStatus === 'ready' ? '沿線的資源' : '視窗內的資源';
      $('#sheet-body').innerHTML = noCategory ? NO_CATEGORY_HTML : `<p class="field-note">${resourceScope()} ${visible.length} 筆 · 各資源距離為直線距離（非步行路線）${state.position ? '' : '，依地圖中心估算'}</p>${visible.map(row).join('') || `<p class="empty-copy">${resourceScope()}沒有符合的資源。</p>`}`;
    }
  }
  function setText(selector, text) { const el = $(selector); if (el) el.textContent = text; }
  function renderGuidance() {
    const store = state.mode === 'resource' ? byId.get(state.selectedId) : null; const position = state.position;
    const pointing = Boolean(store && valid(store) && position); const arrow = $('#guide-arrow');
    if (arrow) { arrow.style.transform = pointing ? `rotate(${arrowRotation(position, store)}deg)` : 'rotate(0deg)'; arrow.dataset.ready = String(pointing); }
    setText('#guidance-heading', store ? (resultStore()?.id === store.id && URGENCIES[state.urgency]?.title) || '前往選取的資源' : '身邊的友善導引');
    setText('#guidance-title', store ? store.name : '探索附近資源');
    // 步行路線算好後大字換成步行距離（與廁所步行卡同一個 guideRoute），直線退到方向那行。
    const route = store ? state.guideRoute : null; const walk = $('#guide-walk');
    const straight = pointing ? `直線 ${approx()}${distanceLabel(distance(position, store))}` : '';
    setText('#guidance-distance', store ? !valid(store) ? '未提供座標' : position ? route ? `步行 ${distanceLabel(route.distanceM)}` : straight : '需要定位' : `視窗內 ${visibleStores().length} 筆`);
    setText('#guidance-bearing', store ? !valid(store) ? '無法計算方向，請選擇有座標的資源' : position ? `${route ? `${straight} · ` : ''}${directionName(bearing(position, store))}方 · 正北基準 · ${state.orientationEnabled ? state.orientationMessage : '未使用方位感測'}` : '需要定位才能顯示方向' : '點選資源查看資訊；未規劃行走路線');
    const toiletGuide = Boolean(store && state.urgency === 'toilet' && store.services.includes('toilet'));
    if (walk) { walk.hidden = !route || toiletGuide; walk.textContent = route ? `約 ${Math.ceil(route.estimateMinutes)} 分鐘 · 本機路網估算，未驗證入口` : ''; }
    if ($('#guide-retry')) $('#guide-retry').hidden = !(store && state.guideStatus === 'error');
    if ($('#guide-orientation')) $('#guide-orientation').hidden = !pointing || state.orientationEnabled;
    setText('#guidance-location', position?.source === 'demo' ? '展示位置 · 非您的 GPS' : position ? `${position.accuracy > 100 ? '精度不足 · ' : ''}定位${position.accuracy !== null ? ` ±${Math.round(position.accuracy)} m` : '精度未知'} · ${timeText(position.capturedAt)}` : state.gpsPending ? '正在定位…' : state.gpsMessage || '尚未取得位置，請使用定位按鈕重試');
    if ($('#guidance-detail')) $('#guidance-detail').hidden = !store;
    if (!store && state.destination) {
      setText('#guidance-title', state.destination.name);
      setText('#guidance-distance', state.route ? `步行約 ${distanceLabel(state.route.distanceM)}` : state.routeMessage);
      setText('#guidance-bearing', state.route ? `沿線 ${visibleStores().length} 筆 · 路線兩側250m，非可達保證；虛線為估計接線。` : '本機臺北市步行路網');
    }
  }
  // card 是覆蓋層：畫面與 #app[data-view] 取來源 base（result 或 map），地圖版面不重排。
  function setView(view, base) {
    if (!VIEWS.includes(view)) return;
    const screen = view === 'card' ? (base === 'map' ? 'map' : 'result') : view;
    state.externalGeneration += 1; closeSheet(); state.view = view; state.screen = screen; $('#app').dataset.view = screen;
    if ($('#home-screen')) $('#home-screen').hidden = screen !== 'home';
    if (screen === 'home') urgencyButtons().forEach(el => el.classList.remove('is-latched'));
    if ($('#result-screen')) $('#result-screen').hidden = screen !== 'result';
    if ($('#explore-screen')) $('#explore-screen').hidden = !['guide', 'map'].includes(screen);
    window.scrollTo?.(0, 0);
    renderGuidance(); renderMapLayout(); syncHighlights();
    requestAnimationFrame(() => { if (state.screen !== screen) return; if (['guide', 'map'].includes(screen)) map.invalidateSize({ animate: false }); if (state.route && screen === 'map') fitDestinationRoute(); if (view !== 'card' && !state.activeSheet && document.documentElement.dataset.input === 'keyboard') $(focusTarget())?.focus({ preventScroll: true }); });
  }
  function clearResource() { state.externalGeneration += 1; state.selectedId = null; state.mode = 'free'; closeSheet(); renderAll(); }
  function guidePadding() {
    const size = map.getSize(); const stage = $('#map-stage').getBoundingClientRect();
    const top = Math.min(size.y * .45, Math.max(96, $('#guidance-hud').getBoundingClientRect().bottom - stage.top + 16));
    const bottom = Math.min(size.y * .4, Math.max(96, stage.bottom - $('#guidance-controls').getBoundingClientRect().top + 16));
    return { paddingTopLeft: [36, top], paddingBottomRight: [36, bottom], maxZoom: 17, animate: false };
  }
  // guide 以 [位置, 目的資源] 或成功後的 guide 步行路線 fit；沒有資源時才沿用目的地路線。
  function focusGuidance() {
    const store = state.mode === 'resource' ? byId.get(state.selectedId) : null;
    if (store && state.position && valid(store)) map.fitBounds(state.guideRoute ? state.guideRoute.coordinates : [[state.position.lat, state.position.lng], [store.lat, store.lng]], guidePadding());
    else if (!store && state.route) fitDestinationRoute();
    else if (state.position) focusPoint(state.position);
  }
  // 「結束導引」回到進導引前那一筆；導引中換過目標也一次離開。返回鍵與系統返回仍一步一步退。
  function endGuidance() {
    const exitDepth = window.history?.state?.exitDepth; const depth = currentDepth();
    if (Number.isInteger(exitDepth) && exitDepth >= 0 && exitDepth < depth) window.history.go(exitDepth - depth); else goBack();
  }
  const guideStore = () => state.screen === 'guide' && state.mode === 'resource' ? byId.get(state.selectedId) || null : null;
  function arrowRotation(position, store) { const angle = bearing(position, store); return state.orientationEnabled && state.heading !== null ? angle - state.heading : angle; }
  const approx = () => state.position?.accuracy > 100 ? '約 ' : '';
  function drawGuideRoute() {
    guideRouteLayer.clearLayers(); const route = state.guideRoute; if (!route) return; const colors = palette();
    for (const segment of route.roadSegments) L.polyline(segment, { color: colors.route, weight: 6, opacity: .9, interactive: false }).addTo(guideRouteLayer);
    for (const connector of route.connectors) L.polyline(connector, { color: colors.connector, weight: 4, dashArray: '4 7', opacity: .8, interactive: false }).addTo(guideRouteLayer);
  }
  function guideChanged() { renderGuidance(); syncHighlights(); }
  // 獨立的 guideRouteClient／guideGeneration：不和目的地路線互相取消；只在進入 guide、重試、或等待定位後計算一次。
  async function scheduleGuideRoute(store) {
    state.guideGeneration += 1; const generation = state.guideGeneration; guideRouteClient?.cancel(); state.guideRoute = null; state.guideMessage = ''; guideRouteLayer.clearLayers();
    if (!valid(store)) { state.guideStatus = 'unavailable'; guideChanged(); return; }
    if (!state.position || state.gpsPending) { state.guideStatus = 'waiting-location'; guideChanged(); return; }
    state.guideStatus = 'loading'; guideChanged();
    try {
      if (!window.FriendlyRouteClient) throw new Error('本機路由程式未載入');
      guideRouteClient ||= window.FriendlyRouteClient.createClient();
      const route = await guideRouteClient.route({ points: [state.position, store].map(point => ({ lat: point.lat, lng: point.lng })), stores: [], radius: 250 });
      if (generation !== state.guideGeneration || guideStore()?.id !== store.id) return;
      state.guideRoute = route; state.guideStatus = 'ready'; drawGuideRoute(); guideChanged();
      if (state.urgency === 'toilet' && store.services.includes('toilet')) highlights?.openToilet?.(store, route);
      requestAnimationFrame(() => { if (generation === state.guideGeneration && state.screen === 'guide') focusGuidance(); });
    } catch (error) {
      if (generation !== state.guideGeneration) return;
      state.guideStatus = 'error'; state.guideMessage = error.message || '本機步行路線暫時無法計算'; guideChanged();
    }
  }
  function enterGuide(store) { if (map.hasLayer(destinationRouteLayer)) map.removeLayer(destinationRouteLayer); scheduleGuideRoute(store); }
  function leaveGuide() {
    state.guideGeneration += 1; guideRouteClient?.cancel(); state.guideRoute = null; state.guideStatus = 'idle'; state.guideMessage = ''; guideRouteLayer.clearLayers();
    if (!map.hasLayer(destinationRouteLayer)) destinationRouteLayer.addTo(map);
    highlights?.pauseGuide?.();
  }
  // 返回堆疊只存在 history.state：每筆 { view, base, urgency, storeId, category, index, depth }。
  const hasHistory = () => typeof window.history?.pushState === 'function';
  const currentDepth = () => hasHistory() && Number.isInteger(window.history.state?.depth) ? window.history.state.depth : 0;
  function pushScreen(entry) { const next = { ...entry, depth: currentDepth() + 1 }; if (hasHistory()) window.history.pushState(next, ''); applyScreen(next); }
  function replaceScreen(patch) { if (hasHistory() && window.history.state) window.history.replaceState({ ...window.history.state, ...patch }, ''); }
  function goBack() { if (currentDepth() > 0) window.history.back(); else applyScreen({ view: 'home', depth: 0 }); }
  function goHome() { const depth = currentDepth(); if (depth > 0) window.history.go(-depth); else applyScreen({ view: 'home', depth: 0 }); }
  function applyScreen(entry) {
    const next = entry && VIEWS.includes(entry.view) ? entry : { view: 'home', depth: 0 };
    window.FriendlySpeakCard?.closeSpeakCard({ silent: true });
    if (state.screen === 'guide') leaveGuide();
    state.urgency = Object.hasOwn(URGENCIES, next.urgency || '') ? next.urgency : null;
    const store = byId.get(String(next.storeId ?? ''));
    if (next.view === 'home') { setView('home'); renderHome(); return; }
    if (next.view === 'result' || (next.view === 'card' && next.base === 'result')) {
      if (!state.urgency) { setView('home'); renderHome(); return; }
      if (state.result?.urgency !== state.urgency || (!state.result.items.length && valid(state.position))) state.result = rankFor(state.urgency);
      state.resultIndex = Math.max(0, Math.min(Number(next.index) || 0, Math.max(0, state.result.items.length - 1)));
      setView(next.view, 'result'); renderResult();
      if (next.view === 'card') openCard(next);
      return;
    }
    if (next.view === 'guide') {
      // 重新載入時記憶體沒有結果清單：依 entry 重建，標題才能判斷是不是結果卡那一筆。
      if (state.urgency && state.result?.urgency !== state.urgency) { state.result = rankFor(state.urgency); state.resultIndex = Math.max(0, Number(next.index) || 0); }
      if (store) selectResource(store.id);
      setView('guide'); if (store) enterGuide(store);
      requestAnimationFrame(() => { if (state.screen === 'guide') focusGuidance(); });
      return;
    }
    if (store && state.selectedId !== store.id) selectResource(store.id);
    setView(next.view, 'map');
    if (next.view === 'card') { openCard(next); return; }
    requestAnimationFrame(() => { if (state.screen === 'map' && store && state.selectedId === store.id && valid(store)) focusPoint(store); });
  }
  function initScreen() {
    const saved = hasHistory() ? window.history.state : null;
    if (saved && VIEWS.includes(saved.view) && Number.isInteger(saved.depth)) { applyScreen(saved); return; }
    if (hasHistory()) window.history.replaceState({ view: 'home', depth: 0 }, '');
    applyScreen({ view: 'home', depth: 0 });
  }
  function locationLine() {
    const p = state.position;
    if (state.gpsPending) return '正在定位…';
    if (p?.source === 'demo') return '展示位置 · 非您的 GPS';
    if (p) return `${p.accuracy > 100 ? '精度不足 · ' : '已定位 · '}${p.accuracy !== null ? `±${Math.round(p.accuracy)} m` : '精度未知'} · ${timeText(p.capturedAt)}`;
    const reason = String(state.gpsMessage || '').replace(/；距離依地圖中心估算。$/, '');
    return !reason ? '尚未取得定位' : reason.startsWith('無法取得定位') ? reason : `無法取得定位 · ${reason}`;
  }
  function renderHome() {
    const el = $('#home-location'); if (!el) return;
    el.textContent = locationLine(); el.dataset.state = state.gpsPending ? 'pending' : state.position ? state.position.accuracy > 100 ? 'weak' : 'ok' : 'failed';
    $('#home-gps').disabled = state.gpsPending;
  }
  function rankFor(category) {
    const ranked = window.FriendlyUrgency ? window.FriendlyUrgency.rankNearest(stores, state.position, { category, stepFree: state.prefs.stepFree, limit: 3, distance }) : { items: [], stepFreeFallback: false };
    return { urgency: category, items: ranked.items, stepFreeFallback: ranked.stepFreeFallback };
  }
  const resultStore = () => state.result?.items[state.resultIndex]?.store || null;
  // 首頁按鈕：按住由 CSS :active 下沉，放開加 .is-latched 卡住，停 180ms 讓人看見卡住再換頁；回首頁時 setView 清掉。
  const urgencyButtons = () => [...document.querySelectorAll('[data-urgency]')];
  function pressUrgency(button) {
    const category = button.dataset.urgency;
    if (!Object.hasOwn(URGENCIES, category) || urgencyButtons().some(el => el.classList.contains('is-latched'))) return;
    button.classList.add('is-latched');
    try { navigator.vibrate?.([22, 40, 10]); } catch { /* Optional. */ }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { openUrgency(category); return; }
    setTimeout(() => { if (state.screen === 'home') openUrgency(category); }, 180);
  }
  function openUrgency(category) { if (!Object.hasOwn(URGENCIES, category)) return; state.urgency = category; state.result = rankFor(category); pushScreen({ view: 'result', urgency: category, index: 0 }); }
  function nextResult() { if (!state.result || state.resultIndex + 1 >= state.result.items.length) return; state.resultIndex += 1; replaceScreen({ index: state.resultIndex }); renderResult(); }
  function renderResult() {
    const body = $('#result-body'); const meta = URGENCIES[state.urgency]; if (!body || !meta) return;
    setText('#result-title', meta.title);
    if (!valid(state.position)) {
      body.innerHTML = `<section class="result-empty" data-result="need-location"><span class="result-empty-icon">${icon('location', 34)}</span><h2>需要定位才能找最近</h2><p>${esc(state.gpsPending ? '正在取得定位，完成後自動顯示最近一筆…' : `${locationLine()}。不以地圖中心推估。`)}</p><div class="result-actions"><button class="primary-button" data-action="gps" ${state.gpsPending ? 'disabled' : ''}>${icon('location', 19)}重新定位</button><button class="secondary-button" data-action="map">${icon('compass', 19)}看地圖</button></div></section>`;
      return;
    }
    const store = resultStore();
    if (!store) { body.innerHTML = `<section class="result-empty" data-result="empty"><h2>名冊內沒有${esc(meta.label)}點位</h2><p>可改從地圖查看其他資源。</p><div class="result-actions"><button class="secondary-button" data-action="map">${icon('compass', 19)}看地圖</button></div></section>`; return; }
    const total = state.result.items.length; const angle = bearing(state.position, store); const accessible = store.services.includes('accessible'); const hasNext = state.resultIndex + 1 < total;
    body.innerHTML = `<article class="result-card" data-result-id="${esc(store.id)}"><p class="result-rank">直線第 ${state.resultIndex + 1} 近 · 共 ${total} 筆候選</p><h2 class="result-name">${esc(store.name)}</h2><p class="result-address">${esc(store.address || '地址待確認')}</p><div class="result-metric"><span class="result-arrow" style="transform:rotate(${angle}deg)">${icon('arrowNorth', 30)}</span><div><strong id="result-distance">直線 ${approx()}${distanceLabel(distance(state.position, store))}</strong><span>在您的${directionName(angle)}方 · 正北基準，非步行路線</span></div></div><div class="result-tags">${isInferred(store, state.urgency) ? `<span class="service-tag inferred">${icon(state.urgency, 16)}${esc(meta.label)} · 推定，請向現場確認</span>` : ''}<span class="service-tag ${accessible ? 'available' : 'unknown'}">${icon('accessible', 16)}無障礙 · ${accessible ? '有標示' : '未標示'}</span>${state.urgency === 'wifi' ? `<span class="service-tag unknown">${icon('wifi', 16)}免費 Wi-Fi 熱點，不保證訊號</span>` : ''}</div>${state.prefs.stepFree && state.result.stepFreeFallback ? `<p class="result-warning" role="status">無障礙資料不足：名冊中沒有標示無障礙的${esc(meta.label)}，先顯示最近一筆。</p>` : ''}${state.position.accuracy > 100 ? '<p class="field-note">定位精度不足，距離與方向可能有偏差。</p>' : ''}${sourceHtml(store)}<div class="result-actions"><button class="primary-button" data-action="go" data-cat="${esc(state.urgency)}" ${valid(store) ? '' : 'disabled'}>${icon('navigation', 19)}帶我去</button>${speakCategory(store) ? '<button class="secondary-button" data-action="speak">開口卡</button>' : ''}<button class="secondary-button" data-action="map">${icon('compass', 19)}看地圖</button>${phoneFor(store) ? `<button class="secondary-button" data-action="phone">${icon('phone', 19)}撥號</button>` : ''}</div><button class="text-button result-next" data-action="next" ${hasNext ? '' : 'disabled'}>${hasNext ? `換下一家（直線第 ${state.resultIndex + 2} 近）` : '已是最後一筆候選'}${icon('chevron', 16)}</button></article>`;
  }
  function refreshUrgencyScreens() {
    if (state.view === 'result' && state.urgency) { state.result = rankFor(state.urgency); state.resultIndex = 0; replaceScreen({ index: 0 }); renderResult(); }
    if (state.view === 'guide' && state.urgency && valid(state.position) && !state.result?.items.length) { state.result = rankFor(state.urgency); state.resultIndex = Math.max(0, Number(window.history?.state?.index) || 0); renderGuidance(); }
    const store = guideStore(); if (store && state.guideStatus === 'waiting-location' && state.position) scheduleGuideRoute(store);
  }
  function startGuide(store) { if (!valid(store)) return; if (state.urgency) { state.filters = new Set([state.urgency]); renderFilters(); } selectResource(store.id); const current = window.history?.state; const exitDepth = state.screen === 'guide' && Number.isInteger(current?.exitDepth) ? current.exitDepth : currentDepth(); pushScreen({ view: 'guide', urgency: state.urgency, storeId: store.id, index: state.resultIndex, exitDepth }); }
  function openMap() {
    if (state.screen === 'result' && state.urgency) {
      highlights?.close?.(); const store = resultStore(); state.filters = new Set([state.urgency]); renderFilters();
      if (store) selectResource(store.id);
      pushScreen({ view: 'map', urgency: state.urgency, storeId: store?.id ?? null });
    } else {
      // 從首頁進地圖一律是空狀態，不沿用上一趟結果卡留下的類別與選取。
      if (state.screen === 'home' && !state.urgency) { state.filters = new Set(); renderFilters(); clearResource(); }
      pushScreen({ view: 'map', urgency: state.urgency });
    }
  }
  // 開口卡類別：有急用類別且店家具備就用它，否則取店家第一個三急類別；三類都沒有就不出開口卡。
  function speakCategory(store) {
    // 公眾 Wi-Fi 熱點名冊沒有店員可出示，不出開口卡。
    if (!store || !window.FriendlySpeakCard || store.sourceId === 'wifi') return null;
    if (state.urgency && store.services.includes(state.urgency)) return state.urgency;
    return store.services.find(service => Object.hasOwn(URGENCIES, service)) || null;
  }
  function openSpeak() {
    const fromResult = state.screen === 'result'; const store = fromResult ? resultStore() : byId.get(state.selectedId); const category = speakCategory(store);
    if (!category) return;
    pushScreen({ view: 'card', base: fromResult ? 'result' : 'map', urgency: state.urgency, storeId: store.id, category, index: state.resultIndex });
  }
  function openCard(entry) {
    if (!window.FriendlySpeakCard || !Object.hasOwn(URGENCIES, entry.category || '')) return;
    try {
      const plan = window.FriendlySpeakCard.openSpeakCard({ category: entry.category, lang: state.prefs.lang, onClose: goBack });
      if (plan.fellBack || state.prefsNotice) { toast(state.prefsNotice || '所選母語尚未校對，先顯示中文單面。'); state.prefsNotice = ''; }
    } catch { toast('開口卡暫時無法開啟'); }
  }
  const availableLangs = () => window.FriendlySpeakCard?.getAvailableLangs() || [{ code: 'zh-TW', label: '中文' }];
  function savePref(key, value) { try { localStorage.setItem(key, value); } catch { /* Optional. */ } }
  function readPrefs() {
    let lang = 'zh-TW'; let stepFree = false; let notice = '';
    try {
      const stored = localStorage.getItem(LANG_KEY);
      if (stored && availableLangs().some(item => item.code === stored)) lang = stored;
      else if (stored) { notice = '先前選的母語尚未校對或無法使用，已改用中文單面。'; localStorage.removeItem(LANG_KEY); }
      stepFree = localStorage.getItem(STEP_FREE_KEY) === '1';
    } catch { /* Optional. */ }
    state.prefs = { lang, stepFree }; state.prefsNotice = notice;
  }
  function renderAll() { renderBasemapNotice(); renderPosition(); renderPanel(); renderDestinationRoute(); renderMarkers(); renderCache(); renderGuidance(); renderDetailsDistance(); renderHome(); if (state.screen === 'result') renderResult(); }
  function selectResource(id) { const store = byId.get(String(id)); if (!store) return; state.externalGeneration += 1; state.selectedId = store.id; state.mode = 'resource'; closeSheet(); renderPanel(); renderMarkers(); renderGuidance(); if (state.screen === 'guide') focusGuidance(); else if (valid(store)) focusPoint(store); if (!state.online && state.position && !isInBasemap(state.position)) showDirection(); }
  function focusPoint(point) { map.setView([point.lat, point.lng], Math.max(map.getZoom(), 17), { animate: false }); }
  async function requestPosition() {
    const generation = ++state.gpsGeneration; state.gpsPending = true; state.gpsMessage = ''; renderPosition(); renderGuidance(); renderHome(); if (state.view === 'result') renderResult(); syncHighlights();
    if (state.destination) scheduleRoute();
    try {
      const position = await FriendlyBridge.getLocation(); if (generation !== state.gpsGeneration) return;
      if (!valid(position)) throw Object.assign(new Error('Invalid location'), { code: 'GEO_FAILED' });
      state.position = position; state.gpsMessage = position.accuracy > 100 ? '定位精度不足，距離與方向可能有偏差。' : ''; if (state.screen === 'guide') focusGuidance(); else focusPoint(position);
    } catch (error) {
      if (generation !== state.gpsGeneration) return;
      const messages = { BRIDGE_LOCATION_FAILED: '無法取得定位', GEO_DENIED: '定位權限未開啟', GEO_TIMEOUT: '定位逾時', GEO_UNSUPPORTED: '此瀏覽器不支援定位', GEO_FAILED: '無法取得定位' };
      state.position = null; state.gpsMessage = `${messages[error.code] || '無法取得定位'}；距離依地圖中心估算。`;
    } finally { if (generation === state.gpsGeneration) { state.gpsPending = false; if (state.destination) scheduleRoute(); else renderAll(); if (state.activeSheet === 'direction') renderDirection(); refreshUrgencyScreens(); } }
  }
  function setDestination(place) {
    if (!valid(place)) { const record = byId.get(place.storeId || place.id); if (record) showDetails(record); toast('此資料未提供座標，無法在地圖標記。'); return; }
    state.destination = place; $('#search-label').textContent = place.name; $('#destination-clear').hidden = false; $('#destination-name').textContent = place.name;
    if (referenceMarker) map.removeLayer(referenceMarker);
    referenceMarker = L.marker([place.lat, place.lng], { icon: L.divIcon({ className: 'destination-map-pin', iconSize: [40, 40], iconAnchor: [20, 40], html: `<span title="${esc(place.name)}">${icon('flag', 24)}</span>` }) }).addTo(map);
    closeSheet(); focusPoint(place); scheduleRoute();
  }
  function localSearch(query) {
    const q = query.trim().toLowerCase(); return q ? stores.filter(s => `${s.name} ${s.address}`.toLowerCase().includes(q)).slice(0, 20).map(s => ({ ...s, storeId: s.id, source: 'catalog' })) : [];
  }
  function displaySearch(results, message) {
    state.searchResults = results; $('#search-message').textContent = message;
    $('#search-results').innerHTML = results.map((p, index) => `<button class="place-result" data-search-result="${index}"><span class="result-icon">${icon('location', 22)}</span><span><strong>${esc(p.name)}</strong><small>${esc(p.address || '地址待確認')}</small><small>${p.source === 'photon' ? 'OpenStreetMap · Photon' : esc(p.sourceName || '已下載資源')}${valid(p) ? '' : ' · 未提供座標'}</small></span>${icon('arrowUpRight', 18)}</button>`).join('');
  }
  function openSearch() {
    cancelSearch(); openSheet('搜尋目的地', `<form id="search-form" class="search-form"><span>${icon('search')}</span><input id="search-input" aria-label="搜尋目的地名稱或地址" placeholder="搜尋地點或地址" maxlength="120" autocomplete="off"><button id="search-submit" class="icon-button" type="submit" aria-label="搜尋目的地">${icon('arrowUpRight')}</button></form><p id="search-message" class="field-note" role="status"></p><div id="search-results"></div>`, 'search');
    $('#search-input').value = state.searchQuery; $('#search-input').focus(); displaySearch(localSearch(state.searchQuery), state.online ? '先搜尋已下載的資源，送出可找更多地點。' : '僅搜尋已下載資料');
    $('#search-input').addEventListener('input', event => { cancelSearch(); state.searchQuery = event.target.value; displaySearch(localSearch(state.searchQuery), state.online ? '已下載資源' : '僅搜尋已下載資料'); });
    $('#search-form').addEventListener('submit', async event => {
      event.preventDefault(); cancelSearch(); const generation = state.searchGeneration; const query = state.searchQuery.trim(); const local = localSearch(query);
      if (!state.online) { displaySearch(local, '僅搜尋已下載資料'); return; }
      if (query.length < 2) { displaySearch(local, '請輸入至少 2 個字'); return; }
      state.searchController = new AbortController(); $('#search-submit').disabled = true; displaySearch(local, '正在搜尋地點…');
      try { searchClient ||= FriendlySearch.createClient(); const remote = await searchClient.search(query, { signal: state.searchController.signal }); if (generation !== state.searchGeneration || state.activeSheet !== 'search' || !state.online) return; displaySearch([...local, ...remote], local.length || remote.length ? '選擇地點，查看附近資源' : '找不到地點，請試試完整地址'); }
      catch (error) { if (generation === state.searchGeneration && state.activeSheet === 'search' && error.name !== 'AbortError') displaySearch(local, local.length ? '線上搜尋暫時無法使用，仍可選擇已下載資源。' : '搜尋暫時無法使用，請稍後再試。'); }
      finally { if (generation === state.searchGeneration && $('#search-submit')) $('#search-submit').disabled = false; }
    });
  }
  function renderDetailsDistance() {
    const store = byId.get(state.detailId); if (state.activeSheet !== 'details' || !store) return;
    setText('#detail-distance', `直線距離（非步行路線）：${valid(store) ? distanceLabel(distance(pointForDistance(), store)) : '未提供座標'}${valid(store) && !state.position ? ' · 依地圖中心估算' : ''}${state.position?.accuracy > 100 ? ' · 定位精度不足，距離可能有偏差' : ''}`);
  }
  function showDetails(store) {
    if (!store) return; state.detailId = store.id;
    openSheet('資源資訊', `<div class="store-heading"><span class="store-category">${esc(store.sourceName)}</span><h2>${esc(store.name)}</h2><p>${esc(store.address || '地址待確認')}</p></div><div class="service-grid">${tags(store)}</div>${inferenceHtml(store)}<p class="field-note">現場使用條件、營業狀態與免消費條件：待確認。</p>${sourceHtml(store)}<div class="store-actions"><button class="secondary-button" data-copy="address">${icon('copy', 18)}複製地址</button>${store.phone ? `<button class="secondary-button" data-copy="phone">${icon('copy', 18)}複製電話</button>` : ''}</div>${store.phone ? `<p class="field-note">電話：${esc(store.phone)}</p>` : '<p class="field-note">電話未提供。</p>'}<p id="detail-distance" class="field-note">直線距離（非步行路線）：${valid(store) ? distanceLabel(distance(pointForDistance(), store)) : '未提供座標'}${valid(store) && !state.position ? ' · 依地圖中心估算' : ''}</p><button class="primary-button full-width" data-action="navigate" ${valid(store) ? '' : 'disabled'}>${icon('navigation', 20)}導航</button>${phoneFor(store) ? `<button class="secondary-button full-width" data-action="phone">${icon('phone', 20)}撥號</button>` : ''}${store.id === state.selectedId ? `<button class="secondary-button full-width" data-action="direction">${icon('compass', 20)}方向與距離</button>` : ''}<p id="external-message" class="field-note" role="status"></p>`, 'details'); renderDetailsDistance();
  }
  const actionResource = () => state.activeSheet === 'details' ? byId.get(state.detailId) : state.screen === 'result' ? resultStore() : byId.get(state.selectedId);
  async function externalAction(kind) {
    const store = actionResource(); if (!store) return; const generation = ++state.externalGeneration;
    if (!state.online) toast('此功能依賴外部程式或通話功能，離線時可能無法使用。');
    const buttons = document.querySelectorAll(`[data-action="${kind}"]`); buttons.forEach(button => { button.disabled = true; });
    try {
      const result = kind === 'navigate' ? await FriendlyBridge.navigate(store) : await FriendlyBridge.callPhone(phoneFor(store));
      if (generation !== state.externalGeneration || actionResource()?.id !== store.id) return;
      const message = result === 'unsupported' ? '需在台北通 App 內使用' : result === 'failed' ? kind === 'navigate' ? '無法開啟外部地圖' : '無法撥號' : kind === 'navigate' ? '已交由裝置開啟地圖' : '已交由裝置撥號';
      const offlineNote = state.online ? '' : '離線時此功能依賴外部程式或通話功能，可能無法使用。';
      toast(`${message}。${offlineNote}`); if (result !== 'opened') { showDetails(store); $('#external-message').textContent = `${message}。${offlineNote}可複製地址${store.phone ? '或電話' : ''}。`; }
    } catch { if (generation !== state.externalGeneration || actionResource()?.id !== store.id) return; toast(kind === 'navigate' ? '無法開啟外部地圖' : '無法撥號'); showDetails(store); $('#external-message').textContent = '操作未完成，請複製地址或電話後手動使用。'; } finally { buttons.forEach(button => { button.disabled = false; }); }
  }
  function renderDirection() {
    const store = byId.get(state.selectedId); if (!store || state.activeSheet !== 'direction') return;
    const body = $('#direction-content'); if (!body) return;
    if (!state.position || !valid(store)) { body.innerHTML = `<p class="empty-copy">需要定位才能指向${!valid(store) ? '，此資源未提供座標。' : '。'}</p><button class="primary-button" data-action="gps">重新定位</button>`; return; }
    const angle = bearing(state.position, store); const d = distance(state.position, store); const rotate = arrowRotation(state.position, store);
    body.innerHTML = `<div class="direction-compass"><span class="north-label">北</span><span class="direction-arrow" style="transform:rotate(${rotate}deg)">${icon('arrowNorth', 92)}</span></div><h3>${esc(store.name)}</h3><p class="direction-distance">${distanceLabel(d)}</p><p>店家在您的${directionName(angle)}方（以正北為基準）</p><p class="field-note">直線距離（非步行路線）<br>${esc(state.orientationMessage)}${state.position.accuracy > 100 ? '<br>定位精度不足，方向可能有偏差。' : ''}</p>`;
  }
  function showDirection() { openSheet('方向與距離', '<div id="direction-content" class="direction-content"></div><button class="secondary-button full-width" data-action="orientation">啟用裝置方向感測</button><p class="field-note">請依現場道路通行。箭頭不判斷障礙物或階梯。</p>', 'direction'); renderDirection(); }
  async function enableOrientation() {
    if (!window.DeviceOrientationEvent) { state.orientationMessage = '裝置不支援方位感測，以正北為基準'; renderDirection(); renderGuidance(); toast(state.orientationMessage); return; }
    try { if (typeof DeviceOrientationEvent.requestPermission === 'function' && await DeviceOrientationEvent.requestPermission() !== 'granted') throw new Error('denied'); state.orientationEnabled = true; state.orientationMessage = '等待方位感測；未取得前以正北為基準'; renderDirection(); renderGuidance(); }
    catch { state.orientationMessage = '未取得方位權限，以正北為基準'; renderDirection(); renderGuidance(); }
  }
  function orientation(event) {
    if (!state.orientationEnabled) return;
    const heading = Number.isFinite(event.webkitCompassHeading) ? event.webkitCompassHeading : event.absolute && Number.isFinite(event.alpha) ? (360 - event.alpha) % 360 : null;
    if (heading === null) return; state.heading = heading; state.orientationMessage = '箭頭依裝置方位調整，方位感測可能有誤差'; renderDirection(); if (state.screen === 'guide') renderGuidance();
  }
  function renderCache() {
    const cache = state.cache; $('#network-label').textContent = state.online ? '' : '離線';
    $('#cache-status').textContent = cache?.state === 'ready' ? `已快取 ${timeText(cache.savedAt)} · 底圖限${BASEMAP_REGION_NAMES}` : cache?.state === 'downloading' ? `下載離線資料 ${cache.completed}/${cache.total}` : cache?.state === 'partial' ? '快取未完整 · 可在設定重試' : cache?.state === 'unsupported' ? '此環境不支援離線快取' : state.online ? '準備離線資料' : '離線資料尚未確認';
    $('#cache-status').title = `全市資源點位；離線底圖限${BASEMAP_REGION_NAMES}`;
    setText('#home-cache', state.online ? $('#cache-status').textContent : `離線 · ${$('#cache-status').textContent}`);
    if (state.activeSheet === 'settings') renderSettingsCache();
  }
  function renderSettingsCache() {
    const el = $('#settings-cache'); if (!el) return; const cache = state.cache;
    el.innerHTML = `<p class="field-note">${cache?.state === 'ready' ? `已快取 · ${new Date(cache.savedAt).toLocaleString('zh-TW')}` : '快取尚未完整'}<br>點位：臺北市資料聯集<br>離線底圖：${esc(BASEMAP_REGION_NAMES)}<br>其他區域離線可查看點位與方向距離。</p>${cache?.failures?.length ? `<p class="field-note">未完成：${cache.failures.map(f => esc(f.label || f.asset)).join('、')}</p>` : ''}`;
  }
  function openSettings() {
    openSheet('設定', `<section class="setting-section"><h3>母語（開口卡下半）</h3><div class="segmented">${availableLangs().map(item => `<button data-lang-choice="${esc(item.code)}" aria-pressed="${state.prefs.lang === item.code}">${esc(item.label)}</button>`).join('')}</div><p class="field-note">${state.prefsNotice ? `${esc(state.prefsNotice)}<br>` : ''}只列已由母語者校對的語言，其他語言待校對；母語為中文時開口卡只顯示單面。只存在本機。</p></section><section class="setting-section"><h3>輪椅／推車</h3><div class="segmented"><button data-step-free-choice="1" aria-pressed="${state.prefs.stepFree}">${icon('accessible', 20)}優先無障礙</button><button data-step-free-choice="0" aria-pressed="${!state.prefs.stepFree}">不限</button></div><p class="field-note">開啟後只挑標示無障礙的地點；沒有時顯示最近一筆並註明「無障礙資料不足」。無障礙標籤指設施，不代表沿途無障礙。只存在本機。</p></section><section class="setting-section"><h3>地圖外觀</h3><div class="segmented"><button data-theme-choice="dark" aria-pressed="${state.theme === 'dark'}">${icon('moon', 20)}深色</button><button data-theme-choice="light" aria-pressed="${state.theme === 'light'}">${icon('sun', 20)}淺色</button></div></section><section class="setting-section"><h3>離線資料</h3><div id="settings-cache"></div><button class="secondary-button" data-action="cache">${icon('download', 19)}重新檢查與下載</button></section><section class="setting-section"><h3>目前位置</h3><p class="field-note">${state.position ? `精度：${state.position.accuracy === null ? '未知' : `${Math.round(state.position.accuracy)} 公尺`}<br>取得時間：${timeText(state.position.capturedAt)}` : '目前非您的位置，距離依地圖中心估算。'}</p><button class="secondary-button" data-action="gps">${icon('location', 20)}重新定位</button></section><details class="data-disclosure"><summary>資料來源與授權</summary>${data.sources.map(source => `<p><a href="${esc(source.url || source.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(source.name || source.sourceName)}</a><br>更新日期：${esc(dateText(source.updatedAt))}</p>`).join('')}<p>OpenStreetMap contributors（ODbL）；離線底圖快照：信義／大安東 2026-11-07、北投學園路 2026-11-08。Photon 地點搜尋為 OpenStreetMap 資料。</p><a href="https://photon.komoot.io" target="_blank" rel="noopener noreferrer">Photon 搜尋</a><p>橘色「推定」只補充既有官方點位的常見服務，不是單店官方保證，也不新增店家位置；可能需消費、付費或借用，且分店有差異。</p><p>無障礙標籤指設施，不代表沿途無障礙。名冊不提供即時營業或免消費保證。</p><a href="./NOTICE.txt" target="_blank">資料與第三方元件聲明</a></details>`, 'settings'); renderSettingsCache();
  }
  async function cacheData() { state.cache = await FriendlyOffline.initialize(status => { state.cache = status; renderCache(); }); renderCache(); }
  async function copyValue(key) { const store = actionResource(); const value = store?.[key]; if (!value) { toast('資料未提供'); return; } try { await navigator.clipboard.writeText(value); toast(key === 'phone' ? '已複製電話' : '已複製地址'); } catch { toast('無法自動複製，請長按卡片文字複製。'); } }
  function setTheme(theme) { state.theme = theme; document.documentElement.dataset.theme = theme; try { localStorage.setItem('friendly-theme-v6', theme); } catch { /* Optional. */ } drawBasemap(); renderPosition(); renderMarkers(); if (state.activeSheet === 'settings') openSettings(); }
  document.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.resource) openResource(button.dataset.resource);
    if (button.dataset.urgency) pressUrgency(button);
    if (button.dataset.langChoice) { const code = button.dataset.langChoice; if (availableLangs().some(item => item.code === code)) { state.prefs = { ...state.prefs, lang: code }; state.prefsNotice = ''; savePref(LANG_KEY, code); openSettings(); } }
    if (button.dataset.stepFreeChoice) { state.prefs = { ...state.prefs, stepFree: button.dataset.stepFreeChoice === '1' }; savePref(STEP_FREE_KEY, state.prefs.stepFree ? '1' : '0'); openSettings(); }
    if (button.dataset.service) { const service = button.dataset.service; state.filters.has(service) ? state.filters.delete(service) : state.filters.add(service); renderFilters(); renderPanel(); renderDestinationRoute(); renderMarkers(); renderGuidance(); if (document.documentElement.dataset.input === 'keyboard') document.querySelector(`[data-service="${service}"]`)?.focus({ preventScroll: true }); }
    if (button.dataset.searchResult !== undefined) setDestination(state.searchResults[Number(button.dataset.searchResult)]);
    if (button.dataset.themeChoice) setTheme(button.dataset.themeChoice);
    if (button.dataset.copy) copyValue(button.dataset.copy);
    const action = button.dataset.action; if (!action) return;
    if (action === 'gps') requestPosition();
    else if (action === 'clear') clearResource();
    else if (action === 'detail') showDetails(byId.get(state.selectedId));
    else if (action === 'navigate' || action === 'phone') externalAction(action);
    else if (action === 'direction') showDirection();
    else if (action === 'orientation') enableOrientation();
    else if (action === 'cache') cacheData();
    else if (action === 'go') startGuide(state.screen === 'result' ? resultStore() : byId.get(state.selectedId));
    else if (action === 'speak') openSpeak();
    else if (action === 'map') openMap();
    else if (action === 'next') nextResult();
  });
  $('#sheet-close').addEventListener('click', closeSheet); $('#app-sheet').addEventListener('cancel', event => { event.preventDefault(); closeSheet(); });
  let backdropPointer = false; $('#app-sheet').addEventListener('pointerdown', event => { const bounds = $('#app-sheet').getBoundingClientRect(); backdropPointer = event.target === $('#app-sheet') && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom); });
  $('#app-sheet').addEventListener('click', event => { if (backdropPointer && event.target === $('#app-sheet')) closeSheet(); backdropPointer = false; });
  $('#search-trigger').addEventListener('click', openSearch); $('#settings-button').addEventListener('click', openSettings);
  $('#list-button').addEventListener('click', () => { openSheet('視窗內的資源', '', 'list'); renderPanel(); });
  $('#gps-button').addEventListener('click', requestPosition); $('#overview-button').addEventListener('click', () => map.setView([25.06, 121.55], 12, { animate: false }));
  $('#route-retry').addEventListener('click', () => { if (!state.position) requestPosition(); else scheduleRoute(); });
  $('#map-expand').addEventListener('click', () => { state.mapExpanded = !state.mapExpanded; refreshMapLayout(); });
  $('#panel-toggle').addEventListener('click', () => { state.panelCollapsed = !state.panelCollapsed; refreshMapLayout(); });
  $('#home-button').addEventListener('click', event => { event.preventDefault(); goHome(); });
  $('#home-map').addEventListener('click', openMap); $('#home-settings').addEventListener('click', openSettings);
  $('#result-back').addEventListener('click', goBack); $('#map-back').addEventListener('click', goBack);
  $('#guide-retry').addEventListener('click', () => { const store = guideStore(); if (store) scheduleGuideRoute(store); });
  window.addEventListener('popstate', event => applyScreen(event.state));
  $('#exit-guidance')?.addEventListener('click', goBack);
  $('#guidance-end')?.addEventListener('click', endGuidance);
  $('#guidance-detail')?.addEventListener('click', () => showDetails(byId.get(state.selectedId)));
  $('#guidance-resources')?.addEventListener('click', () => { openSheet('視窗內的資源', '', 'list'); renderPanel(); });
  $('#destination-clear').addEventListener('click', () => { state.destination = null; if (referenceMarker) map.removeLayer(referenceMarker); referenceMarker = null; $('#destination-clear').hidden = true; $('#search-label').textContent = '想去哪裡？'; cancelDestinationRoute(); renderAll(); });
  map.on('moveend zoomend', () => { cancelAnimationFrame(viewportFrame); viewportFrame = requestAnimationFrame(() => { syncOnlineTiles(); renderPanel(); renderMarkers(); renderGuidance(); renderDetailsDistance(); }); });
  new ResizeObserver(() => map.invalidateSize({ animate: false })).observe($('#map-stage'));
  function connectivity() { state.online = navigator.onLine; cancelSearch(); syncOnlineTiles(); renderAll(); if (state.activeSheet === 'search') openSearch(); if (state.online) cacheData(); }
  window.addEventListener('online', connectivity); window.addEventListener('offline', connectivity);
  window.addEventListener('deviceorientationabsolute', orientation); window.addEventListener('deviceorientation', orientation);
  document.addEventListener('keydown', () => { document.documentElement.dataset.input = 'keyboard'; }); document.addEventListener('pointerdown', () => { document.documentElement.dataset.input = 'pointer'; });
  try { if (localStorage.getItem('friendly-theme-v6') === 'dark') state.theme = 'dark'; } catch { /* Optional. */ }
  readPrefs();
  highlights = window.FriendlyHighlights?.create({ map, stores, icon, escapeHtml: esc, distance, guideHost: $('#guide-timer'),
    onSelectResource: store => selectResource(store.id), onShowDetails: showDetails, onRequestPosition: requestPosition,
    onUseDemoPosition: useDemoPosition, onOpenExplore: () => { state.panelCollapsed = false; if (state.screen === 'map') refreshMapLayout(); else pushScreen({ view: 'map', urgency: state.urgency }); } });
  $('#highlight-map-launch')?.addEventListener('click', () => highlights?.open('wifi'));
  document.documentElement.dataset.theme = state.theme; updateIcons(); drawBasemap(); syncOnlineTiles(); renderFilters(); renderAll(); initScreen();
  requestPosition(); cacheData();
})();
