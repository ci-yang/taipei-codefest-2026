/* 開口卡：全螢幕覆蓋層，上半給店員看中文大字，下半給使用者看母語同一句。
 * 不發網路請求、不寫儲存、不記錄。需先載入 speak-card-strings.js。
 * API：window.FriendlySpeakCard.{ openSpeakCard, closeSpeakCard, getAvailableLangs, planSpeakCard }
 */
(function (root, factory) {
  const strings = typeof module === 'object' && module.exports
    ? require('./speak-card-strings.js')
    : root && root.FRIENDLY_SPEAK_CARD_STRINGS;
  const api = factory(strings);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FriendlySpeakCard = api;
})(typeof window === 'undefined' ? null : window, function (STRINGS) {
  'use strict';

  if (!STRINGS) throw new Error('speak-card.js：請先載入 speak-card-strings.js');
  const STAFF_LANG = STRINGS.staffLang;

  function getAvailableLangs({ includeUnreviewed = false } = {}) {
    return Object.entries(STRINGS.langs)
      .filter(([, meta]) => includeUnreviewed || meta.reviewed === true)
      .map(([code, meta]) => ({ code, label: meta.label, reviewed: meta.reviewed === true }));
  }

  // 純函式：決定要渲染哪些區塊。未上架語言退回中文單面，避免未校對文案外流。
  function planSpeakCard({ category, lang = STAFF_LANG, includeUnreviewed = false } = {}) {
    const entry = STRINGS.categories[category];
    if (!entry) throw new Error(`開口卡：未知類別 ${category}`);
    const available = getAvailableLangs({ includeUnreviewed }).map(item => item.code);
    const requested = lang || STAFF_LANG;
    const resolved = available.includes(requested) ? requested : STAFF_LANG;
    const face = code => ({
      lang: code,
      htmlLang: STRINGS.langs[code].htmlLang,
      label: STRINGS.langs[code].label,
      reviewed: STRINGS.langs[code].reviewed === true,
      ask: entry.phrases[code].ask,
      thanks: entry.phrases[code].thanks,
    });
    const single = resolved === STAFF_LANG;
    return {
      category,
      categoryLabel: entry.label,
      layout: single ? 'single' : 'double',
      requestedLang: requested,
      fellBack: resolved !== requested,
      staff: face(STAFF_LANG),
      user: single ? null : face(resolved),
    };
  }

  let current = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function buildFace(face, role) {
    const section = el('section', `speak-card-face speak-card-${role}`);
    section.setAttribute('lang', face.htmlLang);
    const ask = el('p', 'speak-card-ask', face.ask);
    const thanks = el('p', 'speak-card-thanks', face.thanks);
    if (role === 'staff') {
      ask.id = 'speak-card-title';
      section.append(ask, thanks, el('p', 'speak-card-hint', '請給店員看'));
    } else {
      const meta = el('p', 'speak-card-lang', face.label);
      if (!face.reviewed) meta.append(el('span', 'speak-card-unreviewed', '未校對・內部預覽'));
      section.append(meta, ask, thanks);
    }
    return section;
  }

  function onKeydown(event) {
    if (!current) return;
    if (event.key === 'Escape') { event.preventDefault(); closeSpeakCard(); return; }
    if (event.key === 'Tab') {
      // 卡上只有一個可聚焦元素，Tab 留在關閉鈕上。
      event.preventDefault();
      current.closeButton.focus();
    }
  }

  function openSpeakCard({ category, lang = STAFF_LANG, onClose, includeUnreviewed = false } = {}) {
    const plan = planSpeakCard({ category, lang, includeUnreviewed });
    if (current) closeSpeakCard({ silent: true });

    const overlay = el('div', 'speak-card');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'speak-card-title');
    overlay.dataset.layout = plan.layout;
    overlay.dataset.category = plan.category;

    const faces = el('div', 'speak-card-faces');
    faces.append(buildFace(plan.staff, 'staff'));
    if (plan.user) faces.append(buildFace(plan.user, 'user'));

    const closeButton = el('button', 'speak-card-close', '關閉');
    closeButton.type = 'button';
    closeButton.addEventListener('click', () => closeSpeakCard());
    const footer = el('div', 'speak-card-footer');
    footer.append(closeButton);
    overlay.append(faces, footer);

    current = { overlay, closeButton, onClose, returnFocus: document.activeElement };
    document.documentElement.classList.add('speak-card-open');
    document.body.append(overlay);
    document.addEventListener('keydown', onKeydown);
    closeButton.focus();
    return plan;
  }

  function closeSpeakCard({ silent = false } = {}) {
    if (!current) return false;
    const { overlay, onClose, returnFocus } = current;
    current = null;
    document.removeEventListener('keydown', onKeydown);
    overlay.remove();
    document.documentElement.classList.remove('speak-card-open');
    if (returnFocus && typeof returnFocus.focus === 'function' && returnFocus.isConnected !== false) returnFocus.focus();
    if (!silent && typeof onClose === 'function') onClose();
    return true;
  }

  return Object.freeze({ openSpeakCard, closeSpeakCard, getAvailableLangs, planSpeakCard });
});
