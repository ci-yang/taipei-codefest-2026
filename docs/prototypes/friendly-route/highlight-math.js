/* Pure, local estimates for the friendly-route design prototype. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FriendlyHighlightMath = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';

  const EARTH_RADIUS_M = 6371008.8;
  const RADIANS = Math.PI / 180;
  const DISTRICTS = ['中山區', '中正區', '信義區', '內湖區', '北投區', '南港區', '士林區', '大同區', '大安區', '文山區', '松山區', '萬華區'];
  const OTHER_CITIES = /新北市|臺北縣|台北縣|桃園[市縣]|臺中[市縣]|台中[市縣]|臺南[市縣]|台南[市縣]|高雄[市縣]|基隆市|新竹[市縣]|嘉義[市縣]|苗栗縣|彰化縣|南投縣|雲林縣|屏東縣|宜蘭縣|花蓮縣|臺東縣|台東縣|澎湖縣|金門縣|連江縣/;

  function finiteNumber(value, name, minimum = -Infinity, maximum = Infinity) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError(`${name} must be a finite number`);
    }
    if (value < minimum || value > maximum) {
      throw new RangeError(`${name} must be between ${minimum} and ${maximum}`);
    }
    return value;
  }

  function optionsObject(options) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      throw new TypeError('options must be an object');
    }
    return options;
  }

  function coordinate(point, name) {
    if (!point || typeof point !== 'object') throw new TypeError(`${name} must be a coordinate`);
    const lat = Array.isArray(point) ? point[0] : point.lat;
    const lng = Array.isArray(point) ? point[1] : point.lng;
    return {
      lat: finiteNumber(lat, `${name}.lat`, -90, 90),
      lng: finiteNumber(lng, `${name}.lng`, -180, 180),
    };
  }

  function longitudeDelta(from, to) {
    return ((to - from + 540) % 360) - 180;
  }

  function distanceM(from, to) {
    const latDelta = (to.lat - from.lat) * RADIANS;
    const lngDelta = longitudeDelta(from.lng, to.lng) * RADIANS;
    const a = Math.sin(latDelta / 2) ** 2
      + Math.cos(from.lat * RADIANS) * Math.cos(to.lat * RADIANS) * Math.sin(lngDelta / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(Math.min(1, a)));
  }

  function wifiSummary(stores, center, options = {}) {
    if (!Array.isArray(stores)) throw new TypeError('stores must be an array');
    const origin = coordinate(center, 'center');
    const { radiusM = 300, signalM = 50 } = optionsObject(options);
    finiteNumber(radiusM, 'radiusM', Number.MIN_VALUE);
    finiteNumber(signalM, 'signalM', 0);
    // The fixed-size grid bounds work even when a caller changes the radius.
    finiteNumber(radiusM + signalM, 'radiusM + signalM', 0, Math.PI * EARTH_RADIUS_M);
    const groups = new Map();
    for (const store of stores) {
      if (!store || !Array.isArray(store.services) || !store.services.includes('wifi')) continue;
      if (typeof store.lat !== 'number' || typeof store.lng !== 'number'
        || !Number.isFinite(store.lat) || !Number.isFinite(store.lng)
        || Math.abs(store.lat) > 90 || Math.abs(store.lng) > 180) continue;
      const key = `${store.lat.toFixed(5)},${store.lng.toFixed(5)}`;
      if (!groups.has(key)) groups.set(key, store);
    }
    const points = [...groups.values()];
    let count = 0;
    const candidates = [];
    for (const point of points) {
      const distance = distanceM(origin, point);
      if (distance <= radiusM) count += 1;
      if (distance <= radiusM + signalM) {
        candidates.push({
          x: longitudeDelta(origin.lng, point.lng) * RADIANS * EARTH_RADIUS_M * Math.cos(origin.lat * RADIANS),
          y: (point.lat - origin.lat) * RADIANS * EARTH_RADIUS_M,
        });
      }
    }

    let covered = 0;
    let sampled = 0;
    if (signalM > 0 && candidates.length) {
      // 2,821 deterministic local-plane samples; 10 m spacing at the default 300 m.
      // A hotspot outside 300 m may still cover samples inside it (up to 350 m).
      const gridSteps = 30;
      const spacing = radiusM / gridSteps;
      for (let row = -gridSteps; row <= gridSteps; row += 1) {
        for (let column = -gridSteps; column <= gridSteps; column += 1) {
          if (row * row + column * column > gridSteps * gridSteps) continue;
          sampled += 1;
          const x = column * spacing;
          const y = row * spacing;
          if (candidates.some((point) => (point.x - x) ** 2 + (point.y - y) ** 2 <= signalM ** 2)) covered += 1;
        }
      }
    }
    return {
      points,
      count,
      coveragePercent: sampled ? Math.round(covered / sampled * 1000) / 10 : 0,
      label: count === 0 ? 'Wi-Fi沙漠' : count <= 2 ? 'Wi-Fi綠洲' : 'Wi-Fi風暴',
    };
  }

  function toiletEstimate(distance) {
    finiteNumber(distance, 'distanceM', 0);
    const steps = Math.ceil(distance / 0.7);
    const seconds = Math.ceil(distance / 0.7 / 100 * 60);
    finiteNumber(steps, 'estimated steps', 0, Number.MAX_SAFE_INTEGER);
    finiteNumber(seconds, 'estimated seconds', 0, Number.MAX_SAFE_INTEGER);
    return { steps, seconds };
  }

  function batteryBudget(percent, options = {}) {
    finiteNumber(percent, 'percent', 0, 100);
    const { reservePercent = 5, drainPerHour = 20, speedKmh = 4, charging = false } = optionsObject(options);
    finiteNumber(reservePercent, 'reservePercent', 0, 100);
    finiteNumber(drainPerHour, 'drainPerHour', Number.MIN_VALUE);
    finiteNumber(speedKmh, 'speedKmh', 0);
    if (typeof charging !== 'boolean') throw new TypeError('charging must be a boolean');
    const active = percent < 20 && !charging;
    const hours = active ? Math.max(0, percent - reservePercent) / drainPerHour : 0;
    const seconds = finiteNumber(hours * 3600, 'estimated seconds', 0);
    const radiusM = finiteNumber(hours * speedKmh * 1000, 'estimated radiusM', 0);
    return { active, seconds, radiusM };
  }

  function districtFromAddress(address) {
    if (typeof address !== 'string' || !address.trim() || OTHER_CITIES.test(address)) return null;
    const districts = DISTRICTS.filter((district) => address.includes(district));
    return districts.length === 1 ? districts[0] : null;
  }

  function mortgage(total, options = {}) {
    finiteNumber(total, 'total', 0);
    const { ltv = 0.8, annualRate = 0.025, years = 30, daysPerMonth = 30 } = optionsObject(options);
    finiteNumber(ltv, 'ltv', 0, 1);
    finiteNumber(annualRate, 'annualRate', 0);
    finiteNumber(years, 'years', Number.MIN_VALUE);
    finiteNumber(daysPerMonth, 'daysPerMonth', Number.MIN_VALUE);
    const months = years * 12;
    if (!Number.isSafeInteger(months) || months < 1) throw new RangeError('years must yield a positive whole number of monthly payments');
    const principal = total * ltv;
    const monthlyRate = annualRate / 12;
    // This equivalent amortization expression avoids overflow and cancellation.
    const monthly = monthlyRate === 0 ? principal / months
      : principal * monthlyRate / -Math.expm1(-months * Math.log1p(monthlyRate));
    finiteNumber(monthly, 'monthly payment', 0);
    const secondsPerMonth = finiteNumber(daysPerMonth * 24 * 60 * 60, 'seconds per month', Number.MIN_VALUE);
    const perSecond = finiteNumber(monthly / secondsPerMonth, 'per-second payment', 0);
    return { monthly, perSecond };
  }

  return Object.freeze({ wifiSummary, toiletEstimate, batteryBudget, districtFromAddress, mortgage });
});
