/* 情境入口「我遇到了……」: fixed content, no login, no storage, no network beyond static files.
 * Rendering is pure (data -> HTML string) so tests can run it without a DOM. */
(function (root) {
  'use strict';

  const SECTION_TITLES = [
    ['window', '去哪個窗口'],
    ['bring', '要帶什麼'],
    ['call', '打哪支電話'],
    ['say', '開口怎麼說'],
  ];

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function formatDial(dial) {
    if (dial === '1999') return '1999';
    return `02-${dial.slice(2, 6)}-${dial.slice(6)}`;
  }

  function sourceLine(data, ids) {
    const links = ids.map((id) => {
      const source = data.sources[id];
      if (!source) throw new Error(`Unknown source id: ${id}`);
      return `<a href="${escapeHtml(source.url)}" rel="noopener">${escapeHtml(source.short)}</a><span class="checked">查核 ${escapeHtml(source.checkedOn)}</span>`;
    });
    return `<p class="source">來源：${links.join('；')}</p>`;
  }

  function pendingBadge(entry) {
    return entry.pending ? '<span class="badge-pending">待確認</span>' : '';
  }

  function callButton(dial, label) {
    return `<a class="call-button" href="tel:${escapeHtml(dial)}" data-dial="${escapeHtml(dial)}">`
      + `<span class="call-icon" aria-hidden="true">☎</span><span class="call-text"><span class="call-label">${escapeHtml(label)}</span>`
      + `<span class="call-number">${escapeHtml(formatDial(dial))}</span></span></a>`;
  }

  function renderEntry(data, entry) {
    return `<li class="entry${entry.pending ? ' is-pending' : ''}"><p>${pendingBadge(entry)}${escapeHtml(entry.text)}</p>${sourceLine(data, entry.sources)}</li>`;
  }

  function renderCallEntry(data, entry, center) {
    let action;
    if (entry.fromDirectory) {
      action = center
        ? callButton(center.phone.dial, center.name)
        : '<p class="hint">請先在上面選你住的行政區。</p>';
    } else {
      action = callButton(entry.number.replace(/\D/g, ''), entry.label);
    }
    return `<li class="entry call-entry"><p class="call-title">${escapeHtml(entry.label)}</p>${action}`
      + `<p class="call-note">${escapeHtml(entry.note)}</p>${sourceLine(data, entry.sources)}</li>`;
  }

  function districtsOf(rows) {
    return [...new Set(rows.map((row) => row.district))];
  }

  function renderWelfareDirectory(data, directory, district) {
    const options = districtsOf(directory.rows)
      .map((name) => `<option value="${escapeHtml(name)}"${name === district ? ' selected' : ''}>${escapeHtml(name)}</option>`)
      .join('');
    const centers = directory.rows.filter((row) => row.district === district);
    const cards = centers.map((row) => `<div class="place"><p class="place-name">${escapeHtml(row.name)}</p>`
      + `<p class="place-line">${escapeHtml(row.address)}</p>${callButton(row.phone.dial, row.name)}</div>`).join('');
    return `<div class="directory"><label class="district-label" for="district">找你那一區</label>`
      + `<select id="district" class="district-select"><option value="">選擇行政區</option>${options}</select>`
      + `${cards}${sourceLine(data, directory.sources)}</div>`;
  }

  function renderLaborDirectory(data, directory) {
    const cards = directory.rows.map((row) => `<div class="place"><p class="place-name">${escapeHtml(row.name)}</p>`
      + `<p class="place-line">${escapeHtml(row.address)}</p><p class="place-line">方式：${escapeHtml(row.method)}</p>`
      + `<p class="place-line">時段：${escapeHtml(row.hours)}</p></div>`).join('');
    return `<div class="directory"><p class="district-label">${escapeHtml(directory.title)}</p>${cards}${sourceLine(data, directory.sources)}</div>`;
  }

  function renderHome(data) {
    const cards = data.situations.map((situation) => `<a class="situation-card" href="#/${escapeHtml(situation.id)}">`
      + `<span class="situation-title">${escapeHtml(situation.title)}</span>`
      + `<span class="situation-sub">${escapeHtml(situation.subtitle)}</span><span class="chevron" aria-hidden="true">›</span></a>`).join('');
    return `<header class="home-header"><p class="eyebrow">臺北市官方窗口整理</p><h1>我遇到了……</h1>`
      + `<p class="lead">選一個最接近你現在狀況的，告訴你去哪個窗口、要帶什麼、打哪支電話、開口怎麼說。</p></header>`
      + `<nav class="situation-list" aria-label="選擇情境">${cards}</nav>`
      + `<p class="privacy">不用登入。這個頁面不會記錄、也不會上傳你選了什麼。資料查核日 ${escapeHtml(data.checkedOn)}，以官方最新公告為準。</p>`;
  }

  function renderSituation(data, id, district) {
    const situation = data.situations.find((item) => item.id === id);
    if (!situation) return null;
    const directory = data.directories[situation.directory];
    const center = district ? directory.rows.find((row) => row.district === district) : null;
    const directoryHtml = situation.directory === 'welfareCenters'
      ? renderWelfareDirectory(data, directory, district)
      : renderLaborDirectory(data, directory);
    const sections = SECTION_TITLES.map(([key, title], index) => {
      const items = key === 'call'
        ? situation.call.map((entry) => renderCallEntry(data, entry, center)).join('')
        : situation[key].map((entry) => renderEntry(data, entry)).join('');
      const extra = key === 'window' ? directoryHtml : '';
      return `<section class="step" aria-labelledby="step-${key}"><h2 id="step-${key}"><span class="step-no">${index + 1}</span>${title}</h2>`
        + `<ul class="entries${key === 'say' ? ' say' : ''}">${items}</ul>${extra}</section>`;
    }).join('');
    const cautions = situation.cautions.map((entry) => renderEntry(data, entry)).join('');
    const usedSources = [...new Set([
      ...SECTION_TITLES.flatMap(([key]) => situation[key].flatMap((entry) => entry.sources)),
      ...situation.cautions.flatMap((entry) => entry.sources),
      ...directory.sources,
    ])];
    const sourceList = usedSources.map((sid) => {
      const source = data.sources[sid];
      return `<li><a href="${escapeHtml(source.url)}" rel="noopener">${escapeHtml(source.title)}</a>`
        + `<span class="checked">${escapeHtml(source.publisher)} · 查核 ${escapeHtml(source.checkedOn)}</span></li>`;
    }).join('');
    return `<header class="detail-header"><a class="back" href="#/">‹ 我遇到了……</a>`
      + `<h1>${escapeHtml(situation.title)}</h1><p class="lead">${escapeHtml(situation.subtitle)}</p></header>`
      + sections
      + `<section class="step caution" aria-labelledby="step-caution"><h2 id="step-caution">先知道</h2><ul class="entries">${cautions}</ul></section>`
      + `<section class="sources" aria-labelledby="step-sources"><h2 id="step-sources">資料來源</h2><ol>${sourceList}</ol></section>`
      + `<p class="privacy">這個頁面不會記錄你選了什麼。</p>`;
  }

  function parseRoute(hash) {
    const match = /^#\/([a-z]+)$/.exec(hash || '');
    return match ? match[1] : null;
  }

  function mount(doc, data, bridge) {
    const app = doc.getElementById('app');
    const status = doc.getElementById('call-status');
    let district = '';

    function showStatus(text) {
      status.textContent = text;
      status.hidden = !text;
    }

    function render() {
      const id = parseRoute(root.location.hash);
      const html = id ? renderSituation(data, id, district) : null;
      app.innerHTML = html || renderHome(data);
      doc.title = html ? `${data.situations.find((item) => item.id === id).title}｜我遇到了……` : '我遇到了……';
    }

    root.addEventListener('hashchange', () => { district = ''; showStatus(''); render(); root.scrollTo(0, 0); });

    app.addEventListener('change', (event) => {
      if (event.target.id !== 'district') return;
      district = event.target.value;
      render();
      const select = doc.getElementById('district');
      if (select) select.focus();
    });

    app.addEventListener('click', async (event) => {
      const link = event.target.closest('a[data-dial]');
      if (!link || !bridge.available()) return; // plain browser: let tel: open the dialer
      event.preventDefault();
      const dial = link.dataset.dial;
      showStatus(`正在撥打 ${formatDial(dial)}…`);
      const failed = () => showStatus(`這台裝置沒辦法直接撥號，請手動撥打 ${formatDial(dial)}。`);
      const result = await bridge.call(dial, failed);
      if (result === 'opened') showStatus('');
      else if (result === 'unconfirmed') showStatus(`若沒有跳出撥號畫面，請直接撥 ${formatDial(dial)}。`);
      else if (result === 'busy') showStatus('上一通撥號還在處理，請稍等。');
      else failed();
    });

    render();
  }

  root.SituationApp = Object.freeze({ renderHome, renderSituation, parseRoute, formatDial, escapeHtml, mount });
  if (root.document && root.SITUATION_DATA && root.SituationBridge) {
    root.document.addEventListener('DOMContentLoaded', () => mount(root.document, root.SITUATION_DATA, root.SituationBridge));
  }
})(typeof window === 'undefined' ? globalThis : window);
