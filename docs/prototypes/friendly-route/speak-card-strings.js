/* 開口卡文案：內建於 App，離線可用，不呼叫任何線上翻譯或 LLM。
 *
 * 校對狀態（US-2、FR-004）：
 * - zh-TW 是原文，依 lead 指示標 reviewed: true；校對人與日期尚未登記，待補（不編造）。
 * - en、id、vi、ja、ko 為機器翻譯初稿，未經母語者校對（2026-11-08 加 ja、ko）。
 *   一律 reviewed: false；getAvailableLangs() 預設不列，App 以 includeUnreviewed 列出，
 *   畫面一律標「機器翻譯」（D17）。
 *   母語者校對後，把 reviewed 改 true 並填 reviewedBy／reviewedOn，
 *   同時登記到 README 資料來源表旁。
 */
(function (root, factory) {
  const data = factory();
  if (typeof module === 'object' && module.exports) module.exports = data;
  if (root) root.FRIENDLY_SPEAK_CARD_STRINGS = data;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';

  const deepFreeze = value => {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(deepFreeze);
      Object.freeze(value);
    }
    return value;
  };

  return deepFreeze({
    staffLang: 'zh-TW',
    langs: {
      'zh-TW': { label: '中文', htmlLang: 'zh-Hant-TW', reviewed: true, reviewedBy: null, reviewedOn: null },
      en: { label: 'English', htmlLang: 'en', reviewed: false, reviewedBy: null, reviewedOn: null },
      id: { label: 'Bahasa Indonesia', htmlLang: 'id', reviewed: false, reviewedBy: null, reviewedOn: null },
      vi: { label: 'Tiếng Việt', htmlLang: 'vi', reviewed: false, reviewedBy: null, reviewedOn: null },
      ja: { label: '日本語', htmlLang: 'ja', reviewed: false, reviewedBy: null, reviewedOn: null },
      ko: { label: '한국어', htmlLang: 'ko', reviewed: false, reviewedBy: null, reviewedOn: null },
    },
    categories: {
      toilet: {
        label: '借廁所',
        phrases: {
          'zh-TW': { ask: '您好，我想借用廁所，請問方便嗎？謝謝', thanks: '不方便也沒關係，謝謝' },
          en: { ask: 'Hello, may I use your restroom, please? Thank you.', thanks: "It's okay if not. Thank you." },
          id: { ask: 'Permisi, bolehkah saya menumpang ke toilet? Terima kasih.', thanks: 'Kalau tidak bisa, tidak apa-apa. Terima kasih.' },
          vi: { ask: 'Xin chào, tôi có thể mượn nhà vệ sinh được không ạ? Cảm ơn.', thanks: 'Nếu không tiện cũng không sao ạ. Cảm ơn.' },
          ja: { ask: 'すみません、トイレをお借りしてもよろしいですか？ありがとうございます。', thanks: '難しければ大丈夫です。ありがとうございます。' },
          ko: { ask: '안녕하세요, 화장실을 좀 써도 될까요? 감사합니다.', thanks: '안 되셔도 괜찮아요. 감사합니다.' },
        },
      },
      charge: {
        label: '借插座充電',
        phrases: {
          'zh-TW': { ask: '您好，我想借插座充電一下，請問方便嗎？謝謝', thanks: '不方便也沒關係，謝謝' },
          en: { ask: 'Hello, may I charge my phone here for a moment, please? Thank you.', thanks: "It's okay if not. Thank you." },
          id: { ask: 'Permisi, bolehkah saya menumpang mengisi daya ponsel sebentar? Terima kasih.', thanks: 'Kalau tidak bisa, tidak apa-apa. Terima kasih.' },
          vi: { ask: 'Xin chào, tôi có thể mượn ổ cắm sạc điện thoại một chút được không ạ? Cảm ơn.', thanks: 'Nếu không tiện cũng không sao ạ. Cảm ơn.' },
          ja: { ask: 'すみません、コンセントで少し充電させていただけますか？ありがとうございます。', thanks: '難しければ大丈夫です。ありがとうございます。' },
          ko: { ask: '안녕하세요, 콘센트로 잠깐 충전해도 될까요? 감사합니다.', thanks: '안 되셔도 괜찮아요. 감사합니다.' },
        },
      },
      wifi: {
        label: '借 Wi-Fi',
        phrases: {
          'zh-TW': { ask: '您好，請問可以告訴我 Wi-Fi 密碼嗎？謝謝', thanks: '不方便也沒關係，謝謝' },
          en: { ask: 'Hello, could you tell me the Wi-Fi password, please? Thank you.', thanks: "It's okay if not. Thank you." },
          id: { ask: 'Permisi, bolehkah saya minta kata sandi Wi-Fi? Terima kasih.', thanks: 'Kalau tidak bisa, tidak apa-apa. Terima kasih.' },
          vi: { ask: 'Xin chào, cho tôi xin mật khẩu Wi-Fi được không ạ? Cảm ơn.', thanks: 'Nếu không tiện cũng không sao ạ. Cảm ơn.' },
          ja: { ask: 'すみません、Wi-Fi のパスワードを教えていただけますか？ありがとうございます。', thanks: '難しければ大丈夫です。ありがとうございます。' },
          ko: { ask: '안녕하세요, Wi-Fi 비밀번호를 알려 주실 수 있을까요? 감사합니다.', thanks: '안 되셔도 괜찮아요. 감사합니다.' },
        },
      },
    },
  });
});
