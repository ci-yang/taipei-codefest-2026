/* Variant A「一句話引導」: one question at a time, then one answer. */
(function (root) {
  'use strict';
  const C = root.SituationCore;
  const { esc } = C;

  function pending(entry) {
    return entry.pending && !entry.text.includes('待確認') ? '<span class="pending">待確認</span>' : '';
  }

  function line(index, entry) {
    return `<li>${pending(entry)}${esc(entry.text)}${C.refsHtml(index, entry.sources)}</li>`;
  }

  function nowBar(state) {
    const flip = state.period === 'day' ? '改看晚上的做法' : '改看白天的做法';
    return `<p class="now">${C.periodText(state.period)}<button type="button" class="now-flip" data-flip-period>${flip}</button></p>`;
  }

  function home(data, state) {
    const options = data.situations.map((s) => `<a class="reply" href="#/${esc(s.id)}">`
      + `<span class="reply-title">${esc(s.title)}</span><span class="reply-sub">${esc(s.subtitle)}</span></a>`).join('');
    return `${nowBar(state)}<h1 class="ask">現在遇到<br>什麼事？</h1>`
      + `<p class="ask-sub">選一個最接近的，下一步就告訴你打給誰、怎麼說。</p>`
      + `<nav class="replies" aria-label="選擇情境">${options}</nav>`
      + `<p class="quiet">不用登入。這頁不會記下你選了什麼。</p>`;
  }

  function said(situation, state) {
    const asks = C.needsDistrict(situation) && state.district;
    const where = asks ? `，住${esc(state.district)}` : '';
    const change = asks ? '<button type="button" class="said-edit" data-clear-district>改地區</button>' : '';
    return `<p class="said"><a class="said-back" href="#/" aria-label="回到上一題">‹</a>`
      + `<span>你說：${esc(situation.title)}${where}</span>${change}</p>`;
  }

  function askDistrict(data, situation, state) {
    const chips = C.districts(data).map((d) => `<button type="button" class="district" data-district="${esc(d)}">${esc(d.replace(/區$/, ''))}</button>`).join('');
    return `${nowBar(state)}${said(situation, state)}<h1 class="ask">你住哪一區？</h1>`
      + `<p class="ask-sub">上班時間要打你那一區的社會福利服務中心。</p>`
      + `<div class="districts">${chips}</div>`;
  }

  function more(title, body, count, open) {
    const n = count ? `<span class="more-n">${count}</span>` : '';
    return `<details class="more"${open ? ' open' : ''}><summary>${title}${n}</summary><div class="more-body">${body}</div></details>`;
  }

  function otherCall(data, call, index) {
    if (call.open) {
      const chips = C.districts(data).map((d) => `<button type="button" class="district small" data-district="${esc(d)}">${esc(d.replace(/區$/, ''))}</button>`).join('');
      return `<li><strong>${esc(call.who)}</strong><span class="other-note">選你住的區，就會出現電話。</span><div class="districts">${chips}</div></li>`;
    }
    const note = call.note ? `<span class="other-note">${esc(call.note)}</span>` : '';
    return `<li><strong>${esc(call.who)}</strong>${note}<a class="dial-small" href="tel:${esc(call.dial)}" data-dial="${esc(call.dial)}"${call.entry.fromDirectory ? ' data-focus-after-pick' : ''}>撥 ${esc(call.display)}</a>`
      + `${C.refsHtml(index, call.sources)}</li>`;
  }

  function answer(data, situation, state) {
    const index = C.sourceIndex(data, situation);
    const p = C.plan(data, situation, state.period, state.district);
    const f = p.first;
    const script = C.splitScript(p.say.text);
    const extra = f.more.map((c) => `<p class="also">同區另有${esc(c.name.replace(/^.*?\(|\)$/g, ''))}：`
      + `<a href="tel:${esc(c.phone.dial)}" data-dial="${esc(c.phone.dial)}">${esc(c.phone.display)}</a></p>`).join('');
    const aside = f.aside ? `<p class="aside">${esc(f.aside)}</p>` : '';
    const timeNote = p.timeNote ? `<p class="time-note">${esc(p.timeNote.text)}${C.refsHtml(index, p.timeNote.sources)}</p>` : '';
    const where = f.address ? `<p class="where">${esc(f.address)}</p>` : (f.note ? `<p class="where">${esc(f.note)}</p>` : '');

    const otherSays = p.otherSay.map((entry) => {
      const s = C.splitScript(entry.text);
      return `<div class="alt-say"><p class="alt-lead">${esc(s.lead || '另一種說法')}</p>`
        + `<p>「${C.scriptHtml(s.quote, 'blank', state.district)}」${C.refsHtml(index, entry.sources)}</p></div>`;
    }).join('');

    const directory = data.directories[situation.directory];
    const places = situation.directory === 'laborConsult'
      ? more(esc(directory.title), `<ul class="places">${directory.rows.map((r) => `<li><strong>${esc(r.name)}</strong>`
        + `<span>${esc(r.address)}</span><span>${esc(r.hours)}</span></li>`).join('')}</ul>${C.refsHtml(index, directory.sources)}`, directory.rows.length)
      : '';

    return `${nowBar(state)}${said(situation, state)}`
      + `<section class="answer" aria-labelledby="who"><p class="answer-lead">現在打給</p>`
      + `<h1 id="who" class="who" tabindex="-1"${f.entry.fromDirectory ? ' data-focus-after-pick' : ''}>${esc(f.who)}</h1>${aside}`
      + `<a class="dial" href="tel:${esc(f.dial)}" data-dial="${esc(f.dial)}"><span class="dial-icon" aria-hidden="true">`
      + '<svg viewBox="0 0 24 24" width="26" height="26"><path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>'
      + `</span><span class="dial-number">${esc(f.display)}</span><span class="dial-verb">撥號</span></a>`
      + `${extra}${where}${timeNote}</section>`
      + `<section class="script" aria-labelledby="say-h"><h2 id="say-h">接通後，照著念</h2>`
      + `<blockquote>${C.scriptHtml(script.quote, 'blank', state.district)}</blockquote>`
      + `<p class="script-hint">空格換成你的情況。${C.refsHtml(index, p.say.sources)}</p></section>`
      + '<section class="after"><h2>打完再看</h2>'
      + (otherSays ? more('其他說法', otherSays, p.otherSay.length) : '')
      + more('要帶什麼', `<ul class="lines">${situation.bring.map((e) => line(index, e)).join('')}</ul>`, situation.bring.length)
      + more('怎麼申請、誰可以申請', `<ul class="lines">${p.facts.map((e) => line(index, e)).join('')}</ul>`, p.facts.length)
      + places
      + more('其他電話', `<ul class="others">${p.others.map((c) => otherCall(data, c, index)).join('')}</ul>`, p.others.length,
        Boolean(state.district) && p.others.some((c) => c.entry.fromDirectory))
      + more('先知道', `<ul class="lines">${situation.cautions.map((e) => line(index, e)).join('')}</ul>`, situation.cautions.length)
      + `<details class="more sources" data-sources><summary>資料來源<span class="more-n">${index.list.length}</span></summary>`
      + `<div class="more-body"><ol class="src-list">${C.sourcesListHtml(index)}</ol></div></details></section>`
      + `<p class="quiet">內容整理自臺北市官方頁面與開放資料，查核日 ${esc(data.checkedOn)}，以官方最新公告為準。這頁不會記下你選了什麼。</p>`;
  }

  function render(data, state) {
    const situation = state.id && C.findSituation(data, state.id);
    if (!situation) return home(data, state);
    const p = C.plan(data, situation, state.period, state.district);
    return p.first.open ? askDistrict(data, situation, state) : answer(data, situation, state);
  }

  function titleOf(data, state) {
    const s = state.id && C.findSituation(data, state.id);
    return s ? `${s.title}｜我遇到了……` : '我遇到了……';
  }

  root.document.addEventListener('DOMContentLoaded', () => C.start(render, titleOf));
})(window);
