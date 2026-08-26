# Trend AI HOT MONITOR — 技术方案

> 更新时间：2026-08-25。本文档含**已核实的第三方 API 对接方式**（用于防止使用过时代码）。

## 一、技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 运行时 | Node.js ≥ 23（本项目 v23.11） | 自带 `node:sqlite` 与 `fetch`，免装原生依赖 |
| 后端 | Express **5** | 最新稳定 5.2.x，Node 18+ |
| 存储 | `node:sqlite`（内置 `DatabaseSync`） | 单文件，零运维 |
| 调度 | `node-cron` | 轻量定时 |
| 采集 | 原生 `fetch` + `cheerio` | 爬 HTML / 解析 RSS |
| AI | OpenRouter（原生 HTTP POST） | 免 SDK |
| 邮件 | `nodemailer` | SMTP |
| 浏览器推送 | `web-push`（VAPID）+ Service Worker | 真·推送 |
| 前端 | React 18 + Vite + **Tailwind v4**（CSS-first）+ 自绘 SVG | 独特视觉 |
| 实时 | SSE（Server-Sent Events） | 面板实时刷新 |

> 全部 ESM（`"type":"module"`）。后端无需构建步骤，前端 Vite 构建后由 Express 托管静态产物。

## 二、目录结构

```
Trend AI HOT MONITOR/
├── package.json
├── .env / .env.example
├── README.md
├── docs/                      # 需求与设计文档
├── server/
│   ├── index.js               # 入口：Express + 静态托管 + 调度
│   ├── config.js              # 读 .env + 校验
│   ├── db.js                  # node:sqlite 初始化 + 表 + 去重
│   ├── scheduler.js           # node-cron 两个任务
│   ├── notify.js              # 邮件 + 浏览器推送 + 告警落库
│   ├── ai.js                  # OpenRouter 批量判定
│   ├── routes/                # hotspots/keywords/alerts/push/stats
│   └── collectors/            # 8 个采集源 + 聚合入口 + 共享抓取器
├── cli.mjs                    # Agent Skills 用 CLI
├── skills/trend-monitor/SKILL.md
├── scripts/smoke.mjs          # 冒烟测试
├── public/                    # Vite 构建产物（托管）
└── src/                       # 前端源码（React + Tailwind v4）
```

## 三、数据模型（SQLite 表）

- `keywords(id, keyword, scope, enabled, created_at)`
- `items(id, url_hash UNIQUE, title, url, source, snippet, first_seen, last_seen)` — 原始条目去重
- `hotspots(id, title, summary, source, url, score, range, first_seen, last_seen)` — 聚合热点
- `alerts(id, keyword_id, keyword, title, url, source, reason, ai_verdict, sent_via, created_at)` — 告警
- `push_subscriptions(id, endpoint, keys_json, created_at)` — 浏览器订阅

去重键：`url_hash = sha1(规范化 title + url)`。

## 四、已核实的第三方 API 对接清单（2026-08）

### 1. OpenRouter（AI）
- **端点**：`POST https://openrouter.ai/api/v1/chat/completions`
- **头**：`Authorization: Bearer $OPENROUTER_API_KEY` + `Content-Type: application/json`
- **JSON 输出**：`response_format: { "type": "json_object" }`（**必须传对象，不能传字符串**，否则 400）
- **返回**：结果在 `choices[0].message.content`（字符串，需自行 JSON.parse）
- **默认模型**：`google/gemini-2.0-flash-001`（`.env` 可换；免费/廉价模型可用 `deepseek/deepseek-chat` 等）

### 2. Twitter/X（twitterapi.io，需 key）
- **Base**：`https://api.twitterapi.io`，头 `X-API-Key: $TWITTERAPI_IO_KEY`
- 搜索：`GET /twitter/tweet/advanced_search?query=<kw>&queryType=Latest`（支持 `cursor` 分页）
- 趋势：`GET /twitter/trends`
- 指定用户：`GET /twitter/user/last_tweets?userName=<name>`
- **额度**：$0.10 免费；1 USD = 10 万 credits，读 ≈ $0.00015/条

### 3. Google（免 key，用 News RSS）
- **端点**：`https://news.google.com/rss/search?q=<kw>&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`
- **注意**：`ceid` 为必填（`国家:语言`），缺省可能失败/跳转；`gl` 与 `ceid` 需一致
- 热点：`https://news.google.com/rss?hl=zh-CN&gl=CN&ceid=CN:zh-Hans`
- 返回 XML（约 ≤100 条 item），链接为跳转编码，需跟随后解出真实 URL

### 4. Bing（免 key）
- News RSS（优先）：`https://www.bing.com/news/search?q=<kw>&format=rss`
- 网页搜索兜底：`https://www.bing.com/search?q=<kw>`（HTML 抓取）

### 5. DuckDuckGo（免 key）
- **端点**：`https://html.duckduckgo.com/html/?q=<kw>`（静态 HTML，约 10 条/页，不翻页）
- 注意：对数据中心 IP 限流较强，可能返回验证页 → 需检测异常页并降级

