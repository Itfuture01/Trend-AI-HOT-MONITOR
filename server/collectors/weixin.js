import { load } from 'cheerio';
import { fetchText } from './http.js';
import { applyFilter } from './filter.js';

// 微信公众号内容（经搜狗微信聚合搜索，国内可直连、免 API Key）。
// 公众号是国内「官方/博主」内容的主阵地，其他源覆盖不到。
// 注意：文章 URL 为搜狗跳转壳（/link?url=...&token=...），每次会话不同，
// 去重靠 norm_hash（清洗标题+来源），URL 不参与去重。
const SOURCE = '微信';
const BASE = 'https://weixin.sogou.com';

// 搜狗微信对「短时间连续请求」很敏感（密集探测会触发 antispider 临时封 IP，302 → antispider 页）。
// 做两级自我保护：普通请求至少间隔 MIN_GAP_MS；命中反爬则冷却 BLOCK_MS 再试（期间返回空，静默跳过）。
const MIN_GAP_MS = 60 * 1000; // 同源请求最小间隔 60s
const BLOCK_MS = 15 * 60 * 1000; // 反爬冷却 15 分钟
let nextAllowedAt = 0;

export const name = SOURCE;

function parseHtml(html) {
  const $ = load(html);
  const out = [];
  const seen = new Set();
  $('.txt-box').each((_, el) => {
    const $el = $(el);
    const $a = $el.find('h3 a').first();
    const title = $a.text().trim();
    if (!title || seen.has(title)) return;
    seen.add(title);
    const href = $a.attr('href') || '';
    // 搜狗微信高亮注释 <!--red_beg--><!--red_end--> 已在 cheerio text() 中剔除
    const acc = $el.find('span.all-time-y2').first().text().trim();
    const snippet = $el.find('p.txt-info').first().text().trim();
    // 时间藏在 <script>document.write(timeConvert('unix秒'))</script>
    const tsMatch = $el.find('.s2 script').html()?.match(/timeConvert\('(\d+)'\)/) ||
      $el.find('.s2').text().match(/timeConvert\('(\d+)'\)/);
    out.push({
      title,
      url: href.startsWith('http') ? href : `${BASE}${href}`,
      source: SOURCE,
      snippet: snippet.slice(0, 200),
      site: acc, // 公众号名
      ts: tsMatch ? Number(tsMatch[1]) * 1000 : Date.now(),
    });
  });
  return applyFilter(out);
}

export async function collectHot() {
  // 微信无热搜榜，用通用 AI 话题作为代理热点（与搜狗/360 一致）
  return collectSearch('AI 人工智能 大模型 科技');
}

export async function collectSearch(keyword) {
  // 节流：距上次请求不足 MIN_GAP_MS 或处于反爬冷却，直接跳过本轮（best-effort）
  if (Date.now() < nextAllowedAt) return [];
  nextAllowedAt = Date.now() + MIN_GAP_MS;
  const url = `${BASE}/weixin?type=2&query=${encodeURIComponent(keyword)}&ie=utf8&s_from=input`;
  const html = await fetchText(url, { headers: { Referer: BASE } });
  // 反爬/验证码检测：命中即进入长冷却，避免每轮都打被封 IP
  if (/antispider|请输入验证码|验证码|请开启javascript/.test(html)) {
    nextAllowedAt = Date.now() + BLOCK_MS;
    return [];
  }
  return parseHtml(html);
}
