// offscreen.js — 오디오 재생 전용

const audio = new Audio();
audio.preload = 'auto';

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'PLAY_SOUND') return;

  const src = `../assets/sounds/${msg.soundFile}`;

  // 같은 파일이면 src 교체 불필요
  if (!audio.src.endsWith(msg.soundFile)) {
    audio.src = src;
  }

  audio.volume = msg.volume ?? 0.7;
  audio.currentTime = 0;
  audio.play().catch(console.error);
});
