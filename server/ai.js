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
    // 无 AI 时保守：命中关键词也仅给中等相关度，避免误判为 urgent。
    // 真实性与重要性留给上层的规则噪音过滤（filter.js）把关。
    const relevant = hit ? 65 : 20;
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
    .map(
      (it, idx) =>
        `${idx}. 标题: ${it.title}` +
        (it.site ? `\n   站点: ${it.site}` : '') +
        (it.heat ? `\n   热度: ${it.heat}` : '') +
        `\n   来源: ${it.source}` +
        `\n   摘要: ${(it.snippet || '').slice(0, 150)}`,
    )
    .join('\n');

  const prompt = `你是热点监控的智能审核助手，职责是帮用户过滤掉噪音，只保留「真实、新鲜、有信息量」的内容。用户关注的主题/关键词是：「${topic || '未指定'}」。

请对下面每条内容依次审核，只返回一个 JSON 对象（不要任何解释文字），形如：
{"results":[{"index":0,"relevant":85,"genuine":true,"level":"high","summary":"一句话中文摘要","reason":"简短理由"}]}

字段含义：
- relevant: 0~100，与该主题的相关度（越高越相关；「热度/站点正规性」可作加分信号）
- genuine: true/false，是否真实有效。以下情况一律判 false：
  * 下载站/软件安装页/App推广页（标题常含「下载、官方版、电脑版、手机版、免费版」）
  * 百科词条、教程/介绍/科普类「老内容」（不是新发布的消息，没有时效信息量）
  * 无实质内容的水文、营销软文、广告、标题党、纯问答引流页
  * 与主题无关或仅同名无关
- level: 重要性分级，urgent(紧急)/high(高)/medium(中)/low(低)
- summary: 一句话中文摘要（必须非空，说明这条内容讲什么）
- reason: 简短理由（判定依据）

注意：
- 优先保留「新发布的报道/讨论」；百科、教程、软件下载、聚合介绍页即使标题含关键词也应判 genuine=false。
- 有明确热度（如 ★stars、回复数、播放量）或来自正规媒体/官方域名（如 .gov/.cn 新闻媒体、GitHub/V2EX 等社区）的内容，relevant 可适度上浮。
- 若某条被其他独立信息源同时抓到，也可作为可信度信号。

内容列表：
${list}`;

  const body = {
    model: config.openrouter.model,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    max_tokens: 3000,
  };

  // 429/5xx 短暂重试一次（免费模型常触发分钟级限流，重试通常可恢复）
  let res;
  for (let attempt = 0; attempt <= 1; attempt++) {
    res = await fetch(`${config.openrouter.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.openrouter.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (res.ok || attempt === 1) break;
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    } else {
      break;
    }
  }

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
