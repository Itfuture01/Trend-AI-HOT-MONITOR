import { load } from 'cheerio';
import { EnvHttpProxyAgent } from 'undici';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// 网络策略：默认走直连（国内网络下 Bing/GitHub/360/百度等均可直连）。
// 仅在检测到可用代理环境变量时，直连失败后再兜底走代理一次，
// 代理仍失败则该源整体跳过（单源失败不影响其他源）。
// 注意：代理环境变量的 scheme 必须是 http://（HTTPS_PROXY 同理），
// 写成 https:// 会导致 undici 无法识别而直接失败。
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

// 熔断器：被墙/超时的源短期记忆，避免每轮扫描都白等满超时。
// 某来源在 COOLDOWN_MS 内连续失败 CONSEC_FAILS 次后，进入熔断：
// 该来源的请求改用短超时（快速失败），不占限频窗口。
const COOLDOWN_MS = 10 * 60 * 1000; // 10 分钟
const CONSEC_FAILS = 2;
const failCount = new Map(); // origin -> { count, until }
function originOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
function inCooldown(url) {
  const o = originOf(url);
  const rec = failCount.get(o);
  if (!rec) return false;
  if (Date.now() > rec.until) {
    failCount.delete(o);
    return false;
  }
  return true;
}
function recordFail(url) {
  const o = originOf(url);
  const rec = failCount.get(o) || { count: 0, until: 0 };
  rec.count += 1;
  if (rec.count >= CONSEC_FAILS) rec.until = Date.now() + COOLDOWN_MS;
  failCount.set(o, rec);
}
function recordOk(url) {
  failCount.delete(originOf(url));
}

export async function fetchText(url, { headers = {}, timeoutMs = 6500, retries = 1, trackFail = true } = {}) {
  await throttle();
  let lastErr;
  const cool = inCooldown(url);
  // 熔断中的来源：短超时 + 不重试，快速失败放行
  const effTimeout = cool ? Math.min(timeoutMs, 1200) : timeoutMs;
  const effRetries = cool ? 0 : retries;
  // 直连优先，代理兜底（避免被墙源长时间占用限频窗口）。
  // 直连失败 + 无代理 → 快速抛错让上层跳过该源。
  const dispatchers = proxyAgent ? [null, proxyAgent] : [null];
  for (const dispatcher of dispatchers) {
    for (let i = 0; i <= effRetries; i++) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), effTimeout);
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
        const text = await res.text();
        if (trackFail) recordOk(url);
        return text;
      } catch (e) {
        lastErr = e;
        // trackFail=false 时不记入熔断：账号探测的 404/限流是「无此用户」的常态，
        // 不应让连续 404 把来源熔断、误伤后续真实账号解析。
        if (trackFail) recordFail(url);
        if (i < effRetries) await sleep(1000 * (i + 1));
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
