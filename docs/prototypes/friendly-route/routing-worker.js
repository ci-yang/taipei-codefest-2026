/* Coordinates remain in this worker's memory; only bundled public graph files are loaded. */
'use strict';
// The existing graph/router are also used by the legacy browser prototype.
var window = self;
importScripts('routing-data.js', 'routing.js');
self.onmessage = ({ data }) => {
  if (!data || !Number.isSafeInteger(data.id)) return;
  try {
    const result = self.FriendlyRouter.compare({ ...data.options, shortestOnly: true });
    if (result.error || !result.routes[0]) self.postMessage({ id: data.id, error: result.error || '目前無法建立步行路線。' });
    else self.postMessage({ id: data.id, route: result.routes[0] });
  } catch {
    self.postMessage({ id: data.id, error: '本機路線計算失敗，請重新選擇目的地。' });
  }
};
