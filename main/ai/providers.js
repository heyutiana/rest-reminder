function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, done: () => clearTimeout(timer) };
}

function isDeepSeek(settings) {
  const baseUrl = String(settings.baseUrl || '').toLowerCase();
  const model = String(settings.model || '').toLowerCase();
  return baseUrl.includes('api.deepseek.com') || model.startsWith('deepseek-');
}

function buildBody(settings, messages, opts) {
  const body = {
    model: settings.model,
    messages,
    stream: false,
    temperature: opts.temperature == null ? 0.2 : opts.temperature,
    max_tokens: opts.maxTokens || 900,
  };

  if (opts.json) body.response_format = { type: 'json_object' };

  if (isDeepSeek(settings)) {
    body.thinking = { type: 'disabled' };
  }

  return body;
}

async function parseErrorDetail(res) {
  const text = await res.text().catch(() => '');
  if (!text) return '';
  try {
    const data = JSON.parse(text);
    return data && data.error && data.error.message ? String(data.error.message) : text;
  } catch {
    return text;
  }
}

async function chatCompletion(settings, messages, opts = {}) {
  if (!settings.enabled) throw new Error('AI_NOT_ENABLED');
  if (!settings.apiKey) throw new Error('AI_KEY_MISSING');
  if (!settings.baseUrl || !settings.model) throw new Error('AI_SETTINGS_INVALID');

  const timeout = withTimeout(settings.timeoutMs || 20000);
  try {
    const res = await fetch(settings.baseUrl.replace(/\/+$/, '') + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + settings.apiKey,
      },
      signal: timeout.controller.signal,
      body: JSON.stringify(buildBody(settings, messages, opts)),
    });
    if (!res.ok) {
      const detail = await parseErrorDetail(res);
      throw new Error('AI_HTTP_' + res.status + (detail ? ': ' + detail.slice(0, 300) : ''));
    }
    const data = await res.json();
    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (typeof content !== 'string' || !content.trim()) throw new Error('AI_EMPTY_RESPONSE');
    return content.trim();
  } finally {
    timeout.done();
  }
}

module.exports = { chatCompletion };
