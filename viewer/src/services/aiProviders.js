
import { sendMessages as sendAnthropic } from './anthropicClient';

export const ALL_MODELS = [
  { id: 'claude-sonnet-4-6',     provider: 'anthropic', label: 'Claude Sonnet 4.6',  icon: '🎯', tier: 'balanced' },
  { id: 'claude-haiku-4-5-20251001', provider: 'anthropic', label: 'Claude Haiku 4.5', icon: '⚡', tier: 'fast' },
  { id: 'claude-opus-4-7',       provider: 'anthropic', label: 'Claude Opus 4.7',   icon: '🧠', tier: 'premium' },
  { id: 'gpt-5.4',               provider: 'openai',    label: 'GPT-5.4',           icon: '🔵', tier: 'balanced', requiresProxy: true },
  { id: 'gpt-5.4-mini',          provider: 'openai',    label: 'GPT-5.4 mini',      icon: '🔵', tier: 'fast',     requiresProxy: true },
  { id: 'gemini-3.1-pro-preview', provider: 'google',  label: 'Gemini 3.1 Pro',    icon: '🟢', tier: 'balanced', requiresProxy: true },
  { id: 'gemini-3.1-flash-lite',  provider: 'google',  label: 'Gemini 3.1 Flash Lite', icon: '🟢', tier: 'fast', requiresProxy: true },
  { id: 'gemini-3.5-flash',       provider: 'google',  label: 'Gemini 3.5 Flash',     icon: '🟢', tier: 'fast', requiresProxy: true },
  { id: 'kimi-k2-0905-preview',   provider: 'moonshot', label: 'Kimi K2',            icon: '🌙', tier: 'balanced', requiresProxy: true },
  { id: 'moonshot-v1-128k',       provider: 'moonshot', label: 'Kimi (128k)',        icon: '🌙', tier: 'fast',     requiresProxy: true },
];

export function getProviderForModel(modelId) {
  const m = ALL_MODELS.find((x) => x.id === modelId);
  return m?.provider || 'anthropic';
}

export function providerNeedsKey(provider) {
  return provider !== 'anthropic';
}

export function availableModels(hasKey = () => false) {
  return ALL_MODELS.filter((m) => !providerNeedsKey(m.provider) || hasKey(m.provider));
}

export function coerceModel(modelId, hasKey) {
  const list = availableModels(hasKey);
  return list.some((m) => m.id === modelId) ? modelId : list[0].id;
}
function flattenSystem(systemBlocks) {
  if (!systemBlocks) return '';
  if (typeof systemBlocks === 'string') return systemBlocks;
  return systemBlocks
    .map((b) => (typeof b === 'string' ? b : (b.text || '')))
    .join('');
}

function flattenMessageContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((b) => (typeof b === 'string' ? b : (b.text || ''))).join('');
  }
  return '';
}

async function sendOpenAI({ apiKey, model, system, messages, maxTokens, baseUrl, signal, onDelta, reasoningEffort, verbosity }) {
  if (!apiKey) throw new Error('OpenAI API 키가 필요합니다');
  const endpoint = (baseUrl && baseUrl.trim() ? baseUrl.trim().replace(/\/$/, '') : 'https://api.openai.com') + '/v1/chat/completions';
  const stream = typeof onDelta === 'function';
  const apiMsgs = [];
  const sysText = flattenSystem(system);
  if (sysText) apiMsgs.push({ role: 'system', content: sysText });
  for (const m of messages) {
    apiMsgs.push({ role: m.role, content: flattenMessageContent(m.content) });
  }
  const isGpt5 = /^gpt-5/i.test(model);
  const reasoning = ['minimal', 'low', 'medium', 'high'].includes(reasoningEffort) ? reasoningEffort : 'minimal';
  const verb = ['low', 'medium', 'high'].includes(verbosity) ? verbosity : 'high';
  const reasonMul = { minimal: 1.4, low: 1.8, medium: 2.5, high: 3.5 }[reasoning];
  const body = {
    model,
    messages: apiMsgs,
    stream,
    ...(isGpt5
      ? {
          max_completion_tokens: Math.floor(maxTokens * reasonMul),
          reasoning_effort: reasoning,
          verbosity: verb,
        }
      : { max_tokens: maxTokens }),
  };
  if (stream) body.stream_options = { include_usage: true };
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).error?.message || ''; } catch { }
    throw new Error(`OpenAI API ${res.status} ${res.statusText}${detail ? ': ' + detail : ''}`);
  }
  if (!stream) {
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    return {
      text,
      usage: {
        input_tokens: data.usage?.prompt_tokens || 0,
        output_tokens: data.usage?.completion_tokens || 0,
        cache_read_input_tokens: data.usage?.prompt_tokens_details?.cached_tokens || 0,
        cache_creation_input_tokens: 0,
      },
      stop_reason: data.choices?.[0]?.finish_reason,
      raw: data,
    };
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let text = '';
  let usage = {};
  let stop_reason = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      let evt;
      try { evt = JSON.parse(payload); } catch { continue; }
      const delta = evt.choices?.[0]?.delta?.content || '';
      if (delta) {
        text += delta;
        try { onDelta(delta, text); } catch { }
      }
      if (evt.choices?.[0]?.finish_reason) stop_reason = evt.choices[0].finish_reason;
      if (evt.usage) {
        usage = {
          input_tokens: evt.usage.prompt_tokens || 0,
          output_tokens: evt.usage.completion_tokens || 0,
          cache_read_input_tokens: evt.usage.prompt_tokens_details?.cached_tokens || 0,
          cache_creation_input_tokens: 0,
        };
      }
    }
  }
  return { text, usage, stop_reason };
}

