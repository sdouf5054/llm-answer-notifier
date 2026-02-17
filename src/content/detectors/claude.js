// claude.js — Claude (claude.ai) detector

window.__AI_NOTIFIER_DETECTOR = {
  hostnames: ['claude.ai'],

  isGenerating() {
    // Tier 1: Stop 버튼 (aria-label)
    if (document.querySelector('button[aria-label="Stop response"]'))  return true;
    if (document.querySelector('button[aria-label="응답 중지"]'))      return true;

    // Tier 2: Stop 버튼 (data-testid)
    if (document.querySelector('button[data-testid="stop-button"]')) return true;

    // Tier 3: streaming 속성 / 커서
    if (document.querySelector('[data-is-streaming="true"]')) return true;

    return false;
  },

  getLastResponseText() {
    const selectors = [
      '.font-claude-message',
      '[data-message-author="assistant"]',
      '[data-role="assistant"]',
      '.prose, .markdown'
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

console.log('[AI-Notifier] Claude detector ready');
