// options.js — 설정 페이지

const SITES = [
  { key: 'chatgpt.com',        label: 'ChatGPT' },
  { key: 'claude.ai',          label: 'Claude' },
  { key: 'gemini.google.com',  label: 'Gemini' },
  { key: 'perplexity.ai',      label: 'Perplexity' }
];

// assets/sounds/ 에 있는 음원 파일 목록
// 파일 추가/삭제 시 여기만 수정하면 됨
const SOUND_FILES = [
  'default.wav',
  'bell1.mp3',
  'bell2.mp3',
  'bell3.mp3',
  'bell4.mp3',
  'coin.mp3',
  'ding.mp3',
  'honk1.mp3',
  'honk2.mp3',
  'honk3.mp3',
  'honk4.mp3',
  'water_drop.mp3'
];

// 확장자 제거 → 표시 이름
const soundLabel = (f) => f.replace(/\.[^.]+$/, '');

const DEFAULT_SOUNDS = {
  'chatgpt.com':        'default.wav',
  'claude.ai':          'default.wav',
  'gemini.google.com':  'default.wav',
  'perplexity.ai':      'default.wav'
};

// ─── DOM ──────────────────────────────────────────────────────

const $volume      = document.getElementById('volume');
const $volumeValue = document.getElementById('volumeValue');
const $alwaysNotify = document.getElementById('alwaysNotify');
const $soundsContainer = document.getElementById('soundsContainer');

// ─── 사이트별 소리 UI 생성 ───────────────────────────────────

function buildSoundRows(currentSounds) {
  $soundsContainer.innerHTML = '';

  for (const site of SITES) {
    const row = document.createElement('div');
    row.className = 'sound-row';

    const label = document.createElement('span');
    label.className = 'site-label';
    label.textContent = site.label;

    const select = document.createElement('select');
    select.dataset.site = site.key;

    for (const file of SOUND_FILES) {
      const opt = document.createElement('option');
      opt.value = file;
      opt.textContent = soundLabel(file);
      if (currentSounds[site.key] === file) opt.selected = true;
      select.appendChild(opt);
    }

    // "없음" 항상 마지막
    const noneOpt = document.createElement('option');
    noneOpt.value = 'none';
    noneOpt.textContent = '🔇 없음';
    if (currentSounds[site.key] === 'none') noneOpt.selected = true;
    select.appendChild(noneOpt);

    select.addEventListener('change', () => {
      saveSounds();
    });

    const previewBtn = document.createElement('button');
    previewBtn.className = 'preview-btn';
    previewBtn.textContent = '▶';
    previewBtn.title = '미리듣기';
    previewBtn.addEventListener('click', () => {
      const val = select.value;
      if (val === 'none') return;
      chrome.runtime.sendMessage({ type: 'PLAY_TEST_SOUND', site: site.key });
    });

    row.appendChild(label);
    row.appendChild(select);
    row.appendChild(previewBtn);
    $soundsContainer.appendChild(row);
  }
}

function saveSounds() {
  const sounds = {};
  for (const select of $soundsContainer.querySelectorAll('select')) {
    sounds[select.dataset.site] = select.value;
  }
  chrome.storage.sync.set({ sounds });
}

// ─── 설정 로드 ───────────────────────────────────────────────

chrome.storage.sync.get({
  volume: 0.7,
  alwaysNotify: true,
  sounds: DEFAULT_SOUNDS
}, (s) => {
  $volume.value = s.volume;
  $volumeValue.textContent = Math.round(s.volume * 100) + '%';
  $alwaysNotify.checked = s.alwaysNotify;
  buildSoundRows(s.sounds);
});

// ─── 이벤트 핸들러 ──────────────────────────────────────────

$volume.addEventListener('input', () => {
  const v = parseFloat($volume.value);
  $volumeValue.textContent = Math.round(v * 100) + '%';
  chrome.storage.sync.set({ volume: v });
});

$alwaysNotify.addEventListener('change', () => {
  chrome.storage.sync.set({ alwaysNotify: $alwaysNotify.checked });
});

// ─── Discord Webhook ────────────────────────────────────────

const $discordEnabled = document.getElementById('discordEnabled');
const $discordUrl     = document.getElementById('discordUrl');
const $discordTestBtn = document.getElementById('discordTestBtn');
const $discordStatus  = document.getElementById('discordStatus');

// 로드
chrome.storage.sync.get({ discordEnabled: false, discordWebhookUrl: '' }, (s) => {
  $discordEnabled.checked = s.discordEnabled;
  $discordUrl.value = s.discordWebhookUrl;
});

// 활성화 토글
$discordEnabled.addEventListener('change', () => {
  chrome.storage.sync.set({ discordEnabled: $discordEnabled.checked });
});

// URL 저장 (입력 중 자동 저장)
let urlSaveTimer;
$discordUrl.addEventListener('input', () => {
  clearTimeout(urlSaveTimer);
  urlSaveTimer = setTimeout(() => {
    chrome.storage.sync.set({ discordWebhookUrl: $discordUrl.value.trim() });
  }, 500);
});

// 테스트 전송
$discordTestBtn.addEventListener('click', () => {
  const url = $discordUrl.value.trim();
  if (!url) {
    showDiscordStatus('Webhook URL을 입력하세요', true);
    return;
  }
  if (!url.startsWith('https://discord.com/api/webhooks/')) {
    showDiscordStatus('올바른 Discord Webhook URL이 아닙니다', true);
    return;
  }

  // URL 저장 + 전송 요청
  chrome.storage.sync.set({ discordWebhookUrl: url });
  $discordTestBtn.disabled = true;
  $discordTestBtn.textContent = '전송 중...';
  chrome.runtime.sendMessage({ type: 'TEST_DISCORD', webhookUrl: url });
});

// 테스트 결과 수신
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'TEST_DISCORD_RESULT') return;
  $discordTestBtn.disabled = false;
  $discordTestBtn.textContent = '📤 테스트 전송';

  if (msg.ok) {
    showDiscordStatus('✓ 전송 성공! Discord 채널을 확인하세요', false);
  } else {
    showDiscordStatus(`✗ 전송 실패 (${msg.status || msg.error})`, true);
  }
});

function showDiscordStatus(text, isError) {
  $discordStatus.textContent = text;
  $discordStatus.className = 'discord-status ' + (isError ? 'err' : 'ok');
  setTimeout(() => { $discordStatus.textContent = ''; }, 5000);
}
