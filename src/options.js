// options.js — 설정 페이지

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

const SITES = [
  { key: 'chatgpt.com',        label: 'ChatGPT' },
  { key: 'claude.ai',          label: 'Claude' },
  { key: 'gemini.google.com',  label: 'Gemini' },
  { key: 'perplexity.ai',      label: 'Perplexity' }
];

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

const soundLabel = (f) => f.replace(/\.[^.]+$/, '');

const DEFAULT_SOUNDS = {
  'chatgpt.com':        'default.wav',
  'claude.ai':          'default.wav',
  'gemini.google.com':  'default.wav',
  'perplexity.ai':      'default.wav'
};

const $volume      = document.getElementById('volume');
const $volumeValue = document.getElementById('volumeValue');
const $alwaysNotify = document.getElementById('alwaysNotify');
const $soundsContainer = document.getElementById('soundsContainer');

const DEFAULT_DISCORD_SITES = {
  'chatgpt.com': true, 'claude.ai': true,
  'gemini.google.com': true, 'perplexity.ai': true
};

const $discordEnabled       = document.getElementById('discordEnabled');
const $discordUrl           = document.getElementById('discordUrl');
const $discordTestBtn       = document.getElementById('discordTestBtn');
const $discordStatus        = document.getElementById('discordStatus');
const $discordSitesContainer = document.getElementById('discordSitesContainer');
const $discordPreview       = document.getElementById('discordPreview');
const $discordPreviewLength = document.getElementById('discordPreviewLength');
const $discordErrors        = document.getElementById('discordErrors');
const $discordClearErrors   = document.getElementById('discordClearErrors');
const $debugLogs            = document.getElementById('debugLogs');

applyI18n();

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
  chrome.storage.sync.set({ sounds });
}

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

$volume.addEventListener('input', () => {
  const v = parseFloat($volume.value);
  $volumeValue.textContent = Math.round(v * 100) + '%';
  chrome.storage.sync.set({ volume: v });
});

$alwaysNotify.addEventListener('change', () => {
  chrome.storage.sync.set({ alwaysNotify: $alwaysNotify.checked });
});

chrome.storage.sync.get({
  discordEnabled: false,
  discordWebhookUrl: '',
  discordSites: DEFAULT_DISCORD_SITES,
  discordPreview: true,
  discordPreviewLength: 200,
  debugLogs: false
}, (s) => {
  $discordEnabled.checked = s.discordEnabled;
  $discordUrl.value = s.discordWebhookUrl;
  $discordPreview.checked = s.discordPreview;
  $discordPreviewLength.value = s.discordPreviewLength;
  $debugLogs.checked = Boolean(s.debugLogs);
  buildDiscordSiteRows(s.discordSites);
});

loadDiscordErrors();

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
  chrome.storage.sync.set({ discordSites });
}

$discordEnabled.addEventListener('change', () => {
  chrome.storage.sync.set({ discordEnabled: $discordEnabled.checked });
});

let urlSaveTimer;
$discordUrl.addEventListener('input', () => {
  clearTimeout(urlSaveTimer);
  urlSaveTimer = setTimeout(() => {
    chrome.storage.sync.set({ discordWebhookUrl: $discordUrl.value.trim() });
  }, 500);
});

$discordPreview.addEventListener('change', () => {
  chrome.storage.sync.set({ discordPreview: $discordPreview.checked });
});

$discordPreviewLength.addEventListener('change', () => {
  const val = Math.max(50, Math.min(500, parseInt($discordPreviewLength.value, 10) || 200));
  $discordPreviewLength.value = val;
  chrome.storage.sync.set({ discordPreviewLength: val });
});

$debugLogs.addEventListener('change', () => {
  chrome.storage.sync.set({ debugLogs: $debugLogs.checked });
  showDiscordStatus(
    $debugLogs.checked ? t('debugLogsEnabledStatus') : t('debugLogsDisabledStatus'),
    false
  );
});

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

  chrome.storage.sync.set({ discordWebhookUrl: url });
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
