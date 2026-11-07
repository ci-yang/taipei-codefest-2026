/* TownPass (城市通) phone bridge.
 * Protocol: flutterObject.postMessage(JSON.stringify({ name, data })); replies arrive as 'message' events
 * whose data is a JSON string { name, data }. Replies carry no request id, so one call runs at a time.
 * - 1999 uses the shell's '1999agree' handler (terms page + dial dialog). It replies only `false`, and only on
 *   failure — possibly long after the tap, once the user leaves the terms page. Silence never proves a dial,
 *   so 1999 resolves 'unconfirmed' and keeps listening for a late `false` until the next call starts.
 * - Other numbers use 'phone_call', which always replies a boolean (canLaunchUrl result).
 * Outside the app there is no flutterObject: callers fall back to a plain tel: link. */
(function (root) {
  'use strict';
  const PHONE_TIMEOUT = 5000;
  const AGREE_WAIT = 1500;
  let busy = false;
  let stopLateListener = () => {};

  function bridgeObject() {
    const value = root.flutterObject;
    return value && typeof value.postMessage === 'function' && typeof value.addEventListener === 'function' ? value : null;
  }

  function dialable(number) {
    return typeof number === 'string' && /^(1999|0\d{8,9})$/.test(number);
  }

  // Subscribes to boolean replies named `name`; returns the unsubscribe function.
  function listen(target, name, onValue) {
    const listener = (event) => {
      let message;
      try { message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch { return; }
      if (!message || message.name !== name || typeof message.data !== 'boolean') return;
      onValue(message.data);
    };
    target.addEventListener('message', listener);
    return () => { if (typeof target.removeEventListener === 'function') target.removeEventListener('message', listener); };
  }

  function post(target, name, data) {
    try { target.postMessage(JSON.stringify({ name, data })); return true; } catch { return false; }
  }

  // Settles on the first boolean reply, or null on timeout.
  function request(target, name, data, timeout) {
    return new Promise((resolve) => {
      const finish = (value) => { clearTimeout(timer); stop(); resolve(value); };
      const stop = listen(target, name, finish);
      const timer = setTimeout(() => finish(null), timeout);
      if (!post(target, name, data)) finish(false);
    });
  }

  // Resolves 'failed' on an explicit false within AGREE_WAIT, else 'unconfirmed'. A later false goes to onLate.
  function request1999(target, onLate) {
    return new Promise((resolve) => {
      let settled = false;
      const stop = listen(target, '1999agree', (value) => {
        if (value !== false) return;
        stop();
        stopLateListener = () => {};
        if (settled) { onLate('failed'); return; }
        settled = true;
        clearTimeout(timer);
        resolve('failed');
      });
      stopLateListener = stop;
      const timer = setTimeout(() => { settled = true; resolve('unconfirmed'); }, AGREE_WAIT);
      if (!post(target, '1999agree', true)) { stop(); clearTimeout(timer); settled = true; resolve('failed'); }
    });
  }

  // Resolves 'opened' | 'unconfirmed' (1999 only) | 'failed' | 'unsupported' | 'busy'.
  async function call(number, onLate = () => {}) {
    const target = bridgeObject();
    if (!target) return 'unsupported';
    if (!dialable(number)) return 'failed';
    if (busy) return 'busy';
    busy = true;
    stopLateListener();
    stopLateListener = () => {};
    try {
      if (number === '1999') return await request1999(target, onLate);
      return (await request(target, 'phone_call', number, PHONE_TIMEOUT)) === true ? 'opened' : 'failed';
    } finally {
      busy = false;
    }
  }

  root.SituationBridge = Object.freeze({ call, available: () => bridgeObject() !== null, dialable });
})(typeof window === 'undefined' ? globalThis : window);
