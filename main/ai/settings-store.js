const fs = require('fs');
const path = require('path');
const { safeStorage } = require('electron');

const DEFAULT_SETTINGS = {
  enabled: false,
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  apiKey: '',
  timeoutMs: 20000,
};

const ALLOWED_PROTOCOLS = ['https:'];

const SSRF_BLOCK_HOSTS = [
  '169.254.169.254',
  '169.254.169.253',
  'metadata.google.internal',
  'metadata',
  '0.0.0.0',
];

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    if (!ALLOWED_PROTOCOLS.includes(url.protocol)) return false;
    const host = url.hostname.toLowerCase();
    if (SSRF_BLOCK_HOSTS.includes(host)) return false;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
    if (/^169\.254\./.test(host)) return false;
    if (/^10\./.test(host)) return false;
    if (/^192\.168\./.test(host)) return false;
    if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(host)) return false;
    if (/^fd[0-9a-f]{2}:/i.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

function sanitizeBaseUrl(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (!isValidHttpUrl(trimmed)) return '';
  return trimmed;
}

function sanitizeModel(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 100) return '';
  if (/[^a-zA-Z0-9._\-\/:]/.test(trimmed)) return '';
  return trimmed;
}

function createAiSettingsStore(file) {
  const keyFile = path.join(path.dirname(file), 'ai-key.enc');

  function isEncryptionAvailable() {
    try {
      return safeStorage && safeStorage.isEncryptionAvailable();
    } catch {
      return false;
    }
  }

  function readEncryptedKey() {
    try {
      if (!fs.existsSync(keyFile)) return '';
      const buf = fs.readFileSync(keyFile);
      if (!isEncryptionAvailable()) return buf.toString('utf8');
      return safeStorage.decryptString(buf);
    } catch {
      return '';
    }
  }

  function writeEncryptedKey(plainKey) {
    try {
      if (isEncryptionAvailable()) {
        const buf = safeStorage.encryptString(plainKey);
        fs.writeFileSync(keyFile, buf);
      } else {
        fs.writeFileSync(keyFile, plainKey, 'utf8');
      }
    } catch {
      // best-effort; key persistence is non-fatal
    }
  }

  function removeEncryptedKey() {
    try { if (fs.existsSync(keyFile)) fs.unlinkSync(keyFile); } catch {}
  }

  function loadRaw() {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      const { apiKey, ...rest } = data;
      return { ...DEFAULT_SETTINGS, ...rest, apiKey: readEncryptedKey() };
    } catch {
      return { ...DEFAULT_SETTINGS, apiKey: readEncryptedKey() };
    }
  }

  function saveRaw(settings) {
    const { apiKey, ...rest } = settings;
    fs.writeFileSync(file, JSON.stringify(rest, null, 2));
    if (apiKey) writeEncryptedKey(apiKey);
    else removeEncryptedKey();
  }

  function getSettings() {
    return loadRaw();
  }

  function getPublicSettings() {
    const settings = loadRaw();
    return {
      enabled: !!settings.enabled,
      baseUrl: settings.baseUrl,
      model: settings.model,
      timeoutMs: settings.timeoutMs,
      apiKeySet: !!settings.apiKey,
    };
  }

  function saveSettings(input) {
    const current = loadRaw();
    const next = { ...current };
    if (typeof input.enabled === 'boolean') next.enabled = input.enabled;
    if (typeof input.baseUrl === 'string') {
      const sanitized = sanitizeBaseUrl(input.baseUrl);
      if (sanitized) next.baseUrl = sanitized;
    }
    if (typeof input.model === 'string') {
      const sanitized = sanitizeModel(input.model);
      if (sanitized) next.model = sanitized;
    }
    if (Number.isFinite(input.timeoutMs)) next.timeoutMs = Math.max(5000, Math.min(60000, Math.round(input.timeoutMs)));
    if (typeof input.apiKey === 'string' && input.apiKey.trim()) next.apiKey = input.apiKey.trim();
    if (input.clearApiKey === true) next.apiKey = '';
    saveRaw(next);
    return getPublicSettings();
  }

  return { getSettings, getPublicSettings, saveSettings };
}

module.exports = { createAiSettingsStore, isValidHttpUrl, sanitizeBaseUrl, sanitizeModel };
