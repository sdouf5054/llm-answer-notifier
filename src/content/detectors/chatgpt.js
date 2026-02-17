// chatgpt.js — ChatGPT (chatgpt.com) detector

window.__AI_NOTIFIER_DETECTOR = {
  hostnames: ['chatgpt.com', 'chat.openai.com'],

  isGenerating() {
    // Tier 1: 핵심 스트리밍 클래스
    if (document.querySelector('.result-streaming')) return true;

    // Tier 2: Stop 버튼 (data-testid / aria-label)
    if (document.querySelector('button[data-testid="stop-button"]')) return true;
    if (document.querySelector('button[aria-label*="Stop"]'))        return true;

    // Tier 3: 스피너 애니메이션 (main 영역)
    if (document.querySelector('main svg.animate-spin')) return true;

    return false;
  },

  getLastResponseText() {
    const selectors = [
      '[data-message-author-role="assistant"]',
      'div.agent-turn',
      'article[data-testid*="conversation-turn"]',
      'main .markdown'
    ];

    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length === 0) continue;
      const text = (els[els.length - 1].textContent || '').trim();
      if (text) return text;
    }

    return null;
  }
};

console.log('[AI-Notifier] ChatGPT detector ready');
