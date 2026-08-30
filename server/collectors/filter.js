// 统一噪音过滤层：清洗标题 / 黑名单检测 / 站点名提取 / 规范化标题（用于去重）
//
// 解决的问题：
// - 搜狗/360/百度等搜索引擎综合排序会返回下载站、百科词条、介绍页、水站等「老内容」，
//   它们标题常含营销关键词或站点后缀，可被规则识别，无需每次交给 AI。
// - 同一内容在搜索引擎里 URL 带随机参数（搜狗 id=<uuid>、360 /link?m=…、百度 from=…），
//   标题也会带上「 - 站点名」后缀，导致 url/标题去重失效。这里提供 cleanTitle/normKey
//   作为稳定的去重键。

// 标题黑名单（匹配清洗后的标题，命中即视为噪音）
const TITLE_BLACKLIST = [
  '下载',
  '官方版',
  '电脑版',
  '手机版',
  '客户端',
  '安装',
  '免费版',
  '正版',
  '最新版',
  'app',
  '软件宝库',
  '软件商店',
  '官网', // 「XX官网」多是下载站/仿站，正规官网通常不带「官网」二字
  '换脸',
  '高清版',
];

// 站点黑名单（从标题「 - 站点」或 cite 中提取后匹配）
const SITE_BLACKLIST = [
  '百科',
  'baike',
  'wiki',
  '软件宝库',
  '软件下载',
  '下载站',
  '站长网',
  '教程',
  '菜鸟教程',
];

// 内容特征黑名单：标题命中即判为「无实质新内容」的介绍/问答/聚合页
const CONTENT_BLACKLIST = [
  '是什么',
  '是什么意思',
  '什么是',
  '有哪些',
  '怎么用',
  '入门',
  '教程',
  '简介',
  '基本概念',
];

// 垃圾/广告/无效内容黑名单：与主题无关的低信息量内容（如卖域名、招聘贴、营销软文）
const SPAM_BLACKLIST = [
  '售卖',
  '出售',
  '转让',
  '招聘',
  '内推',
  '求职',
  '不加班',
  '揭秘',
  '体验', // 「体验XX新版」多为营销
  '全新版',
  '域名重定向',
  '求算法',
  '求后端',
];

// 清洗标题：去掉「 - 站点名」「 | 站点名」等尾部站点段，去空白/分隔符，转小写。
// 返回 [cleanTitle, site]。site 为提取出的站点名（无则 ''）。
export function cleanTitle(title) {
  const original = String(title || '').trim();
  if (!original) return ['', ''];
  // 常见分隔：'标题 - 站点' / '标题 | 站点' / '标题__站点'
  const siteMatch = original.match(/\s*[-—|]\s*([^\s\-—|_]{2,20})\s*$/);
  const site = siteMatch ? siteMatch[1] : '';
  const norm = original
    .replace(/\s*[-—|_]\s*[^-—|_]{1,20}\s*$/, '') // 去掉尾部站点段
    .replace(/[_\-—|·\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return [norm, site];
}

// 规范化标题 → 去重键（同源同内容在不同轮抓取/不同 URL 下保持稳定）
export function normKey(title, source) {
  const [t] = cleanTitle(title);
  return `${t}||${source || ''}`.trim();
}

// 是否噪音：命中任一黑名单即 true
export function isNoise(title, site) {
  const [norm] = cleanTitle(title);
  if (!norm) return true;
  // URL 当标题（如 "http://ai/"）视为无效
  if (/^https?:\/\//.test(String(title || '').trim())) return true;
  for (const w of TITLE_BLACKLIST) if (norm.includes(w)) return true;
  if (site) for (const w of SITE_BLACKLIST) if (site.includes(w)) return true;
  for (const w of CONTENT_BLACKLIST) if (norm.includes(w)) return true;
  for (const w of SPAM_BLACKLIST) if (norm.includes(w)) return true;
  return false;
}

// 对采集器原始结果批量过滤：剔除噪音，并补上 site / cleanTitle / heat 字段。
// item 可选带 heat（热度字符串或数字，如 '★ 152' / 12）与 site（来源域名/站点名），
// 有显式 site 时优先使用（比从标题解析更可靠，如 360 的 cite）。
export function applyFilter(items) {
  const out = [];
  for (const it of items || []) {
    if (!it || !it.title) continue;
    const [, titleSite] = cleanTitle(it.title);
    const site = (it.site || titleSite || '').trim();
    if (isNoise(it.title, site)) continue;
    // 标题过短或纯关键词堆砌（下载站特征：下划线串联多个营销词）
    if (cleanTitle(it.title)[0].length < 4) continue;
    out.push({
      ...it,
      site,
      cleanTitle: cleanTitle(it.title)[0],
      heat: it.heat || '',
    });
  }
  return out;
}
