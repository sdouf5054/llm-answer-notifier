// perplexity.js — Perplexity (perplexity.ai) detector

window.__AI_NOTIFIER_DETECTOR = {
  // normalized: www 접두사 제거하여 background 사이트 키와 통일
  hostnames: ['perplexity.ai'],

  // 페이지 로드 직후 오감지 방지
  _initTime: Date.now(),
  _INIT_GRACE_MS: 5000,

  isGenerating() {
    if (Date.now() - this._initTime < this._INIT_GRACE_MS) return false;

    // Tier 1: Stop 버튼 (aria-label)
    if (document.querySelector('button[aria-label*="Stop"]'))  return true;
    if (document.querySelector('button[aria-label*="중지"]'))  return true;

    // Tier 2: streaming indicator
    if (document.querySelector('[data-testid="streaming-indicator"]')) return true;

    // Tier 3: 스피너 — 답변 영역 내부로 한정하여 오감지 방지
    // (.animate-spin은 Tailwind 범용 클래스이므로 부모 컨텍스트로 제한)
    if (document.querySelector('[class*="prose"] .animate-spin, [class*="answer"] .animate-spin, main .animate-spin')) return true;

    return false;
  },

  getLastResponseText() {
    const selectors = ['.prose', '.markdown', '.markdown-body'];

    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length === 0) continue;
      const text = (els[els.length - 1].innerText || '').trim();
      if (text) return text;
    }

    return null;
  }
};

console.log('[AI-Notifier] Perplexity detector ready');
