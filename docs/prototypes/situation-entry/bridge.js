/* TownPass (城市通) phone bridge.
 * Protocol: flutterObject.postMessage(JSON.stringify({ name, data })); replies arrive as 'message' events
 * whose data is a JSON string { name, data }. Replies carry no request id, so one call runs at a time.
 * - 1999 uses the shell's '1999agree' handler (terms page + dial dialog). It replies only `false`, and only on
 *   failure — possibly long after the tap, once the user leaves the terms page. Silence never proves a dial,
 *   so 1999 resolves 'unconfirmed' and keeps listening for a late `false`. Only the latest tap's onLate hears it.
 *   Because that late `false` could arrive at any time, no new 1999agree is sent while one is unanswered:
 *   a reply could not be told apart from the earlier one. Such a tap dials 1999 through 'phone_call' instead;
 *   its reply is named 'phone_call', so the earlier 1999agree `false` can never settle it.
 * - Other numbers (short codes such as 110／165, 0800, landlines) use 'phone_call', which always replies a
 *   boolean (canLaunchUrl result). Only allowlisted numbers are ever sent (see dialable).
 * Outside the app there is no flutterObject: callers fall back to a plain tel: link. */
(function (root) {
  'use strict';
  const PHONE_TIMEOUT = 5000;
  const AGREE_WAIT = 1500;
  let busy = false;
  let open1999 = null; // { notify } while a 1999agree request has had no reply

  function bridgeObject() {
    const value = root.flutterObject;
    return value && typeof value.postMessage === 'function' && typeof value.addEventListener === 'function' ? value : null;
  }

  // Allowlist: the short codes the situation pages use, 0800 toll-free numbers, and landlines (area code + local
  // number not starting with 0, so no mobiles, no 0204／0809 premium-rate and no extension strings).
  const SHORT_CODES = new Set(['110', '113', '119', '165', '1925', '1957', '1966', '1999']);

  function dialable(number) {
    if (typeof number !== 'string') return false;
    return SHORT_CODES.has(number) || /^0800\d{6}$/.test(number) || /^0[2-8][1-9]\d{6,7}$/.test(number);
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

  // Resolves 'failed' on an explicit false within AGREE_WAIT, else 'unconfirmed'. A later false goes to
  // open1999.notify (onLate, until another tap replaces it) and re-allows 1999.
  function request1999(target, onLate) {
    return new Promise((resolve) => {
      let settled = false;
      const pending = { notify: onLate };
      const close = () => { stop(); if (open1999 === pending) open1999 = null; };
      const stop = listen(target, '1999agree', (value) => {
        if (value !== false) return;
        close();
        if (settled) { pending.notify('failed'); return; }
        settled = true;
        clearTimeout(timer);
        resolve('failed');
      });
      open1999 = pending;
      const timer = setTimeout(() => { settled = true; resolve('unconfirmed'); }, AGREE_WAIT);
      if (!post(target, '1999agree', true)) { close(); clearTimeout(timer); settled = true; resolve('failed'); }
    });
  }

  // Resolves 'opened' | 'unconfirmed' | 'failed' | 'unsupported' | 'busy'.
  async function call(number, onLate = () => {}) {
    const target = bridgeObject();
    if (!target) return 'unsupported';
    if (!dialable(number)) return 'failed';
    if (busy) return 'busy';
    if (open1999) open1999.notify = () => {};
    busy = true;
    try {
      if (number === '1999' && !open1999) return await request1999(target, onLate);
      return (await request(target, 'phone_call', number, PHONE_TIMEOUT)) === true ? 'opened' : 'failed';
    } finally {
      busy = false;
    }
  }

  root.SituationBridge = Object.freeze({ call, available: () => bridgeObject() !== null, dialable });
})(typeof window === 'undefined' ? globalThis : window);
