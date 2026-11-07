/* TownPass (城市通) phone bridge.
 * Protocol: flutterObject.postMessage(JSON.stringify({ name, data })); replies arrive as 'message' events
 * whose data is a JSON string { name, data }. Replies carry no request id, so one call runs at a time.
 * - 1999 uses the shell's '1999agree' handler (terms page + dial dialog). It replies only `false` on failure.
 * - Other numbers use 'phone_call', which always replies a boolean (canLaunchUrl result).
 * Outside the app there is no flutterObject: callers fall back to a plain tel: link. */
(function (root) {
  'use strict';
  const PHONE_TIMEOUT = 5000;
  const AGREE_FAILURE_WINDOW = 1500;
  let busy = false;

  function bridgeObject() {
    const value = root.flutterObject;
    return value && typeof value.postMessage === 'function' && typeof value.addEventListener === 'function' ? value : null;
  }

  function dialable(number) {
    return typeof number === 'string' && /^(1999|0\d{8,9})$/.test(number);
  }

  // Sends one message and settles on the first reply named `name` with a boolean payload, or on timeout.
  function request(target, name, data, timeout) {
    return new Promise((resolve) => {
      let timer = null;
      const listener = (event) => {
        let message;
        try { message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch { return; }
        if (!message || message.name !== name || typeof message.data !== 'boolean') return;
        finish(message.data);
      };
      const finish = (value) => {
        clearTimeout(timer);
        if (typeof target.removeEventListener === 'function') target.removeEventListener('message', listener);
        resolve(value);
      };
      target.addEventListener('message', listener);
      timer = setTimeout(() => finish(null), timeout);
      try { target.postMessage(JSON.stringify({ name, data })); } catch { finish(false); }
    });
  }

  // Resolves 'opened' | 'failed' | 'unsupported' | 'busy'.
  async function call(number) {
    const target = bridgeObject();
    if (!target) return 'unsupported';
    if (!dialable(number)) return 'failed';
    if (busy) return 'busy';
    busy = true;
    try {
      if (number === '1999') {
        // Success shows a native dialog and sends no reply; only an explicit false means it failed.
        return (await request(target, '1999agree', true, AGREE_FAILURE_WINDOW)) === false ? 'failed' : 'opened';
      }
      return (await request(target, 'phone_call', number, PHONE_TIMEOUT)) === true ? 'opened' : 'failed';
    } finally {
      busy = false;
    }
  }

  root.SituationBridge = Object.freeze({ call, available: () => bridgeObject() !== null, dialable });
})(typeof window === 'undefined' ? globalThis : window);
