import { config } from './config.js';

const MAX_BATCH = 20; // 每次发给模型的最大条数（批量降本）

export function aiEnabled() {
  return !!config.openrouter.apiKey;
}

function clamp(n, lo, hi) {
  const x = Number(n);
  if (Number.isNaN(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}

// 批量判定：items = [{title,url,source,snippet}]，context.topic = 关键词/范围
// 返回与 items 等长的 [{relevant(0~100), genuine, level, summary, reason}]
export async function analyzeItems(items, { topic } = {}) {
  if (!items.length) return [];
  if (!aiEnabled()) return fallback(items, topic, 'AI 未配置，降级为关键词匹配');

  const results = [];
  try {
    for (let i = 0; i < items.length; i += MAX_BATCH) {
      const batch = items.slice(i, i + MAX_BATCH);
      results.push(...(await analyzeBatch(batch, topic)));
    }
  } catch (e) {
    // AI 调用失败：剩余条目降级，保证监控仍可用
    const rest = fallback(items.slice(results.length), topic, `AI 调用失败，降级匹配（${e.message}）`);
    results.push(...rest);
  }
  return results;
}

// 相关性评分 → 重要性分级（AI 未返回 level 时的兜底）
export function levelFromScore(score) {
  const s = Number(score) || 0;
  if (s >= 80) return 'urgent';
  if (s >= 60) return 'high';
  if (s >= 40) return 'medium';
  return 'low';
}

function fallback(items, topic, reason) {
  const kw = (topic || '').toLowerCase();
  return items.map((it) => {
    const hit = kw && (it.title || '').toLowerCase().includes(kw);
    const relevant = hit ? 90 : 30;
    return {
      relevant,
      genuine: true,
      level: levelFromScore(relevant),
      summary: '',
      reason,
    };
  });
}

async function analyzeBatch(items, topic) {
  const list = items
    .map((it, idx) => `${idx}. 标题: ${it.title}\n   来源: ${it.source}\n   摘要: ${(it.snippet || '').slice(0, 150)}`)
    .join('\n');

  const prompt = `你是热点监控的智能审核助手。用户关注的主题/关键词是：「${topic || '未指定'}」。
请对下面每条内容依次完成审核，并只返回一个 JSON 对象（不要任何解释文字），形如：
{"results":[{"index":0,"relevant":85,"genuine":true,"level":"high","summary":"一句话中文摘要","reason":"简短理由"}]}
字段含义：
- relevant: 0~100，与该主题的相关度评分（越高越相关）
- genuine: true/false，真实性判断（排除标题党、营销号、同名无关、AI造谣、广告、垃圾）
- level: 重要性分级，urgent(紧急)/high(高)/medium(中)/low(低)
- summary: 一句话中文摘要，方便快速阅读
- reason: 简短理由（判定依据）

内容列表：
${list}`;

  const body = {
    model: config.openrouter.model,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    max_tokens: 3000,
  };

  const res = await fetch(`${config.openrouter.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openrouter.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`OpenRouter HTTP ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || '';
  const arr = extractResults(content);

  return items.map((it, idx) => {
    const r = arr.find((x) => Number(x.index) === idx) || {};
    const relevant = clamp(r.relevant, 0, 100);
    const level = ['urgent', 'high', 'medium', 'low'].includes(r.level)
      ? r.level
      : levelFromScore(relevant);
    return {
      relevant,
      genuine: r.genuine !== false,
      level,
      summary: String(r.summary || ''),
      reason: String(r.reason || ''),
    };
  });
}

// 宽松解析模型输出：可能是 {"results":[...]} 或直接的 [...]
function extractResults(content) {
  const tryParse = (s) => {
    try {
      const v = JSON.parse(s);
      if (Array.isArray(v)) return v;
      if (Array.isArray(v?.results)) return v.results;
      if (Array.isArray(v?.items)) return v.items;
      return [];
    } catch {
      return null;
    }
  };
  let r = tryParse(content);
  if (r) return r;
  const m = String(content).match(/\[[\s\S]*\]/);
  if (m) {
    r = tryParse(m[0]);
    if (r) return r;
  }
  return [];
}
