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
  const TRANSPORTS = { walk: '步行', transit: '捷運', bike: '單車', car: '開車' };
  const SERVICES = { wifi: 'Wi-Fi', toilet: '廁所', charge: '充電', accessible: '無障礙' };
  const valid = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
  const stores = data.stores.map(s => ({ ...s, id: String(s.id) }));
  const byId = new Map(stores.map(s => [s.id, s]));
  const center = { lat: 25.0375, lng: 121.5637 };
  const state = { view: 'welcome', mode: 'free', transport: 'walk', detailId: null, position: null, gpsPending: false, gpsMessage: '', gpsGeneration: 0, filters: new Set(), selectedId: null, destination: null, route: null, routeIds: new Set(), routeStatus: 'idle', routeMessage: '', routeGeneration: 0, mapExpanded: false, panelCollapsed: false, online: navigator.onLine, searchGeneration: 0, searchController: null, searchQuery: '', searchResults: [], theme: 'light', heading: null, orientationEnabled: false, orientationMessage: '未使用方位感測，以正北為基準', activeSheet: null, cache: null, externalGeneration: 0 };
  let highlights; let toastTimer; let beforeSheet; let searchClient; let routeClient; let renderedRoute; let selectedLine; let selectedLineKey; let selectedMarker; let gpsMarker; let referenceMarker; let tileLayer; let viewportFrame;
  const map = L.map('map', { zoomControl: false, attributionControl: false, preferCanvas: true }).setView([center.lat, center.lng], 17);
  const attribution = L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);
  attribution.addAttribution('© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a> (ODbL)');
  L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
  const canvas = L.canvas({ padding: 0.5 });
  const resourceLayer = L.layerGroup().addTo(map);
  const iconLayer = L.layerGroup().addTo(map);
  const destinationRouteLayer = L.layerGroup().addTo(map);
  const markers = new Map();
  const geoLayers = [];
  function isInBasemap(point) { const b = basemap.bounds; return valid(point) && point.lat >= b[0][0] && point.lat <= b[1][0] && point.lng >= b[0][1] && point.lng <= b[1][1]; }
  function palette() { return state.theme === 'dark' ? { bg: '#171f1a', building: '#253129', road: '#46534b', park: '#2b3d2c', line: '#687763', accent: '#a89bff', muted: '#91a0b8' } : { bg: '#edf1f8', building: '#dfe6f2', road: '#ffffff', park: '#e1eddf', line: '#cad3e4', accent: '#3525cd', muted: '#8e9db4' }; }
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
    const bounds = map.getBounds(); const localView = isInBasemap(bounds.getSouthWest()) && isInBasemap(bounds.getNorthEast());
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
  const matches = store => !state.filters.size || store.services.some(service => state.filters.has(service));
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
    const restore = beforeSheet?.isConnected && !beforeSheet.closest('dialog') ? beforeSheet : $(state.view === 'welcome' ? '#enter-app' : state.view === 'guidance' ? '#exit-guidance' : '#search-trigger');
    if (document.documentElement.dataset.input === 'keyboard') restore?.focus({ preventScroll: true });
    else document.activeElement?.blur?.();
  }
  function openSheet(title, html, name) {
    state.externalGeneration += 1; beforeSheet = document.activeElement; state.activeSheet = name; $('#app-sheet').dataset.sheet = name === 'details' ? 'detail' : name; $('#sheet-title').textContent = title; $('#sheet-body').innerHTML = html;
    updateIcons($('#sheet-body')); if (!$('#app-sheet').open) $('#app-sheet').showModal();
  }
  function dateText(value) { return value ? String(value).slice(0, 10) : '待確認'; }
  function timeText(time) { return new Date(time).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }); }
  function tags(store) { return Object.keys(SERVICES).map(key => `<span class="service-tag ${store.services.includes(key) ? 'available' : 'unknown'}">${icon(key, 16)}${SERVICES[key]}${store.services.includes(key) ? '' : ' · 未標示'}</span>`).join(''); }
  function phoneFor(store) { return typeof store.normalizedPhone === 'string' && /^\+?\d{8,15}$/.test(store.normalizedPhone) ? store.normalizedPhone : null; }
  function sourceHtml(store) { return `<p class="source-line">來源：<a href="${esc(store.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(store.sourceName)}</a><br>資料更新：${esc(dateText(store.updatedAt))}</p>`; }
  function row(store) {
    const d = valid(store) ? distanceLabel(distance(pointForDistance(), store)) : '未提供座標';
    return `<button class="resource-row" data-resource="${esc(store.id)}"><span class="resource-symbol">${icon(store.services.find(s => state.filters.has(s)) || store.services[0] || 'info', 23)}</span><span class="resource-copy"><strong>${esc(store.name)}</strong><span class="resource-card-address">${esc(store.address || '地址待確認')}</span><span class="resource-card-services">${store.services.map(key => `<span>${icon(key, 15)}${SERVICES[key]}</span>`).join('') || '服務未標示'}</span><span class="resource-card-meta"><span class="resource-card-source">${esc(store.sourceName)}</span><span class="resource-card-updated">更新 ${esc(dateText(store.updatedAt))}</span></span></span><span class="resource-distance">直線 ${d}${icon('chevron', 15)}</span></button>`;
  }
  function renderResourceLine() {
    const store = byId.get(state.selectedId);
    const key = state.mode === 'resource' && state.position && valid(store) ? `${state.position.lat},${state.position.lng}:${store.id}` : null;
    if (selectedLineKey === key) return;
    if (selectedLine) { map.removeLayer(selectedLine); selectedLine = null; }
    selectedLineKey = key;
    if (!key) return;
    selectedLine = L.polyline([[state.position.lat, state.position.lng], [store.lat, store.lng]], { color: '#ff5e3a', weight: 4, dashArray: '7 9', opacity: .8, interactive: false }).addTo(map);
  }
  function renderDestinationRoute() {
    if (renderedRoute !== state.route) {
      destinationRouteLayer.clearLayers(); renderedRoute = state.route;
      if (state.route) {
        for (const segment of state.route.roadSegments) L.polyline(segment, { color: '#ff5e3a', weight: 5, opacity: .95, interactive: false }).addTo(destinationRouteLayer);
        for (const connector of state.route.connectors) L.polyline(connector, { color: '#ff5e3a', weight: 4, dashArray: '4 7', opacity: .8, interactive: false }).addTo(destinationRouteLayer);
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
      requestAnimationFrame(() => { if (generation === state.routeGeneration && state.view !== 'welcome') fitDestinationRoute(); });
    } catch (error) {
      if (generation !== state.routeGeneration) return;
      state.routeStatus = 'error'; state.routeMessage = error.name === 'AbortError' ? '路線計算已取消，可重新計算。' : error.message || '無法計算目的地路線，請重試。'; renderAll();
    }
  }
  function fitDestinationRoute() {
    if (!state.route) return;
    const size = map.getSize(); const stage = $('#map-stage').getBoundingClientRect();
    const status = $(state.view === 'guidance' ? '#guidance-hud' : '#map-status').getBoundingClientRect();
    const top = Math.max(96, status.bottom - stage.top + 18);
    let bottom = 32; let right = 32;
    if (state.mapExpanded && state.view === 'explore') {
      const panel = $('#bottom-panel').getBoundingClientRect();
      if (panel.width < size.x * .65 && panel.left >= stage.left + size.x * .4) right = panel.width + 36;
      else bottom = Math.min(size.y * .48, panel.height + 24);
    }
    if (state.view === 'guidance') bottom = 115;
    map.fitBounds(state.route.coordinates, { paddingTopLeft: [32, top], paddingBottomRight: [right, bottom], maxZoom: 17, animate: false });
  }
  function renderMapLayout() {
    $('#app').classList.toggle('map-expanded', state.mapExpanded && state.view === 'explore');
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
  function openResource(id) { if (!byId.has(String(id))) return; selectResource(id); const store = byId.get(state.selectedId); if (!highlights?.handleResource(store)) showDetails(store); }
  function renderMarkers() {
    renderResourceLine();
    const colors = palette();
    for (const store of stores) {
      if (!valid(store)) continue;
      const match = matches(store) && matchesRoute(store); const active = (state.filters.size > 0 || state.routeStatus === 'ready') && match;
      let marker = markers.get(store.id);
      if (!marker) { marker = L.circleMarker([store.lat, store.lng], { renderer: canvas }).on('click', () => openResource(store.id)).addTo(resourceLayer); markers.set(store.id, marker); }
      marker.setStyle({ radius: active ? 7 : 4, color: active ? colors.accent : colors.muted, weight: active ? 2 : 1, opacity: match ? .9 : .2, fillColor: active ? colors.accent : colors.muted, fillOpacity: match ? .72 : .15 });
    }
    iconLayer.clearLayers();
    if (map.getZoom() >= 14.5) {
      const candidates = visibleStores().filter(s => isVisible(s) && s.id !== state.selectedId).slice(0, 60); const cells = new Set();
      for (const store of candidates) {
        const p = map.latLngToContainerPoint([store.lat, store.lng]); const cell = `${Math.floor(p.x / 52)},${Math.floor(p.y / 52)}`; if (cells.has(cell)) continue; cells.add(cell);
        const key = store.services.find(s => state.filters.has(s)) || store.services[0] || 'info';
        L.marker([store.lat, store.lng], { icon: L.divIcon({ className: 'resource-map-pin', iconSize: [44, 44], iconAnchor: [22, 22], html: `<button aria-label="${esc(store.name)}">${icon(key, 22)}</button>` }), keyboard: false }).on('click', () => openResource(store.id)).addTo(iconLayer);
      }
    }
    if (selectedMarker) map.removeLayer(selectedMarker);
    const selected = byId.get(state.selectedId);
    if (valid(selected)) selectedMarker = L.marker([selected.lat, selected.lng], { icon: L.divIcon({ className: 'resource-map-pin is-selected', iconSize: [48, 48], iconAnchor: [24, 24], html: `<button aria-label="${esc(selected.name)}，已選取">${icon(selected.services.find(s => state.filters.has(s)) || selected.services[0] || 'info', 24)}</button>` }), keyboard: false, zIndexOffset: 1000 }).on('click', () => openResource(selected.id)).addTo(map);
    syncHighlights();
  }
  function syncHighlights() {
    highlights?.update({ view: state.view, theme: state.theme, position: state.position, gpsPending: state.gpsPending,
      selectedStore: byId.get(state.selectedId) || null, filters: [...state.filters], destination: state.destination,
      route: state.route, routeStatus: state.routeStatus, routeIds: [...state.routeIds], visibleStores: visibleStores() });
  }
  function useDemoPosition(point) {
    if (!valid(point)) return;
    state.gpsGeneration += 1; state.gpsPending = false;
    state.position = { lat: point.lat, lng: point.lng, accuracy: 0, capturedAt: Date.now(), source: 'demo' };
    state.gpsMessage = '展示位置，非您的 GPS；可按定位返回實際位置。';
    focusPoint(point); if (state.destination) scheduleRoute(); else renderAll();
  }
  function renderFilters() {
    $('#category-filters').innerHTML = Object.entries(SERVICES).map(([key, label]) => `<button class="filter-chip ${state.filters.has(key) ? 'selected' : ''}" aria-pressed="${state.filters.has(key)}" data-service="${key}">${icon(key, 21)}<span>${label}</span></button>`).join('');
  }
  function renderPosition() {
    const p = state.position;
    $('#gps-button').disabled = state.gpsPending;
    $('#location-status').textContent = state.gpsPending ? '正在定位…' : p?.source === 'demo' ? '展示位置 · 非您的 GPS' : p ? `${p.accuracy > 100 ? '精度不足 · ' : ''}定位${p.accuracy !== null ? ` ±${Math.round(p.accuracy)} m` : '精度未知'} · ${timeText(p.capturedAt)}` : '目前非您的位置';
    $('#location-kicker').textContent = p?.source === 'demo' ? '依展示位置計算 · 非目前位置' : p ? '依目前位置計算距離' : '依地圖中心估算 · 非目前位置';
    $('#location-notice').hidden = Boolean(p && !state.gpsMessage);
    $('#location-notice').innerHTML = p ? esc(state.gpsMessage) : `${esc(state.gpsMessage || '尚未取得位置；距離依地圖中心估算。')} <button class="text-button" data-action="gps">重新定位</button>`;
    if (gpsMarker) { map.removeLayer(gpsMarker); gpsMarker = null; }
    if (p) gpsMarker = L.circleMarker([p.lat, p.lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#3525cd', fillOpacity: 1, interactive: false }).addTo(map);
  }
  function selectedCard(store) {
    const d = valid(store) ? distanceLabel(distance(pointForDistance(), store)) : '未提供座標';
    return `<div class="route-heading"><span class="route-kind">${icon('info', 17)} 資源資訊</span><button class="icon-button compact" data-action="clear" aria-label="關閉資源卡片">${icon('close')}</button></div><h2 class="resource-title">${esc(store.name)}</h2><p class="distance-value">${d}</p><p class="distance-caption">直線距離（非步行路線）${state.position ? '' : ' · 依地圖中心估算'}</p><div class="route-services">${store.services.map(key => `<span>${icon(key, 16)}${SERVICES[key]}</span>`).join('') || '服務未標示'}</div>${sourceHtml(store)}<div class="route-actions"><button class="primary-button" data-action="navigate" ${valid(store) ? '' : 'disabled'}>${icon('navigation', 19)}導航</button>${phoneFor(store) ? `<button class="secondary-button" data-action="phone">${icon('phone', 19)}撥號</button>` : `<button class="secondary-button" data-action="detail">詳細資訊</button>`}</div><div class="card-bottom-actions"><button class="text-button" data-action="direction">方向與距離 ${icon('compass', 16)}</button><button class="text-button secondary-text" data-action="detail">店家資訊 ${icon('chevron', 16)}</button></div>`;
  }
  function renderPanel() {
    const visible = visibleStores(); const store = byId.get(state.selectedId);
    $('#visible-count').textContent = `${resourceScope()} ${visible.length} 筆`;
    $('#panel-summary').textContent = state.routeStatus === 'ready' ? `沿線資源 · ${visible.length} 筆` : state.routeStatus === 'loading' ? '正在計算路線…' : state.destination ? '目的地與附近資源' : '附近資源';
    $('#panel-heading').textContent = state.routeStatus === 'ready' ? '沿途的友善資源' : store ? '找到身邊的資源' : '友善，就在身邊';
    $('#bottom-panel').classList.toggle('has-selection', Boolean(store)); $('#selected-card').hidden = !store; $('#nearby-preview').hidden = Boolean(store);
    if (store) $('#selected-card').innerHTML = selectedCard(store);
    else $('#nearby-preview').innerHTML = visible.length ? visible.slice(0, 6).map(row).join('') : `<p class="empty-copy">${state.routeStatus === 'ready' ? '沿線沒有符合所選類別的資源，可試著調整類別。' : '視窗內沒有符合的資源，試著縮放地圖或搜尋其他地點。'}</p>`;
    if (state.activeSheet === 'list') {
      $('#sheet-title').textContent = state.routeStatus === 'ready' ? '沿線的資源' : '視窗內的資源';
      $('#sheet-body').innerHTML = `<p class="field-note">${resourceScope()} ${visible.length} 筆 · 各資源距離為直線距離（非步行路線）${state.position ? '' : '，依地圖中心估算'}</p>${visible.map(row).join('') || `<p class="empty-copy">${resourceScope()}沒有符合的資源。</p>`}`;
    }
  }
  function setText(selector, text) { const el = $(selector); if (el) el.textContent = text; }
  function renderMode() {
    const resource = state.mode === 'resource';
    setText('#mode-title', resource ? '資源引導模式' : '自由探索模式');
    setText('#mode-description', resource ? '查看資源方向' : '隨心探索附近資源');
    $('#mode-toggle')?.setAttribute('aria-pressed', String(resource));
    document.querySelectorAll('[data-transport]').forEach(button => { const selected = button.dataset.transport === state.transport; button.setAttribute('aria-pressed', String(selected)); button.classList.toggle('selected', selected); });
    setText('#transport-status', state.destination ? `偏好：${TRANSPORTS[state.transport]} · 目的地固定使用步行路網，未規劃捷運／單車／開車路線` : `偏好：${TRANSPORTS[state.transport]} · 直線距離，非步行／捷運／單車／開車路線`);
  }
  function renderGuidance() {
    const store = state.mode === 'resource' ? byId.get(state.selectedId) : null; const position = state.position;
    setText('#guidance-title', store ? store.name : '探索附近資源');
    setText('#guidance-distance', store ? !valid(store) ? '未提供座標' : position ? distanceLabel(distance(position, store)) : '需要定位' : `視窗內 ${visibleStores().length} 筆`);
    setText('#guidance-bearing', store ? !valid(store) ? '無法計算方向，請選擇有座標的資源' : position ? `${directionName(bearing(position, store))}方 · 正北基準 · 直線距離（非步行路線）` : '需要定位才能顯示方向' : '點選資源查看資訊；未規劃行走路線');
    setText('#guidance-location', position?.source === 'demo' ? '展示位置 · 非您的 GPS' : position ? `${position.accuracy > 100 ? '精度不足 · ' : ''}定位${position.accuracy !== null ? ` ±${Math.round(position.accuracy)} m` : '精度未知'} · ${timeText(position.capturedAt)}` : state.gpsPending ? '正在定位…' : state.gpsMessage || '尚未取得位置，請使用定位按鈕重試');
    if ($('#guidance-detail')) $('#guidance-detail').hidden = !store;
    if (!store && state.destination) {
      setText('#guidance-title', state.destination.name);
      setText('#guidance-distance', state.route ? `步行約 ${distanceLabel(state.route.distanceM)}` : state.routeMessage);
      setText('#guidance-bearing', state.route ? `沿線 ${visibleStores().length} 筆 · 路線兩側250m，非可達保證；虛線為估計接線。` : '本機臺北市步行路網');
    }
  }
  function setView(view) {
    if (!['welcome', 'explore', 'guidance'].includes(view)) return;
    state.externalGeneration += 1; closeSheet(); state.view = view; $('#app').dataset.view = view;
    if ($('#welcome-screen')) $('#welcome-screen').hidden = view !== 'welcome';
    if ($('#explore-screen')) $('#explore-screen').hidden = view === 'welcome';
    window.scrollTo?.(0, 0);
    renderMode(); renderGuidance(); renderMapLayout(); syncHighlights();
    requestAnimationFrame(() => { if (state.view !== view) return; map.invalidateSize({ animate: false }); if (state.route && view === 'explore') fitDestinationRoute(); if (!state.activeSheet && document.documentElement.dataset.input === 'keyboard') $(view === 'welcome' ? '#enter-app' : view === 'guidance' ? '#exit-guidance' : '#search-trigger')?.focus({ preventScroll: true }); });
  }
  function clearResource() { state.externalGeneration += 1; state.selectedId = null; state.mode = 'free'; closeSheet(); renderAll(); }
  function toggleMode() { if (state.mode === 'resource') clearResource(); else toast('請先點選地圖或清單中的資源，即可切換資源引導。'); }
  function focusGuidance() {
    const store = byId.get(state.selectedId);
    if (state.route) fitDestinationRoute();
    else if (state.mode === 'resource' && state.position && valid(store)) map.fitBounds([[state.position.lat, state.position.lng], [store.lat, store.lng]], { padding: [48, 140], maxZoom: 17, animate: false });
    else if (state.position) focusPoint(state.position);
  }
  function startGuidance() {
    setView('guidance');
    requestAnimationFrame(() => { if (state.view === 'guidance') focusGuidance(); });
  }
  function endGuidance() { setView('explore'); }
  function renderAll() { renderBasemapNotice(); renderPosition(); renderPanel(); renderDestinationRoute(); renderMarkers(); renderCache(); renderMode(); renderGuidance(); renderDetailsDistance(); }
  function selectResource(id) { const store = byId.get(String(id)); if (!store) return; state.externalGeneration += 1; state.selectedId = store.id; state.mode = 'resource'; if (state.view === 'welcome') setView('explore'); closeSheet(); renderPanel(); renderMarkers(); renderMode(); renderGuidance(); if (state.view === 'guidance') focusGuidance(); else if (valid(store)) focusPoint(store); if (!state.online && state.position && !isInBasemap(state.position)) showDirection(); }
  function focusPoint(point) { map.setView([point.lat, point.lng], Math.max(map.getZoom(), 17), { animate: false }); }
  async function requestPosition() {
    const generation = ++state.gpsGeneration; state.gpsPending = true; state.gpsMessage = ''; renderPosition(); renderGuidance(); syncHighlights();
    if (state.destination) scheduleRoute();
    try {
      const position = await FriendlyBridge.getLocation(); if (generation !== state.gpsGeneration) return;
      if (!valid(position)) throw Object.assign(new Error('Invalid location'), { code: 'GEO_FAILED' });
      state.position = position; state.gpsMessage = position.accuracy > 100 ? '定位精度不足，距離與方向可能有偏差。' : ''; if (state.view === 'guidance') focusGuidance(); else focusPoint(position);
    } catch (error) {
      if (generation !== state.gpsGeneration) return;
      const messages = { BRIDGE_LOCATION_FAILED: '無法取得定位', GEO_DENIED: '定位權限未開啟', GEO_TIMEOUT: '定位逾時', GEO_UNSUPPORTED: '此瀏覽器不支援定位', GEO_FAILED: '無法取得定位' };
      state.position = null; state.gpsMessage = `${messages[error.code] || '無法取得定位'}；距離依地圖中心估算。`;
    } finally { if (generation === state.gpsGeneration) { state.gpsPending = false; if (state.destination) scheduleRoute(); else renderAll(); if (state.activeSheet === 'direction') renderDirection(); } }
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
    openSheet('資源資訊', `<div class="store-heading"><span class="store-category">${esc(store.sourceName)}</span><h2>${esc(store.name)}</h2><p>${esc(store.address || '地址待確認')}</p></div><div class="service-grid">${tags(store)}</div><p class="field-note">現場使用條件、營業狀態與免消費條件：待確認。</p>${sourceHtml(store)}<div class="store-actions"><button class="secondary-button" data-copy="address">${icon('copy', 18)}複製地址</button>${store.phone ? `<button class="secondary-button" data-copy="phone">${icon('copy', 18)}複製電話</button>` : ''}</div>${store.phone ? `<p class="field-note">電話：${esc(store.phone)}</p>` : '<p class="field-note">電話未提供。</p>'}<p id="detail-distance" class="field-note">直線距離（非步行路線）：${valid(store) ? distanceLabel(distance(pointForDistance(), store)) : '未提供座標'}${valid(store) && !state.position ? ' · 依地圖中心估算' : ''}</p><button class="primary-button full-width" data-action="navigate" ${valid(store) ? '' : 'disabled'}>${icon('navigation', 20)}導航</button>${store.id === state.selectedId ? `<button class="secondary-button full-width" data-action="direction">${icon('compass', 20)}方向與距離</button>` : ''}<p id="external-message" class="field-note" role="status"></p>`, 'details'); renderDetailsDistance();
  }
  const actionResource = () => byId.get(state.activeSheet === 'details' ? state.detailId : state.selectedId);
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
    const angle = bearing(state.position, store); const d = distance(state.position, store); const rotate = state.orientationEnabled && state.heading !== null ? angle - state.heading : angle;
    body.innerHTML = `<div class="direction-compass"><span class="north-label">北</span><span class="direction-arrow" style="transform:rotate(${rotate}deg)">${icon('arrowNorth', 92)}</span></div><h3>${esc(store.name)}</h3><p class="direction-distance">${distanceLabel(d)}</p><p>店家在您的${directionName(angle)}方（以正北為基準）</p><p class="field-note">直線距離（非步行路線）<br>${esc(state.orientationMessage)}${state.position.accuracy > 100 ? '<br>定位精度不足，方向可能有偏差。' : ''}</p>`;
  }
  function showDirection() { openSheet('方向與距離', '<div id="direction-content" class="direction-content"></div><button class="secondary-button full-width" data-action="orientation">啟用裝置方向感測</button><p class="field-note">請依現場道路通行。箭頭不判斷障礙物或階梯。</p>', 'direction'); renderDirection(); }
  async function enableOrientation() {
    if (!window.DeviceOrientationEvent) { state.orientationMessage = '裝置不支援方位感測，以正北為基準'; renderDirection(); return; }
    try { if (typeof DeviceOrientationEvent.requestPermission === 'function' && await DeviceOrientationEvent.requestPermission() !== 'granted') throw new Error('denied'); state.orientationEnabled = true; state.orientationMessage = '等待方位感測；未取得前以正北為基準'; renderDirection(); }
    catch { state.orientationMessage = '未取得方位權限，以正北為基準'; renderDirection(); }
  }
  function orientation(event) {
    if (!state.orientationEnabled) return;
    const heading = Number.isFinite(event.webkitCompassHeading) ? event.webkitCompassHeading : event.absolute && Number.isFinite(event.alpha) ? (360 - event.alpha) % 360 : null;
    if (heading === null) return; state.heading = heading; state.orientationMessage = '箭頭依裝置方位調整，方位感測可能有誤差'; renderDirection();
  }
  function renderCache() {
    const cache = state.cache; $('#network-label').textContent = state.online ? '' : '離線';
    $('#cache-status').textContent = cache?.state === 'ready' ? `已快取 ${timeText(cache.savedAt)} · 底圖限信義／大安東` : cache?.state === 'downloading' ? `下載離線資料 ${cache.completed}/${cache.total}` : cache?.state === 'partial' ? '快取未完整 · 可在設定重試' : cache?.state === 'unsupported' ? '此環境不支援離線快取' : state.online ? '準備離線資料' : '離線資料尚未確認';
    $('#cache-status').title = '全市資源點位；離線底圖限信義區及大安東側';
    setText('#welcome-network', state.online ? '目前已連線' : '離線可用範圍依快取而定');
    if ($('#welcome-network')) $('#welcome-network').dataset.online = String(state.online);
    setText('#welcome-resource-count', stores.length.toLocaleString('zh-TW'));
    if ($('#welcome-resource-count')) $('#welcome-resource-count').title = `${stores.filter(valid).length.toLocaleString('zh-TW')} 筆有座標；不同來源可能同址，非去重後場所數`;
    setText('#welcome-cache', $('#cache-status').textContent);
    if (state.activeSheet === 'settings') renderSettingsCache();
  }
  function renderSettingsCache() {
    const el = $('#settings-cache'); if (!el) return; const cache = state.cache;
    el.innerHTML = `<p class="field-note">${cache?.state === 'ready' ? `已快取 · ${new Date(cache.savedAt).toLocaleString('zh-TW')}` : '快取尚未完整'}<br>點位：臺北市資料聯集<br>離線底圖：信義區及大安東側<br>其他區域離線可查看點位與方向距離。</p>${cache?.failures?.length ? `<p class="field-note">未完成：${cache.failures.map(f => esc(f.label || f.asset)).join('、')}</p>` : ''}`;
  }
  function openSettings() {
    openSheet('地圖設定', `<section class="setting-section"><h3>地圖外觀</h3><div class="segmented"><button data-theme-choice="dark" aria-pressed="${state.theme === 'dark'}">${icon('moon', 20)}深色</button><button data-theme-choice="light" aria-pressed="${state.theme === 'light'}">${icon('sun', 20)}淺色</button></div></section><section class="setting-section"><h3>離線資料</h3><div id="settings-cache"></div><button class="secondary-button" data-action="cache">${icon('download', 19)}重新檢查與下載</button></section><section class="setting-section"><h3>目前位置</h3><p class="field-note">${state.position ? `精度：${state.position.accuracy === null ? '未知' : `${Math.round(state.position.accuracy)} 公尺`}<br>取得時間：${timeText(state.position.capturedAt)}` : '目前非您的位置，距離依地圖中心估算。'}</p><button class="secondary-button" data-action="gps">${icon('location', 20)}重新定位</button></section><details class="data-disclosure"><summary>資料來源與授權</summary>${data.sources.map(source => `<p><a href="${esc(source.url || source.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(source.name || source.sourceName)}</a><br>更新日期：${esc(dateText(source.updatedAt))}</p>`).join('')}<p>OpenStreetMap contributors（ODbL）；離線底圖快照 2026-11-07。Photon 地點搜尋為 OpenStreetMap 資料。</p><a href="https://photon.komoot.io" target="_blank" rel="noopener noreferrer">Photon 搜尋</a><p>無障礙標籤指設施，不代表沿途無障礙。名冊不提供即時營業或免消費保證。</p><a href="./NOTICE.txt" target="_blank">資料與第三方元件聲明</a></details>`, 'settings'); renderSettingsCache();
  }
  async function cacheData() { state.cache = await FriendlyOffline.initialize(status => { state.cache = status; renderCache(); }); renderCache(); }
  async function copyValue(key) { const store = actionResource(); const value = store?.[key]; if (!value) { toast('資料未提供'); return; } try { await navigator.clipboard.writeText(value); toast(key === 'phone' ? '已複製電話' : '已複製地址'); } catch { toast('無法自動複製，請長按卡片文字複製。'); } }
  function setTheme(theme) { state.theme = theme; document.documentElement.dataset.theme = theme; try { localStorage.setItem('friendly-theme-v6', theme); } catch { /* Optional. */ } drawBasemap(); renderMarkers(); if (state.activeSheet === 'settings') openSettings(); }
  document.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.resource) openResource(button.dataset.resource);
    if (button.dataset.transport && Object.hasOwn(TRANSPORTS, button.dataset.transport)) { state.transport = button.dataset.transport; renderMode(); }
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
  $('#home-button').addEventListener('click', event => { event.preventDefault(); setView('welcome'); });
  $('#enter-app')?.addEventListener('click', () => setView('explore'));
  $('#mode-toggle')?.addEventListener('click', toggleMode);
  $('#start-guidance')?.addEventListener('click', startGuidance);
  $('#exit-guidance')?.addEventListener('click', endGuidance);
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
  highlights = window.FriendlyHighlights?.create({ map, stores, icon, escapeHtml: esc, distance,
    onSelectResource: store => selectResource(store.id), onShowDetails: showDetails, onRequestPosition: requestPosition,
    onUseDemoPosition: useDemoPosition, onOpenExplore: () => { state.panelCollapsed = false; setView('explore'); } });
  $('#highlight-map-launch')?.addEventListener('click', () => highlights?.open('wifi'));
  document.documentElement.dataset.theme = state.theme; updateIcons(); drawBasemap(); syncOnlineTiles(); renderFilters(); renderAll(); setView('welcome');
  requestPosition(); cacheData();
})();
