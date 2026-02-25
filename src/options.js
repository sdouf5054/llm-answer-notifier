// options.js — 설정 페이지
// constants.js가 options.html에서 먼저 로드되어
// SITES, SOUND_FILES, DEFAULT_SOUNDS, DEFAULT_DISCORD_SITES 사용 가능

function t(key, substitutions) {
  return chrome.i18n.getMessage(key, substitutions) || key;
}

function applyI18n() {
  document.title = t('optionsPageTitle');

  for (const el of document.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n);
  }

  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  }

  for (const el of document.querySelectorAll('[data-i18n-title]')) {
    el.title = t(el.dataset.i18nTitle);
  }
}

const soundLabel = (f) => f.replace(/\.[^.]+$/, '');

// ─── DOM 요소 ─────────────────────────────────────────────────

const $volume      = document.getElementById('volume');
const $volumeValue = document.getElementById('volumeValue');
const $alwaysNotify = document.getElementById('alwaysNotify');
const $soundsContainer = document.getElementById('soundsContainer');

const $discordEnabled       = document.getElementById('discordEnabled');
const $discordUrl           = document.getElementById('discordUrl');
const $discordTestBtn       = document.getElementById('discordTestBtn');
const $discordStatus        = document.getElementById('discordStatus');
const $discordSitesContainer = document.getElementById('discordSitesContainer');
const $discordErrors        = document.getElementById('discordErrors');
const $discordClearErrors   = document.getElementById('discordClearErrors');
const $debugLogs            = document.getElementById('debugLogs');

applyI18n();

// ─── Storage Batching ─────────────────────────────────────────
// 설정 변경이 짧은 시간 내 여러 번 발생하면 하나의 storage.sync.set으로 병합

let pendingSync = {};
let syncTimer = null;
const SYNC_DELAY_MS = 300;

function saveSync(updates) {
  Object.assign(pendingSync, updates);
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    chrome.storage.sync.set(pendingSync);
    pendingSync = {};
  }, SYNC_DELAY_MS);
}

// ─── 사이트별 알림음 ─────────────────────────────────────────

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

    const noneOpt = document.createElement('option');
    noneOpt.value = 'none';
    noneOpt.textContent = t('soundDisabledOption');
    if (currentSounds[site.key] === 'none') noneOpt.selected = true;
    select.appendChild(noneOpt);

    select.addEventListener('change', saveSounds);

    const previewBtn = document.createElement('button');
    previewBtn.className = 'preview-btn';
    previewBtn.textContent = '▶';
    previewBtn.title = t('previewButtonTitle');
    previewBtn.addEventListener('click', () => {
      if (select.value === 'none') return;
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
  saveSync({ sounds });
}

// ─── 초기 로드 ────────────────────────────────────────────────

chrome.storage.sync.get({
  volume: 0.7,
  alwaysNotify: true,
  sounds: DEFAULT_SOUNDS,
  discordEnabled: false,
  discordWebhookUrl: '',
  discordSites: DEFAULT_DISCORD_SITES,
  debugLogs: false
}, (s) => {
  $volume.value = s.volume;
  $volumeValue.textContent = Math.round(s.volume * 100) + '%';
  $alwaysNotify.checked = s.alwaysNotify;
  buildSoundRows(s.sounds);

  $discordEnabled.checked = s.discordEnabled;
  $discordUrl.value = s.discordWebhookUrl;
  $debugLogs.checked = Boolean(s.debugLogs);
  buildDiscordSiteRows(s.discordSites);
});

loadDiscordErrors();

// ─── 이벤트 리스너 ───────────────────────────────────────────

$volume.addEventListener('input', () => {
  const v = parseFloat($volume.value);
  $volumeValue.textContent = Math.round(v * 100) + '%';
  saveSync({ volume: v });
});

$alwaysNotify.addEventListener('change', () => {
  saveSync({ alwaysNotify: $alwaysNotify.checked });
});

// ─── Discord 설정 ─────────────────────────────────────────────

function buildDiscordSiteRows(currentSites) {
  $discordSitesContainer.innerHTML = '';

  for (const site of SITES) {
    const label = document.createElement('label');
    label.className = 'checkbox-label';
    label.style.marginBottom = '6px';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.site = site.key;
    checkbox.checked = currentSites[site.key] !== false;

    checkbox.addEventListener('change', saveDiscordSites);

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(` ${site.label}`));
    $discordSitesContainer.appendChild(label);
  }
}

function saveDiscordSites() {
  const discordSites = {};
  for (const cb of $discordSitesContainer.querySelectorAll('input[type="checkbox"]')) {
    discordSites[cb.dataset.site] = cb.checked;
  }
  saveSync({ discordSites });
}

$discordEnabled.addEventListener('change', () => {
  saveSync({ discordEnabled: $discordEnabled.checked });
});

$discordUrl.addEventListener('input', () => {
  saveSync({ discordWebhookUrl: $discordUrl.value.trim() });
});

$debugLogs.addEventListener('change', () => {
  saveSync({ debugLogs: $debugLogs.checked });
  showDiscordStatus(
    $debugLogs.checked ? t('debugLogsEnabledStatus') : t('debugLogsDisabledStatus'),
    false
  );
});

// ─── Discord 테스트 ───────────────────────────────────────────

$discordTestBtn.addEventListener('click', () => {
  const url = $discordUrl.value.trim();
  if (!url) {
    showDiscordStatus(t('discordWebhookRequiredStatus'), true);
    return;
  }
  if (!url.startsWith('https://discord.com/api/webhooks/')) {
    showDiscordStatus(t('discordWebhookInvalidStatus'), true);
    return;
  }

  saveSync({ discordWebhookUrl: url });
  $discordTestBtn.disabled = true;
  $discordTestBtn.textContent = t('discordSendingButton');
  chrome.runtime.sendMessage({ type: 'TEST_DISCORD', webhookUrl: url });
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'TEST_DISCORD_RESULT') return;
  $discordTestBtn.disabled = false;
  $discordTestBtn.textContent = t('discordTestButton');

  if (msg.ok) {
    showDiscordStatus(t('discordTestSuccessStatus'), false);
  } else {
    showDiscordStatus(t('discordTestFailedStatus', [String(msg.status || msg.error)]), true);
  }
});

function showDiscordStatus(text, isError) {
  $discordStatus.textContent = text;
  $discordStatus.className = 'discord-status ' + (isError ? 'err' : 'ok');
  setTimeout(() => { $discordStatus.textContent = ''; }, 5000);
}

// ─── Discord 에러 로그 ────────────────────────────────────────

function loadDiscordErrors() {
  chrome.storage.local.get({ discordErrors: [] }, ({ discordErrors }) => {
    if (discordErrors.length === 0) {
      $discordErrors.textContent = t('noErrors');
      $discordErrors.style.color = '#888';
    } else {
      $discordErrors.textContent = discordErrors.join('\n');
      $discordErrors.style.color = '#f44336';
      $discordErrors.style.whiteSpace = 'pre-wrap';
    }
  });
}

$discordClearErrors.addEventListener('click', () => {
  chrome.storage.local.set({ discordErrors: [] });
  $discordErrors.textContent = t('noErrors');
  $discordErrors.style.color = '#888';
});
