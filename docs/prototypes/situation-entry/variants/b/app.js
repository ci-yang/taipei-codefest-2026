/* Variant B「行動卡」: one card per situation — number, script, checklist — that can be screenshotted or shown to a social worker. */
(function (root) {
  'use strict';
  const C = root.VariantCore;
  const { esc } = C;
  const checked = new Set(); // page memory only; gone on reload

  const PHONE = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>';

  function pending(entry) {
    return entry.pending && !entry.text.includes('待確認') ? '<span class="pending">待確認</span>' : '';
  }

  function periodTag(state) {
    return `<button type="button" class="period" data-flip-period aria-label="${C.periodText(state.period)}，點一下切換">`
      + `${state.period === 'day' ? '白天' : '晚上／假日'}<span class="period-swap">切換</span></button>`;
  }

  function preview(data, situation, state) {
    const p = C.plan(data, situation, state.period, state.district);
    if (p.first.open) return '你那一區的社福中心';
    return p.first.who.includes(p.first.display) ? p.first.who : `${p.first.who} ${p.first.display}`;
  }

  function home(data, state) {
    const cards = data.situations.map((s) => `<a class="mini" href="#/${esc(s.id)}">`
      + `<span class="mini-band">${esc(s.title)}</span>`
      + `<span class="mini-body"><span class="mini-sub">${esc(s.subtitle)}</span>`
      + `<span class="mini-now">現在打：${esc(preview(data, s, state))}</span></span></a>`).join('');
    return `<header class="top"><h1>我遇到了……</h1>${periodTag(state)}</header>`
      + `<p class="intro">每一張卡寫好現在打給誰、開口怎麼說、要帶什麼。挑最接近你的那張。</p>`
      + `<nav class="deck" aria-label="選擇情境">${cards}</nav>`
      + `<p class="foot">不用登入。這頁不會記下你選了什麼，勾選的東西重新整理就清空。</p>`;
  }

  function districtPicker(data) {
    const chips = C.districts(data).map((d) => `<button type="button" class="chip" data-district="${esc(d)}">${esc(d.replace(/區$/, ''))}</button>`).join('');
    return `<div class="pick"><p class="pick-q">你住哪一區？</p><div class="chips">${chips}</div></div>`;
  }

  function callBlock(data, p, index, state) {
    const f = p.first;
    if (f.open) return districtPicker(data);
    const area = state.district && f.entry.fromDirectory
      ? `<button type="button" class="area" data-clear-district>${esc(state.district)}<span>換區</span></button>` : '';
    const sub = [f.aside, f.note, f.address].filter(Boolean).join('。');
    const more = f.more.map((c) => `<p class="also">同區另有${esc(c.name.replace(/^.*?\(|\)$/g, ''))}：`
      + `<a href="tel:${esc(c.phone.dial)}" data-dial="${esc(c.phone.dial)}">${esc(c.phone.display)}</a></p>`).join('');
    return `<p class="who" tabindex="-1" data-focus-after-pick>${esc(f.who)}${area}</p>`
      + `<p class="number">${esc(f.display)}</p>`
      + (sub ? `<p class="sub">${esc(sub)}${C.refsHtml(index, f.sources)}</p>` : '')
      + `<a class="dial" href="tel:${esc(f.dial)}" data-dial="${esc(f.dial)}">${PHONE}撥出這支電話</a>${more}`;
  }

  function checklist(situation, index) {
    return situation.bring.map((entry, i) => {
      const key = `${situation.id}:${i}`;
      return `<li><label class="check"><input type="checkbox" data-check="${key}"${checked.has(key) ? ' checked' : ''}>`
        + `<span class="box" aria-hidden="true"></span><span class="check-text">${pending(entry)}${esc(entry.text)}</span></label>`
        + `${C.refsHtml(index, entry.sources)}</li>`;
    }).join('');
  }

  function row(title, body) {
    return `<details class="row"><summary>${title}</summary><div class="row-body">${body}</div></details>`;
  }

  function card(data, situation, state) {
    const index = C.sourceIndex(data, situation);
    const p = C.plan(data, situation, state.period, state.district);
    const script = C.splitScript(p.say.text);
    const timeNote = p.timeNote ? `<p class="time">${esc(p.timeNote.text)}${C.refsHtml(index, p.timeNote.sources)}</p>` : '';
    const others = p.others.map((c) => (c.open
      ? `<li><strong>${esc(c.who)}</strong><span>選了你住的區就會顯示。</span>${districtPicker(data)}</li>`
      : `<li><strong>${esc(c.who)}</strong>${c.note ? `<span>${esc(c.note)}</span>` : ''}`
        + `<a class="line-dial" href="tel:${esc(c.dial)}" data-dial="${esc(c.dial)}">${PHONE}${esc(c.display)}</a>${C.refsHtml(index, c.sources)}</li>`)).join('');
    const sayOthers = p.otherSay.map((e) => {
      const s = C.splitScript(e.text);
      return `<li><strong>${esc(s.lead || '另一種說法')}</strong><span>「${C.scriptHtml(s.quote, 'blank', state.district)}」${C.refsHtml(index, e.sources)}</span></li>`;
    }).join('');
    const facts = p.facts.map((e) => `<li>${pending(e)}${esc(e.text)}${C.refsHtml(index, e.sources)}</li>`).join('');
    const cautions = situation.cautions.map((e) => `<li>${pending(e)}${esc(e.text)}${C.refsHtml(index, e.sources)}</li>`).join('');
    const directory = data.directories[situation.directory];
    const places = situation.directory === 'laborConsult'
      ? row(esc(directory.title), `<ul class="list">${directory.rows.map((r) => `<li><strong>${esc(r.name)}</strong>`
        + `<span>${esc(r.address)}</span><span>${esc(r.hours)}</span></li>`).join('')}</ul>${C.refsHtml(index, directory.sources)}`)
      : '';

    return `<header class="top"><a class="back" href="#/" aria-label="回到所有卡片">‹</a>${periodTag(state)}</header>`
      + `<article class="card" aria-labelledby="card-title">`
      + `<h1 class="band" id="card-title">${esc(situation.title)}</h1>`
      + `<section class="part call" aria-label="現在打給誰"><p class="label">現在打給</p>${callBlock(data, p, index, state)}${timeNote}</section>`
      + `<section class="part say" aria-label="開口怎麼說"><p class="label">接通後照著說</p>`
      + `<p class="script">「${C.scriptHtml(script.quote, 'blank', state.district)}」${C.refsHtml(index, p.say.sources)}</p></section>`
      + `<section class="part bring" aria-label="要帶的東西"><p class="label">要準備的東西</p><ul class="checks">${checklist(situation, index)}</ul></section>`
      + `<p class="card-foot">可以截圖，或直接把手機拿給社工看。</p>`
      + `</article>`
      + `<div class="rows">`
      + (others ? row('其他電話', `<ul class="list">${others}</ul>`) : '')
      + (sayOthers ? row('其他時段怎麼說', `<ul class="list">${sayOthers}</ul>`) : '')
      + row('怎麼申請、誰可以申請', `<ul class="list">${facts}</ul>`)
      + places
      + row('先知道', `<ul class="list">${cautions}</ul>`)
      + `<details class="row" data-sources><summary>資料來源</summary><div class="row-body"><ol class="src-list">${C.sourcesListHtml(index)}</ol></div></details>`
      + `</div><p class="foot">整理自臺北市官方頁面與開放資料，查核日 ${esc(data.checkedOn)}，以官方最新公告為準。</p>`;
  }

  function render(data, state) {
    const situation = state.id && C.findSituation(data, state.id);
    return situation ? card(data, situation, state) : home(data, state);
  }

  function titleOf(data, state) {
    const s = state.id && C.findSituation(data, state.id);
    return s ? `${s.title}｜行動卡` : '我遇到了……';
  }

  root.document.addEventListener('DOMContentLoaded', () => {
    C.start(render, titleOf);
    root.document.getElementById('app').addEventListener('change', (event) => {
      const key = event.target.dataset && event.target.dataset.check;
      if (!key) return;
      if (event.target.checked) checked.add(key); else checked.delete(key);
    });
  });
})(window);
