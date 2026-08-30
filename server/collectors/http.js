import { load } from 'cheerio';
import { EnvHttpProxyAgent } from 'undici';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// 仅在检测到代理环境变量时才启用代理，否则走原生直连。
// 在无法直连 Google/Bing/DuckDuckGo 的网络环境下，设置 HTTP_PROXY/HTTPS_PROXY 即可解锁这些源。
const HAS_PROXY = !!(
  process.env.HTTP_PROXY ||
  process.env.HTTPS_PROXY ||
  process.env.http_proxy ||
  process.env.https_proxy ||
  process.env.ALL_PROXY
);
const proxyAgent = HAS_PROXY ? new EnvHttpProxyAgent() : null;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 全局限频：任意两次 HTTP 请求之间至少间隔 GAP_MS（再加随机抖动），避免被源封禁
const GAP_MS = 1200;
let lastReq = 0;
async function throttle() {
  const now = Date.now();
  const wait = Math.max(0, lastReq + GAP_MS + Math.random() * 800 - now);
  if (wait) await sleep(wait);
  lastReq = Date.now();
}

export async function fetchText(url, { headers = {}, timeoutMs = 9000, retries = 1 } = {}) {
  await throttle();
  let lastErr;
  // 代理可用时优先走代理；代理连接失败（如代理未启动）则回退直连，
  // 避免一个失效代理导致所有源（含可直连的中文源/HN）全部失败。
  const dispatchers = proxyAgent ? [proxyAgent, null] : [null];
  for (const dispatcher of dispatchers) {
    for (let i = 0; i <= retries; i++) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': UA,
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            ...headers,
          },
          signal: ctrl.signal,
          redirect: 'follow',
          ...(dispatcher ? { dispatcher } : {}),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.text();
      } catch (e) {
        lastErr = e;
        if (i < retries) await sleep(1000 * (i + 1));
      } finally {
        clearTimeout(t);
      }
    }
  }
  throw lastErr;
}

export async function fetchJson(url, opts) {
  const text = await fetchText(url, opts);
  return JSON.parse(text);
}

export function stripTags(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// 解析 RSS 的 <item>（兼容 Atom 的 <entry>）
export function parseRss(xml, defaultSource) {
  const $ = load(xml, { xmlMode: true });
  const out = [];
  $('item').each((_, el) => {
    const $el = $(el);
    const title = $el.find('title').first().text().trim();
    if (!title) return;
    const url =
      $el.find('link').first().text().trim() ||
      $el.find('guid').first().text().trim();
    const pubDate =
      $el.find('pubDate').first().text().trim() ||
      $el.find('published').first().text().trim();
    const snippet = stripTags($el.find('description').first().text());
    out.push({
      title,
      url,
      source: defaultSource,
      snippet: snippet.slice(0, 200),
      ts: pubDate ? Date.parse(pubDate) : Date.now(),
    });
  });
  return out;
}

export { UA };
