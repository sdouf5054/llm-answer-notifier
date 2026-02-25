// constants.js — 공유 상수
// background.js, options.js 등에서 importScripts 또는 <script>로 로드

const SITES = [
  { key: 'chatgpt.com',        label: 'ChatGPT' },
  { key: 'claude.ai',          label: 'Claude' },
  { key: 'gemini.google.com',  label: 'Gemini' },
  { key: 'perplexity.ai',      label: 'Perplexity' }
];

const SITE_LABELS = Object.fromEntries(SITES.map(s => [s.key, s.label]));

const DEFAULT_SOUNDS = {
  'chatgpt.com':        'default.wav',
  'claude.ai':          'default.wav',
  'gemini.google.com':  'default.wav',
  'perplexity.ai':      'default.wav'
};

const DEFAULT_DISCORD_SITES = {
  'chatgpt.com':        true,
  'claude.ai':          true,
  'gemini.google.com':  true,
  'perplexity.ai':      true
};

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
