// engine.js — 공통 감지 엔진
// detector(사이트별)가 먼저 로드되어 window.__AI_NOTIFIER_DETECTOR에 등록된 후 실행.
//
// 상태 흐름:
//   IDLE → GENERATING → SETTLING → DONE → IDLE
//                ↑ flickering ↓
//             GENERATING ← SETTLING
//
// PENDING_DONE: onDone() 비동기 처리 중 재진입 방지용 잠금 상태
//
// 모든 시간 판정은 tick() 내에서 Date.now() 비교로 수행.
// (hidden 탭에서 setTimeout이 throttle되므로 setTimeout 사용하지 않음)

(function () {
  'use strict';

  const detector = window.__AI_NOTIFIER_DETECTOR;
  if (!detector) {
    console.warn('[AI-Notifier] No detector found. Aborting.');
    return;
  }

  // ─── 상수 ────────────────────────────────────────────────────

  const P = '[AI-Notifier]';
  const POLL_MS          = 500;   // 안전망 polling 주기
  const TEXT_STABLE_MS   = 1500;  // 텍스트 변화 없으면 완료 판정
  const COOLDOWN_MS      = 3000;  // DONE → IDLE 전이 대기
  const GRACE_MS         = 2000;  // 생성 신호 소멸 후 flickering 유예

  // ─── 상태 ────────────────────────────────────────────────────

  let state            = 'IDLE';
  let lastNotifiedAt   = 0;

  // SETTLING phase
  let settleStartedAt  = 0;
  let settleGraceDone  = false;
  let stableText       = null;
  let stableCheckAt    = 0;

  // DONE phase
  let doneEnteredAt    = 0;

  // [P0] 네트워크 감지 이중 알림 방지
  // NETWORK_DONE 수신 시 true → isGenerating()이 완전히 false가 될 때까지
  // GENERATING 진입을 차단하여 탭 복귀 시 DOM flickering에 의한 2차 알림을 방지
  let networkHandled   = false;

  // ─── 유틸리티 ────────────────────────────────────────────────

  const log = (...args) => console.log(P, ...args);

  function transition(to) {
    if (state === to) return;
    log(`State: ${state} → ${to}`);
    state = to;
  }

  // ─── Heartbeat (Pacemaker) ───────────────────────────────────

  const HEARTBEAT_SITES = ['claude.ai', 'gemini.google.com', 'perplexity.ai'];
  const needsHeartbeat  = detector.hostnames.some(h => HEARTBEAT_SITES.some(s => h.includes(s)));
  let heartbeatActive   = false;

  function startHeartbeat() {
    if (!needsHeartbeat || heartbeatActive) return;
    chrome.runtime.sendMessage({ type: 'START_HEARTBEAT' });
    heartbeatActive = true;
  }

  function stopHeartbeat() {
    if (!heartbeatActive) return;
    chrome.runtime.sendMessage({ type: 'STOP_HEARTBEAT' });
    heartbeatActive = false;
  }

  // ─── 메시지 수신 ────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'PULSE') {
      tick();
    }
    if (msg.type === 'NETWORK_DONE') {
      // [P0] 네트워크가 이미 알림을 처리함 — 이 사이클의 DOM 감지를 억제
      log('Network handled notification — suppressing this cycle');
      stopHeartbeat();
      networkHandled = true;
      lastNotifiedAt = Date.now();
      state = 'IDLE';
    }
  });

  // ─── 완료 처리 ──────────────────────────────────────────────

  function onDone() {
    const now = Date.now();

    // [P1] 비동기 콜백 실행 전 tick() 재진입 방지
    if (state !== 'SETTLING') return;
    transition('PENDING_DONE');

    if (now - lastNotifiedAt < COOLDOWN_MS) {
      log('Skipped: cooldown active');
      stopHeartbeat();
      transition('IDLE');
      return;
    }

    // [P0] 네트워크가 이미 이 사이클을 처리했으면 스킵
    if (networkHandled) {
      log('Skipped: already notified by network for this cycle');
      stopHeartbeat();
      transition('IDLE');
      return;
    }

    chrome.storage.sync.get({ alwaysNotify: true }, ({ alwaysNotify }) => {
      if (!alwaysNotify && document.visibilityState === 'visible') {
        log('Skipped: tab visible (alwaysNotify off)');
        stopHeartbeat();
        transition('IDLE');
        return;
      }

      lastNotifiedAt = Date.now();
      stopHeartbeat();

      log('✅ Notification sent —', detector.hostnames[0]);

      chrome.runtime.sendMessage({
        type: 'ANSWER_DONE',
        site: detector.hostnames[0],
        tabTitle: document.title,
        timestamp: new Date().toISOString()
      });

      transition('DONE');
      doneEnteredAt = Date.now();
    });
  }

  // ─── 메인 tick ──────────────────────────────────────────────

  function tick() {
    const generating = detector.isGenerating();

    switch (state) {
      case 'IDLE':
        // [P0] 네트워크 알림 후 잠금 상태: 생성 신호가 완전히 사라질 때까지 대기
        if (networkHandled) {
          if (!generating) {
            networkHandled = false;
            log('Network suppression cleared — clean IDLE confirmed');
          }
          break;
        }
        if (generating) {
          transition('GENERATING');
          startHeartbeat();
        }
        break;

      case 'GENERATING':
        if (!generating) {
          transition('SETTLING');
          settleStartedAt = Date.now();
          settleGraceDone = false;
          stableText = null;
          stableCheckAt = 0;
        }
        break;

      case 'SETTLING':
        if (generating) {
          log('Signal flickered — returning to GENERATING');
          transition('GENERATING');
          settleGraceDone = false;
          break;
        }

        // Phase 1: flickering 유예
        if (!settleGraceDone) {
          if (Date.now() - settleStartedAt >= GRACE_MS) {
            settleGraceDone = true;
            log('Signal off confirmed — checking text stability');
            stableText = detector.getLastResponseText();
            stableCheckAt = Date.now();
          }
          break;
        }

        // Phase 2: 텍스트 안정화
        if (Date.now() - stableCheckAt >= TEXT_STABLE_MS) {
          const current = detector.getLastResponseText();
          if (current === stableText) {
            onDone();
          } else {
            log('Text still changing — rechecking');
            stableText = current;
            stableCheckAt = Date.now();
          }
        }
        break;

      // [P1] PENDING_DONE: onDone()의 비동기 처리가 끝날 때까지 대기
      case 'PENDING_DONE':
        break;

      case 'DONE':
        if (Date.now() - doneEnteredAt >= COOLDOWN_MS) {
          transition('IDLE');
        }
        if (generating) {
          transition('GENERATING');
          startHeartbeat();
        }
        break;
    }
  }

  // ─── 초기화 ─────────────────────────────────────────────────

  // [P1] MutationObserver throttle — rAF 기반으로 과도한 tick 호출 방지
  let tickScheduled = false;

  new MutationObserver(() => {
    if (tickScheduled) return;
    tickScheduled = true;
    requestAnimationFrame(() => {
      tick();
      tickScheduled = false;
    });
  }).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'aria-label', 'aria-busy', 'data-testid']
  });

  setInterval(tick, POLL_MS);

  log('Engine ready —', detector.hostnames.join(', '));
})();
