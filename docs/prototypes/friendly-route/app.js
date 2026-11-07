/* 友善同行 App v4：裝置定位、本地路網；評論與互助不傳送至伺服器。 */
(() => {
  'use strict';
  const data = window.FRIENDLY_DATA;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  if (!data || !window.L || !window.FriendlyRouter) {
    document.body.insertAdjacentHTML('afterbegin', '<p role="alert">必要圖資尚未載入，請恢復連線後重新開啟。</p>'); return;
  }
  const services = { wifi: { label: 'Free WiFi', short: 'WiFi', icon: '⌁' }, charge: { label: '行動裝置充電', short: '充電', icon: 'ϟ' }, toilet: { label: '友善廁所', short: '廁所', icon: 'WC' }, accessible: { label: '無障礙友善', short: '無障礙', icon: '♿' } };
  const APP_VERSION = 'friendly-app-v2'; // Retain local reviews; route snapshots have their own schema.
  const SNAPSHOT_VERSION = 4;
  const scopePath = new URL('./', location.href).pathname;
  const CACHE_NAME = `friendly-route-v4:${scopePath}`;
  const requiredAssets = ['./', './index.html', './app.js', './styles.css', './map-ui.css', './data.js', './routing-data.js', './routing.js', './search.js', './vendor/leaflet.js', './vendor/leaflet.css'];
  const baseKey = `${APP_VERSION}:${scopePath}`;
  const storage = {
    read(key, fallback) { try { return JSON.parse(localStorage.getItem(`${baseKey}:${key}`)) ?? fallback; } catch { return fallback; } },
    write(key, value) { try { localStorage.setItem(`${baseKey}:${key}`, JSON.stringify(value)); return true; } catch { return false; } },
    remove(key) { try { localStorage.removeItem(`${baseKey}:${key}`); } catch { /* Storage may be unavailable. */ } },
  };
  const stores = data.stores.map((store) => ({ ...store, id: String(store.id) }));
  const byId = new Map(stores.map((store) => [store.id, store]));
  const known = (id) => byId.has(String(id));
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const validPoint = (point) => point && Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
  const validRoute = (route) => route && Array.isArray(route.coordinates) && route.coordinates.length > 1 && route.coordinates.every((p) => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])) && Number.isFinite(route.distanceM) && Number.isFinite(route.resourceCount);
  const originalReviews = storage.read('reviews', []);
  const reviews = Array.isArray(originalReviews) ? originalReviews.filter((r) => r && known(r.storeId) && services[r.service] && ['yes', 'no'].includes(r.outcome) && typeof r.comment === 'string' && Number.isFinite(r.time)).slice(-300) : [];
  const loadedSnapshot = storage.read('snapshot', null);
  const validReference = (place) => place === null || (validPoint(place) && typeof place.id === 'string' && typeof place.name === 'string' && place.name.trim() && typeof place.address === 'string' && ['catalog', 'photon'].includes(place.source));
  const snapshotValid = loadedSnapshot && loadedSnapshot.version === APP_VERSION && loadedSnapshot.snapshotVersion === SNAPSHOT_VERSION && loadedSnapshot.dataVersion === data.version
    && Array.isArray(loadedSnapshot.points) && loadedSnapshot.points.length === 2 && loadedSnapshot.points.every(validPoint) && validRoute(loadedSnapshot.route)
    && known(loadedSnapshot.resourceId) && String(loadedSnapshot.points[1].storeId || loadedSnapshot.points[1].id) === loadedSnapshot.resourceId
    && validReference(loadedSnapshot.destinationPlace) && Number.isFinite(loadedSnapshot.savedAt) && typeof loadedSnapshot.date === 'string'
    && Array.isArray(loadedSnapshot.filters) && loadedSnapshot.filters.every((key) => services[key]) && [100, 250, 500].includes(loadedSnapshot.radius);

  const state = {
    screen: 'home', date: localDate(), locationMode: null, demoLocation: null, savedLocation: null, destinationPlace: null, resourceId: null,
    previewPlace: null, previewMessage: '', searchTarget: 'destination', searchIndex: null, searchResults: [], searchGeneration: 0, searchController: null,
    gps: null, gpsStatus: 'idle', gpsMessage: '尚未取得定位', gpsRequest: 0,
    points: [], routes: [], selectedRouteId: null, preferredRouteId: 'shortest', criteria: null, routingNote: '', calculating: false,
    filters: new Set(Object.keys(services)), radius: 250, routeOnly: false, search: '', selectedId: null,
    reviews, simulatedOffline: storage.read('simulateOffline', false) === true,
    snapshot: snapshotValid ? loadedSnapshot : null, cacheVerified: false, downloading: false,
    request: null, helpRole: 'sender', helpDraft: { placeId: '', reason: '想詢問附近哪裡可以借用 WiFi／充電', consent: false, shareRoute: false },
  };
  let toastTimer; let workerRegistration; let helperMap; let helperMapFrame; let focusedBeforeDrawer;
  const isOffline = () => state.simulatedOffline || !navigator.onLine;
  const formatDate = (time) => new Date(time).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  const distanceLabel = (meters) => meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`;
  const toast = (message) => { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false; toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 5000); };
  const sourceDate = data.source.updatedAt || '2026-07-20';
  const selectedRoute = () => state.routes.find((route) => route.id === state.selectedRouteId) || null;
  const routeStores = () => state.points;
  function serviceTags(store) { return store.services.filter((key) => services[key]).map((key) => `<span class="service-tag"><span aria-hidden="true">${services[key].icon}</span>${services[key].short}</span>`).join(''); }
  function storeReviews(id) { return state.reviews.filter((r) => String(r.storeId) === String(id)); }
  function quality(id) {
    const entries = storeReviews(id); if (!entries.length) return { code: 'unknown', label: '尚無回報', reason: '尚無本機試填回報；不是沒有服務。', entries };
    const no = entries.some((r) => r.outcome === 'no'); const yes = entries.some((r) => r.outcome === 'yes');
    return { code: no ? 'caution' : 'good', label: no ? '需再確認' : '有順利回報', reason: no ? (yes ? '回報不一致，請先向店家確認。' : '有使用不順利的回報，請先向店家確認。') : '有順利使用的本機回報，不代表目前一定可用。', entries };
  }
  function setScreen() {
    state.screen = 'home'; $('#app').dataset.screen = 'home'; $('#home-screen').hidden = false; $('#back-button').hidden = true; $('#screen-step').textContent = 'APP / V4';
    renderPreview(); requestAnimationFrame(() => { map.invalidateSize({ animate: false }); renderMap(); fitRoute(); });
  }
  $('#home-gps').addEventListener('click', requestPosition);
  $('#preview-refresh-location').addEventListener('click', requestPosition);
  function invalidateComparison() {
    state.helpDraft.consent = false; state.helpDraft.shareRoute = false; state.draftRevision = (state.draftRevision || 0) + 1; state.calculating = false;
    state.routes = []; state.points = []; state.selectedRouteId = null; state.criteria = null; state.routeOnly = false; $('#save-offline').disabled = true;
  }
  function storedOrigin(point) { return { ...point, kind: 'saved', name: point.kind === 'demo' ? '已保存的示範位置（非目前位置）' : '已保存位置（不是新 GPS）' }; }
  function currentOrigin() {
    const point = state.locationMode === 'gps' ? state.gps : state.locationMode === 'demo' ? state.demoLocation : state.locationMode === 'saved' ? state.savedLocation : null;
    return validPoint(point) ? { ...point } : null;
  }
  function locationLabel() {
    if (state.locationMode === 'demo') return '示範位置（非目前位置）';
    if (state.locationMode === 'saved') return '已保存位置（不是新 GPS）';
    if (state.gps) return state.gpsStatus === 'ready' || state.gpsStatus === 'outside' ? '目前位置（GPS）' : '上次取得的 GPS 位置';
    return '尚未取得目前位置';
  }
  function requestPosition() {
    if (isOffline()) { toast('離線僅能查看已下載資料；恢復連線後可重新定位。'); return; }
    const token = ++state.gpsRequest;
    if (!window.isSecureContext || !navigator.geolocation) { state.gpsStatus = 'error'; state.gpsMessage = '此瀏覽器未提供定位。請用 HTTPS 開啟，或明確選擇示範位置。'; renderGps(); renderPreview(); return; }
    state.gpsStatus = 'pending'; state.gpsMessage = '正在取得裝置定位…'; renderGps(); renderPreview();
    navigator.geolocation.getCurrentPosition(async (position) => {
      if (token !== state.gpsRequest || isOffline()) return;
      const { latitude: lat, longitude: lng, accuracy } = position.coords;
      if (!validPoint({ lat, lng })) { state.gpsStatus = 'error'; state.gpsMessage = '定位結果無效，請重新定位或選擇示範位置。'; renderGps(); renderPreview(); return; }
      state.gps = { id: 'device-position', name: '目前位置（GPS）', label: '目前位置（GPS）', lat, lng, accuracy: Number.isFinite(accuracy) ? accuracy : null, capturedAt: position.timestamp || Date.now(), kind: 'gps' };
      state.locationMode = 'gps'; const inside = FriendlyRouter.contains(state.gps); state.gpsStatus = inside ? 'ready' : 'outside';
      state.gpsMessage = inside ? (accuracy > 200 ? `定位誤差約 ${Math.round(accuracy)} m，路線僅供參考；可重新定位。` : '已取得目前位置，點資源即可查看路線。') : '已取得真實位置，但超出本地路網範圍，無法計算資源路線。可改用明示的示範位置。';
      invalidateComparison(); renderGps(); renderAll(); renderPreview();
      if (state.previewPlace || state.resourceId) await routeToPreview(); else map.setView([lat, lng], 16, { animate: false });
    }, (error) => {
      if (token !== state.gpsRequest || isOffline()) return;
      state.gpsStatus = 'error'; state.gpsMessage = error.code === 1 ? '定位權限未開啟。可重試，或選擇示範位置查看資源。' : error.code === 3 ? '定位逾時，請重試或選擇示範位置。' : '目前無法取得位置，請重試或選擇示範位置。'; renderGps(); renderPreview();
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  }
  function renderGps() {
    const pending = state.gpsStatus === 'pending'; const label = locationLabel();
    $('#home-gps').disabled = pending || isOffline(); $('#preview-refresh-location').disabled = pending || isOffline(); $('#demo-location').disabled = isOffline();
    $('#home-gps-title').textContent = pending ? '正在定位…' : label;
    const locationNote = state.locationMode === 'demo' ? '正在展示示範位置附近的資源；不代表你所在的位置。' : state.locationMode === 'saved' ? '目前為下載時的位置與路線；重新定位後才能更新。' : '';
    $('#home-gps-detail').textContent = locationNote ? `${locationNote}${state.gpsStatus === 'error' ? ` ${state.gpsMessage}` : ''}` : state.gpsMessage;
    $('#home-location-label').textContent = `${label}${state.gpsStatus === 'pending' ? ' · 定位中…' : state.locationMode === 'gps' && state.gps?.accuracy > 200 ? ` · 誤差約 ${Math.round(state.gps.accuracy)} m` : ''}${state.gpsStatus === 'error' || (state.locationMode === 'gps' && state.gpsStatus === 'outside') ? ` · ${state.gpsMessage}` : ''}`;
    $('#preview-refresh-location').textContent = pending ? '正在定位…' : '重新定位';
  }
  async function useDemoLocation() {
    if (isOffline()) return; const store = byId.get(String(data.demoRoute[0])); if (!store) return;
    state.gpsRequest += 1; state.gpsStatus = 'idle';
    state.locationMode = 'demo'; state.demoLocation = { ...catalogPlace(store), name: '示範位置（非目前位置）', kind: 'demo' }; invalidateComparison();
    renderGps(); renderAll(); renderPreview(); if (state.previewPlace || state.resourceId) await routeToPreview(); else fitRoute();
  }
  $('#demo-location').addEventListener('click', useDemoLocation);
  function renderFilters() {
    ['resource-filters', 'map-filters'].forEach((id) => {
      $(`#${id}`).innerHTML = Object.entries(services).map(([key, s]) => `<button type="button" class="filter-chip" data-service="${key}" aria-pressed="${id === 'map-filters' ? state.filters.size === 1 && state.filters.has(key) : state.filters.has(key)}"><span class="service-icon" aria-hidden="true">${s.icon}</span><span>${s.short === 'WiFi' ? 'Wi-Fi' : s.short}</span></button>`).join('');
      $$(`#${id} button`).forEach((button) => button.addEventListener('click', () => { const key = button.dataset.service; if (id === 'map-filters') state.filters = new Set(state.filters.size === 1 && state.filters.has(key) ? Object.keys(services) : [key]); else state.filters.has(key) ? state.filters.delete(key) : state.filters.add(key); renderFilters(); renderAll(); renderPreview(); }));
    });
  }
  function catalogPlace(store) { return { id: String(store.id), storeId: String(store.id), name: store.name, label: store.name, address: store.address, lat: store.lat, lng: store.lng, source: 'catalog', kind: 'store' }; }
  async function calculateRoute(points) {
    const fail = (message) => { state.previewMessage = message; renderPreview(); };
    if (isOffline()) return;
    if (!points[0]) { fail('尚未取得位置；請重新定位，或關閉卡片後選擇明示的示範位置。'); return; }
    if (points[0].kind === 'saved') { fail('目前是已保存位置；重新定位後才會更新這間資源的路線。'); return; }
    if (points.some((point) => !validPoint(point) || !FriendlyRouter.contains(point))) { fail('目前採用的位置或資源超出本地路網範圍，無法計算步行路線。'); return; }
    const revision = state.draftRevision; const comparisonServices = state.filters.size ? [...state.filters] : Object.keys(services); const comparisonRadius = state.radius;
    state.calculating = true; state.previewMessage = '正在計算最短步行路線…'; renderPreview(); renderMap();
    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (revision !== state.draftRevision || isOffline()) return;
      const samePosition = points[0].lat === points[1].lat && points[0].lng === points[1].lng;
      const result = samePosition ? { routes: [{ id: 'shortest', label: '同一位置', distanceM: 0, estimateMinutes: 0, coordinates: points.map((point) => [point.lat, point.lng]), connectors: [], resourceCount: 0 }], candidateCount: 1 } : await FriendlyRouter.compare({ points, services: comparisonServices, radius: comparisonRadius, stores });
      if (revision !== state.draftRevision || isOffline()) return;
      if (result.error || !result.routes?.length) throw new Error(result.error || '本地路網無法連接這間資源，請查看其他資源。');
      const route = result.routes.find((entry) => entry.id === 'shortest') || result.routes[0];
      state.points = points; state.routes = [route]; state.selectedRouteId = route.id; state.resourceId = String(points[1].storeId || points[1].id);
      state.criteria = { services: comparisonServices, radius: comparisonRadius, candidateCount: result.candidateCount }; state.routingNote = result.warning || '本地路網快照，通行條件需依現場確認。';
      state.previewMessage = ''; renderMap(); renderList(); fitRoute();
    } catch (error) { if (revision === state.draftRevision) fail(error instanceof Error ? error.message : '路線暫時無法計算，請重試。'); }
    finally { if (revision === state.draftRevision) { state.calculating = false; renderPreview(); } }
  }
  async function selectPlace(place) {
    const id = String(place?.storeId || place?.id); const store = byId.get(id); if (!store) return;
    state.previewPlace = catalogPlace(store); state.selectedId = id; state.previewMessage = '';
    if ($('#resources-dialog').open) $('#resources-dialog').close();
    renderPreview();
    if (!isOffline()) await routeToPreview(); else renderMap();
  }
  async function routeToPreview() {
    const resourcePlace = state.previewPlace || (known(state.resourceId) ? catalogPlace(byId.get(state.resourceId)) : null);
    if (!resourcePlace || isOffline()) return;
    const resource = { ...resourcePlace }; const origin = currentOrigin(); invalidateComparison(); state.resourceId = String(resource.storeId || resource.id);
    await calculateRoute([origin, resource]); renderMap();
  }
  function renderDestination() {
    const place = state.destinationPlace; $('#destination-reference').hidden = !place;
    $('#destination-chip').textContent = place ? `目的地 · ${place.name}` : ''; $('#clear-destination').disabled = isOffline();
  }
  function setDestination(place) {
    if (isOffline() || !validReference(place) || !place) return;
    state.destinationPlace = { ...place }; renderDestination(); renderMap(); fitRoute();
    toast('已標記目的地；資源路線維持由目前採用的位置出發。');
  }
  $('#destination-chip').addEventListener('click', () => { if (!state.destinationPlace) return; map.setView([state.destinationPlace.lat, state.destinationPlace.lng], 16, { animate: false }); showPlaceDetails(state.destinationPlace); });
  $('#clear-destination').addEventListener('click', () => { if (isOffline()) return; state.destinationPlace = null; renderDestination(); renderMap(); });
  function renderPreview() {
    renderDestination(); const place = state.previewPlace; $('#place-preview').hidden = !place; $('#home-overview').hidden = Boolean(place);
    if (!place) return;
    const store = byId.get(String(place.storeId || place.id)); const route = selectedRoute(); const endpoint = state.points[1];
    const matches = route && endpoint && String(endpoint.storeId || endpoint.id) === String(place.storeId || place.id);
    const count = route ? stores.filter((entry) => entry.services.some((key) => state.filters.has(key)) && FriendlyRouter.distanceToRoute(entry, route.coordinates) <= state.radius).length : 0;
    $('#place-preview-content').innerHTML = `<p class="drawer-eyebrow">友善資源 · 官方名冊</p><h3>${esc(place.name)}</h3><p class="card-address">${esc(place.address || '未提供地址')}</p><div class="service-tags">${serviceTags(store)}</div>`;
    $('#preview-status').textContent = state.previewMessage || (matches ? `步行路線 ${distanceLabel(route.distanceM)} · 約 ${Math.round(route.estimateMinutes || route.distanceM / (4000 / 60))} 分 · 沿線 ${count} 間資源` : isOffline() ? '離線僅能查看已下載路線；這間資源尚無已下載路線，可查看店家資訊。' : !currentOrigin() ? '尚未取得位置，請重新定位，或關閉卡片後使用示範位置。' : '尚未找到可用的步行路線。');
    $('#preview-location-note').textContent = matches ? `路線採用：${locationLabel()}${state.locationMode === 'gps' && state.gps?.accuracy > 200 ? `；定位誤差約 ${Math.round(state.gps.accuracy)} m` : ''}。依本地路網估算，請核對現場通行條件。` : locationLabel();
    $('#preview-save-offline').disabled = !matches || state.calculating; renderGps();
  }
  function showPlaceDetails(place) { if (!place) return; const id = String(place.storeId || place.id); if (known(id)) openStore(id); else { $('#place-info-content').innerHTML = `<h2>${esc(place.name)}</h2><p>${esc(place.address || '未提供地址')}</p><p class="fine-print">目的地參考標記，不是資源路線的起點或終點。OpenStreetMap · Photon 地點資料，未列於本機友善店家名冊。</p><p class="micro">${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}</p>`; $('#place-info-dialog').showModal(); } }
  $('#preview-details').addEventListener('click', () => showPlaceDetails(state.previewPlace));
  $('#preview-save-offline').addEventListener('click', openInfo);
  $('#close-preview').addEventListener('click', () => { state.previewPlace = null; state.selectedId = null; state.previewMessage = ''; renderPreview(); renderMap(); });
  const searchClient = window.FriendlySearch?.createClient({ endpoint: window.FRIENDLY_SEARCH_CONFIG?.endpoint });
  const searchLocal = (query) => window.FriendlySearch?.searchLocal(query, stores) || stores.filter((store) => `${store.name} ${store.address}`.toLowerCase().includes(query.toLowerCase())).slice(0, 15).map(catalogPlace);
  function cancelSearch() { state.searchGeneration += 1; state.searchController?.abort(); state.searchController = null; $('#search-submit').disabled = isOffline(); }
  function renderSearchResults(results, generation) {
    state.searchResults = results.filter(validPoint);
    $('#search-results').innerHTML = state.searchResults.map((place, index) => `<button class="search-result" data-search-result="${index}"><strong>${esc(place.name)}</strong><span>${esc(place.address || '未提供地址')}</span><small class="search-result-meta">${place.source === 'catalog' ? '本機友善店家' : 'OpenStreetMap · Photon'}${FriendlyRouter.contains(place) ? '' : ' · 超出路網快照範圍'}</small></button>`).join('');
    $$('[data-search-result]').forEach((button) => button.addEventListener('click', async () => {
      if (generation !== state.searchGeneration || isOffline()) return;
      const place = state.searchResults[Number(button.dataset.searchResult)]; if (!place) return;
      cancelSearch(); $('#search-dialog').close();
      setDestination(place);
    }));
  }
  function showLocalSearch() {
    cancelSearch(); const query = $('#place-search').value.trim(); const results = query ? searchLocal(query) : [];
    renderSearchResults(results, state.searchGeneration); $('#search-status').textContent = isOffline() ? '離線只可查看已下載行程，無法搜尋新的目的地。' : query ? results.length ? `本機找到 ${results.length} 個地點；也可按搜尋查找其他地點。` : '本機沒有符合地點；按搜尋查找其他地點。' : '輸入地點、地址或店名。';
  }
  function openSearch() {
    $('#search-title').textContent = '標記目的地'; $('#place-search').value = '';
    showLocalSearch(); if (!$('#search-dialog').open) $('#search-dialog').showModal(); $('#place-search').focus();
  }
  $('#home-search').addEventListener('click', () => openSearch());
  $('#place-search').addEventListener('input', showLocalSearch);
  $('#search-dialog').addEventListener('close', cancelSearch);
  $('#search-form').addEventListener('submit', async (event) => {
    event.preventDefault(); if (isOffline()) return; cancelSearch(); const query = $('#place-search').value.trim(); const generation = state.searchGeneration; const local = query ? searchLocal(query) : [];
    renderSearchResults(local, generation);
    if (!query) { $('#search-status').textContent = '請先輸入搜尋關鍵字。'; return; }
    if (!searchClient) { $('#search-status').textContent = '地點搜尋模組尚未載入，目前僅能使用本機名冊。'; return; }
    state.searchController = new AbortController(); $('#search-submit').disabled = true; $('#search-status').textContent = '正在搜尋地點…';
    try {
      const remote = await searchClient.search(query, { signal: state.searchController.signal });
      if (generation !== state.searchGeneration || $('#place-search').value.trim() !== query) return;
      const results = [...local, ...remote.filter((place) => !local.some((entry) => entry.name === place.name && Math.abs(entry.lat - place.lat) < .0001 && Math.abs(entry.lng - place.lng) < .0001))];
      renderSearchResults(results, generation); $('#search-status').textContent = results.length ? `找到 ${results.length} 個地點。請核對地址後選擇。` : '找不到符合地點，請試試完整地址或其他名稱。';
    } catch (error) { if (generation !== state.searchGeneration || error.name === 'AbortError') return; $('#search-status').textContent = `${window.FriendlySearch?.ERROR_MESSAGES?.[error.code] || '線上搜尋暫時無法使用，請稍後重試。'}${local.length ? '仍可選擇下方本機結果。' : ''}`; }
    finally { if (generation === state.searchGeneration) { state.searchController = null; $('#search-submit').disabled = isOffline(); } }
  });
  const map = L.map('map', { preferCanvas: true, zoomControl: false, minZoom: 10, maxZoom: 19, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false });
  map.setView([25.034, 121.561], 16, { animate: false }); map.attributionControl.setPrefix(false); map.attributionControl.addAttribution('© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap · ODbL</a>');
  map.createPane('basemap'); map.getPane('basemap').style.zIndex = 250; map.createPane('range'); map.getPane('range').style.zIndex = 350;
  function mapStyle(feature) { const p = feature.properties || {}; if (feature.geometry.type.includes('Polygon')) return { fillColor: p.leisure ? '#203a2d' : '#1d2a27', fillOpacity: .95, color: '#2b3833', weight: .5 }; return { color: ['primary', 'secondary', 'tertiary'].includes(p.highway) ? '#394841' : '#2e3c36', weight: ['primary', 'secondary', 'tertiary'].includes(p.highway) ? 7 : 3, opacity: 1 }; }
  const names = new Set();
  L.geoJSON(data.map, { pane: 'basemap', interactive: false, style: mapStyle, onEachFeature: (f) => { const name = f.properties?.name; if (!name || names.has(name) || f.geometry.type !== 'LineString' || !['primary', 'secondary'].includes(f.properties.highway)) return; names.add(name); const c = f.geometry.coordinates[Math.floor(f.geometry.coordinates.length / 2)]; L.marker([c[1], c[0]], { interactive: false, keyboard: false, pane: 'basemap', icon: L.divIcon({ className: 'road-label', html: esc(name), iconSize: [95, 12] }) }).addTo(map); } }).addTo(map);
  const rangeLayer = L.layerGroup().addTo(map); const routeLayer = L.layerGroup().addTo(map); const markerLayer = L.layerGroup().addTo(map); const gpsLayer = L.layerGroup().addTo(map); const helpLayer = L.layerGroup().addTo(map);
  function fitRoute() {
    const route = selectedRoute(); const reference = state.destinationPlace && FriendlyRouter.contains(state.destinationPlace) ? state.destinationPlace : null;
    const origin = currentOrigin(); const points = route ? route.coordinates.slice() : origin ? [[origin.lat, origin.lng]] : [];
    if (reference) points.push([reference.lat, reference.lng]);
    const preview = $('#place-preview'); const previewHeight = !preview.hidden && typeof preview.getBoundingClientRect === 'function' ? preview.getBoundingClientRect()?.height : 0;
    const bottomPadding = Math.max(320, Number.isFinite(previewHeight) && previewHeight > 0 ? Math.ceil(previewHeight) + 24 : 320);
    if (points.length > 1) map.fitBounds(points, { paddingTopLeft: [32, state.destinationPlace ? 250 : 190], paddingBottomRight: [32, bottomPadding], maxZoom: 16, animate: false });
    else if (points.length === 1) map.setView(points[0], 16, { animate: false });
    else map.setView([25.034, 121.561], 16, { animate: false });
  }
  $('#fit-map').addEventListener('click', fitRoute);
  function routeDistance(store) { const route = selectedRoute(); return route ? FriendlyRouter.distanceToRoute(store, route.coordinates) : Infinity; }
  function nearbyDistance(store) {
    const origin = currentOrigin(); if (!origin) return Infinity;
    const radians = Math.PI / 180; const dLat = (store.lat - origin.lat) * radians; const dLng = (store.lng - origin.lng) * radians;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(origin.lat * radians) * Math.cos(store.lat * radians) * Math.sin(dLng / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  }
  function filteredStores() { return stores.filter((store) => store.services.some((key) => state.filters.has(key))).filter((store) => !state.search || `${store.name} ${store.address}`.toLowerCase().includes(state.search.toLowerCase())).map((store) => ({ store, distance: nearbyDistance(store), routeDistance: routeDistance(store) })).filter((entry) => !state.routeOnly || entry.routeDistance <= state.radius).sort((a, b) => (a.distance - b.distance) || a.store.name.localeCompare(b.store.name, 'zh-Hant')); }
  function renderMap() {
    if (expireIfNeeded() && $('#help-dialog').open) renderHelp();
    rangeLayer.clearLayers(); routeLayer.clearLayers(); markerLayer.clearLayers(); gpsLayer.clearLayers(); helpLayer.clearLayers();
    if (isOffline() && !state.cacheVerified) return;
    const route = selectedRoute(); const showRoute = Boolean(route);
    if (showRoute) {
      const mpp = 156543.03392 * Math.cos(map.getCenter().lat * Math.PI / 180) / (2 ** map.getZoom());
      L.polyline(route.coordinates, { pane: 'range', color: '#a6dc65', opacity: .07, weight: state.radius * 2 / mpp, lineCap: 'round', interactive: false }).addTo(rangeLayer);
      L.polyline(route.coordinates, { color: '#5b7a37', weight: 8, opacity: .3, interactive: false }).addTo(routeLayer);
      L.polyline(route.coordinates, { color: '#bdff58', weight: 3, interactive: false }).addTo(routeLayer);
      (route.connectors || []).forEach((segment) => { L.polyline(segment, { color: '#151b20', weight: 7, interactive: false }).addTo(routeLayer); L.polyline(segment, { color: '#a1d7e9', weight: 3, dashArray: '3 5', interactive: false }).addTo(routeLayer); });
      state.points.forEach((p, i) => L.marker([p.lat, p.lng], { title: p.name, zIndexOffset: 500, icon: L.divIcon({ className: '', html: `<span class="route-number${i ? '' : ' origin'}">${i ? '資' : state.locationMode === 'demo' ? '示' : state.locationMode === 'saved' ? '存' : '你'}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] }) }).bindTooltip(esc(p.name)).on('click', () => { if (i) showPlaceDetails(p); else toast(`${locationLabel()}，不是手動起點。`); }).addTo(routeLayer));
    }
    const visible = stores.filter((store) => store.services.some((key) => state.filters.has(key))).map((store) => ({ store, distance: routeDistance(store) }));
    visible.forEach(({ store, distance }) => { const q = quality(store.id); const key = store.services.find((service) => state.filters.has(service)); const near = route && distance <= state.radius; const selected = state.selectedId === store.id;
      L.marker([store.lat, store.lng], { title: `${store.name}，${near ? '路線附近，' : ''}${q.label}`, zIndexOffset: selected ? 700 : near ? 400 : 0, icon: L.divIcon({ className: '', html: `<span class="store-marker ${q.code}${selected ? ' selected' : ''}${near ? ' near-route' : route ? ' dimmed' : ''}">${services[key]?.icon || '·'}</span>`, iconSize: [44, 44], iconAnchor: [22, 22] }) }).bindTooltip(`${esc(store.name)} · ${q.label}`).on('click', () => { return selectPlace(catalogPlace(store)); }).addTo(markerLayer);
    });
    if (!route && currentOrigin() && state.locationMode !== 'gps') { const origin = currentOrigin(); L.marker([origin.lat, origin.lng], { title: locationLabel(), icon: L.divIcon({ className: '', html: `<span class="route-number origin demo-marker">${state.locationMode === 'saved' ? '存' : '示'}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] }) }).bindTooltip(esc(locationLabel())).addTo(routeLayer); }
    if (state.destinationPlace) { const place = state.destinationPlace; L.marker([place.lat, place.lng], { title: `目的地參考：${place.name}（僅標記）`, zIndexOffset: 850, icon: L.divIcon({ className: '', html: '<span class="destination-marker">目</span>', iconSize: [44, 44], iconAnchor: [22, 22] }) }).bindTooltip(`目的地：${esc(place.name)} · 僅標記位置`).on('click', () => showPlaceDetails(place)).addTo(markerLayer); }
    if (state.gps && state.locationMode === 'gps') { L.marker([state.gps.lat, state.gps.lng], { title: locationLabel(), icon: L.divIcon({ className: '', html: '<span class="gps-marker"></span>', iconSize: [18, 18], iconAnchor: [9, 9] }) }).addTo(gpsLayer); if (state.gps.accuracy && state.gps.accuracy < 2000) L.circle([state.gps.lat, state.gps.lng], { radius: state.gps.accuracy, color: '#89d9ff', fillOpacity: .06, weight: 1, interactive: false }).addTo(gpsLayer); }
    $('#map-area').textContent = state.locationMode === 'gps' && state.gpsStatus === 'outside' ? '目前位置・此區無本地底圖' : '信義生活圈・本地圖資';
    if (activeRequest()) { const p = byId.get(state.request.placeId); L.marker([p.lat, p.lng], { icon: L.divIcon({ className: '', html: '<span class="help-marker">♡</span>', iconSize: [30, 30], iconAnchor: [15, 15] }) }).bindTooltip(`本機示範求助點：${esc(p.name)}`).addTo(helpLayer); }
  }
  map.on('zoomend', renderMap);
  function renderList() {
    const result = isOffline() && !state.cacheVerified ? [] : filteredStores(); $('#results-title').textContent = `${result.length} 間友善店家`;
    $('#result-context').textContent = `${currentOrigin() ? `依距離${locationLabel()}的直線距離排序` : '位置未知，依店名排序；尚無附近距離'}${state.routeOnly ? ` · 限路線 ${state.radius} m 內` : ''} · 未確認營業與現場可用狀態`;
    $('#store-list').innerHTML = result.length ? result.map(({ store, distance }) => { const q = quality(store.id); return `<button class="store-card" data-store="${esc(store.id)}"><div class="card-top"><h3>${esc(store.name)}</h3><span class="card-distance">${Number.isFinite(distance) ? `直線 ${distanceLabel(distance)}` : '距離未知'}</span></div><p class="card-address">${esc(store.address)}</p><div class="service-tags">${serviceTags(store)}</div><p class="quality-label"><i class="quality-dot ${q.code}"></i>${q.label}${q.entries.length ? `・${q.entries.length} 筆本機試填` : ''}</p><p class="card-condition">名冊標示 · 消費條件待確認 · ${esc(sourceDate)}</p></button>`; }).join('') : '<div class="empty-state"><strong>目前沒有符合的店家</strong><p>可放大範圍、改看全區，或調整服務篩選。</p></div>';
    $$('[data-store]').forEach((b) => b.addEventListener('click', () => selectPlace(catalogPlace(byId.get(b.dataset.store)))));
  }
  function renderAll() { $('#route-only').checked = state.routeOnly; $('#route-only').disabled = !selectedRoute(); $$('#range-options button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.radius) === state.radius))); renderMap(); renderList(); }
  function openResources() { renderFilters(); renderAll(); $('#resources-dialog').showModal(); }
  $('#home-resources').addEventListener('click', () => { state.routeOnly = false; openResources(); });
  $('#route-only').addEventListener('change', (event) => { state.routeOnly = event.target.checked; renderAll(); });
  $$('#range-options button').forEach((b) => b.addEventListener('click', () => { state.radius = Number(b.dataset.radius); renderAll(); renderPreview(); }));
  $('#search-store').addEventListener('input', (event) => { state.search = event.target.value.trim(); renderList(); });
  function openStore(id) { if (!known(id)) return; focusedBeforeDrawer = document.activeElement; state.selectedId = id; renderDetail(); if (!$('#store-drawer').open) $('#store-drawer').showModal(); renderMap(); }
  $('#close-store').addEventListener('click', () => $('#store-drawer').close());
  $('#store-drawer').addEventListener('close', () => { state.selectedId = state.previewPlace?.storeId || null; renderMap(); if (focusedBeforeDrawer?.isConnected) focusedBeforeDrawer.focus(); });
  $$('[data-close]').forEach((b) => b.addEventListener('click', () => $(`#${b.dataset.close}`).close()));

  function renderDetail() {
    const store = byId.get(state.selectedId); if (!store) return;
    const q = quality(store.id); const entries = q.entries.slice().sort((a, b) => b.time - a.time);
    const breakdown = Object.keys(services).filter((key) => entries.some((entry) => entry.service === key)).map((key) => `${services[key].short}：${entries.filter((entry) => entry.service === key && entry.outcome === 'yes').length} 順利／${entries.filter((entry) => entry.service === key && entry.outcome === 'no').length} 不順利`).join('；');
    $('#store-detail').innerHTML = `<p class="drawer-eyebrow">沿途的一份照應・官方名冊點位</p><h2>${esc(store.name)}</h2><p class="detail-address">${esc(store.address)}</p><div class="service-status">${Object.entries(services).map(([key, service]) => `<div class="${store.services.includes(key) ? '' : 'unlisted'}"><span aria-hidden="true">${service.icon}</span> ${service.label}<small>${store.services.includes(key) ? '名冊有標示' : '名冊未標示'}</small></div>`).join('')}</div><p class="source-note">名冊更新 ${esc(sourceDate)}。消費條件、營業與現場可用狀態待確認；無障礙標籤不代表沿途路徑無障礙。</p><div class="detail-links">${store.phone ? `<a href="tel:${esc(store.phone.replace(/[^+\d,;]/g, ''))}">電話 ${esc(store.phone)}</a>` : '<span class="fine-print">名冊未提供電話</span>'}${store.url && /^https:\/\//.test(store.url) ? `<a href="${esc(store.url)}" target="_blank" rel="noopener">原始店家資料 ↗</a>` : ''}</div><div class="detail-section"><h3>服務品質回報</h3><span class="local-badge">本機試填・未公開・非官方認證</span><div class="quality-box"><strong><i class="quality-dot ${q.code}"></i>${q.label}</strong><p>${q.reason}</p><p>${entries.length} 筆本機回報${entries.length ? `・最新 ${formatDate(entries[0].time)}` : ''}</p>${breakdown ? `<div class="quality-breakdown">${esc(breakdown)}</div>` : ''}</div><form id="review-form" class="review-form"><label for="review-service">這次使用什麼服務？</label><select id="review-service">${Object.entries(services).map(([key, service]) => `<option value="${key}">${service.label}${store.services.includes(key) ? '' : '（名冊未標示）'}</option>`).join('')}</select><label for="review-outcome">使用狀況</label><select id="review-outcome"><option value="yes">順利使用</option><option value="no">未能順利使用，建議再確認</option></select><label for="review-comment">補充說明 <span class="mini-label">選填，最多 160 字；請勿填個資</span></label><textarea id="review-comment" maxlength="160" placeholder="記下實際使用條件；此處僅測試，不公開"></textarea><button class="primary wide" type="submit">儲存本機試填回報</button></form><div class="review-history">${entries.slice(0, 5).map((entry) => `<article class="review-entry"><header><strong>${services[entry.service].short} · ${entry.outcome === 'yes' ? '順利' : '需確認'}</strong><small>${formatDate(entry.time)}</small></header>${entry.comment ? `<p>${esc(entry.comment)}</p>` : ''}<small>本機試填，未驗證</small></article>`).join('')}</div>${entries.length ? '<button id="clear-reviews" class="text-button">清除這間店的本機試填</button>' : ''}</div><div class="detail-section"><h3>也能直接向店家詢問</h3><button id="show-inquiry" class="secondary wide">出示大字詢問卡</button><div id="inquiry-card" hidden><p class="inquiry-message">請問可以借用 WiFi、充電、廁所或無障礙空間嗎？<br><strong>是否需要消費，或有使用限制？</strong></p><p>${esc(store.name)}<br>${esc(store.address)}<br>${esc(store.phone || '')}</p><button id="print-inquiry" class="text-button">列印詢問卡 ↗</button></div></div>`;
    $('#review-form').addEventListener('submit', (event) => {
      event.preventDefault(); const service = $('#review-service').value; const outcome = $('#review-outcome').value; const comment = $('#review-comment').value.trim().slice(0, 160);
      if (!services[service] || !['yes', 'no'].includes(outcome)) return;
      const entry = { storeId: store.id, service, outcome, comment, time: Date.now() };
      const next = [...state.reviews, entry].slice(-300);
      if (!storage.write('reviews', next)) { toast('瀏覽器不允許本機儲存，回報尚未保存。'); return; }
      state.reviews = next; renderDetail(); renderAll(); toast('已儲存在這台裝置；未發布，也不代表店家認證。');
    });
    $('#clear-reviews')?.addEventListener('click', () => { const next = state.reviews.filter((entry) => String(entry.storeId) !== store.id); if (!storage.write('reviews', next)) { toast('無法清除，請檢查瀏覽器儲存設定。'); return; } state.reviews = next; renderDetail(); renderAll(); toast('已清除這間店的本機試填。'); });
    $('#show-inquiry').addEventListener('click', () => { $('#inquiry-card').hidden = !$('#inquiry-card').hidden; });
    $('#print-inquiry').addEventListener('click', () => { document.body.classList.add('printing-inquiry'); window.print(); document.body.classList.remove('printing-inquiry'); });
  }

  async function verifyOfflineAssets() {
    if (!('caches' in window)) return false;
    const cache = await caches.open(CACHE_NAME);
    const matches = await Promise.all(requiredAssets.map((path) => cache.match(new URL(path, location.href).href)));
    return matches.every(Boolean);
  }
  async function prepareWorker() {
    // An existing offline package is readable even when registration/update cannot reach the origin.
    if (state.snapshot) {
      try { state.cacheVerified = await verifyOfflineAssets(); }
      catch { state.cacheVerified = false; }
      if (!state.cacheVerified) { state.snapshot = null; storage.remove('snapshot'); }
      if (isOffline() && state.cacheVerified) restoreSnapshot();
    }
    updateConnectivity();
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return false;
    try {
      if (isOffline()) {
        workerRegistration = await navigator.serviceWorker.getRegistration(new URL('./', location.href).href);
        return Boolean(workerRegistration?.active);
      }
      workerRegistration = await navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' });
      await navigator.serviceWorker.ready;
      return Boolean(workerRegistration?.active);
    } catch { return false; }
  }
  function openInfo() { updateConnectivity(); if (!$('#info-dialog').open) $('#info-dialog').showModal(); }
  $('#open-info').addEventListener('click', openInfo);
  function updateConnectivity() {
    const offline = isOffline();
    $('#network-status').textContent = offline ? state.simulatedOffline ? '離線示範' : '裝置離線' : '裝置在線';
    $('#network-status').classList.toggle('offline', offline);
    $('#network-status').title = '依瀏覽器回報顯示，不代表 Wi-Fi 連線或伺服器可達。';
    $('#simulate-offline').checked = state.simulatedOffline; $('#simulate-offline').disabled = !navigator.onLine;
    $('#save-offline').disabled = offline || state.downloading || !selectedRoute();
    $('#home-search').disabled = offline; $('#search-submit').disabled = offline;
    $('#no-cache-overlay').hidden = !offline || Boolean(state.snapshot && state.cacheVerified);
    $('#leave-offline').hidden = !state.simulatedOffline; $('#restore-offline').hidden = !(state.snapshot && state.cacheVerified);
    if (state.snapshot && state.cacheVerified) {
      $('#cache-summary').textContent = `已下載 · ${formatDate(state.snapshot.savedAt)}`;
      $('#offline-detail').textContent = `已保存位置、資源路線${state.snapshot.destinationPlace ? '、目的地參考標記' : ''}與 ${stores.length} 間店家。離線只讀取這份資料；保存位置不是新 GPS。`;
    } else {
      $('#cache-summary').textContent = selectedRoute() ? '還沒下載這段路' : '先取得位置，再點選一間資源';
      $('#offline-detail').textContent = '完整下載後可離線重開 App；快取被瀏覽器移除時，需重新下載。';
    }
    renderGps(); renderPreview(); renderAll(); if ($('#help-dialog').open) renderHelp();
  }
  function restoreSnapshot() {
    if (!state.snapshot || !state.cacheVerified) { updateConnectivity(); return; }
    const snapshot = state.snapshot; state.gpsRequest += 1; cancelSearch(); invalidateComparison();
    state.gpsStatus = 'idle'; state.gpsMessage = '目前查看已保存位置與資源路線。'; state.locationMode = 'saved'; state.savedLocation = storedOrigin(snapshot.points[0]);
    state.points = [{ ...state.savedLocation }, { ...snapshot.points[1] }]; state.resourceId = snapshot.resourceId;
    state.previewPlace = catalogPlace(byId.get(snapshot.resourceId)); state.selectedId = snapshot.resourceId; state.destinationPlace = snapshot.destinationPlace ? { ...snapshot.destinationPlace } : null;
    state.routes = [JSON.parse(JSON.stringify(snapshot.route))]; state.selectedRouteId = snapshot.route.id; state.criteria = snapshot.criteria;
    state.date = snapshot.date; state.radius = snapshot.radius; state.filters = new Set(snapshot.filters); state.routeOnly = false; state.previewMessage = '';
    state.routingNote = '已下載的資源路線與保存位置，不是新 GPS 或即時導航。'; state.search = ''; $('#search-store').value = '';
    renderFilters(); setScreen(); updateConnectivity();
  }
  function enterOffline() {
    state.gpsRequest += 1; cancelSearch();
    if (state.gpsStatus === 'pending') { state.gpsStatus = 'idle'; state.gpsMessage = '定位已因離線中止；恢復連線後可重試。'; }
    if (state.snapshot && state.cacheVerified) { restoreSnapshot(); toast('已開啟下載時的資源路線與目的地標記；離線不會送出協助請求。'); }
    else { invalidateComparison(); state.previewMessage = '尚無已下載路線，請恢復連線。'; updateConnectivity(); }
  }
  $('#restore-offline').addEventListener('click', () => { $('#info-dialog').close(); restoreSnapshot(); });
  $('#simulate-offline').addEventListener('change', (event) => { state.simulatedOffline = event.target.checked; storage.write('simulateOffline', state.simulatedOffline); if (isOffline()) enterOffline(); else { updateConnectivity(); toast('已恢復連線示範，不會自動重送協助請求。'); } });
  $('#leave-offline').addEventListener('click', () => { state.simulatedOffline = false; storage.write('simulateOffline', false); updateConnectivity(); });
  window.addEventListener('offline', enterOffline);
  window.addEventListener('online', () => { updateConnectivity(); toast('裝置回報恢復連線；協助請求仍需自行確認。'); });
  $('#save-offline').addEventListener('click', async () => {
    const route = selectedRoute(); if (isOffline() || state.downloading || state.calculating || !route) return;
    const snapshot = { version: APP_VERSION, snapshotVersion: SNAPSHOT_VERSION, resourceId: String(state.points[1].storeId || state.points[1].id), destinationPlace: state.destinationPlace ? { ...state.destinationPlace } : null, dataVersion: data.version, savedAt: Date.now(), date: state.date, points: JSON.parse(JSON.stringify(state.points)), route: JSON.parse(JSON.stringify(route)), criteria: state.criteria, radius: state.radius, filters: [...state.filters] };
    state.downloading = true; $('#save-offline').textContent = '下載中…'; updateConnectivity();
    try {
      if (!await workerReady || !workerRegistration?.active) throw new Error('此瀏覽器未提供離線快取，請用 HTTPS 或 localhost 開啟。');
      await new Promise((resolve, reject) => {
        const channel = new MessageChannel(); let settled = false;
        const timer = setTimeout(() => { settled = true; channel.port1.close(); reject(new Error('下載逾時，請保持連線後重試。')); }, 30000);
        channel.port1.onmessage = ({ data: message }) => { if (settled) return; settled = true; clearTimeout(timer); channel.port1.close(); if (message.ok && message.version === APP_VERSION) resolve(); else reject(new Error(message.error || '離線程式版本尚未更新，請重新整理後重試。')); };
        workerRegistration.active.postMessage({ type: 'CACHE_ROUTE', version: APP_VERSION }, [channel.port2]);
      });
      if (!await verifyOfflineAssets()) throw new Error('離線資產尚未齊全，請重新下載。');
      if (!storage.write('snapshot', snapshot)) throw new Error('無法保存行程，請允許瀏覽器的本機儲存。');
      state.snapshot = snapshot; state.cacheVerified = true; toast('已下載地圖、路線與起點。可以試試離線重開。');
    } catch (error) {
      state.snapshot = null; state.cacheVerified = false; storage.remove('snapshot');
      if ('caches' in window) { try { await caches.delete(CACHE_NAME); } catch { /* The snapshot remains revoked. */ } }
      toast(`${error instanceof Error ? error.message : '下載失敗。'} 離線包已停用。`);
    } finally { state.downloading = false; $('#save-offline').textContent = '更新／下載路線與地圖'; updateConnectivity(); }
  });

  function openHelp() {
    if (!state.helpDraft.placeId) state.helpDraft.placeId = state.selectedId || state.points.find((p) => known(p.id))?.id || stores[0].id;
    if (!$('#help-dialog').open) $('#help-dialog').showModal();
    renderHelp();
  }
  $('#home-help').addEventListener('click', openHelp); $('#preview-help').addEventListener('click', openHelp);
  $('#close-help').addEventListener('click', () => $('#help-dialog').close());
  $('#help-dialog').addEventListener('close', disposeHelperMap);
  $('#help-dialog').addEventListener('click', (event) => { if (event.target === $('#help-dialog')) { const bounds = $('#help-dialog').getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) $('#help-dialog').close(); } });
  $('#sender-tab').addEventListener('click', () => { state.helpRole = 'sender'; renderHelp(); });
  $('#helper-tab').addEventListener('click', () => { state.helpRole = 'helper'; renderHelp(); });
  const requestStatusLabel = { pending: '等待示範回應', acknowledged: '有人已回應（示範）', resolved: '已結束', cancelled: '已撤銷', expired: '已到期' };
  function requestCountdown() { if (!state.request) return ''; const seconds = Math.max(0, Math.ceil((state.request.expiresAt - Date.now()) / 1000)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
  function disposeHelperMap() {
    if (helperMapFrame) { cancelAnimationFrame(helperMapFrame); helperMapFrame = null; }
    if (helperMap) { const previousMap = helperMap; helperMap = null; previousMap.stop(); previousMap.remove(); }
  }
  function expireIfNeeded() {
    if (!state.request || !['pending', 'acknowledged'].includes(state.request.status) || Date.now() < state.request.expiresAt) return false;
    state.request = { status: 'expired', placeId: '', sharedPoints: [], routeCoordinates: [], routeConnectors: [], reason: '', shareRoute: false };
    state.helpDraft.consent = false; state.helpDraft.shareRoute = false;
    return true;
  }
  function activeRequest() {
    return state.request && ['pending', 'acknowledged'].includes(state.request.status) && Date.now() < state.request.expiresAt;
  }
  function renderHelp() {
    disposeHelperMap();
    if (expireIfNeeded()) renderMap();
    ['sender', 'helper'].forEach((name) => { $(`#${name}-tab`).setAttribute('aria-selected', String(name === state.helpRole)); $(`#${name}-panel`).hidden = name !== state.helpRole; });
    const active = activeRequest();
    const offlineNotice = isOffline() ? '<div class="warning-inline">目前離線：只能查看本機示範內容，無法送出或回應。恢復連線不會自動重送。</div>' : '<p class="fine-print">裝置回報在線；此版本只改變本機狀態，不會連線到其他使用者。</p>';
    if (active) {
      const request = state.request; const place = byId.get(request.placeId);
      $('#sender-panel').innerHTML = `${offlineNotice}<div class="request-status"><strong>${requestStatusLabel[request.status]}</strong><p>本機示範・剩餘 <span class="request-counter">${requestCountdown()}</span> 到期；不代表實際有人前來。</p></div><div class="privacy-preview"><strong>對方會看到的資料</strong><p>求助點：${esc(place.name)}</p><p>${esc(place.address)}</p><p>路線：${request.shareRoute ? `已同意分享這次選定的 ${request.sharedPoints.length} 個點位` : '未分享，只顯示求助點'}</p><p>需求：${esc(request.reason)}</p></div><div class="help-actions"><button id="resolve-request" class="primary">結束示範</button><button id="cancel-request" class="secondary">撤銷請求</button></div><button id="expire-request" class="text-button">測試到期狀態</button>`;
      $('#resolve-request').addEventListener('click', () => finishRequest('resolved'));
      $('#cancel-request').addEventListener('click', () => finishRequest('cancelled'));
      $('#expire-request').addEventListener('click', () => finishRequest('expired'));
    } else {
      const draft = state.helpDraft;
      $('#sender-panel').innerHTML = `${offlineNotice}${state.request ? `<div class="request-status"><strong>${requestStatusLabel[state.request.status]}</strong><p>求助點與路線已從對方的示範畫面隱藏。可以重新建立一次示範。</p></div>` : ''}<form id="help-form"><label for="help-place">我要在哪裡請人幫忙？</label><select id="help-place">${stores.map((store) => `<option value="${esc(store.id)}" ${store.id === draft.placeId ? 'selected' : ''}>${esc(store.name)}</option>`).join('')}</select><label for="help-reason">需要的協助</label><textarea id="help-reason" maxlength="120" rows="2">${esc(draft.reason)}</textarea><div class="privacy-preview" id="help-preview"></div><label class="checkbox-field"><input id="help-consent" type="checkbox" ${draft.consent ? 'checked' : ''}><span>我同意在這次示範中分享選定的求助點及需求。這不是我的即時定位。</span></label><label class="checkbox-field"><input id="help-share-route" type="checkbox" ${draft.shareRoute ? 'checked' : ''}><span>另外分享這次選定的路線，包含本次起點（選填，預設不分享）。</span></label><p class="form-error" id="help-error" role="alert"></p><button class="primary wide" type="submit" ${isOffline() ? 'disabled' : ''}>建立協助請求・本機示範</button></form>`;
      const updateDraft = () => { state.helpDraft = { placeId: $('#help-place').value, reason: $('#help-reason').value.slice(0, 120), consent: $('#help-consent').checked, shareRoute: $('#help-share-route').checked }; renderHelpPreview(); };
      ['help-place', 'help-reason', 'help-consent', 'help-share-route'].forEach((id) => $(`#${id}`).addEventListener('input', updateDraft));
      renderHelpPreview();
      $('#help-form').addEventListener('submit', (event) => {
        event.preventDefault(); updateDraft(); const draftNow = state.helpDraft;
        if (isOffline()) { $('#help-error').textContent = '目前離線，沒有送出任何請求。'; return; }
        if (!draftNow.consent) { $('#help-error').textContent = '請先確認並同意分享這個求助點。'; return; }
        if (!draftNow.reason.trim()) { $('#help-error').textContent = '請簡短填寫需要的協助。'; return; }
        if (!known(draftNow.placeId)) { $('#help-error').textContent = '請選取有效的求助地點。'; return; }
        state.request = { ...draftNow, reason: draftNow.reason.trim(), sharedPoints: draftNow.shareRoute ? JSON.parse(JSON.stringify(state.points)) : [], routeCoordinates: draftNow.shareRoute && selectedRoute() ? JSON.parse(JSON.stringify(selectedRoute().coordinates)) : [], routeConnectors: draftNow.shareRoute && selectedRoute() ? JSON.parse(JSON.stringify(selectedRoute().connectors || [])) : [], status: 'pending', createdAt: Date.now(), expiresAt: Date.now() + 15 * 60 * 1000 };
        renderHelp(); renderMap(); toast('已建立本機示範；切換「我是幫忙的人」查看接收畫面。');
      });
    }
    if (!active) {
      $('#helper-panel').innerHTML = `<div class="help-empty"><strong>${state.request ? requestStatusLabel[state.request.status] : '目前沒有協助請求'}</strong><p>${state.request ? '原本的求助點與路線已隱藏。' : '先在「我需要幫忙」建立請求，再切換到這裡。'}</p><span class="not-live">同一裝置的角色示範，不是其他真人帳號</span></div>`;
    } else {
      const request = state.request; const place = byId.get(request.placeId);
      $('#helper-panel').innerHTML = `${offlineNotice}<span class="local-badge">接收方視角・本機示範</span><p class="request-place">${esc(place.name)}</p><p class="detail-address">${esc(place.address)}</p><p class="request-note">${esc(request.reason)}</p><div class="privacy-preview"><strong>對方選擇分享的路線</strong>${request.shareRoute ? `<ol class="request-route">${request.sharedPoints.map((point) => `<li>${esc(point.name || point.label || '已分享點位')}</li>`).join('')}</ol><p>這是本地路網建議，含估計接線；不是即時導航。</p>` : '<p>對方沒有分享路線。只顯示已同意的求助點。</p>'}</div><div id="helper-mini-map" class="helper-mini-map" aria-label="接收方看到的求助點及已同意的路線"></div><div class="request-status"><strong>${requestStatusLabel[request.status]}</strong><p>剩餘 <span class="request-counter">${requestCountdown()}</span>・回應不代表救援承諾。</p></div><button id="ack-request" class="primary wide" ${isOffline() || request.status === 'acknowledged' ? 'disabled' : ''}>${request.status === 'acknowledged' ? '已回應（示範）' : '我可以提供資訊・示範回應'}</button>`;
      $('#ack-request').addEventListener('click', () => {
        if (expireIfNeeded()) { renderHelp(); renderMap(); toast('請求已到期，分享內容已隱藏。'); return; }
        if (isOffline() || !activeRequest()) return;
        state.request.status = 'acknowledged'; renderHelp(); toast('示範回應已顯示；沒有通知真人。');
      });
      if (state.helpRole === 'helper') {
        helperMapFrame = requestAnimationFrame(() => {
          helperMapFrame = null;
          if ($('#help-dialog').open && state.helpRole === 'helper' && activeRequest()) renderHelpMap(state.request);
        });
      }
    }
  }
  function renderHelpPreview() {
    const draft = state.helpDraft; const place = byId.get(draft.placeId);
    $('#help-preview').innerHTML = `<strong>送出前先看一眼</strong><p>求助點：${esc(place?.name || '尚未選取')}</p><p>${esc(place?.address || '')}</p><p>路線：${draft.shareRoute ? routeStores().map((store) => esc(store.name)).join(' → ') : '不分享'}</p><p>保留 15 分鐘，可隨時撤銷；只分享你選定的內容，不會追蹤即時位置。</p>`;
  }
  function renderHelpMap(request) {
    const target = $('#helper-mini-map'); if (!target || !target.isConnected || target.getBoundingClientRect().width === 0) return;
    const place = byId.get(request.placeId); const visibleStores = request.shareRoute ? request.sharedPoints : [place];
    const miniature = L.map(target, { preferCanvas: true, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false, zoomControl: false, attributionControl: true, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, keyboard: false });
    helperMap = miniature;
    miniature.setView([place.lat, place.lng], 15, { animate: false });
    miniature.invalidateSize({ animate: false });
    miniature.attributionControl.setPrefix(false); miniature.attributionControl.addAttribution('© <a href="https://www.openstreetmap.org/copyright">OSM・ODbL</a>');
    L.geoJSON(data.map, { interactive: false, style: mapStyle }).addTo(miniature);
    if (request.shareRoute) { L.polyline(request.routeCoordinates, { color: '#b9ff5b', weight: 3 }).addTo(miniature); request.routeConnectors.forEach((segment) => { L.polyline(segment, { color: '#171b20', weight: 5 }).addTo(miniature); L.polyline(segment, { color: '#89d9ff', weight: 3, dashArray: '4 5' }).addTo(miniature); }); }
    L.circleMarker([place.lat, place.lng], { color: '#fff', fillColor: '#b8513e', fillOpacity: 1, radius: 9, weight: 3 }).addTo(miniature).bindTooltip('求助點', { permanent: true, direction: 'top' });
    miniature.fitBounds([...visibleStores.map((store) => [store.lat, store.lng]), [place.lat, place.lng]], { padding: [25, 25], maxZoom: 16, animate: false });
    miniature.invalidateSize({ animate: false });
  }
  function finishRequest(status) { if (!state.request) return; state.request = { status, placeId: '', sharedPoints: [], routeCoordinates: [], routeConnectors: [], reason: '', shareRoute: false }; state.helpDraft.consent = false; state.helpDraft.shareRoute = false; renderHelp(); renderMap(); toast(`示範請求${requestStatusLabel[status]}，已移除分享內容。`); }
  const refreshAfterResume = () => {
    if (!expireIfNeeded()) return;
    renderMap(); if ($('#help-dialog').open) renderHelp();
  };
  window.addEventListener('pageshow', refreshAfterResume);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshAfterResume(); });
  setInterval(() => {
    if (!state.request || !['pending', 'acknowledged'].includes(state.request.status)) return;
    if (Date.now() >= state.request.expiresAt) { finishRequest('expired'); return; }
    $$('.request-counter').forEach((element) => { element.textContent = requestCountdown(); });
  }, 1000);
  $('#dataset-count').textContent = `${stores.length} 間店家 · 本地開放資料快照`;
  $('#data-version').textContent = `名冊更新 ${sourceDate} · OpenStreetMap © contributors / ODbL · 原型快照 ${data.version}`;
  if (data.source.url) $('#source-link').href = data.source.url;
  renderFilters(); setScreen(); updateConnectivity();
  const workerReady = prepareWorker();
  if (!isOffline()) requestPosition();
})();