### 6. HackerNews（免 key）
- 首页热点：`https://hn.algolia.com/api/v1/search?tags=front_page`
- 关键词搜索：`https://hn.algolia.com/api/v1/search?query=<kw>`

### 7. 搜狗（免 key）
- 网页搜索：`https://www.sogou.com/web?query=<kw>`（HTML）
- 微信文章：`https://weixin.sogou.com/weixin?query=<kw>`（HTML）

### 8. B站（免 key）
- **热搜榜**：`https://app.bilibili.com/x/v2/search/trending/ranking`（移动端公开接口，免签名，最多 100 条）
  - 旧接口 `api.bilibili.com/x/web-interface/search/square` **已废弃**；新 wbi 接口需签名 + buvid3 cookie，本期不用
- 关键词搜索：抓取 `https://search.bilibili.com/all?keyword=<kw>` HTML（兜底）

### 9. 微博（免 key）
- **热搜榜**：`https://weibo.com/ajax/side/hotSearch`（JSON，`data.realtime` 为热搜数组，`word/num/url` 字段）
  - 需移动端 UA；约 5–10 次/分钟限流；若被封，兜底解析 `https://s.weibo.com/top/summary?cate=realtimehot`
- 关键词搜索：抓取 `https://s.weibo.com/weibo?q=<kw>` HTML（兜底）

## 五、采集器设计（8 源并行）

- `collectors/index.js` 用 `Promise.allSettled` 并行调用 8 源，**单源失败不影响整体**。
- 统一返回 `{ title, url, source, snippet, ts }`。
- 每个源实现 `collectHot()`（榜单/首页）与 `collectSearch(kw)`（关键词搜索）两个方法。
- `collectors/http.js` 统一：真实 UA、超时 8s、失败重试 1 次、结果解析失败仅告警不崩溃、每源每轮限频 2–4s 随机抖动。

## 六、AI 分析（批量降本）

一次把一轮候选条目（≤N 条）发给模型，要求返回 JSON：
```json
[{"index":0,"relevant":0.0,"genuine":true,"summary":"...","reason":"..."}]
```
- `relevant`（0~1）：与关键词/范围的匹配度。
- `genuine`（bool）：是否真实有效（识别假冒内容）。
- `summary`：中文一句话摘要。
- 解析失败降级为「标题含关键词即视为相关」。无 key 时整体降级为关键词匹配。

## 七、调度

- **关键词监控任务**（默认每 5 min）：对每个启用关键词 → 8 源关键词搜索并行 → 去重 → AI 判定 → 命中（`relevant ≥ 阈值 && genuine`）→ 告警 + 通知。
- **热点聚合任务**（默认每 15 min）：8 源热点模式 → 去重 → AI 排序/摘要 → 写 hotspots（按 range 分组）。
- 另提供 `POST /api/scan` 手动触发。间隔在 `.env` 配置。

## 八、通知

- **邮件**：nodemailer，主题 `[TrendMonitor] 关键词「X」命中`。
- **浏览器推送**：web-push（VAPID 公钥首启自动生成写 `.env`）+ Service Worker。
- 成功/失败都写 `alerts`（`sent_via` 记录渠道）；同一 `url_hash` 一段时间内只告警一次（节流）。

## 九、HTTP API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/hotspots?range=&limit=` | 热点 |
| GET/POST/DELETE | `/api/keywords` | 关键词 |
| POST | `/api/scan` | 手动扫描 |
| GET | `/api/alerts` | 告警 |
| POST | `/api/push/subscribe` / `unsubscribe` | 订阅 |
| GET | `/api/stats` | 统计/状态 |
| GET | `/api/events` | SSE 实时流 |
| POST | `/api/test-email` / `/api/test-push` | 通知测试 |

## 十、前端视觉

**主题「雷达监控台 / Mission Control」**：深空底色 + 电光青绿(#00ff9c)主强调 + 琥珀警示，等宽字体点缀，自绘 SVG 雷达扫描动画，热点按「信号强度」渲染为雷达光点。响应式。

组件：`Radar`（SVG 雷达 + 光点）、`KeywordPanel`、`HotspotList`、`AlertStream`（SSE）、`Settings`。

## 十一、Agent Skills

`skills/trend-monitor/SKILL.md` + `cli.mjs`（命令见下文），供其他 AI 调用：
```bash
node cli.mjs status
node cli.mjs list-hotspots --range AI编程
node cli.mjs add-keyword "GPT-5" --scope AI编程
node cli.mjs remove-keyword <id>
node cli.mjs scan
node cli.mjs alerts
```

## 十二、风险与注意

- 搜索引擎/中文源 HTML 结构可能变动 → 采集器容错 + 多源冗余，单源失效不影响。
- twitterapi.io / OpenRouter 需 key，无 key 自动降级跳过，不阻塞其他源。
- Web Push 需安全上下文：localhost 可用，线上需 HTTPS。
- 通知节流避免刷屏。

## 十三、开发顺序

1. 脚手架 → 2. 采集器（8 源）→ 3. AI 分析 → 4. 调度+去重+告警 → 5. 通知 → 6. HTTP API + CLI → 7. 前端 → 8. Agent Skills → 9. 测试验收。
