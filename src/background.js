// background.js — Service Worker
// 담당: 소리 재생, heartbeat(pacemaker), 네트워크 기반 스트리밍 완료 감지

'use strict';

const P = '[AI-Notifier BG]';

// ─── 사이트별 기본 알림음 ────────────────────────────────────

const DEFAULT_SOUNDS = {
  'chatgpt.com':        'default.wav',
  'claude.ai':          'default.wav',
  'gemini.google.com':  'default.wav',
  'perplexity.ai':      'default.wav'
};

// ─── 소리 재생 (Offscreen Document) ───────────────────────────

const OFFSCREEN_PATH = 'src/offscreen.html';

async function ensureOffscreen() {
  const exists = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_PATH)]
  });
  if (exists.length > 0) return;

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Play notification sound on LLM response completion'
  });
}

async function playSound(site) {
  const { volume, sounds } = await chrome.storage.sync.get({
    volume: 0.7,
    sounds: DEFAULT_SOUNDS
  });

  const soundFile = sounds[site] || 'default.wav';

  // "none" → 이 사이트는 알림 꺼짐
  if (soundFile === 'none') {
    console.log(P, `Sound disabled for ${site}`);
    return;
  }

  await ensureOffscreen();
  chrome.runtime.sendMessage({ type: 'PLAY_SOUND', volume, soundFile });
}

// ─── 탭별 알림 쿨다운 (네트워크 ↔ Content Script 중복 방지) ──

const tabCooldown = new Map();
const TAB_COOLDOWN_MS = 5000;

function canNotify(tabId) {
  return Date.now() - (tabCooldown.get(tabId) || 0) >= TAB_COOLDOWN_MS;
}

function markNotified(tabId) {
  tabCooldown.set(tabId, Date.now());
}

// ─── Heartbeat (Pacemaker) ────────────────────────────────────

const heartbeats = new Map();

function startHeartbeat(tabId) {
  if (heartbeats.has(tabId)) return;
  console.log(P, `Heartbeat started (tab ${tabId})`);

  const timer = setInterval(() => {
    chrome.tabs.sendMessage(tabId, { type: 'PULSE' }).catch(() => {
      stopHeartbeat(tabId);
    });
  }, 1000);

  heartbeats.set(tabId, timer);
}

function stopHeartbeat(tabId) {
  const timer = heartbeats.get(tabId);
  if (!timer) return;
  clearInterval(timer);
  heartbeats.delete(tabId);
  console.log(P, `Heartbeat stopped (tab ${tabId})`);
}

// ─── 메시지 핸들러 ───────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender) => {
  const tabId = sender.tab?.id;

  switch (msg.type) {
    case 'PLAY_TEST_SOUND':
      playSound(msg.site);
      break;

    case 'ANSWER_DONE':
      console.log(P, 'Answer done:', msg.site, `(tab ${tabId})`);
      if (tabId && !canNotify(tabId)) {
        console.log(P, 'Skipped — tab cooldown active');
        break;
      }
      if (tabId) markNotified(tabId);
      playSound(msg.site);
      break;

    case 'START_HEARTBEAT':
      if (tabId) startHeartbeat(tabId);
      break;

    case 'STOP_HEARTBEAT':
      if (tabId) stopHeartbeat(tabId);
      break;
  }
});

// ─── 네트워크 기반 스트리밍 완료 감지 ─────────────────────────

const STREAM_URL_PATTERNS = [
  'https://chatgpt.com/backend-api/f/conversation',
  'https://claude.ai/api/*/completion',
  'https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate*',
  'https://gemini.google.com/u/*/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate*',
  'https://www.perplexity.ai/rest/sse/perplexity_ask*'
];

const MIN_STREAM_DURATION_MS = 1000;
const pendingStreams = new Map();

function siteFromUrl(url) {
  if (url.includes('chatgpt.com'))        return 'chatgpt.com';
  if (url.includes('claude.ai'))          return 'claude.ai';
  if (url.includes('gemini.google.com'))  return 'gemini.google.com';
  if (url.includes('perplexity.ai'))      return 'perplexity.ai';
  return null;
}

chrome.webRequest.onBeforeRequest.addListener(
  ({ tabId, url, requestId }) => {
    if (tabId < 0) return;
    const site = siteFromUrl(url);
    pendingStreams.set(requestId, { tabId, startTime: Date.now(), site });
    console.log(P, `${site} stream started (tab ${tabId}, req ${requestId})`);
  },
  { urls: STREAM_URL_PATTERNS }
);

chrome.webRequest.onCompleted.addListener(
  ({ tabId, requestId }) => {
    const tracked = pendingStreams.get(requestId);
    if (!tracked) return;
    pendingStreams.delete(requestId);

    const duration = Date.now() - tracked.startTime;
    const { site } = tracked;

    if (duration < MIN_STREAM_DURATION_MS) return;
    if (!canNotify(tabId)) {
      console.log(P, `${site} stream ended — tab cooldown active (${duration}ms)`);
      return;
    }

    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) return;

      chrome.storage.sync.get({ alwaysNotify: true }, ({ alwaysNotify }) => {
        if (!alwaysNotify && tab.active) {
          console.log(P, `${site} stream ended — tab active, CS handles (${duration}ms)`);
          return;
        }

        markNotified(tabId);
        console.log(P, `${site} stream ended (${duration}ms) — playing sound`);
        playSound(site);
        chrome.tabs.sendMessage(tabId, { type: 'NETWORK_DONE' }).catch(() => {});
      });
    });
  },
  { urls: STREAM_URL_PATTERNS }
);

chrome.webRequest.onErrorOccurred.addListener(
  ({ requestId }) => { pendingStreams.delete(requestId); },
  { urls: STREAM_URL_PATTERNS }
);

console.log(P, 'Service worker started');
