/* Variant C「城市通原生」: TownPass component language (TPAppBar, TPCard, TPButton) so it reads as a built-in service. */
(function (root) {
  'use strict';
  const C = root.VariantCore;
  const { esc } = C;

  const ICONS = {
    food: '<path d="M4 11h16a8 8 0 0 1-16 0zM8 3c0 2-1.5 2-1.5 4M12 3c0 2-1.5 2-1.5 4M16 3c0 2-1.5 2-1.5 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    labor: '<path d="M4 8h16v11H4zM9 8V5h6v3M4 13h16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    emergency: '<path d="M4 11l8-7 8 7v9H4zM12 11v4m0 2.5v.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  };
  const PHONE = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>';

  function icon(id) {
    return `<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">${ICONS[id] || ICONS.emergency}</svg>`;
  }

  function appBar(title, back) {
    const lead = back ? '<a class="bar-back" href="#/" aria-label="返回"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></a>' : '<span class="bar-back"></span>';
    return `<header class="bar">${lead}<p class="bar-title">${esc(title)}</p><span class="bar-back"></span></header>`;
  }

  function segmented(state) {
    const opt = (value, label) => `<button type="button" class="seg-opt${state.period === value ? ' is-on' : ''}"`
      + `${state.period === value ? ' aria-pressed="true" disabled' : ' aria-pressed="false" data-flip-period'}>${label}</button>`;
    return `<div class="seg" role="group" aria-label="現在時段">${opt('day', '平日上班時間')}${opt('night', '晚上或假日')}</div>`;
  }

  function home(data, state) {
    const tiles = data.situations.map((s) => `<a class="tile" href="#/${esc(s.id)}"><span class="tile-icon">${icon(s.id)}</span>`
      + `<span class="tile-title">${esc(s.title)}</span></a>`).join('');
    return appBar('我遇到了', false)
      + '<div class="page">'
      + `<section class="card hello"><h1>不知道找誰，從這裡開始</h1>`
      + `<p>選一個最接近的狀況，馬上告訴你現在打哪支電話、開口怎麼說。</p>${segmented(state)}`
      + `<p class="hint">時段是照手機時間判斷；國定假日請選「晚上或假日」。</p></section>`
      + `<h2 class="group-title">你遇到哪一種狀況？</h2><nav class="tiles" aria-label="選擇情境">${tiles}</nav>`
      + `<p class="note">不用登入，這頁不會記下你選了什麼。資料整理自臺北市官方頁面與開放資料，查核日 ${esc(data.checkedOn)}。</p>`
      + '</div>';
  }

  function districtGrid(data) {
    return `<div class="grid4">${C.districts(data).map((d) => `<button type="button" class="btn-secondary" data-district="${esc(d)}">${esc(d.replace(/區$/, ''))}</button>`).join('')}</div>`;
  }

  function callCard(data, p, index, state) {
    const f = p.first;
    const districtRow = state.district && (f.entry.fromDirectory || p.others.some((c) => c.entry.fromDirectory))
      ? `<div class="kv"><span>居住行政區</span><strong>${esc(state.district)}</strong><button type="button" class="text-btn" data-clear-district>更改</button></div>` : '';
    if (f.open) {
      return `<section class="card now"><div class="card-head"><h2>你住哪一區？</h2></div>`
        + `<p class="muted">上班時間要打你那一區的社會福利服務中心，選了就顯示電話。</p>${districtGrid(data)}`
        + (p.timeNote ? `<p class="fine">${esc(p.timeNote.text)}${C.refsHtml(index, p.timeNote.sources)}</p>` : '')
        + '</section>';
    }
    const sub = [f.aside, f.note].filter(Boolean).join('。');
    const more = f.more.map((c) => `<a class="btn-secondary wide" href="tel:${esc(c.phone.dial)}" data-dial="${esc(c.phone.dial)}">`
      + `${esc(c.name.replace(/^.*?\(|\)$/g, ''))} ${esc(c.phone.display)}</a>`).join('');
    return `<section class="card now"><div class="card-head"><h2>現在打這支</h2></div>${districtRow}`
      + `<p class="who" tabindex="-1" data-focus-after-pick>${esc(f.who)}</p>`
      + `<p class="number">${esc(f.display)}</p>`
      + (sub ? `<p class="muted">${esc(sub)}</p>` : '')
      + (f.address ? `<p class="muted">${esc(f.address)}</p>` : '')
      + `<a class="btn-primary" href="tel:${esc(f.dial)}" data-dial="${esc(f.dial)}">${PHONE}撥打電話</a>${more}`
      + (p.timeNote ? `<p class="fine">${esc(p.timeNote.text)}${C.refsHtml(index, p.timeNote.sources)}</p>` : `<p class="fine">${C.refsHtml(index, f.sources)}</p>`)
      + '</section>';
  }

  function listRow(title, count, body, open) {
    const n = count ? `<span class="row-n">${count} 項</span>` : '';
    return `<details class="row"${open ? ' open' : ''}><summary><span class="row-title">${title}</span>${n}</summary><div class="row-body">${body}</div></details>`;
  }

  function bullets(index, entries) {
    return `<ul class="bul">${entries.map((e) => `<li${e.pending ? ' class="is-pending"' : ''}>${esc(e.text)}${C.refsHtml(index, e.sources)}</li>`).join('')}</ul>`;
  }

  function situationPage(data, situation, state) {
    const index = C.sourceIndex(data, situation);
    const p = C.plan(data, situation, state.period, state.district);
    const script = C.splitScript(p.say.text);
    const others = p.others.map((c) => (c.open
      ? `<li><strong>${esc(c.who)}</strong><span class="muted">選你住的區：</span>${districtGrid(data)}</li>`
      : `<li><strong>${esc(c.who)}</strong>${c.note ? `<span class="muted">${esc(c.note)}</span>` : ''}`
        + `<a class="btn-secondary wide" href="tel:${esc(c.dial)}" data-dial="${esc(c.dial)}">${PHONE}${esc(c.display)}</a>${C.refsHtml(index, c.sources)}</li>`)).join('');
    const sayOthers = p.otherSay.map((e) => {
      const s = C.splitScript(e.text);
      return `<li><strong>${esc(s.lead || '另一種說法')}</strong><span>「${C.scriptHtml(s.quote, 'blank', state.district)}」${C.refsHtml(index, e.sources)}</span></li>`;
    }).join('');
    const directory = data.directories[situation.directory];
    const places = situation.directory === 'laborConsult'
      ? listRow(esc(directory.title), directory.rows.length, `<ul class="stack">${directory.rows.map((r) => `<li><strong>${esc(r.name)}</strong>`
        + `<span class="muted">${esc(r.address)}</span><span class="muted">${esc(r.hours)}</span></li>`).join('')}</ul>${C.refsHtml(index, directory.sources)}`)
      : '';
    const openOthers = Boolean(state.district) && p.others.some((c) => c.entry.fromDirectory);

    return appBar(situation.title, true)
      + '<div class="page">'
      + `<div class="status"><span class="chip">${C.periodText(state.period)}</span><button type="button" class="text-btn" data-flip-period>`
      + `改看${state.period === 'day' ? '晚上或假日' : '平日上班時間'}</button></div>`
      + callCard(data, p, index, state)
      + `<section class="card say"><div class="card-head"><h2>開口怎麼說</h2></div>`
      + `<p class="script">「${C.scriptHtml(script.quote, 'blank', state.district)}」</p>`
      + `<p class="fine">底線的地方換成你的情況。${C.refsHtml(index, p.say.sources)}</p></section>`
      + '<section class="list" aria-label="更多資訊">'
      + listRow('要帶什麼', situation.bring.length, bullets(index, situation.bring))
      + listRow('怎麼申請、誰可以申請', p.facts.length, bullets(index, p.facts))
      + places
      + (others ? listRow('其他電話', p.others.length, `<ul class="stack">${others}</ul>`, openOthers) : '')
      + (sayOthers ? listRow('其他時段怎麼說', 0, `<ul class="stack">${sayOthers}</ul>`) : '')
      + listRow('先知道', situation.cautions.length, bullets(index, situation.cautions))
      + `<details class="row" data-sources><summary><span class="row-title">資料來源</span><span class="row-n">${index.list.length} 筆</span></summary>`
      + `<div class="row-body"><ol class="src-list">${C.sourcesListHtml(index)}</ol></div></details>`
      + '</section>'
      + `<p class="note">標「待確認」的是官方頁面沒寫清楚的地方，請打電話時再問一次。資料查核日 ${esc(data.checkedOn)}，以官方最新公告為準。</p>`
      + '</div>';
  }

  function render(data, state) {
    const situation = state.id && C.findSituation(data, state.id);
    return situation ? situationPage(data, situation, state) : home(data, state);
  }

  function titleOf(data, state) {
    const s = state.id && C.findSituation(data, state.id);
    return s ? `${s.title}｜我遇到了` : '我遇到了';
  }

  root.document.addEventListener('DOMContentLoaded', () => C.start(render, titleOf));
})(window);