async function sendGoogle({ apiKey, model, system, messages, maxTokens, baseUrl, signal, onDelta }) {
  if (!apiKey) throw new Error('Google AI API 키가 필요합니다');
  const stream = typeof onDelta === 'function';
  const method = stream ? 'streamGenerateContent' : 'generateContent';
  const base = (baseUrl && baseUrl.trim() ? baseUrl.trim().replace(/\/$/, '') : 'https://generativelanguage.googleapis.com');
  const endpoint = `${base}/v1beta/models/${encodeURIComponent(model)}:${method}${stream ? '?alt=sse' : ''}`;

  const contents = [];
  for (const m of messages) {
    contents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: flattenMessageContent(m.content) }],
    });
  }
  const sysText = flattenSystem(system);
  const body = {
    contents,
    generationConfig: { maxOutputTokens: maxTokens },
  };
  if (sysText) body.systemInstruction = { parts: [{ text: sysText }] };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).error?.message || ''; } catch { }
    throw new Error(`Gemini API ${res.status} ${res.statusText}${detail ? ': ' + detail : ''}`);
  }
  if (!stream) {
    const data = await res.json();
    const cand = data.candidates?.[0];
    const text = (cand?.content?.parts || []).map((p) => p.text || '').join('');
    return {
      text,
      usage: {
        input_tokens: data.usageMetadata?.promptTokenCount || 0,
        output_tokens: data.usageMetadata?.candidatesTokenCount || 0,
        cache_read_input_tokens: data.usageMetadata?.cachedContentTokenCount || 0,
        cache_creation_input_tokens: 0,
      },
      stop_reason: cand?.finishReason,
      raw: data,
    };
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let text = '';
  let usage = {};
  let stop_reason = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      let evt;
      try { evt = JSON.parse(payload); } catch { continue; }
      const cand = evt.candidates?.[0];
      const chunk = (cand?.content?.parts || []).map((p) => p.text || '').join('');
      if (chunk) {
        text += chunk;
        try { onDelta(chunk, text); } catch { }
      }
      if (cand?.finishReason) stop_reason = cand.finishReason;
      if (evt.usageMetadata) {
        usage = {
          input_tokens: evt.usageMetadata.promptTokenCount || 0,
          output_tokens: evt.usageMetadata.candidatesTokenCount || 0,
          cache_read_input_tokens: evt.usageMetadata.cachedContentTokenCount || 0,
          cache_creation_input_tokens: 0,
        };
      }
    }
  }
  return { text, usage, stop_reason };
}

export async function sendMessagesUnified(opts) {
  const provider = getProviderForModel(opts.model);
  if (provider === 'openai') return sendOpenAI(opts);
  if (provider === 'google') return sendGoogle(opts);
  if (provider === 'moonshot') return sendOpenAI({ ...opts, baseUrl: opts.baseUrl || 'https://api.moonshot.ai' });
  return sendAnthropic(opts);
}
