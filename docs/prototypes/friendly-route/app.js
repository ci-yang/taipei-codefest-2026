/* 友善同行：位置只供當次使用，離線快取只含公開資料與 app shell。 */
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const data = window.FRIENDLY_RESOURCES;
  const basemap = window.FRIENDLY_DATA;
  const icons = window.FriendlyIcons;
  const i18n = window.FriendlyI18n;
  if (!data || !basemap || !icons || !i18n || !window.L || !window.FriendlyBridge || !window.FriendlyOffline) {
    document.body.textContent = i18n ? i18n.t('app.boot.error') : '必要資料尚未載入，請連線後重新開啟。尚未完成首次快取的裝置無法離線啟動。'; return;
  }
  const t = (key, params) => i18n.t(key, params);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const icon = (name, size = 22) => icons.icon(name, size);
  // 標籤每次取用時查表，切換介面語言後下一次渲染就是新語言。
  const URGENCIES = Object.fromEntries(['toilet', 'charge', 'wifi'].map(key => [key, Object.freeze({ get label() { return t(`urgency.${key}.label`); }, get title() { return t(`urgency.${key}.title`); } })]));
  const VIEWS = ['home', 'result', 'guide', 'card', 'map'];
  const LANG_KEY = 'friendly-native-language-v1'; const STEP_FREE_KEY = 'friendly-step-free-v1';
  const SERVICES = Object.defineProperties({}, Object.fromEntries(['wifi', 'toilet', 'charge', 'accessible'].map(key => [key, { enumerable: true, get: () => t(`service.${key}`) }])));
  const valid = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
  const stores = data.stores.map(s => ({ ...s, id: String(s.id) }));
  const byId = new Map(stores.map(s => [s.id, s]));
  const center = { lat: 25.0375, lng: 121.5637 };
  const state = { view: 'home', screen: 'home', urgency: null, result: null, resultIndex: 0, guideRoute: null, guideStatus: 'idle', guideMessage: '', guideGeneration: 0, prefs: { lang: 'zh-TW', stepFree: false }, prefsNotice: '', mode: 'free', detailId: null, position: null, gpsPending: false, gpsError: null, gpsGeneration: 0, filters: new Set(), selectedId: null, destination: null, route: null, routeIds: new Set(), routeStatus: 'idle', routeMessage: '', routeGeneration: 0, mapExpanded: false, panelCollapsed: false, online: navigator.onLine, searchGeneration: 0, searchController: null, searchQuery: '', searchResults: [], theme: 'light', heading: null, orientationEnabled: false, orientation: 'off', activeSheet: null, cache: null, externalGeneration: 0 };
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
    notice.textContent = outsideCoverage ? t('map.no.basemap') : '';
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
  const directionName = angle => t(`dir.${['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'][Math.round(angle / 45) % 8]}`);
  const distanceLabel = meters => meters >= 1000 ? t('unit.km', { n: (meters / 1000).toFixed(1) }) : t('unit.m', { n: Math.round(meters) });
  const minutesLabel = minutes => t('unit.min', { n: Math.ceil(minutes) });
  // 狀態裡的提示存 key（或已是文字的錯誤訊息），渲染時才查表。
  const message = value => value && typeof value === 'object' ? t(value.key) : value || '';
  const pointForDistance = () => state.position || { lat: map.getCenter().lat, lng: map.getCenter().lng };
  // 空集合是「尚未選類別」，不是「全部」：沒選就不列、不畫任何資源。
  const matches = store => state.filters.size > 0 && store.services.some(service => state.filters.has(service));
  const hitCategory = store => store.services.find(service => state.filters.has(service)) || null;
  const pinStyle = key => Object.hasOwn(SERVICES, key) ? `--pin:var(--cat-${key});--pin-on:var(--cat-${key}-on);--pin-text:var(--cat-${key}-text)` : '';
  const isVisible = store => valid(store) && map.getBounds().contains([store.lat, store.lng]);
  const matchesRoute = store => state.routeStatus !== 'ready' || state.routeIds.has(store.id);
  function visibleStores() { const from = pointForDistance(); return stores.filter(s => valid(s) && matches(s) && (state.routeStatus === 'ready' ? state.routeIds.has(s.id) : isVisible(s))).sort((a, b) => distance(from, a) - distance(from, b)); }
  const resourceScope = () => t(state.routeStatus === 'ready' ? 'panel.scope.route' : 'panel.scope.view');
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
  function dateText(value) { return value ? String(value).slice(0, 10) : t('common.tbc'); }
  function timeText(time) { return new Date(time).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }); }
  const isInferred = (store, service) => (store.inferredServices || []).includes(service);
  function serviceTag(store, key, includeMissing = true) {
    if (!store.services.includes(key)) return includeMissing ? `<span class="service-tag unknown">${icon(key, 16)}${esc(t('tag.missing', { service: SERVICES[key] }))}</span>` : '';
    const inferred = isInferred(store, key);
    return `<span class="service-tag ${inferred ? 'inferred' : 'official'}">${icon(key, 16)}${esc(t(inferred ? 'tag.inferred' : 'tag.official', { service: SERVICES[key] }))}</span>`;
  }
  function tags(store) { return Object.keys(SERVICES).map(key => serviceTag(store, key)).join(''); }
  function inferenceHtml(store) {
    const rules = store.inferenceRules || [];
    if (!rules.length) return '';
    return `<div class="inference-note"><strong>${esc(t('inference.title'))}</strong><span>${rules.map(rule => esc(rule.detail)).join(' ')}</span><span>${esc(t('inference.caveat'))}</span></div>`;
  }
  function serviceTags(store) { return store.services.map(key => serviceTag(store, key, false)).join(''); }
  function phoneFor(store) { return typeof store.normalizedPhone === 'string' && /^\+?\d{8,15}$/.test(store.normalizedPhone) ? store.normalizedPhone : null; }
  function sourceHtml(store) { return `<p class="source-line">${esc(t('source.label'))}<a href="${esc(store.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(store.sourceName)}</a><br>${esc(t('source.updated', { date: dateText(store.updatedAt) }))}</p>`; }
  function row(store) {
    const d = valid(store) ? distanceLabel(distance(pointForDistance(), store)) : t('common.no.coords');
    return `<button class="resource-row" data-resource="${esc(store.id)}" data-cat="${esc(hitCategory(store) || store.services[0] || '')}"><span class="resource-symbol">${icon(store.services.find(s => state.filters.has(s)) || store.services[0] || 'info', 23)}</span><span class="resource-copy"><strong>${esc(store.name)}</strong><span class="resource-card-address">${esc(store.address || t('common.address.tbc'))}</span><span class="resource-card-services">${serviceTags(store) || esc(t('tag.none'))}</span><span class="resource-card-meta"><span class="resource-card-source">${esc(store.sourceName)}</span><span class="resource-card-updated">${esc(t('row.updated', { date: dateText(store.updatedAt) }))}</span></span></span><span class="resource-distance">${esc(t('common.straight', { d }))}${icon('chevron', 15)}</span></button>`;
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
    $('#destination-route-message').textContent = route ? t('route.summary', { d: distanceLabel(route.distanceM), min: minutesLabel(route.estimateMinutes), n: visibleStores().length }) : message(state.routeMessage);
    $('#destination-route-note').textContent = route ? t('route.note.ready', { d: distanceLabel(route.connectorDistanceM) }) : t('route.note.idle');
    $('#route-retry').hidden = !['waiting-location', 'error'].includes(state.routeStatus);
    $('#route-retry').disabled = state.gpsPending;
    $('#route-retry').textContent = t(state.routeStatus === 'waiting-location' ? 'common.relocate' : 'route.retry');
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
      state.routeMessage = { key: state.gpsPending ? 'route.wait.gps' : 'route.need.gps' }; renderAll(); return;
    }
    state.routeStatus = 'loading'; state.routeMessage = { key: 'route.loading' }; renderAll();
    try {
      if (!window.FriendlyRouteClient) throw new Error(t('route.no.router'));
      routeClient ||= window.FriendlyRouteClient.createClient();
      const route = await routeClient.route({ points: [state.position, state.destination].map(point => ({ lat: point.lat, lng: point.lng })), stores, radius: 250 });
      if (generation !== state.routeGeneration) return;
      state.route = route; state.routeIds = new Set(route.storeIds.map(String)); state.routeStatus = 'ready'; state.routeMessage = ''; renderAll();
      requestAnimationFrame(() => { if (generation === state.routeGeneration && (state.screen === 'map' || (state.screen === 'guide' && !guideStore()))) fitDestinationRoute(); });
    } catch (error) {
      if (generation !== state.routeGeneration) return;
      state.routeStatus = 'error'; state.routeMessage = error.name === 'AbortError' ? { key: 'route.cancelled' } : error.message || { key: 'route.failed' }; renderAll();
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
    $('#map-expand').setAttribute('aria-label', t(state.mapExpanded ? 'map.restore' : 'map.expand'));
    $('#map-expand-label').textContent = t(state.mapExpanded ? 'map.restore' : 'map.expand');
    $('#panel-content').hidden = state.panelCollapsed;
    $('#bottom-panel').classList.toggle('is-collapsed', state.panelCollapsed);
    $('#panel-toggle').setAttribute('aria-expanded', String(!state.panelCollapsed));
    $('#panel-toggle-label').textContent = t(state.panelCollapsed ? 'panel.expand' : 'panel.collapse');
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
    if (valid(selected)) selectedMarker = L.marker([selected.lat, selected.lng], { icon: L.divIcon({ className: 'resource-map-pin is-selected', iconSize: [48, 48], iconAnchor: [24, 24], html: `<button aria-label="${esc(t('map.selected.pin', { name: selected.name }))}" style="${pinStyle(selectedKey)}">${icon(selectedKey, 24)}</button>` }), keyboard: false, zIndexOffset: 1000 }).on('click', () => openResource(selected.id)).addTo(map);
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
    state.gpsError = null;
    focusPoint(point); if (state.destination) scheduleRoute(); else renderAll();
  }
  function renderFilters() {
    $('#category-filters').innerHTML = Object.entries(SERVICES).map(([key, label]) => { const on = state.filters.has(key); return `<button class="filter-chip ${on ? 'selected' : ''}" aria-pressed="${on}" data-service="${key}">${icon(on ? 'check' : key, 20)}<span>${label}</span></button>`; }).join('');
  }
  function renderPosition() {
    const p = state.position;
    $('#gps-button').disabled = state.gpsPending;
    $('#location-status').textContent = state.gpsPending ? t('common.locating') : p ? fixText(p) : t('gps.not.yours');
    const basis = state.gpsPending ? t('common.locating') : p?.source === 'demo' ? t('gps.basis.demo') : p ? `${t('gps.basis.here')}${p.accuracy > 100 ? t('gps.basis.weak') : ''}` : t('gps.basis.center', { reason: gpsReason() || t('gps.basis.off') });
    $('#location-notice').innerHTML = `${esc(basis)}${p || state.gpsPending ? '' : ` <button class="text-button" data-action="gps">${esc(t('common.relocate'))}</button>`}`;
    if (gpsMarker) { map.removeLayer(gpsMarker); gpsMarker = null; }
    if (p) { const colors = palette(); gpsMarker = L.circleMarker([p.lat, p.lng], { radius: 8, color: colors.surface, weight: 3, fillColor: colors.accent, fillOpacity: 1, interactive: false }).addTo(map); }
  }
  // 定位列（地圖狀態膠囊與導引 HUD 共用）：展示位置、精度與取得時間。
  function fixText(p) {
    if (p.source === 'demo') return t('gps.demo');
    return `${p.accuracy > 100 ? t('gps.weak.prefix') : ''}${p.accuracy !== null ? t('gps.fix', { n: Math.round(p.accuracy) }) : t('gps.fix.unknown')} · ${timeText(p.capturedAt)}`;
  }
  const GPS_ERRORS = { BRIDGE_LOCATION_FAILED: 'bridge', GEO_DENIED: 'denied', GEO_TIMEOUT: 'timeout', GEO_UNSUPPORTED: 'unsupported', GEO_FAILED: 'failed' };
  const gpsReason = () => state.gpsError ? t(`gps.err.${GPS_ERRORS[state.gpsError] || 'failed'}`) : '';
  function selectedCard(store) {
    const d = valid(store) ? distanceLabel(distance(pointForDistance(), store)) : t('common.no.coords');
    const cat = hitCategory(store) || store.services.find(key => Object.hasOwn(SERVICES, key)) || '';
    return `<div class="route-heading"><span class="route-kind">${icon('info', 17)} ${esc(t('card.info'))}</span><button class="icon-button compact" data-action="clear" aria-label="${esc(t('card.close'))}">${icon('close')}</button></div><h2 class="resource-title">${esc(store.name)}</h2><p class="distance-value">${esc(d)}</p><p class="distance-caption">${esc(t('card.straight.caption'))}${state.position ? '' : esc(t('common.center.suffix'))}</p><div class="route-services">${serviceTags(store) || esc(t('tag.none'))}</div>${inferenceHtml(store)}${sourceHtml(store)}<div class="route-actions"><button class="primary-button" data-action="go" ${cat ? `data-cat="${cat}"` : ''} ${valid(store) ? '' : 'disabled'}>${icon('navigation', 19)}${esc(t('common.go'))}</button>${speakCategory(store) ? `<button class="secondary-button" data-action="speak">${esc(t('common.speak'))}</button>` : ''}<button class="secondary-button" data-action="detail">${esc(t('card.detail'))}</button></div>`;
  }
  const noCategoryHtml = () => `<div class="empty-state" data-empty="no-category"><strong>${esc(t('panel.pick.title'))}</strong><p>${esc(t('panel.pick.body'))}</p></div>`;
  function renderPanel() {
    const visible = visibleStores(); const store = byId.get(state.selectedId);
    const noCategory = state.filters.size === 0;
    $('#panel-summary').textContent = state.routeStatus === 'loading' ? t('panel.loading') : state.routeStatus === 'ready' ? t('panel.summary.route', { x: noCategory ? t('panel.no.category') : t('panel.count', { n: visible.length }) }) : t('panel.summary.near', { x: noCategory ? t('panel.no.category') : t('panel.count.view', { n: visible.length }) });
    $('#list-button').hidden = noCategory || visible.length <= 6; $('#list-button-label').textContent = t('panel.all', { n: visible.length });
    $('#bottom-panel').classList.toggle('has-selection', Boolean(store)); $('#selected-card').hidden = !store; $('#nearby-preview').hidden = Boolean(store);
    if (store) $('#selected-card').innerHTML = selectedCard(store);
    else $('#nearby-preview').innerHTML = noCategory ? noCategoryHtml() : visible.length ? visible.slice(0, 6).map(row).join('') : `<p class="empty-copy">${esc(t(state.routeStatus === 'ready' ? 'panel.empty.route' : 'panel.empty.view'))}</p>`;
    if (state.activeSheet === 'list') {
      $('#sheet-title').textContent = t(state.routeStatus === 'ready' ? 'panel.list.route' : 'panel.list.view');
      $('#sheet-body').innerHTML = noCategory ? noCategoryHtml() : `<p class="field-note">${esc(t('panel.list.note', { scope: resourceScope(), n: visible.length }))}${state.position ? '' : esc(t('panel.list.center'))}</p>${visible.map(row).join('') || `<p class="empty-copy">${esc(t('panel.list.empty', { scope: resourceScope() }))}</p>`}`;
    }
  }
  function setText(selector, text) { const el = $(selector); if (el) el.textContent = text; }
  function renderGuidance() {
    const store = state.mode === 'resource' ? byId.get(state.selectedId) : null; const position = state.position;
    const pointing = Boolean(store && valid(store) && position); const arrow = $('#guide-arrow');
    if (arrow) { arrow.style.transform = pointing ? `rotate(${arrowRotation(position, store)}deg)` : 'rotate(0deg)'; arrow.dataset.ready = String(pointing); }
    setText('#guidance-heading', store ? (resultStore()?.id === store.id && URGENCIES[state.urgency]?.title) || t('guide.to.selected') : t('guide.heading'));
    setText('#guidance-title', store ? store.name : t('guide.explore'));
    // 步行路線算好後大字換成步行距離（與廁所步行卡同一個 guideRoute），直線退到方向那行。
    const route = store ? state.guideRoute : null; const walk = $('#guide-walk');
    const straight = pointing ? straightText(distance(position, store)) : '';
    setText('#guidance-distance', store ? !valid(store) ? t('common.no.coords') : position ? route ? t('guide.walk', { d: distanceLabel(route.distanceM) }) : straight : t('guide.need.location') : t('panel.count.view', { n: visibleStores().length }));
    setText('#guidance-bearing', store ? !valid(store) ? t('guide.no.bearing') : position ? `${route ? `${straight} · ` : ''}${t('guide.bearing', { dir: directionName(bearing(position, store)), orient: state.orientationEnabled ? t(`orient.${state.orientation}`) : t('orient.off.short') })}` : t('guide.need.bearing') : t('guide.free.hint'));
    const toiletGuide = Boolean(store && state.urgency === 'toilet' && store.services.includes('toilet'));
    if (walk) { walk.hidden = !route || toiletGuide; walk.textContent = route ? t('guide.walk.note', { min: minutesLabel(route.estimateMinutes) }) : ''; }
    if ($('#guide-retry')) $('#guide-retry').hidden = !(store && state.guideStatus === 'error');
    if ($('#guide-orientation')) $('#guide-orientation').hidden = !pointing || state.orientationEnabled;
    setText('#guidance-location', position ? fixText(position) : state.gpsPending ? t('common.locating') : gpsReason() ? t('gps.err.full', { reason: gpsReason() }) : t('guide.no.position'));
    if ($('#guidance-detail')) $('#guidance-detail').hidden = !store;
    if (!store && state.destination) {
      setText('#guidance-title', state.destination.name);
      setText('#guidance-distance', state.route ? t('guide.walk.about', { d: distanceLabel(state.route.distanceM) }) : message(state.routeMessage));
      setText('#guidance-bearing', state.route ? t('guide.route.bearing', { n: visibleStores().length }) : t('guide.route.network'));
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
  // 精度不足時在距離前加「約」；直線距離文字結果卡與導引 HUD 共用。
  const straightText = meters => { const d = distanceLabel(meters); return t('common.straight', { d: state.position?.accuracy > 100 ? t('common.about', { d }) : d }); };
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
    if (state.gpsPending) return t('common.locating');
    if (p?.source === 'demo') return t('gps.demo');
    if (p) return `${t(p.accuracy > 100 ? 'home.loc.weak' : 'home.loc.ok')}${p.accuracy !== null ? `±${Math.round(p.accuracy)} m` : t('home.loc.unknown')} · ${timeText(p.capturedAt)}`;
    if (!state.gpsError) return t('home.loc.none');
    return ['bridge', 'failed'].includes(GPS_ERRORS[state.gpsError] || 'failed') ? gpsReason() : t('home.loc.failed', { reason: gpsReason() });
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
      body.innerHTML = `<section class="result-empty" data-result="need-location"><span class="result-empty-icon">${icon('location', 34)}</span><h2>${esc(t('result.need.title'))}</h2><p>${esc(state.gpsPending ? t('result.need.pending') : t('result.need.body', { line: locationLine() }))}</p><div class="result-actions"><button class="primary-button" data-action="gps" ${state.gpsPending ? 'disabled' : ''}>${icon('location', 19)}${esc(t('common.relocate'))}</button><button class="secondary-button" data-action="map">${icon('compass', 19)}${esc(t('common.map'))}</button></div></section>`;
      return;
    }
    const store = resultStore();
    if (!store) { body.innerHTML = `<section class="result-empty" data-result="empty"><h2>${esc(t('result.empty.title', { label: meta.label }))}</h2><p>${esc(t('result.empty.body'))}</p><div class="result-actions"><button class="secondary-button" data-action="map">${icon('compass', 19)}${esc(t('common.map'))}</button></div></section>`; return; }
    const total = state.result.items.length; const angle = bearing(state.position, store); const accessible = store.services.includes('accessible'); const hasNext = state.resultIndex + 1 < total;
    body.innerHTML = `<article class="result-card" data-result-id="${esc(store.id)}"><p class="result-rank">${esc(t('result.rank', { i: state.resultIndex + 1, total }))}</p><h2 class="result-name">${esc(store.name)}</h2><p class="result-address">${esc(store.address || t('common.address.tbc'))}</p><div class="result-metric"><span class="result-arrow" style="transform:rotate(${angle}deg)">${icon('arrowNorth', 30)}</span><div><strong id="result-distance">${esc(straightText(distance(state.position, store)))}</strong><span>${esc(t('result.direction', { dir: directionName(angle) }))}</span></div></div><div class="result-tags">${isInferred(store, state.urgency) ? `<span class="service-tag inferred">${icon(state.urgency, 16)}${esc(t('result.inferred', { label: meta.label }))}</span>` : ''}<span class="service-tag ${accessible ? 'available' : 'unknown'}">${icon('accessible', 16)}${esc(t(accessible ? 'result.accessible.yes' : 'result.accessible.no'))}</span>${state.urgency === 'wifi' ? `<span class="service-tag unknown">${icon('wifi', 16)}${esc(t('result.wifi.note'))}</span>` : ''}</div>${state.prefs.stepFree && state.result.stepFreeFallback ? `<p class="result-warning" role="status">${esc(t('result.stepfree.fallback', { label: meta.label }))}</p>` : ''}${state.position.accuracy > 100 ? `<p class="field-note">${esc(t('result.weak'))}</p>` : ''}${sourceHtml(store)}<div class="result-actions"><button class="primary-button" data-action="go" data-cat="${esc(state.urgency)}" ${valid(store) ? '' : 'disabled'}>${icon('navigation', 19)}${esc(t('common.go'))}</button>${speakCategory(store) ? `<button class="secondary-button" data-action="speak">${esc(t('common.speak'))}</button>` : ''}<button class="secondary-button" data-action="map">${icon('compass', 19)}${esc(t('common.map'))}</button>${phoneFor(store) ? `<button class="secondary-button" data-action="phone">${icon('phone', 19)}${esc(t('common.phone'))}</button>` : ''}</div><button class="text-button result-next" data-action="next" ${hasNext ? '' : 'disabled'}>${esc(hasNext ? t('result.next', { i: state.resultIndex + 2 }) : t('result.last'))}${icon('chevron', 16)}</button></article>`;
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
      const plan = window.FriendlySpeakCard.openSpeakCard({ category: entry.category, lang: state.prefs.lang, onClose: goBack, includeUnreviewed: true });
      if (plan.fellBack || state.prefsNotice) { toast(t(state.prefsNotice || 'speak.fell.back')); state.prefsNotice = ''; }
    } catch { toast(t('speak.error')); }
  }
  // 未校對的語言也可選，畫面標「機器翻譯」；reviewed 欄位不改。
  const availableLangs = () => window.FriendlySpeakCard?.getAvailableLangs({ includeUnreviewed: true }) || [{ code: 'zh-TW', label: '中文', reviewed: true }];
  const speakLangFor = code => code !== 'zh-TW' && availableLangs().some(item => item.code === code) ? code : null;
  function savePref(key, value) { try { localStorage.setItem(key, value); } catch { /* Optional. */ } }
  function readPrefs() {
    // 沒存過母語時跟著介面語言（en／ja／ko），其他一律中文單面。
    let lang = speakLangFor(i18n.getLang()) || 'zh-TW'; let stepFree = false; let notice = '';
    try {
      const stored = localStorage.getItem(LANG_KEY);
      if (stored && availableLangs().some(item => item.code === stored)) lang = stored;
      else if (stored) { notice = 'prefs.lang.cleared'; lang = 'zh-TW'; localStorage.removeItem(LANG_KEY); }
      stepFree = localStorage.getItem(STEP_FREE_KEY) === '1';
    } catch { /* Optional. */ }
    state.prefs = { lang, stepFree }; state.prefsNotice = notice;
  }
  // 換介面語言：靜態 HTML 查表，再走既有的各畫面重繪。
  function relocalize() {
    i18n.apply(); if (!state.destination) $('#search-label').textContent = t('map.search');
    renderFilters(); renderMapLayout(); renderAll();
    if (state.activeSheet === 'settings') openSettings();
  }
  function setUiLang(code) {
    if (!i18n.LANGS.some(lang => lang.code === code)) return;
    i18n.setLang(code);
    const speakLang = speakLangFor(code);
    if (speakLang) { state.prefs = { ...state.prefs, lang: speakLang }; state.prefsNotice = ''; savePref(LANG_KEY, speakLang); }
    relocalize();
  }
  function renderAll() { renderBasemapNotice(); renderPosition(); renderPanel(); renderDestinationRoute(); renderMarkers(); renderCache(); renderGuidance(); renderDetailsDistance(); renderHome(); if (state.screen === 'result') renderResult(); }
  function selectResource(id) { const store = byId.get(String(id)); if (!store) return; state.externalGeneration += 1; state.selectedId = store.id; state.mode = 'resource'; closeSheet(); renderPanel(); renderMarkers(); renderGuidance(); if (state.screen === 'guide') focusGuidance(); else if (valid(store)) focusPoint(store); if (!state.online && state.position && !isInBasemap(state.position)) showDirection(); }
  function focusPoint(point) { map.setView([point.lat, point.lng], Math.max(map.getZoom(), 17), { animate: false }); }
  async function requestPosition() {
    const generation = ++state.gpsGeneration; state.gpsPending = true; state.gpsError = null; renderPosition(); renderGuidance(); renderHome(); if (state.view === 'result') renderResult(); syncHighlights();
    if (state.destination) scheduleRoute();
    try {
      const position = await FriendlyBridge.getLocation(); if (generation !== state.gpsGeneration) return;
      if (!valid(position)) throw Object.assign(new Error('Invalid location'), { code: 'GEO_FAILED' });
      state.position = position; state.gpsError = null; if (state.screen === 'guide') focusGuidance(); else focusPoint(position);
    } catch (error) {
      if (generation !== state.gpsGeneration) return;
      state.position = null; state.gpsError = Object.hasOwn(GPS_ERRORS, error.code || '') ? error.code : 'GEO_FAILED';
    } finally { if (generation === state.gpsGeneration) { state.gpsPending = false; if (state.destination) scheduleRoute(); else renderAll(); if (state.activeSheet === 'direction') renderDirection(); refreshUrgencyScreens(); } }
  }
  function setDestination(place) {
    if (!valid(place)) { const record = byId.get(place.storeId || place.id); if (record) showDetails(record); toast(t('map.no.coords.toast')); return; }
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
    $('#search-results').innerHTML = results.map((p, index) => `<button class="place-result" data-search-result="${index}"><span class="result-icon">${icon('location', 22)}</span><span><strong>${esc(p.name)}</strong><small>${esc(p.address || t('common.address.tbc'))}</small><small>${p.source === 'photon' ? 'OpenStreetMap · Photon' : esc(p.sourceName || t('search.downloaded'))}${valid(p) ? '' : ` · ${esc(t('common.no.coords'))}`}</small></span>${icon('arrowUpRight', 18)}</button>`).join('');
  }
  function openSearch() {
    cancelSearch(); openSheet(t('search.title'), `<form id="search-form" class="search-form"><span>${icon('search')}</span><input id="search-input" aria-label="${esc(t('search.input'))}" placeholder="${esc(t('search.placeholder'))}" maxlength="120" autocomplete="off"><button id="search-submit" class="icon-button" type="submit" aria-label="${esc(t('search.submit'))}">${icon('arrowUpRight')}</button></form><p id="search-message" class="field-note" role="status"></p><div id="search-results"></div>`, 'search');
    $('#search-input').value = state.searchQuery; $('#search-input').focus(); displaySearch(localSearch(state.searchQuery), t(state.online ? 'search.hint.online' : 'search.offline'));
    $('#search-input').addEventListener('input', event => { cancelSearch(); state.searchQuery = event.target.value; displaySearch(localSearch(state.searchQuery), t(state.online ? 'search.downloaded' : 'search.offline')); });
    $('#search-form').addEventListener('submit', async event => {
      event.preventDefault(); cancelSearch(); const generation = state.searchGeneration; const query = state.searchQuery.trim(); const local = localSearch(query);
      if (!state.online) { displaySearch(local, t('search.offline')); return; }
      if (query.length < 2) { displaySearch(local, t('search.too.short')); return; }
      state.searchController = new AbortController(); $('#search-submit').disabled = true; displaySearch(local, t('search.loading'));
      try { searchClient ||= FriendlySearch.createClient(); const remote = await searchClient.search(query, { signal: state.searchController.signal }); if (generation !== state.searchGeneration || state.activeSheet !== 'search' || !state.online) return; displaySearch([...local, ...remote], t(local.length || remote.length ? 'search.pick' : 'search.none')); }
      catch (error) { if (generation === state.searchGeneration && state.activeSheet === 'search' && error.name !== 'AbortError') displaySearch(local, t(local.length ? 'search.remote.fail' : 'search.fail')); }
      finally { if (generation === state.searchGeneration && $('#search-submit')) $('#search-submit').disabled = false; }
    });
  }
  function renderDetailsDistance() {
    const store = byId.get(state.detailId); if (state.activeSheet !== 'details' || !store) return;
    setText('#detail-distance', detailDistance(store));
  }
  function detailDistance(store) {
    return `${t('detail.distance', { d: valid(store) ? distanceLabel(distance(pointForDistance(), store)) : t('common.no.coords') })}${valid(store) && !state.position ? t('common.center.suffix') : ''}${state.position?.accuracy > 100 ? t('detail.weak.suffix') : ''}`;
  }
  function showDetails(store) {
    if (!store) return; state.detailId = store.id;
    openSheet(t('card.info'), `<div class="store-heading"><span class="store-category">${esc(store.sourceName)}</span><h2>${esc(store.name)}</h2><p>${esc(store.address || t('common.address.tbc'))}</p></div><div class="service-grid">${tags(store)}</div>${inferenceHtml(store)}<p class="field-note">${esc(t('detail.conditions'))}</p>${sourceHtml(store)}<div class="store-actions"><button class="secondary-button" data-copy="address">${icon('copy', 18)}${esc(t('detail.copy.address'))}</button>${store.phone ? `<button class="secondary-button" data-copy="phone">${icon('copy', 18)}${esc(t('detail.copy.phone'))}</button>` : ''}</div><p class="field-note">${esc(store.phone ? t('detail.phone', { phone: store.phone }) : t('detail.no.phone'))}</p><p id="detail-distance" class="field-note">${esc(detailDistance(store))}</p><button class="primary-button full-width" data-action="navigate" ${valid(store) ? '' : 'disabled'}>${icon('navigation', 20)}${esc(t('detail.navigate'))}</button>${phoneFor(store) ? `<button class="secondary-button full-width" data-action="phone">${icon('phone', 20)}${esc(t('common.phone'))}</button>` : ''}${store.id === state.selectedId ? `<button class="secondary-button full-width" data-action="direction">${icon('compass', 20)}${esc(t('detail.direction'))}</button>` : ''}<p id="external-message" class="field-note" role="status"></p>`, 'details');
  }
  const actionResource = () => state.activeSheet === 'details' ? byId.get(state.detailId) : state.screen === 'result' ? resultStore() : byId.get(state.selectedId);
  async function externalAction(kind) {
    const store = actionResource(); if (!store) return; const generation = ++state.externalGeneration;
    if (!state.online) toast(t('ext.offline.warn'));
    const buttons = document.querySelectorAll(`[data-action="${kind}"]`); buttons.forEach(button => { button.disabled = true; });
    try {
      const result = kind === 'navigate' ? await FriendlyBridge.navigate(store) : await FriendlyBridge.callPhone(phoneFor(store));
      if (generation !== state.externalGeneration || actionResource()?.id !== store.id) return;
      const outcome = t(result === 'unsupported' ? 'ext.unsupported' : result === 'failed' ? kind === 'navigate' ? 'ext.nav.fail' : 'ext.phone.fail' : kind === 'navigate' ? 'ext.nav.ok' : 'ext.phone.ok');
      const sentence = t('ext.result', { msg: outcome, note: state.online ? '' : t('ext.offline.note') });
      toast(sentence); if (result !== 'opened') { showDetails(store); $('#external-message').textContent = `${sentence}${t(store.phone ? 'ext.copy.hint.phone' : 'ext.copy.hint')}`; }
    } catch { if (generation !== state.externalGeneration || actionResource()?.id !== store.id) return; toast(t(kind === 'navigate' ? 'ext.nav.fail' : 'ext.phone.fail')); showDetails(store); $('#external-message').textContent = t('ext.incomplete'); } finally { buttons.forEach(button => { button.disabled = false; }); }
  }
  function renderDirection() {
    const store = byId.get(state.selectedId); if (!store || state.activeSheet !== 'direction') return;
    const body = $('#direction-content'); if (!body) return;
    if (!state.position || !valid(store)) { body.innerHTML = `<p class="empty-copy">${esc(t(valid(store) ? 'dir.need' : 'dir.need.coords'))}</p><button class="primary-button" data-action="gps">${esc(t('common.relocate'))}</button>`; return; }
    const angle = bearing(state.position, store); const d = distance(state.position, store); const rotate = arrowRotation(state.position, store);
    body.innerHTML = `<div class="direction-compass"><span class="north-label">${esc(t('dir.north.label'))}</span><span class="direction-arrow" style="transform:rotate(${rotate}deg)">${icon('arrowNorth', 92)}</span></div><h3>${esc(store.name)}</h3><p class="direction-distance">${esc(distanceLabel(d))}</p><p>${esc(t('dir.store', { dir: directionName(angle) }))}</p><p class="field-note">${esc(t('card.straight.caption'))}<br>${esc(t(`orient.${state.orientation}`))}${state.position.accuracy > 100 ? `<br>${esc(t('dir.weak'))}` : ''}</p>`;
  }
  function showDirection() { openSheet(t('detail.direction'), `<div id="direction-content" class="direction-content"></div><button class="secondary-button full-width" data-action="orientation">${esc(t('dir.enable'))}</button><p class="field-note">${esc(t('dir.caution'))}</p>`, 'direction'); renderDirection(); }
  async function enableOrientation() {
    if (!window.DeviceOrientationEvent) { state.orientation = 'unsupported'; renderDirection(); renderGuidance(); toast(t('orient.unsupported')); return; }
    try { if (typeof DeviceOrientationEvent.requestPermission === 'function' && await DeviceOrientationEvent.requestPermission() !== 'granted') throw new Error('denied'); state.orientationEnabled = true; state.orientation = 'waiting'; renderDirection(); renderGuidance(); }
    catch { state.orientation = 'denied'; renderDirection(); renderGuidance(); }
  }
  function orientation(event) {
    if (!state.orientationEnabled) return;
    const heading = Number.isFinite(event.webkitCompassHeading) ? event.webkitCompassHeading : event.absolute && Number.isFinite(event.alpha) ? (360 - event.alpha) % 360 : null;
    if (heading === null) return; state.heading = heading; state.orientation = 'active'; renderDirection(); if (state.screen === 'guide') renderGuidance();
  }
  function renderCache() {
    const cache = state.cache; $('#network-label').textContent = state.online ? '' : t('net.offline');
    $('#cache-status').textContent = cache?.state === 'ready' ? t('cache.ready', { time: timeText(cache.savedAt), regions: BASEMAP_REGION_NAMES }) : cache?.state === 'downloading' ? t('cache.downloading', { done: cache.completed, total: cache.total }) : t(cache?.state === 'partial' ? 'cache.partial' : cache?.state === 'unsupported' ? 'cache.unsupported' : state.online ? 'cache.preparing' : 'cache.unknown');
    $('#cache-status').title = t('cache.title', { regions: BASEMAP_REGION_NAMES });
    setText('#home-cache', state.online ? $('#cache-status').textContent : t('cache.offline', { status: $('#cache-status').textContent }));
    if (state.activeSheet === 'settings') renderSettingsCache();
  }
  function renderSettingsCache() {
    const el = $('#settings-cache'); if (!el) return; const cache = state.cache;
    el.innerHTML = `<p class="field-note">${esc(cache?.state === 'ready' ? t('settings.cache.ready', { date: new Date(cache.savedAt).toLocaleString(i18n.htmlLang()) }) : t('settings.cache.incomplete'))}<br>${esc(t('settings.cache.points'))}<br>${esc(t('settings.cache.basemap', { regions: BASEMAP_REGION_NAMES }))}<br>${esc(t('settings.cache.other'))}</p>${cache?.failures?.length ? `<p class="field-note">${esc(t('settings.cache.failed', { items: cache.failures.map(f => f.label || f.asset).join('、') }))}</p>` : ''}`;
  }
  function openSettings() {
    const uiLang = i18n.getLang();
    const uiLangs = i18n.LANGS.map(lang => `<button data-ui-lang="${esc(lang.code)}" lang="${esc(lang.htmlLang)}" aria-pressed="${uiLang === lang.code}">${esc(lang.label)}</button>`).join('');
    const nativeLangs = availableLangs().map(item => `<button data-lang-choice="${esc(item.code)}" aria-pressed="${state.prefs.lang === item.code}"><span>${esc(item.label)}</span>${item.reviewed === false ? `<small class="lang-machine">${esc(t('speak.machine'))}</small>` : ''}</button>`).join('');
    const accuracy = state.position && (state.position.accuracy === null ? t('settings.accuracy.unknown') : t('unit.m', { n: Math.round(state.position.accuracy) }));
    openSheet(t('settings.title'), `<section class="setting-section"><h3>${esc(t('settings.ui.lang'))}</h3><div class="segmented">${uiLangs}</div><p class="field-note">${esc(t('settings.ui.lang.note'))}</p></section><section class="setting-section"><h3>${esc(t('settings.native'))}</h3><div class="segmented lang-grid">${nativeLangs}</div><p class="field-note">${state.prefsNotice ? `${esc(t(state.prefsNotice))}<br>` : ''}${esc(t('settings.native.note'))}</p></section><section class="setting-section"><h3>${esc(t('settings.stepfree'))}</h3><div class="segmented"><button data-step-free-choice="1" aria-pressed="${state.prefs.stepFree}">${icon('accessible', 20)}${esc(t('settings.stepfree.on'))}</button><button data-step-free-choice="0" aria-pressed="${!state.prefs.stepFree}">${esc(t('settings.stepfree.off'))}</button></div><p class="field-note">${esc(t('settings.stepfree.note'))}</p></section><section class="setting-section"><h3>${esc(t('settings.theme'))}</h3><div class="segmented"><button data-theme-choice="dark" aria-pressed="${state.theme === 'dark'}">${icon('moon', 20)}${esc(t('settings.theme.dark'))}</button><button data-theme-choice="light" aria-pressed="${state.theme === 'light'}">${icon('sun', 20)}${esc(t('settings.theme.light'))}</button></div></section><section class="setting-section"><h3>${esc(t('settings.offline'))}</h3><div id="settings-cache"></div><button class="secondary-button" data-action="cache">${icon('download', 19)}${esc(t('settings.recheck'))}</button></section><section class="setting-section"><h3>${esc(t('settings.position'))}</h3><p class="field-note">${state.position ? `${esc(t('settings.accuracy', { v: accuracy }))}<br>${esc(t('settings.captured', { time: timeText(state.position.capturedAt) }))}` : esc(t('settings.no.position'))}</p><button class="secondary-button" data-action="gps">${icon('location', 20)}${esc(t('common.relocate'))}</button></section><details class="data-disclosure"><summary>${esc(t('settings.sources'))}</summary>${data.sources.map(source => `<p><a href="${esc(source.url || source.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(source.name || source.sourceName)}</a><br>${esc(t('settings.source.updated', { date: dateText(source.updatedAt) }))}</p>`).join('')}<p>${esc(t('settings.osm'))}</p><a href="https://photon.komoot.io" target="_blank" rel="noopener noreferrer">${esc(t('settings.photon'))}</a><p>${esc(t('settings.inferred.note'))}</p><p>${esc(t('settings.accessible.note'))}</p><a href="./NOTICE.txt" target="_blank">${esc(t('settings.notice'))}</a></details>`, 'settings'); renderSettingsCache();
  }
  async function cacheData() { state.cache = await FriendlyOffline.initialize(status => { state.cache = status; renderCache(); }); renderCache(); }
  async function copyValue(key) { const store = actionResource(); const value = store?.[key]; if (!value) { toast(t('copy.none')); return; } try { await navigator.clipboard.writeText(value); toast(t(key === 'phone' ? 'copy.phone' : 'copy.address')); } catch { toast(t('copy.fail')); } }
  function setTheme(theme) { state.theme = theme; document.documentElement.dataset.theme = theme; try { localStorage.setItem('friendly-theme-v6', theme); } catch { /* Optional. */ } drawBasemap(); renderPosition(); renderMarkers(); if (state.activeSheet === 'settings') openSettings(); }
  document.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.resource) openResource(button.dataset.resource);
    if (button.dataset.urgency) pressUrgency(button);
    if (button.dataset.uiLang) setUiLang(button.dataset.uiLang);
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
  $('#list-button').addEventListener('click', () => { openSheet(t('panel.list.view'), '', 'list'); renderPanel(); });
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
  $('#guidance-resources')?.addEventListener('click', () => { openSheet(t('panel.list.view'), '', 'list'); renderPanel(); });
  $('#destination-clear').addEventListener('click', () => { state.destination = null; if (referenceMarker) map.removeLayer(referenceMarker); referenceMarker = null; $('#destination-clear').hidden = true; $('#search-label').textContent = t('search.where'); cancelDestinationRoute(); renderAll(); });
  map.on('moveend zoomend', () => { cancelAnimationFrame(viewportFrame); viewportFrame = requestAnimationFrame(() => { syncOnlineTiles(); renderPanel(); renderMarkers(); renderGuidance(); renderDetailsDistance(); }); });
  new ResizeObserver(() => map.invalidateSize({ animate: false })).observe($('#map-stage'));
  function connectivity() { state.online = navigator.onLine; cancelSearch(); syncOnlineTiles(); renderAll(); if (state.activeSheet === 'search') openSearch(); if (state.online) cacheData(); }
  window.addEventListener('online', connectivity); window.addEventListener('offline', connectivity);
  window.addEventListener('deviceorientationabsolute', orientation); window.addEventListener('deviceorientation', orientation);
  document.addEventListener('keydown', () => { document.documentElement.dataset.input = 'keyboard'; }); document.addEventListener('pointerdown', () => { document.documentElement.dataset.input = 'pointer'; });
  try { if (localStorage.getItem('friendly-theme-v6') === 'dark') state.theme = 'dark'; } catch { /* Optional. */ }
  readPrefs();
  highlights = window.FriendlyHighlights?.create({ map, stores, icon, escapeHtml: esc, distance, t, guideHost: $('#guide-timer'),
    onSelectResource: store => selectResource(store.id), onShowDetails: showDetails, onRequestPosition: requestPosition,
    onUseDemoPosition: useDemoPosition, onOpenExplore: () => { state.panelCollapsed = false; if (state.screen === 'map') refreshMapLayout(); else pushScreen({ view: 'map', urgency: state.urgency }); } });
  $('#highlight-map-launch')?.addEventListener('click', () => highlights?.open('wifi'));
  i18n.apply(); $('#search-label').textContent = t('map.search');
  document.documentElement.dataset.theme = state.theme; updateIcons(); drawBasemap(); syncOnlineTiles(); renderFilters(); renderAll(); initScreen();
  requestPosition(); cacheData();
})();
