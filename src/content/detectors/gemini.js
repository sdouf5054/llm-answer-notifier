// gemini.js — Gemini (gemini.google.com) detector

window.__AI_NOTIFIER_DETECTOR = {
  hostnames: ['gemini.google.com'],

  // 페이지 로드 직후 progress bar 오감지 방지
  _initTime: Date.now(),
  _INIT_GRACE_MS: 5000,

  isGenerating() {
    if (Date.now() - this._initTime < this._INIT_GRACE_MS) return false;

    // Tier 1: Stop 버튼 (다국어 aria-label)
    if (document.querySelector('button[aria-label*="Stop"]'))  return true;
    if (document.querySelector('button[aria-label*="중지"]'))  return true;

    // Tier 2: Material progress bar
    if (document.querySelector('mat-progress-bar, .mat-mdc-progress-bar')) return true;

    // Tier 3: streaming 속성
    if (document.querySelector('[data-is-streaming="true"]')) return true;

    return false;
  },

  getLastResponseText() {
    const selectors = [
      'model-response .model-response-text',
      '[data-test-id="model-response-text"]',
      '.markdown',
      'message-content'
    ];

    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length === 0) continue;
      const text = (els[els.length - 1].innerText || '').trim();
      if (text) return text;
    }

    return null;
  }
};

console.log('[AI-Notifier] Gemini detector ready');
