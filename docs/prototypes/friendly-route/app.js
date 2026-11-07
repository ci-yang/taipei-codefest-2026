/* 友善同行：靜態互動原型。評論與互助不傳送至伺服器。 */
(() => {
  'use strict';
  const data = window.FRIENDLY_DATA;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  if (!data || !window.L) {
    document.body.insertAdjacentHTML('afterbegin', '<p role="alert" style="padding:20px">地圖資料尚未載入，請重新整理，或確認已下載離線資料。</p>');
    return;
  }
  const services = {
    wifi: { label: 'Free WiFi', short: 'WiFi', icon: '⌁' },
    charge: { label: '行動裝置充電', short: '充電', icon: 'ϟ' },
    toilet: { label: '友善廁所', short: '廁所', icon: 'WC' },
    accessible: { label: '無障礙友善', short: '無障礙', icon: '♿' },
  };
  const baseKey = `friendly-route:${location.pathname.replace(/index\.html$/, '')}`;
  const storage = {
    read(key, fallback) { try { return JSON.parse(localStorage.getItem(`${baseKey}:${key}`)) ?? fallback; } catch { return fallback; } },
    write(key, value) { try { localStorage.setItem(`${baseKey}:${key}`, JSON.stringify(value)); return true; } catch { return false; } },
    remove(key) { try { localStorage.removeItem(`${baseKey}:${key}`); } catch { /* unavailable storage */ } },
  };
  const stores = data.stores.map((store) => ({ ...store, id: String(store.id) }));
  const byId = new Map(stores.map((store) => [store.id, store]));
  const known = (id) => byId.has(String(id));
  const originalReviews = storage.read('reviews', []);
  const reviews = Array.isArray(originalReviews) ? originalReviews.filter((review) => review && known(review.storeId) && services[review.service] && ['yes', 'no'].includes(review.outcome) && typeof review.comment === 'string' && Number.isFinite(review.time)).slice(-300) : [];
  const loadedSnapshot = storage.read('snapshot', null);
  const snapshotValid = loadedSnapshot && loadedSnapshot.version === data.version && Array.isArray(loadedSnapshot.routeIds) && loadedSnapshot.routeIds.length >= 2 && loadedSnapshot.routeIds.every(known) && Number.isFinite(loadedSnapshot.savedAt);
  const demoIds = data.demoRoute.map(String).filter(known);
  const state = {
    routeIds: demoIds.length >= 2 ? demoIds : stores.slice(0, 3).map((store) => store.id),
    filters: new Set(Object.keys(services)), radius: 250, search: '', showRange: true, routeOnly: true,
    selectedId: null, simulatedOffline: storage.read('simulateOffline', false) === true, snapshot: snapshotValid ? loadedSnapshot : null,
    cacheVerified: false, downloading: false, reviews, request: null, helpRole: 'sender',
    helpDraft: { placeId: '', reason: '想詢問附近哪裡可以借用 WiFi／充電', consent: false, shareRoute: false },
  };
  let toastTimer;
  let focusedBeforeDrawer;
  let workerRegistration;
  let helperMap;
  let helperMapFrame;
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const isOffline = () => state.simulatedOffline || !navigator.onLine;
  const formatDate = (time) => new Date(time).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  const toast = (message) => { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false; toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4500); };
  const sourceDate = data.source.updatedAt || '2026-07-20';
  function serviceTags(store) { return store.services.filter((key) => services[key]).map((key) => `<span class="service-tag"><span aria-hidden="true">${services[key].icon}</span>${services[key].short}</span>`).join(''); }
  function storeReviews(id) { return state.reviews.filter((review) => String(review.storeId) === String(id)); }
  function quality(id) {
    const entries = storeReviews(id);
    if (!entries.length) return { code: 'unknown', label: '尚無回報', reason: '尚無本機試填回報；不是沒有服務。', entries };
    const hasNo = entries.some((entry) => entry.outcome === 'no');
    const hasYes = entries.some((entry) => entry.outcome === 'yes');
    return { code: hasNo ? 'caution' : 'good', label: hasNo ? '需再確認' : '有順利回報', reason: hasNo ? (hasYes ? '回報不一致，請先向店家確認。' : '有使用不順利的回報，請先向店家確認。') : '有順利使用的本機回報，不代表目前一定可用。', entries };
  }
  function routeStores() { return state.routeIds.map((id) => byId.get(id)).filter(Boolean); }
  function project(store) { return [store.lng * 111320 * Math.cos(25.033 * Math.PI / 180), store.lat * 110540]; }
  function segmentDistance(point, a, b) {
    const [px, py] = project(point); const [ax, ay] = project(a); const [bx, by] = project(b);
    const dx = bx - ax; const dy = by - ay;
    const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  }
  function routeDistance(store) {
    const route = routeStores();
    if (route.length < 2) return Infinity;
    return Math.min(...route.slice(1).map((next, i) => segmentDistance(store, route[i], next)));
  }
  function filteredStores() {
    return stores.filter((store) => store.services.some((key) => state.filters.has(key)))
      .filter((store) => !state.search || `${store.name} ${store.address}`.toLowerCase().includes(state.search.toLowerCase()))
      .map((store) => ({ store, distance: routeDistance(store) }))
      .filter(({ distance }) => !state.routeOnly || distance <= state.radius)
      .sort((a, b) => a.distance - b.distance || a.store.name.localeCompare(b.store.name, 'zh-Hant'));
  }
  function revealMapOnMobile() {
    if (!window.matchMedia('(max-width: 760px)').matches) return;
    $('.map-workspace').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }
  function setSideTab(tab) {
    ['route', 'resource'].forEach((name) => { $(`#${name}-tab`).setAttribute('aria-selected', String(name === tab)); $(`#${name}-panel`).hidden = name !== tab; });
  }
  $('#route-tab').addEventListener('click', () => setSideTab('route'));
  $('#resource-tab').addEventListener('click', () => setSideTab('resource'));
  $('#store-options').innerHTML = stores.map((store) => `<option value="${esc(store.name)}">${esc(store.address)}</option>`).join('');
  $('#dataset-count').textContent = `${stores.length} 個開放資料點位`;
  $('#data-version').textContent = `名冊更新 ${sourceDate}`;
  $('#source-link').href = data.source.url;
  function routeNames() { return $$('#route-inputs input').map((input) => input.value); }
  function renderRouteInputs(names = state.routeIds.map((id) => byId.get(id)?.name || '')) {
    $('#route-inputs').innerHTML = names.map((name, index) => `<div class="route-row"><span class="stop-number" aria-hidden="true">${index === 0 ? '○' : index}</span><div class="route-field"><label for="route-${index}">${index === 0 ? '起點' : `目的地 ${index}`}</label><input id="route-${index}" name="route-${index}" value="${esc(name)}" list="store-options" placeholder="輸入店名，從清冊選取" autocomplete="off" ${isOffline() ? 'disabled' : ''}></div><div class="stop-actions">${index > 1 ? `<button type="button" data-up="${index}" aria-label="將目的地 ${index} 上移" ${isOffline() ? 'disabled' : ''}>↑</button>` : ''}${index > 0 && names.length > 2 ? `<button type="button" data-remove="${index}" aria-label="移除目的地 ${index}" ${isOffline() ? 'disabled' : ''}>×</button>` : ''}</div></div>`).join('');
    $$('#route-inputs [data-up]').forEach((button) => button.addEventListener('click', () => { const values = routeNames(); const i = Number(button.dataset.up); [values[i - 1], values[i]] = [values[i], values[i - 1]]; renderRouteInputs(values); }));
    $$('#route-inputs [data-remove]').forEach((button) => button.addEventListener('click', () => { const values = routeNames(); values.splice(Number(button.dataset.remove), 1); renderRouteInputs(values); }));
    $('#add-stop').disabled = isOffline() || names.length >= 6;
  }
  $('#add-stop').addEventListener('click', () => { if (isOffline()) return; const names = routeNames(); if (names.length < 6) { names.push(''); renderRouteInputs(names); $(`#route-${names.length - 1}`).focus(); } });
  $('#route-form').addEventListener('submit', (event) => {
    event.preventDefault(); if (isOffline()) return;
    const names = routeNames().map((name) => name.trim());
    const selected = names.map((name) => stores.find((store) => store.name === name));
    const missing = selected.findIndex((store) => !store);
    if (missing >= 0) { $('#route-error').textContent = `${missing === 0 ? '起點' : `目的地 ${missing}`}尚未對應到清冊店家，請從建議清單選取完整店名。`; $(`#route-${missing}`).focus(); return; }
    if (new Set(selected.map((store) => store.id)).size !== selected.length) { $('#route-error').textContent = '這條路線有重複店家，請選擇不同的起點與目的地。'; return; }
    $('#route-error').textContent = ''; state.routeIds = selected.map((store) => store.id); state.routeOnly = true; renderAll(); fitRoute(); revealMapOnMobile(); toast('已更新示意路線；連線不代表實際步行路徑。');
  });
  $('#demo-route').addEventListener('click', () => {
    if (isOffline()) return;
    state.routeIds = demoIds; state.routeOnly = true; state.filters = new Set(Object.keys(services)); state.radius = 250; state.search = ''; $('#search-store').value = ''; $('#route-error').textContent = '';
    renderRouteInputs(); renderFilters(); renderAll(); fitRoute(); setSideTab('route'); revealMapOnMobile(); toast('示範路線已就緒：可切換篩選、點選店家，再下載離線資料。');
  });
  function renderFilters() {
    $('#filters').innerHTML = Object.entries(services).map(([key, service]) => `<button class="filter-chip" data-service="${key}" aria-pressed="${state.filters.has(key)}"><span class="service-icon" aria-hidden="true">${service.icon}</span><span>${key === 'charge' ? '裝置充電' : service.label}</span></button>`).join('');
    $$('#filters button').forEach((button) => button.addEventListener('click', () => { const key = button.dataset.service; if (state.filters.has(key)) state.filters.delete(key); else state.filters.add(key); renderFilters(); renderAll(); }));
  }
  $('#all-services').addEventListener('click', () => { state.filters = new Set(Object.keys(services)); renderFilters(); renderAll(); });
  $('#search-store').addEventListener('input', (event) => { state.search = event.target.value.trim(); renderAll(); });
  $$('#range-options button').forEach((button) => button.addEventListener('click', () => { state.radius = Number(button.dataset.radius); renderAll(); }));
  $('#route-only').addEventListener('change', (event) => { state.routeOnly = event.target.checked; renderAll(); if (!state.routeOnly) map.fitBounds(data.bounds, { padding: [20, 20] }); });
  $('#show-range').addEventListener('change', (event) => { state.showRange = event.target.checked; renderMap(); });
  $('#toggle-results').addEventListener('click', () => { const expanded = $('#toggle-results').getAttribute('aria-expanded') === 'true'; $('#store-list').hidden = expanded; $('#toggle-results').setAttribute('aria-expanded', String(!expanded)); $('#toggle-results').textContent = expanded ? '展開清單 ↓' : '收合清單 ↑'; });

  const map = L.map('map', { preferCanvas: true, zoomControl: false, minZoom: 13, maxZoom: 19, maxBounds: L.latLngBounds(data.bounds).pad(0.15), maxBoundsViscosity: 0.8 });
  L.control.zoom({ position: 'topright' }).addTo(map);
  map.attributionControl.setPrefix(false);
  map.attributionControl.addAttribution('© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors・ODbL</a>');
  map.createPane('basemap'); map.getPane('basemap').style.zIndex = 250;
  map.createPane('range'); map.getPane('range').style.zIndex = 350;
  map.createPane('route'); map.getPane('route').style.zIndex = 410;
  const roadNames = new Set();
  L.geoJSON(data.map, {
    pane: 'basemap', interactive: false,
    style: (feature) => {
      const props = feature.properties || {};
      if (feature.geometry.type.includes('Polygon')) return { fillColor: props.leisure || props.landuse ? '#d2dfc7' : '#e0e4d9', fillOpacity: 0.8, color: '#d5ddce', weight: 0.5 };
      const major = ['primary', 'secondary', 'tertiary', 'trunk'].includes(props.highway);
      return { color: major ? '#fbfcf7' : '#f9faf3', weight: major ? 9 : props.highway === 'footway' ? 1.5 : 4.5, opacity: 1 };
    },
    onEachFeature: (feature) => {
      const name = feature.properties?.name; const coords = feature.geometry?.coordinates;
      if (!name || roadNames.has(name) || feature.geometry.type !== 'LineString' || !['primary', 'secondary', 'tertiary'].includes(feature.properties.highway)) return;
      roadNames.add(name); const mid = coords[Math.floor(coords.length / 2)];
      L.marker([mid[1], mid[0]], { interactive: false, pane: 'basemap', icon: L.divIcon({ className: 'road-label', html: esc(name), iconSize: [100, 16], iconAnchor: [30, 8] }) }).addTo(map);
    },
  }).addTo(map);
  const rangeLayer = L.layerGroup().addTo(map);
  const routeLayer = L.layerGroup().addTo(map);
  const markerLayer = L.layerGroup().addTo(map);
  const helpLayer = L.layerGroup().addTo(map);
  function fitRoute() { const points = routeStores().map((store) => [store.lat, store.lng]); if (points.length >= 2) map.fitBounds(points, { padding: [65, 65], maxZoom: 16 }); else map.fitBounds(data.bounds); }
  $('#fit-map').addEventListener('click', fitRoute);
  function renderMap() {
    if (expireIfNeeded() && $('#help-dialog').open) renderHelp();
    rangeLayer.clearLayers(); routeLayer.clearLayers(); markerLayer.clearLayers(); helpLayer.clearLayers();
    if (isOffline() && (!state.snapshot || !state.cacheVerified)) return;
    const route = routeStores(); const points = route.map((store) => [store.lat, store.lng]);
    if (points.length >= 2) {
      if (state.showRange) {
        const metersPerPixel = 156543.03392 * Math.cos(map.getCenter().lat * Math.PI / 180) / (2 ** map.getZoom());
        L.polyline(points, { pane: 'range', color: '#6e9b75', opacity: 0.15, weight: Math.max(1, state.radius * 2 / metersPerPixel), lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(rangeLayer);
      }
      L.polyline(points, { pane: 'route', color: '#fffefa', weight: 7, opacity: 0.9, interactive: false }).addTo(routeLayer);
      L.polyline(points, { pane: 'route', color: '#2e6b59', weight: 3, dashArray: '7 7', interactive: false }).addTo(routeLayer);
    }
    filteredStores().forEach(({ store }) => {
      const q = quality(store.id); const firstService = store.services.find((key) => state.filters.has(key));
      L.marker([store.lat, store.lng], { title: `${store.name}，${q.label}`, keyboard: true, icon: L.divIcon({ className: '', html: `<span class="store-marker ${q.code}${state.selectedId === store.id ? ' selected' : ''}">${services[firstService]?.icon || '·'}</span>`, iconSize: [24, 24], iconAnchor: [12, 12] }) })
        .bindTooltip(`${esc(store.name)} · ${q.label}`, { direction: 'top' }).on('click', () => openStore(store.id)).addTo(markerLayer);
    });
    route.forEach((store, index) => {
      L.marker([store.lat, store.lng], { title: `${index === 0 ? '起點' : `目的地 ${index}`}：${store.name}`, zIndexOffset: 500, keyboard: true, icon: L.divIcon({ className: '', html: `<span class="route-number ${index === 0 ? 'origin' : ''}">${index === 0 ? '起' : index}</span>`, iconSize: [27, 27], iconAnchor: [13.5, 13.5] }) }).bindTooltip(`${index === 0 ? '起點' : `目的地 ${index}`}：${esc(store.name)}`, { direction: 'top' }).on('click', () => openStore(store.id)).addTo(routeLayer);
    });
    if (state.showRange && state.selectedId && byId.has(state.selectedId)) {
      const selected = byId.get(state.selectedId);
      L.circle([selected.lat, selected.lng], { pane: 'range', radius: state.radius, color: '#74966d', fillColor: '#c6d997', fillOpacity: 0.12, weight: 1, dashArray: '4 5', interactive: false }).addTo(rangeLayer);
    }
    if (activeRequest()) {
      const place = byId.get(state.request.placeId);
      L.marker([place.lat, place.lng], { title: `示範求助點：${place.name}`, zIndexOffset: 1000, icon: L.divIcon({ className: '', html: '<span class="help-marker">♡</span>', iconSize: [33, 33], iconAnchor: [16.5, 16.5] }) }).bindTooltip(`示範求助點：${esc(place.name)}`).on('click', openHelp).addTo(helpLayer);
    }
  }
  map.on('zoomend', renderMap);
  function renderList() {
    const result = isOffline() && !state.cacheVerified ? [] : filteredStores();
    $('#result-count').textContent = result.length;
    $('#results-scope').textContent = state.routeOnly ? '你的沿途資源' : '整個示範區的友善資源';
    const labels = [...state.filters].map((key) => services[key].short).join('、');
    $('#result-context').textContent = `${labels ? `符合任一項：${labels}` : '尚未選取服務'} · ${state.routeOnly ? `距離示意路線 ${state.radius} m 內` : '信義區及大安東側全示範區，不限距離路線'} · 未查詢營業或即時可用狀態`;
    $('#store-list').innerHTML = result.length ? result.map(({ store, distance }) => {
      const q = quality(store.id);
      return `<button type="button" class="store-card${state.selectedId === store.id ? ' active' : ''}" data-store="${esc(store.id)}"><div class="card-top"><h3>${esc(store.name)}</h3><span class="card-distance">距線 ${Math.round(distance)} m</span></div><p class="card-address">${esc(store.address)}</p><div class="service-tags">${serviceTags(store)}</div><p class="quality-label"><i class="quality-dot ${q.code}"></i>${q.label}<span>${q.entries.length ? `・${q.entries.length} 筆本機試填` : ''}</span></p><p class="card-condition">名冊標示 · 消費條件待確認<br>${esc(sourceDate)} · 點開查看電話／詢問卡</p></button>`;
    }).join('') : '<div class="empty-state"><strong>目前範圍沒有符合的店家</strong><p>試著增加範圍、選擇其他服務，或清除搜尋字詞。</p></div>';
    $$('#store-list [data-store]').forEach((button) => button.addEventListener('click', () => openStore(button.dataset.store)));
  }
  function renderAll() { $('#route-only').checked = state.routeOnly; $$('#range-options button').forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.radius) === state.radius))); renderMap(); renderList(); }
  function openStore(id) {
    if (!known(id)) return;
    focusedBeforeDrawer = document.activeElement; state.selectedId = String(id); $('#store-drawer').hidden = false; renderDetail(); renderAll(); $('#close-store').focus({ preventScroll: true });
  }
  function closeStore() { $('#store-drawer').hidden = true; state.selectedId = null; renderAll(); if (focusedBeforeDrawer?.isConnected) focusedBeforeDrawer.focus({ preventScroll: true }); }
  $('#close-store').addEventListener('click', closeStore);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !$('#store-drawer').hidden && !$('#help-dialog').open) closeStore(); });
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

  async function prepareWorker() {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return false;
    try {
      workerRegistration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      await navigator.serviceWorker.ready;
      if (state.snapshot && 'caches' in window) {
        const cache = await caches.open(`friendly-route-v1:${new URL('./', location.href).pathname}`);
        const required = ['./', './index.html', './app.js', './styles.css', './data.js', './vendor/leaflet.js', './vendor/leaflet.css'];
        const cached = await Promise.all(required.map((path) => cache.match(new URL(path, location.href).href)));
        state.cacheVerified = cached.every(Boolean);
        if (!state.cacheVerified) { state.snapshot = null; storage.remove('snapshot'); }
      }
      if (isOffline() && state.cacheVerified) enterOffline();
      else updateConnectivity();
      return true;
    } catch { updateConnectivity(); return false; }
  }
  const workerReady = prepareWorker();
  function updateConnectivity() {
    const offline = isOffline();
    $('#network-status').textContent = offline ? (state.simulatedOffline ? '離線示範' : '裝置離線') : '裝置在線';
    $('#network-status').classList.toggle('offline', offline);
    $('#network-status').title = '依瀏覽器連線狀態顯示，不代表 WiFi 連線或伺服器可達。';
    $('#simulate-offline').checked = state.simulatedOffline;
    $('#simulate-offline').disabled = !navigator.onLine;
    $('#save-offline').disabled = offline || state.downloading;
    $('#build-route').disabled = offline; $('#demo-route').disabled = offline;
    $('#no-cache-overlay').hidden = !offline || Boolean(state.snapshot && state.cacheVerified);
    $('#leave-offline').hidden = !state.simulatedOffline;
    if (state.snapshot && state.cacheVerified) {
      $('#cache-summary').textContent = `已下載 · ${formatDate(state.snapshot.savedAt)}`;
      $('#offline-detail').textContent = `已保存 ${state.snapshot.routeIds.length - 1} 個目的地與 ${stores.length} 個店家；範圍為信義區及大安東側。離線只讀取這份路線，資料不是即時狀態。`;
    } else {
      $('#cache-summary').textContent = '尚未下載離線資料';
      $('#offline-detail').textContent = '下載本地道路、店家清冊與當前路線。未下載或快取被瀏覽器移除，就無法離線開啟。';
    }
    renderRouteInputs(); renderAll(); if ($('#help-dialog').open) renderHelp();
  }
  function enterOffline() {
    if (state.snapshot && state.cacheVerified) {
      state.routeIds = [...state.snapshot.routeIds];
      state.radius = [100, 250, 500].includes(state.snapshot.radius) ? state.snapshot.radius : 250;
      state.routeOnly = state.snapshot.routeOnly !== false;
      state.filters = new Set((state.snapshot.filters || Object.keys(services)).filter((key) => services[key]));
      state.search = ''; $('#search-store').value = ''; renderFilters();
      toast('已切換為下載時的路線。離線可查資料，無法送出協助請求。');
    }
    updateConnectivity();
  }
  $('#simulate-offline').addEventListener('change', (event) => { state.simulatedOffline = event.target.checked; storage.write('simulateOffline', state.simulatedOffline); if (isOffline()) enterOffline(); else { updateConnectivity(); toast('已恢復連線示範；不會自動送出任何請求。'); } });
  $('#leave-offline').addEventListener('click', () => { state.simulatedOffline = false; storage.write('simulateOffline', false); updateConnectivity(); });
  window.addEventListener('offline', enterOffline);
  window.addEventListener('online', () => { updateConnectivity(); toast('裝置回報恢復連線；協助請求仍需自行確認。'); });
  $('#save-offline').addEventListener('click', async () => {
    if (isOffline() || state.downloading) return;
    state.downloading = true; $('#save-offline').textContent = '下載中…'; updateConnectivity();
    try {
      if (!await workerReady || !workerRegistration?.active) throw new Error('這個瀏覽器未提供離線快取功能。請用 HTTPS 或 localhost 開啟。');
      await new Promise((resolve, reject) => {
        const channel = new MessageChannel();
        const timer = setTimeout(() => reject(new Error('下載逾時，請保持連線後重試。')), 30000);
        channel.port1.onmessage = ({ data: message }) => { clearTimeout(timer); if (message.ok) resolve(); else reject(new Error(message.error || '下載未完成，請重試。')); };
        workerRegistration.active.postMessage({ type: 'CACHE_ROUTE' }, [channel.port2]);
      });
      const snapshot = { version: data.version, savedAt: Date.now(), routeIds: [...state.routeIds], radius: state.radius, filters: [...state.filters], routeOnly: state.routeOnly };
      if (!storage.write('snapshot', snapshot)) throw new Error('地圖已快取，但無法保存路線；請允許瀏覽器本機儲存後重試。');
      state.snapshot = snapshot; state.cacheVerified = true; toast('路線、店家與地圖已下載。現在可以試試離線模式。');
    } catch (error) {
      state.snapshot = null; state.cacheVerified = false; storage.remove('snapshot');
      if ('caches' in window) {
        try { await caches.delete(`friendly-route-v1:${new URL('./', location.href).pathname}`); } catch { /* Snapshot is revoked even if browser storage is unavailable. */ }
      }
      toast(`${error instanceof Error ? error.message : '下載失敗。'} 離線包已停用，請重新下載。`);
    }
    finally { state.downloading = false; $('#save-offline').textContent = '更新／下載路線與地圖'; updateConnectivity(); }
  });

  function openHelp() {
    if (!state.helpDraft.placeId) state.helpDraft.placeId = state.selectedId || state.routeIds[0];
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
    state.request = { status: 'expired', placeId: '', routeIds: [], reason: '', shareRoute: false };
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
      $('#sender-panel').innerHTML = `${offlineNotice}<div class="request-status"><strong>${requestStatusLabel[request.status]}</strong><p>本機示範・剩餘 <span class="request-counter">${requestCountdown()}</span> 到期；不代表實際有人前來。</p></div><div class="privacy-preview"><strong>對方會看到的資料</strong><p>求助點：${esc(place.name)}</p><p>${esc(place.address)}</p><p>路線：${request.shareRoute ? `已同意分享這次選定的 ${request.routeIds.length} 個點位` : '未分享，只顯示求助點'}</p><p>需求：${esc(request.reason)}</p></div><div class="help-actions"><button id="resolve-request" class="primary">結束示範</button><button id="cancel-request" class="secondary">撤銷請求</button></div><button id="expire-request" class="text-button">測試到期狀態</button>`;
      $('#resolve-request').addEventListener('click', () => finishRequest('resolved'));
      $('#cancel-request').addEventListener('click', () => finishRequest('cancelled'));
      $('#expire-request').addEventListener('click', () => finishRequest('expired'));
    } else {
      const draft = state.helpDraft;
      $('#sender-panel').innerHTML = `${offlineNotice}${state.request ? `<div class="request-status"><strong>${requestStatusLabel[state.request.status]}</strong><p>求助點與路線已從對方的示範畫面隱藏。可以重新建立一次示範。</p></div>` : ''}<form id="help-form"><label for="help-place">我要在哪裡請人幫忙？</label><select id="help-place">${stores.map((store) => `<option value="${esc(store.id)}" ${store.id === draft.placeId ? 'selected' : ''}>${esc(store.name)}</option>`).join('')}</select><label for="help-reason">需要的協助</label><textarea id="help-reason" maxlength="120" rows="2">${esc(draft.reason)}</textarea><div class="privacy-preview" id="help-preview"></div><label class="checkbox-field"><input id="help-consent" type="checkbox" ${draft.consent ? 'checked' : ''}><span>我同意在這次示範中分享選定的求助點及需求。這不是我的即時定位。</span></label><label class="checkbox-field"><input id="help-share-route" type="checkbox" ${draft.shareRoute ? 'checked' : ''}><span>另外分享這次選定的路線（選填，預設不分享）。</span></label><p class="form-error" id="help-error" role="alert"></p><button class="primary wide" type="submit" ${isOffline() ? 'disabled' : ''}>建立協助請求・本機示範</button></form>`;
      const updateDraft = () => { state.helpDraft = { placeId: $('#help-place').value, reason: $('#help-reason').value.slice(0, 120), consent: $('#help-consent').checked, shareRoute: $('#help-share-route').checked }; renderHelpPreview(); };
      ['help-place', 'help-reason', 'help-consent', 'help-share-route'].forEach((id) => $(`#${id}`).addEventListener('input', updateDraft));
      renderHelpPreview();
      $('#help-form').addEventListener('submit', (event) => {
        event.preventDefault(); updateDraft(); const draftNow = state.helpDraft;
        if (isOffline()) { $('#help-error').textContent = '目前離線，沒有送出任何請求。'; return; }
        if (!draftNow.consent) { $('#help-error').textContent = '請先確認並同意分享這個求助點。'; return; }
        if (!draftNow.reason.trim()) { $('#help-error').textContent = '請簡短填寫需要的協助。'; return; }
        if (!known(draftNow.placeId)) { $('#help-error').textContent = '請選取有效的求助地點。'; return; }
        state.request = { ...draftNow, reason: draftNow.reason.trim(), routeIds: draftNow.shareRoute ? [...state.routeIds] : [], status: 'pending', createdAt: Date.now(), expiresAt: Date.now() + 15 * 60 * 1000 };
        renderHelp(); renderMap(); toast('已建立本機示範；切換「我是幫忙的人」查看接收畫面。');
      });
    }
    if (!active) {
      $('#helper-panel').innerHTML = `<div class="help-empty"><strong>${state.request ? requestStatusLabel[state.request.status] : '目前沒有協助請求'}</strong><p>${state.request ? '原本的求助點與路線已隱藏。' : '先在「我需要幫忙」建立請求，再切換到這裡。'}</p><span class="not-live">同一裝置的角色示範，不是其他真人帳號</span></div>`;
    } else {
      const request = state.request; const place = byId.get(request.placeId);
      $('#helper-panel').innerHTML = `${offlineNotice}<span class="local-badge">接收方視角・本機示範</span><p class="request-place">${esc(place.name)}</p><p class="detail-address">${esc(place.address)}</p><p class="request-note">${esc(request.reason)}</p><div class="privacy-preview"><strong>對方選擇分享的路線</strong>${request.shareRoute ? `<ol class="request-route">${request.routeIds.map((id) => `<li>${esc(byId.get(id)?.name || '')}</li>`).join('')}</ol><p>此路線是示意連線，未接步行導航。</p>` : '<p>對方沒有分享路線。只顯示已同意的求助點。</p>'}</div><div id="helper-mini-map" class="helper-mini-map" aria-label="接收方看到的求助點及已同意的路線"></div><div class="request-status"><strong>${requestStatusLabel[request.status]}</strong><p>剩餘 <span class="request-counter">${requestCountdown()}</span>・回應不代表救援承諾。</p></div><button id="ack-request" class="primary wide" ${isOffline() || request.status === 'acknowledged' ? 'disabled' : ''}>${request.status === 'acknowledged' ? '已回應（示範）' : '我可以提供資訊・示範回應'}</button>`;
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
    $('#help-preview').innerHTML = `<strong>送出前先看一眼</strong><p>求助點：${esc(place?.name || '尚未選取')}</p><p>${esc(place?.address || '')}</p><p>路線：${draft.shareRoute ? routeStores().map((store) => esc(store.name)).join(' → ') : '不分享'}</p><p>保留 15 分鐘，可隨時撤銷；不收集裝置的即時定位。</p>`;
  }
  function renderHelpMap(request) {
    const target = $('#helper-mini-map'); if (!target || !target.isConnected || target.getBoundingClientRect().width === 0) return;
    const place = byId.get(request.placeId); const visibleStores = request.shareRoute ? request.routeIds.map((id) => byId.get(id)) : [place];
    const miniature = L.map(target, { preferCanvas: true, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false, zoomControl: false, attributionControl: true, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, keyboard: false });
    helperMap = miniature;
    miniature.setView([place.lat, place.lng], 15, { animate: false });
    miniature.invalidateSize({ animate: false });
    miniature.attributionControl.setPrefix(false); miniature.attributionControl.addAttribution('© <a href="https://www.openstreetmap.org/copyright">OSM・ODbL</a>');
    L.geoJSON(data.map, { interactive: false, style: (feature) => ({ color: feature.geometry.type.includes('Polygon') ? '#dce4d1' : '#fffef7', weight: feature.geometry.type.includes('Polygon') ? 0.5 : 3, fillColor: '#dce4d1', fillOpacity: 0.8 }) }).addTo(miniature);
    if (request.shareRoute) L.polyline(visibleStores.map((store) => [store.lat, store.lng]), { color: '#306b57', weight: 3, dashArray: '5 5' }).addTo(miniature);
    L.circleMarker([place.lat, place.lng], { color: '#fff', fillColor: '#b8513e', fillOpacity: 1, radius: 9, weight: 3 }).addTo(miniature).bindTooltip('求助點', { permanent: true, direction: 'top' });
    miniature.fitBounds([...visibleStores.map((store) => [store.lat, store.lng]), [place.lat, place.lng]], { padding: [25, 25], maxZoom: 16, animate: false });
    miniature.invalidateSize({ animate: false });
  }
  function finishRequest(status) { if (!state.request) return; state.request = { status, placeId: '', routeIds: [], reason: '', shareRoute: false }; state.helpDraft.consent = false; state.helpDraft.shareRoute = false; renderHelp(); renderMap(); toast(`示範請求${requestStatusLabel[status]}，已移除分享內容。`); }
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
  renderRouteInputs(); renderFilters(); map.fitBounds(data.bounds); fitRoute(); renderAll(); updateConnectivity();
})();
