/* 友善同行 App v2：裝置定位、本地路網；評論與互助不傳送至伺服器。 */
(() => {
  'use strict';
  const data = window.FRIENDLY_DATA;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  if (!data || !window.L || !window.FriendlyRouter) {
    document.body.insertAdjacentHTML('afterbegin', '<p role="alert">必要圖資尚未載入，請恢復連線後重新開啟。</p>'); return;
  }
  const services = { wifi: { label: 'Free WiFi', short: 'WiFi', icon: '⌁' }, charge: { label: '行動裝置充電', short: '充電', icon: 'ϟ' }, toilet: { label: '友善廁所', short: '廁所', icon: 'WC' }, accessible: { label: '無障礙友善', short: '無障礙', icon: '♿' } };
  const APP_VERSION = 'friendly-app-v2';
  const scopePath = new URL('./', location.href).pathname;
  const CACHE_NAME = `friendly-route-v2:${scopePath}`;
  const requiredAssets = ['./', './index.html', './app.js', './styles.css', './data.js', './routing-data.js', './routing.js', './vendor/leaflet.js', './vendor/leaflet.css'];
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
  const originalHistory = storage.read('history', []);
  const history = Array.isArray(originalHistory) ? originalHistory.filter((r) => r && r.version === APP_VERSION && Array.isArray(r.points) && r.points.length >= 2 && r.points.every(validPoint) && validRoute(r.route) && typeof r.date === 'string').slice(0, 20) : [];
  const loadedSnapshot = storage.read('snapshot', null);
  const snapshotValid = loadedSnapshot && loadedSnapshot.version === APP_VERSION && loadedSnapshot.dataVersion === data.version && Array.isArray(loadedSnapshot.points) && loadedSnapshot.points.length >= 2 && loadedSnapshot.points.every(validPoint) && validRoute(loadedSnapshot.route) && Number.isFinite(loadedSnapshot.savedAt) && typeof loadedSnapshot.date === 'string' && Array.isArray(loadedSnapshot.filters) && [100, 250, 500].includes(loadedSnapshot.radius);
  const state = {
    screen: 'home', date: localDate(), originMode: 'gps', manualOrigin: '', historyOrigin: null, destinations: [''],
    gps: null, gpsStatus: 'idle', gpsMessage: '尚未取得定位', gpsRequest: 0,
    points: [], routes: [], selectedRouteId: null, preferredRouteId: 'shortest', criteria: null, routingNote: '', calculating: false,
    filters: new Set(Object.keys(services)), radius: 250, routeOnly: false, search: '', selectedId: null,
    reviews, history, simulatedOffline: storage.read('simulateOffline', false) === true,
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
  function setScreen(screen) {
    state.screen = screen; $('#app').dataset.screen = screen;
    ['home', 'plan', 'confirm', 'journey'].forEach((name) => { $(`#${name}-screen`).hidden = name !== screen; });
    $('#back-button').hidden = screen === 'home'; $('#screen-step').textContent = { home: 'APP / V2', plan: '01 / 規劃', confirm: '02 / 確認', journey: '03 / 出發' }[screen];
    if (screen === 'plan') { renderDates(); renderPlan(); }
    if (screen === 'confirm') renderRouteOptions();
    if (screen === 'journey') renderJourney();
    requestAnimationFrame(() => { map.invalidateSize({ animate: false }); renderMap(); if (screen !== 'plan') fitRoute(); });
  }
  $('#back-button').addEventListener('click', () => setScreen(state.screen === 'confirm' ? 'plan' : state.screen === 'journey' ? 'confirm' : 'home'));
  $('#home-start').addEventListener('click', () => { if (isOffline()) { if (state.cacheVerified) restoreSnapshot(); else openInfo(); return; } setScreen('plan'); if (state.originMode === 'gps' && state.gpsStatus === 'idle') requestPosition(); });
  $('#home-gps').addEventListener('click', () => { state.originMode = 'gps'; state.demoOrigin = false; requestPosition(); });
  $('#retry-gps').addEventListener('click', requestPosition);
  $('#cancel-gps').addEventListener('click', () => { state.gpsRequest += 1; state.gpsStatus = 'idle'; invalidateComparison(); state.gpsMessage = '已取消定位，可重試或手動選起點。'; renderGps(); });
  function invalidateComparison() { state.helpDraft.consent = false; state.helpDraft.shareRoute = false; state.draftRevision = (state.draftRevision || 0) + 1; state.routes = []; state.points = []; state.selectedRouteId = null; state.criteria = null; state.routeOnly = false; $('#start-trip').disabled = true; $('#save-history').disabled = true; $('#save-offline').disabled = true; }
  function storedOrigin(point, kind) { const prefix = kind === 'saved' ? '已保存' : '歷史'; const name = point.kind === 'gps' || /目前位置|GPS/.test(point.name || '') ? `${prefix} GPS 起點` : `${prefix}起點：${(point.name || point.label || '選定位置').replace(/^(歷史起點|已保存起點)：/, '')}`; return { ...point, kind, name, label: name }; }
  function requestPosition() {
    if (state.originMode === 'gps') invalidateComparison();
    if (!window.isSecureContext || !navigator.geolocation) { state.gpsStatus = 'error'; state.gpsMessage = '此瀏覽器未提供定位。請用 HTTPS 開啟，或手動選起點。'; renderGps(); return; }
    if (isOffline()) { toast('離線僅能讀已下載的行程；請先恢復連線再建立新行程。'); return; }
    const token = ++state.gpsRequest; state.gpsStatus = 'pending'; state.gpsMessage = '正在取得裝置定位…'; renderGps();
    navigator.geolocation.getCurrentPosition((position) => {
      if (token !== state.gpsRequest) return;
      const { latitude: lat, longitude: lng, accuracy } = position.coords;
      if (!validPoint({ lat, lng })) { state.gpsStatus = 'error'; state.gpsMessage = '定位結果無效，請重新取得或手動選起點。'; renderGps(); return; }
      state.gps = { id: 'device-position', name: '目前位置（GPS）', label: '目前位置（GPS）', lat, lng, accuracy: Number.isFinite(accuracy) ? accuracy : null, capturedAt: position.timestamp || Date.now(), kind: 'gps' };
      const inside = FriendlyRouter.contains(state.gps); state.gpsStatus = inside ? 'ready' : 'outside';
      state.gpsMessage = inside ? (accuracy > 200 ? '已取得位置，但定位誤差較大；請核對起點，或重試／手動選擇。' : '已取得目前位置。') : '已取得定位，但不在本版示範路網範圍。可手動選起點或以示範區域試用。';
      renderGps(); renderMap(); if (state.screen === 'home') map.setView([lat, lng], 15, { animate: false });
    }, (error) => {
      if (token !== state.gpsRequest) return;
      state.gpsStatus = 'error'; state.gpsMessage = error.code === 1 ? '定位權限未開啟。你仍可手動選起點，或以示範區域試用。' : error.code === 3 ? '定位逾時，請重試或手動選起點。' : '目前無法取得位置，請重試或手動選起點。'; renderGps();
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  }
  function renderGps() {
    const pending = state.gpsStatus === 'pending'; $('#gps-status').textContent = state.gpsMessage;
    $('#retry-gps').textContent = state.gps ? '重新取得定位' : '取得目前位置'; $('#retry-gps').disabled = pending || isOffline(); $('#home-gps').disabled = pending || isOffline(); $('#cancel-gps').hidden = !pending;
    $('#home-gps-title').textContent = pending ? '正在定位…' : state.gpsStatus === 'ready' ? '目前位置已就緒' : state.gpsStatus === 'outside' ? '目前位置在示範區外' : '從你的位置出發';
    $('#home-gps-detail').textContent = state.gpsStatus === 'idle' ? '取得定位後，起點自動帶入。' : state.gpsMessage;
    $('#gps-meta').textContent = state.gps ? `${state.gps.lat.toFixed(5)}, ${state.gps.lng.toFixed(5)} · ${state.gps.accuracy === null ? '精度未知' : `誤差半徑約 ${Math.round(state.gps.accuracy)} m`} · ${formatDate(state.gps.capturedAt)}${state.gps.accuracy > 200 ? ' · 精度較低，請核對起點' : ''}` : '';
  }
  function renderDates() {
    $('#trip-date').value = state.date;
    const chosen = new Date(`${state.date}T12:00:00`); $('#date-heading').textContent = chosen.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' });
    const today = new Date(); const dates = Array.from({ length: 7 }, (_, i) => { const date = new Date(today); date.setDate(today.getDate() + i); return date; });
    if (!dates.some((d) => localDate(d) === state.date)) { dates.length = 0; for (let i = 0; i < 7; i += 1) { const d = new Date(chosen); d.setDate(chosen.getDate() + i); dates.push(d); } }
    $('#date-strip').innerHTML = dates.map((d) => `<button type="button" class="day-button${localDate(d) === state.date ? ' selected' : ''}" data-date="${localDate(d)}" aria-pressed="${localDate(d) === state.date}"><span>${d.toLocaleDateString('zh-TW', { weekday: 'short' }).replace('週', '')}</span><strong>${d.getDate()}</strong><small>${localDate(d) === localDate() ? '今天' : ' '}</small></button>`).join('');
    $$('#date-strip button').forEach((button) => button.addEventListener('click', () => { state.date = button.dataset.date; invalidateComparison(); renderDates(); }));
  }
  $('#trip-date').addEventListener('change', (event) => { if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) { state.date = event.target.value; invalidateComparison(); renderDates(); } });
  $('#store-options').innerHTML = stores.map((s) => `<option value="${esc(s.name)}">${esc(s.address)}</option>`).join('');
  function renderPlan() {
    const historyOption = $('#origin-source option[value="history"]');
    if (state.originMode === 'history' && !historyOption) $('#origin-source').insertAdjacentHTML('beforeend', '<option value="history">歷史起點</option>');
    const restoredOption = $('#origin-source option[value="history"]'); if (restoredOption) restoredOption.textContent = state.historyOrigin?.kind === 'saved' ? '已保存起點' : '歷史起點';
    $('#origin-source').value = state.originMode; $('#gps-origin').hidden = state.originMode !== 'gps'; $('#manual-origin').hidden = state.originMode === 'gps';
    $('#origin-store').value = state.originMode === 'history' ? state.historyOrigin?.name || '' : state.manualOrigin;
    $('#origin-store').readOnly = state.originMode === 'history';
    $('#origin-note').textContent = state.originMode === 'history' ? (state.historyOrigin?.kind === 'saved' ? '此為離線包的已保存起點，不是新取得的 GPS 位置。可切換目前位置或手動起點。' : '此為已儲存的歷史起點，不是新取得的 GPS 位置。要更改可切換目前位置或手動起點。') : state.demoOrigin ? '示範起點，不是你的目前位置。' : '選擇官方清冊中、示範範圍內的店家。';
    renderDestinations(); renderFilters(); renderGps(); renderHistoryCount();
  }
  $('#origin-source').addEventListener('change', (event) => { state.gpsRequest += 1; if (state.gpsStatus === 'pending') { state.gpsStatus = 'idle'; state.gpsMessage = '定位已取消。'; } state.originMode = event.target.value; state.demoOrigin = false; invalidateComparison(); renderPlan(); });
  $('#origin-store').addEventListener('input', (event) => { state.manualOrigin = event.target.value; state.demoOrigin = false; invalidateComparison(); $('#origin-note').textContent = '選擇官方清冊中、示範範圍內的店家。'; });
  function renderDestinations() {
    $('#destination-inputs').innerHTML = state.destinations.map((name, i) => `<div class="route-row"><span class="stop-number">${i + 1}</span><div class="route-field"><label for="destination-${i}">目的地 ${i + 1}</label><input id="destination-${i}" data-destination="${i}" list="store-options" value="${esc(name)}" placeholder="輸入或選擇店名" autocomplete="off"></div><div class="stop-actions">${i > 0 ? `<button type="button" data-up="${i}" aria-label="將目的地 ${i + 1} 上移">↑</button>` : ''}${state.destinations.length > 1 ? `<button type="button" data-remove="${i}" aria-label="移除目的地 ${i + 1}">×</button>` : ''}</div></div>`).join('');
    $$('[data-destination]').forEach((input) => input.addEventListener('input', () => { state.destinations[Number(input.dataset.destination)] = input.value; invalidateComparison(); }));
    $$('[data-up]').forEach((button) => button.addEventListener('click', () => { const i = Number(button.dataset.up); [state.destinations[i - 1], state.destinations[i]] = [state.destinations[i], state.destinations[i - 1]]; invalidateComparison(); renderDestinations(); }));
    $$('[data-remove]').forEach((button) => button.addEventListener('click', () => { state.destinations.splice(Number(button.dataset.remove), 1); invalidateComparison(); renderDestinations(); }));
    $('#add-stop').disabled = state.destinations.length >= 5 || isOffline();
  }
  $('#add-stop').addEventListener('click', () => { if (state.destinations.length < 5 && !isOffline()) { state.destinations.push(''); invalidateComparison(); renderDestinations(); $(`#destination-${state.destinations.length - 1}`).focus(); } });
  $('#demo-route').addEventListener('click', () => {
    if (isOffline()) { openInfo(); return; }
    state.gpsRequest += 1; if (state.gpsStatus === 'pending') { state.gpsStatus = 'idle'; state.gpsMessage = '已取消定位，現在使用示範起點。'; } invalidateComparison(); const points = data.demoRoute.map((id) => byId.get(String(id))).filter(Boolean);
    state.preferredRouteId = 'shortest'; state.originMode = 'manual'; state.manualOrigin = points[0].name; state.destinations = points.slice(1).map((p) => p.name); state.demoOrigin = true;
    $('#route-error').textContent = ''; setScreen('plan'); $('#origin-note').textContent = '示範起點，不是你的目前位置。'; toast('已帶入示範起點與目的地；尚未使用你的 GPS 位置。');
  });
  function renderFilters() {
    ['filters', 'resource-filters'].forEach((id) => {
      $(`#${id}`).innerHTML = Object.entries(services).map(([key, s]) => `<button type="button" class="filter-chip" data-service="${key}" aria-pressed="${state.filters.has(key)}"><span class="service-icon" aria-hidden="true">${s.icon}</span><span>${s.short === 'WiFi' ? 'Wi-Fi' : s.short}</span></button>`).join('');
      $$(`#${id} button`).forEach((button) => button.addEventListener('click', () => { const key = button.dataset.service; state.filters.has(key) ? state.filters.delete(key) : state.filters.add(key); if (state.screen === 'plan') invalidateComparison(); renderFilters(); renderAll(); }));
    });
  }
  $('#route-form').addEventListener('submit', async (event) => {
    event.preventDefault(); if (isOffline() || state.calculating) return;
    let origin;
    if (state.originMode === 'gps') {
      if (!state.gps || state.gpsStatus !== 'ready') { $('#route-error').textContent = state.gpsStatus === 'outside' ? '目前位置不在示範路網範圍，請手動選起點。' : '請先取得有效的目前位置，或改用手動起點。'; return; }
      if (!FriendlyRouter.contains(state.gps)) { $('#route-error').textContent = '目前位置不在這份示範路網內，請手動選擇示範區內起點。'; return; }
      origin = { ...state.gps };
    } else if (state.originMode === 'history') origin = { ...state.historyOrigin };
    else { const store = stores.find((s) => s.name === state.manualOrigin.trim()); if (!store) { $('#route-error').textContent = '請從建議清單選擇完整的起點店名。'; $('#origin-store').focus(); return; } origin = { id: store.id, lat: store.lat, lng: store.lng, name: store.name, label: store.name, kind: state.demoOrigin ? 'demo' : 'store' }; }
    const destinations = state.destinations.map((name) => stores.find((s) => s.name === name.trim()));
    const missing = destinations.findIndex((s) => !s); if (missing >= 0) { $('#route-error').textContent = `目的地 ${missing + 1} 尚未對應清冊，請選擇完整店名。`; $(`#destination-${missing}`).focus(); return; }
    const points = [origin, ...destinations.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, name: s.name, label: s.name, kind: 'store' }))];
    if (new Set(points.map((p) => `${p.lat},${p.lng}`)).size !== points.length) { $('#route-error').textContent = '起點與目的地有重複，請選擇不同地點。'; return; }
    if (!state.filters.size) { $('#route-error').textContent = '請至少選一種沿途需要的服務。'; return; }
    invalidateComparison();
    const revision = state.draftRevision || 0; const comparisonServices = [...state.filters]; const comparisonRadius = state.radius;
    state.calculating = true; $('#start-trip').disabled = true; $('#save-history').disabled = true; $('#save-offline').disabled = true; $('#build-route').disabled = true; $('#build-route').textContent = '正在比較路線…'; $('#route-error').textContent = '';
    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const result = await FriendlyRouter.compare({ points, services: comparisonServices, radius: comparisonRadius, stores });
      if (revision !== (state.draftRevision || 0) || isOffline()) { $('#route-error').textContent = '設定已變更，請再次確認路線。'; return; }
      if (result.error || !result.routes?.length) throw new Error(result.error || '這份本地路網沒有可連接的路線，請調整起迄點。');
      state.points = points; state.routes = result.routes; const preferred = result.routes.find((route) => route.id === state.preferredRouteId); state.selectedRouteId = (preferred || result.routes[0]).id; state.criteria = { services: comparisonServices, radius: comparisonRadius, candidateCount: result.candidateCount };
      state.routingNote = result.warning || '依地方路網快照比較；路線與現場通行條件仍需確認。'; state.routeOnly = true; $('#history-saved').textContent = ''; setScreen('confirm'); if (!preferred && state.preferredRouteId === 'resources') toast('這次沒有資源更多的有效候選，已改選最短路徑；請重新確認。');
    } catch (error) { $('#route-error').textContent = error instanceof Error ? error.message : '路線暫時無法計算，請重試。'; }
    finally { state.calculating = false; $('#build-route').disabled = isOffline(); $('#build-route').innerHTML = '下一步 · 確認路線 <span>→</span>'; }
  });
  function renderRouteOptions() {
    $('#confirm-date').textContent = `${state.date} · ${state.points.length - 1} 個目的地 · ${state.points[0]?.kind === 'gps' ? '裝置定位起點' : state.points[0]?.kind === 'history' ? '歷史起點' : state.points[0]?.kind === 'demo' ? '示範起點' : state.points[0]?.kind === 'saved' ? '已保存起點' : '手動起點'}`;
    $('#route-options').innerHTML = state.routes.map((r) => `<button class="route-option${r.id === state.selectedRouteId ? ' selected' : ''}" data-route-id="${esc(r.id)}" aria-pressed="${r.id === state.selectedRouteId}"><small>${r.id === 'shortest' ? '少走一點路' : '多一些沿途資源'}</small><strong>${esc(r.label)}</strong><span class="option-time">${Math.round(r.estimateMinutes || r.distanceM / (4000 / 60))}<small> 分鐘估算</small></span><span class="option-meta"><span>${distanceLabel(r.distanceM)}</span><span>${r.resourceCount} 間資源</span></span></button>`).join('');
    $('#route-options').style.gridTemplateColumns = state.routes.length > 1 ? '' : '1fr';
    $$('[data-route-id]').forEach((button) => button.addEventListener('click', () => { state.selectedRouteId = button.dataset.routeId; state.preferredRouteId = state.selectedRouteId; renderRouteOptions(); renderMap(); fitRoute(); }));
    const criteria = state.criteria; const route = selectedRoute();
    $('#routing-note').textContent = `${state.routingNote} 本次服務：${(criteria?.services || []).map((key) => services[key]?.short).join('、')}，任一符合且距路線 ${criteria?.radius || 250} m 內的不同店家。${route ? `估計接線總長 ${Math.round(route.connectorDistanceM || 0)} m，以藍色虛線標示。` : ''}${state.routes.length === 1 ? '本次沒有找到資源更多的有效候選，僅提供一條路線。' : ''}`;
    $('#start-trip').disabled = !route; $('#save-history').disabled = !route || isOffline();
  }
  $('#start-trip').addEventListener('click', () => { if (selectedRoute() && !state.calculating) { setScreen('journey'); toast('行程已開啟。路線是規劃參考，請依現場道路與通行條件行走。'); } });
  $('#edit-trip').addEventListener('click', () => { if (isOffline()) { toast('離線只讀已下載行程，請恢復連線後編輯。'); return; } setScreen('plan'); });
  function renderJourney() {
    const route = selectedRoute(); if (!route) return;
    $('#journey-label').textContent = route.label; $('#journey-date').textContent = `${state.date} · ${state.points[0]?.kind === 'saved' ? '已保存起點' : `${state.points.length - 1} 個目的地`}`;
    $('#journey-distance').textContent = distanceLabel(route.distanceM); $('#journey-time').textContent = `${Math.round(route.estimateMinutes || route.distanceM / (4000 / 60))} 分`;
    $('#journey-resources').textContent = `${route.resourceCount} 間`; $('#edit-trip').disabled = isOffline();
  }
  function renderHistoryCount() { $('#history-count').textContent = state.history.length ? `${state.history.length} 條已儲存行程` : '還沒有儲存的行程'; }
  $('#save-history').addEventListener('click', () => {
    const route = selectedRoute(); if (!route || isOffline() || state.calculating) return;
    const record = { version: APP_VERSION, id: `${Date.now()}`, savedAt: Date.now(), date: state.date, points: state.points.map((p) => ({ ...p })), route: JSON.parse(JSON.stringify(route)), criteria: state.criteria };
    const next = [record, ...state.history].slice(0, 20); if (!storage.write('history', next)) { toast('本機儲存不可用，沒有新增歷史。'); return; }
    state.history = next; $('#history-saved').textContent = '已儲存於此裝置；包含本次起點。可在歷史路線刪除。'; renderHistoryCount(); toast('行程已儲存到本機歷史。');
  });
  function openHistory() { renderHistory(); $('#history-dialog').showModal(); }
  $('#open-history').addEventListener('click', openHistory); $('#history-shortcut').addEventListener('click', openHistory);
  function renderHistory() {
    $('#history-list').innerHTML = state.history.length ? state.history.map((r) => `<article class="history-card"><h3>${esc(r.points.at(-1).name)}</h3><p>${esc(r.date)} · ${esc(r.route.label)} · ${distanceLabel(r.route.distanceM)}<br>${esc(storedOrigin(r.points[0], 'history').name)} → ${r.points.length - 1} 個目的地</p><div class="history-actions"><button class="text-button" data-restore-history="${esc(r.id)}">套用這條路線 →</button><button class="text-button" data-delete-history="${esc(r.id)}">刪除</button></div></article>`).join('') : '<div class="empty-state"><strong>還沒有歷史路線</strong><p>確認路線後，按「儲存行程到歷史」才會留在此裝置。</p></div>';
    $$('[data-restore-history]').forEach((button) => button.addEventListener('click', () => { if (isOffline()) { toast('離線不能重新規劃歷史行程，請開啟已下載路線。'); return; } const r = state.history.find((entry) => entry.id === button.dataset.restoreHistory); if (!r) return; state.gpsRequest += 1; state.originMode = 'history'; state.historyOrigin = storedOrigin(r.points[0], 'history'); invalidateComparison(); state.preferredRouteId = r.route.id; if (state.gpsStatus === 'pending') { state.gpsStatus = 'idle'; state.gpsMessage = '已取消定位，現在使用歷史起點。'; } state.destinations = r.points.slice(1).map((p) => p.name); state.filters = new Set((r.criteria?.services || Object.keys(services)).filter((key) => services[key])); state.radius = r.criteria?.radius || 250; $('#history-dialog').close(); $('#route-error').textContent = ''; setScreen('plan'); toast('已套用歷史起迄點，保留本次選定日期。下一步將重新比較路線。'); }));
    $$('[data-delete-history]').forEach((button) => button.addEventListener('click', () => { const next = state.history.filter((r) => r.id !== button.dataset.deleteHistory); if (!storage.write('history', next)) { toast('刪除失敗，請檢查本機儲存設定。'); return; } state.history = next; renderHistory(); renderHistoryCount(); }));
  }
  const map = L.map('map', { preferCanvas: true, zoomControl: false, minZoom: 10, maxZoom: 19, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false });
  map.setView([25.034, 121.561], 15, { animate: false }); map.attributionControl.setPrefix(false); map.attributionControl.addAttribution('© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap · ODbL</a>');
  map.createPane('basemap'); map.getPane('basemap').style.zIndex = 250; map.createPane('range'); map.getPane('range').style.zIndex = 350;
  function mapStyle(feature) { const p = feature.properties || {}; if (feature.geometry.type.includes('Polygon')) return { fillColor: p.leisure ? '#25382b' : '#1d2228', fillOpacity: .9, color: '#252d33', weight: .5 }; return { color: ['primary', 'secondary', 'tertiary'].includes(p.highway) ? '#333e46' : '#2b343b', weight: ['primary', 'secondary', 'tertiary'].includes(p.highway) ? 7 : 3, opacity: 1 }; }
  const names = new Set();
  L.geoJSON(data.map, { pane: 'basemap', interactive: false, style: (feature) => { const p = feature.properties || {}; if (feature.geometry.type.includes('Polygon')) return { fillColor: p.leisure ? '#25382b' : '#1d2228', fillOpacity: .9, color: '#252d33', weight: .5 }; return { color: ['primary', 'secondary', 'tertiary'].includes(p.highway) ? '#333e46' : '#2b343b', weight: ['primary', 'secondary', 'tertiary'].includes(p.highway) ? 7 : 3, opacity: 1 }; }, onEachFeature: (f) => { const name = f.properties?.name; if (!name || names.has(name) || f.geometry.type !== 'LineString' || !['primary', 'secondary'].includes(f.properties.highway)) return; names.add(name); const c = f.geometry.coordinates[Math.floor(f.geometry.coordinates.length / 2)]; L.marker([c[1], c[0]], { interactive: false, keyboard: false, pane: 'basemap', icon: L.divIcon({ className: 'road-label', html: esc(name), iconSize: [95, 12] }) }).addTo(map); } }).addTo(map);
  const rangeLayer = L.layerGroup().addTo(map); const routeLayer = L.layerGroup().addTo(map); const markerLayer = L.layerGroup().addTo(map); const gpsLayer = L.layerGroup().addTo(map); const helpLayer = L.layerGroup().addTo(map);
  function fitRoute() {
    const route = selectedRoute();
    if (route && state.screen !== 'home') { const bottom = state.screen === 'confirm' ? 285 : 255; map.fitBounds(route.coordinates, { paddingTopLeft: [32, 105], paddingBottomRight: [32, bottom], maxZoom: 16, animate: false }); }
    else if (state.gps) map.setView([state.gps.lat, state.gps.lng], 15, { animate: false });
    else map.fitBounds(data.bounds, { padding: [12, 60], animate: false });
  }
  $('#fit-map').addEventListener('click', fitRoute);
  function routeDistance(store) { const route = selectedRoute(); return route ? FriendlyRouter.distanceToRoute(store, route.coordinates) : Infinity; }
  function filteredStores() { return stores.filter((s) => s.services.some((key) => state.filters.has(key))).filter((s) => !state.search || `${s.name} ${s.address}`.toLowerCase().includes(state.search.toLowerCase())).map((store) => ({ store, distance: routeDistance(store) })).filter(({ distance }) => !state.routeOnly || distance <= state.radius).sort((a, b) => (a.distance - b.distance) || a.store.name.localeCompare(b.store.name, 'zh-Hant')); }
  function renderMap() {
    if (expireIfNeeded() && $('#help-dialog').open) renderHelp();
    rangeLayer.clearLayers(); routeLayer.clearLayers(); markerLayer.clearLayers(); gpsLayer.clearLayers(); helpLayer.clearLayers();
    if (isOffline() && !state.cacheVerified) return;
    const route = selectedRoute(); const showRoute = route && state.screen !== 'home';
    if (showRoute) {
      const mpp = 156543.03392 * Math.cos(map.getCenter().lat * Math.PI / 180) / (2 ** map.getZoom());
      L.polyline(route.coordinates, { pane: 'range', color: '#a6dc65', opacity: .07, weight: state.radius * 2 / mpp, lineCap: 'round', interactive: false }).addTo(rangeLayer);
      L.polyline(route.coordinates, { color: '#5b7a37', weight: 8, opacity: .3, interactive: false }).addTo(routeLayer);
      L.polyline(route.coordinates, { color: '#bdff58', weight: 3, interactive: false }).addTo(routeLayer);
      (route.connectors || []).forEach((segment) => { L.polyline(segment, { color: '#151b20', weight: 7, interactive: false }).addTo(routeLayer); L.polyline(segment, { color: '#a1d7e9', weight: 3, dashArray: '3 5', interactive: false }).addTo(routeLayer); });
      state.points.forEach((p, i) => L.marker([p.lat, p.lng], { title: p.name, zIndexOffset: 500, icon: L.divIcon({ className: '', html: `<span class="route-number${i ? '' : ' origin'}">${i || '起'}</span>`, iconSize: [24, 24], iconAnchor: [12, 12] }) }).bindTooltip(esc(p.name)).addTo(routeLayer));
    }
    const visible = state.screen === 'home' ? stores.filter((s) => s.services.some((key) => state.filters.has(key))).map((store) => ({ store })) : filteredStores();
    visible.forEach(({ store }) => { const q = quality(store.id); const key = store.services.find((k) => state.filters.has(k)); L.marker([store.lat, store.lng], { title: `${store.name}，${q.label}`, icon: L.divIcon({ className: '', html: `<span class="store-marker ${q.code}${state.selectedId === store.id ? ' selected' : ''}">${services[key]?.icon || '·'}</span>`, iconSize: [24, 24], iconAnchor: [12, 12] }) }).bindTooltip(`${esc(store.name)} · ${q.label}`).on('click', () => openStore(store.id)).addTo(markerLayer); });
    if (state.gps) { L.marker([state.gps.lat, state.gps.lng], { title: state.gpsStatus === 'ready' || state.gpsStatus === 'outside' ? '裝置定位結果' : '上次裝置定位（尚未更新）', icon: L.divIcon({ className: '', html: '<span class="gps-marker"></span>', iconSize: [18, 18], iconAnchor: [9, 9] }) }).addTo(gpsLayer); if (state.gps.accuracy && state.gps.accuracy < 2000) L.circle([state.gps.lat, state.gps.lng], { radius: state.gps.accuracy, color: '#89d9ff', fillOpacity: .06, weight: 1, interactive: false }).addTo(gpsLayer); }
    $('#map-area').textContent = state.screen === 'home' && state.gpsStatus === 'outside' ? '目前位置・此區無本地底圖' : '信義生活圈・本地圖資';
    if (activeRequest()) { const p = byId.get(state.request.placeId); L.marker([p.lat, p.lng], { icon: L.divIcon({ className: '', html: '<span class="help-marker">♡</span>', iconSize: [30, 30], iconAnchor: [15, 15] }) }).bindTooltip(`本機示範求助點：${esc(p.name)}`).addTo(helpLayer); }
  }
  map.on('zoomend', renderMap);
  function renderList() {
    const result = isOffline() && !state.cacheVerified ? [] : filteredStores(); $('#results-title').textContent = `${result.length} 間友善店家`;
    $('#result-context').textContent = `${state.routeOnly ? `距本次路線 ${state.radius} m 內` : '整個示範區域'} · 任一符合 · 未確認營業與現場可用狀態`;
    $('#store-list').innerHTML = result.length ? result.map(({ store, distance }) => { const q = quality(store.id); return `<button class="store-card" data-store="${esc(store.id)}"><div class="card-top"><h3>${esc(store.name)}</h3><span class="card-distance">${Number.isFinite(distance) ? `距線 ${Math.round(distance)} m` : '名冊點位'}</span></div><p class="card-address">${esc(store.address)}</p><div class="service-tags">${serviceTags(store)}</div><p class="quality-label"><i class="quality-dot ${q.code}"></i>${q.label}${q.entries.length ? `・${q.entries.length} 筆本機試填` : ''}</p><p class="card-condition">名冊標示 · 消費條件待確認 · ${esc(sourceDate)}</p></button>`; }).join('') : '<div class="empty-state"><strong>目前沒有符合的店家</strong><p>可放大範圍、改看全區，或調整服務篩選。</p></div>';
    $$('[data-store]').forEach((b) => b.addEventListener('click', () => openStore(b.dataset.store)));
  }
  function renderAll() { $('#route-only').checked = state.routeOnly; $('#route-only').disabled = !selectedRoute(); $$('#range-options button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.radius) === state.radius))); renderMap(); renderList(); }
  function openResources() { renderFilters(); renderAll(); $('#resources-dialog').showModal(); }
  $('#home-resources').addEventListener('click', () => { state.routeOnly = false; openResources(); }); $('#open-resources').addEventListener('click', openResources);
  $('#route-only').addEventListener('change', (event) => { state.routeOnly = event.target.checked; renderAll(); });
  $$('#range-options button').forEach((b) => b.addEventListener('click', () => { state.radius = Number(b.dataset.radius); if (state.screen === 'plan') invalidateComparison(); renderAll(); }));
  $('#search-store').addEventListener('input', (event) => { state.search = event.target.value.trim(); renderList(); });
  function openStore(id) { if (!known(id)) return; focusedBeforeDrawer = document.activeElement; state.selectedId = id; renderDetail(); if (!$('#store-drawer').open) $('#store-drawer').showModal(); renderMap(); }
  $('#close-store').addEventListener('click', () => $('#store-drawer').close());
  $('#store-drawer').addEventListener('close', () => { state.selectedId = null; renderMap(); if (focusedBeforeDrawer?.isConnected) focusedBeforeDrawer.focus(); });
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
  $('#open-info').addEventListener('click', openInfo); $('#journey-offline').addEventListener('click', openInfo);
  function updateConnectivity() {
    const offline = isOffline();
    $('#network-status').textContent = offline ? state.simulatedOffline ? '離線示範' : '裝置離線' : '裝置在線';
    $('#network-status').classList.toggle('offline', offline);
    $('#network-status').title = '依瀏覽器回報顯示，不代表 Wi-Fi 連線或伺服器可達。';
    $('#simulate-offline').checked = state.simulatedOffline; $('#simulate-offline').disabled = !navigator.onLine;
    $('#save-offline').disabled = offline || state.downloading || !selectedRoute();
    $('#build-route').disabled = offline || state.calculating; $('#demo-route').disabled = offline; $('#edit-trip').disabled = offline;
    $('#no-cache-overlay').hidden = !offline || Boolean(state.snapshot && state.cacheVerified);
    $('#leave-offline').hidden = !state.simulatedOffline; $('#restore-offline').hidden = !(state.snapshot && state.cacheVerified);
    if (state.snapshot && state.cacheVerified) {
      $('#cache-summary').textContent = `已下載 · ${formatDate(state.snapshot.savedAt)}`;
      $('#offline-detail').textContent = `已保存起點、${state.snapshot.points.length - 1} 個目的地、路線與 ${stores.length} 間店家。離線只讀取這份行程，資料不是即時狀態。`;
    } else {
      $('#cache-summary').textContent = selectedRoute() ? '還沒下載這段路' : '先規劃並確認一條路線';
      $('#offline-detail').textContent = '完整下載後可離線重開 App；快取被瀏覽器移除時，需重新下載。';
    }
    renderGps(); renderAll(); if ($('#help-dialog').open) renderHelp();
  }
  function restoreSnapshot() {
    if (!state.snapshot || !state.cacheVerified) { updateConnectivity(); return; }
    const snapshot = state.snapshot;
    state.gpsRequest += 1; invalidateComparison(); if (state.gpsStatus === 'pending') { state.gpsStatus = 'idle'; state.gpsMessage = '已取消定位，現在查看已保存行程。'; }
    state.originMode = 'history'; state.historyOrigin = storedOrigin(snapshot.points[0], 'saved'); state.destinations = snapshot.points.slice(1).map((p) => p.name); state.demoOrigin = false;
    state.points = snapshot.points.map((p, i) => i ? { ...p } : storedOrigin(p, 'saved'));
    state.routes = [JSON.parse(JSON.stringify(snapshot.route))]; state.selectedRouteId = snapshot.route.id; state.preferredRouteId = snapshot.route.id; state.criteria = snapshot.criteria;
    state.date = snapshot.date; state.radius = snapshot.radius; state.filters = new Set(snapshot.filters.filter((key) => services[key])); state.routeOnly = true;
    state.routingNote = '已下載的本地路網路線，不是新的 GPS 位置或即時導航；營業與可達性需現場確認。';
    state.search = ''; $('#search-store').value = ''; renderFilters(); setScreen('journey'); updateConnectivity();
  }
  function enterOffline() { if (state.snapshot && state.cacheVerified) { restoreSnapshot(); toast('已開啟下載時的行程；離線不會送出協助請求。'); } else updateConnectivity(); }
  $('#restore-offline').addEventListener('click', () => { $('#info-dialog').close(); restoreSnapshot(); });
  $('#simulate-offline').addEventListener('change', (event) => { state.simulatedOffline = event.target.checked; storage.write('simulateOffline', state.simulatedOffline); if (isOffline()) enterOffline(); else { updateConnectivity(); toast('已恢復連線示範，不會自動重送協助請求。'); } });
  $('#leave-offline').addEventListener('click', () => { state.simulatedOffline = false; storage.write('simulateOffline', false); updateConnectivity(); });
  window.addEventListener('offline', enterOffline);
  window.addEventListener('online', () => { updateConnectivity(); toast('裝置回報恢復連線；協助請求仍需自行確認。'); });
  $('#save-offline').addEventListener('click', async () => {
    const route = selectedRoute(); if (isOffline() || state.downloading || state.calculating || !route) return;
    const snapshot = { version: APP_VERSION, dataVersion: data.version, savedAt: Date.now(), date: state.date, points: JSON.parse(JSON.stringify(state.points)), route: JSON.parse(JSON.stringify(route)), criteria: state.criteria, radius: state.radius, filters: [...state.filters] };
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
  $('#open-help').addEventListener('click', openHelp);
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
  renderDates(); renderPlan(); renderFilters(); setScreen('home'); updateConnectivity();
  const workerReady = prepareWorker();
})();
