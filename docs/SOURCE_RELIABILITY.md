# 信息源优化与内容过滤规则规范（SOURCE_RELIABILITY）

> 版本：1.0　更新时间：2026-08-30
> 适用范围：`server/collectors/*`（采集层）、`server/ai.js`（判定层）、`server/scheduler.js`（调度/节流）、`server/db.js`（去重存储）
> 关联文档：[DESIGN.md](DESIGN.md)、[REQUIREMENTS.md](REQUIREMENTS.md)

---

## 一、文档目的

本规范沉淀两件事：

1. **信息来源选型与接入标准**——当前 13 个信息源各自的端点、连通性、热度信号、降级行为，以及新增源时必须满足的接口约定。
2. **内容过滤规则标准**——一条内容从"被抓取"到"进入告警/热点"需要依次通过的每一道关卡，以及各关卡的规则、阈值、判定标准。

目标是让信息源**多而不杂、可靠可维护**，杜绝"搜狗下载站/百科轰炸"这类问题复现。

---

## 二、总体原则

| 原则 | 说明 |
|---|---|
| 宁缺毋滥 | 宁可少，不要假。搜狗只抓近 24h 新内容；无法判定的内容默认不放行。 |
| 多源冗余 | 单源失败不影响整体（`Promise.allSettled`）；被墙源快速熔断，不拖慢扫描。 |
| 规则优先、AI 兜底 | 能用规则（黑名单/时间过滤/去重）解决的不交给 AI；AI 用于相关性、真实性与摘要的精细判定。 |
| 降级保守 | AI 不可用时（无 key / 429 / 超时），降级评分从低，绝不因标题含关键词就判 urgent。 |
| 直连优先 | 默认直连，源连不上自动跳过；代理仅在显式配置且直连失败时兜底。 |

---

## 三、信息来源规范（14 源矩阵）

### 3.1 源清单与接入方式

| # | 源名 | 采集器 | 热点模式 | 关键词搜索 | 直连(国内) | 热度字段 | 备注 |
|---|---|---|---|---|---|---|---|
| 1 | Twitter/X | `twitter.js` | `/twitter/trends` | `/twitter/tweet/advanced_search` | — | 推文量 | 需 `TWITTERAPI_IO_KEY`，无 key 跳过 |
| 2 | Google | `google.js` | News RSS 首页 | News RSS `search?q=` | 常不通 | 无 | 双语言版（zh/en）；被墙时失败跳过 |
| 3 | Bing | `bing.js` | News RSS | News RSS `search?q=&format=rss` | 可用 | 无 | 失败自动跳过 |
| 4 | DuckDuckGo | `duckduckgo.js` | HTML 代理搜索 | `html.duckduckgo.com/html/?q=` | 常不通 | 无 | 数据中心 IP 易限流 |
| 5 | HackerNews | `hackernews.js` | `hn.algolia.com/api` front_page | `/search?query=` | 可用 | 无 | 最稳定的英文源之一 |
| 6 | 搜狗 | `sogou.js` | 通用 AI 话题搜索 | 移动端 `searchList.jsp` **必带 `tsn=1`** | 可用 | 无 | **只抓近 24h 新内容**，见 §4.3 |
| 7 | B站 | `bilibili.js` | 热搜榜 JSON | `search.bilibili.com/all` HTML | 可用 | 播放量 | 播放量作为 heat |
| 8 | 微博 | `weibo.js` | 热搜榜 JSON | `s.weibo.com/weibo?q=` HTML | 可用 | 热度值 | 关键词搜索需登录，通常 0 条 |
| 9 | GitHub | `github.js` | Trending HTML | 代码库搜索 API | 可用 | ★ stars | **搜索 API 免 key 10 次/分钟** |
| 10 | V2EX | `v2ex.js` | sov2ex 宽泛搜索 | `www.sov2ex.com/api/search` | 可用 | 回复数 | 官方 API 被墙，用第三方索引 sov2ex |
| 11 | 360 | `so360.js` | 通用 AI 话题搜索 | `www.so.com/s?q=` HTML | 可用 | 无 | 结果带**真实 URL**（`data-mdurl`）与站点域名 |
| 12 | 百度 | `baidu.js` | `top.baidu.com/api/board` 热搜 JSON | `www.baidu.com/s?wd=` HTML | 可用 | 热搜排名 | 搜索偶发验证码 → 检测到即本轮跳过 |
| 13 | Reddit | `reddit.js` | 多 subreddit `hot.json` | `search.json?sort=top&t=day` | 常不通 | upvotes/评论 | 直连失败自动跳过，配代理后恢复 |
| 14 | 微信 | `weixin.js` | 通用 AI 话题搜索 | 搜狗微信 `type=2` | 可用 | 无 | **公众号内容**；反爬自动跳过 + 15min 冷却自恢复，见 §4.4 |

### 3.2 采集器统一接口约定

每个采集器**必须**导出（`collectors/index.js` 通过 `Promise.allSettled` 并行调用）：

```js
export const name = '源名';                       // 须与 db.js SOURCE_SEED 中 name 一致
export async function collectHot() {}              // 返回 { title, url, source, snippet, ts, site?, heat?, lang?, member? }
export async function collectSearch(keyword) {}    // 同上
```

统一返回字段：
- `title`（必填）、`url`（必填）、`snippet`（摘要，≤200）、`ts`（时间戳）
- `site`（可选，来源域名/站点名，比从标题解析更可靠）
- `heat`（可选，热度字符串，如 `★ 203906` / `84 回复` / `7,496 播放`，供 AI 参考）
- `lang`、`member`（可选，GitHub 语言 / V2EX 用户）

新增源时必须：① 写入 `db.js` 的 `SOURCE_SEED`；② 加入 `collectors/index.js` 的 `SOURCES`；③ 采集结果调用 `applyFilter` 过过滤层；④ 跑 `scripts/smoke.mjs` 验证。

### 3.3 新增源的选型标准（避免重蹈覆辙）

评估新源时按以下权重打分，≥3 项通过才值得接入：

1. **有热度/质量信号**（upvotes、回复数、播放量、权威域名）——直接回应"回复量寥寥也进"的问题；
2. **可稳定直连**（国内网络下），或可优雅跳过；
3. **能提供"新内容"**（有时间过滤参数 / 本身就是时效榜 / 更新时间戳）；
4. **解析结构稳定**（JSON API 优于 HTML 抓取；HTML 需选 select 结构变动的稳健容器）；
5. **有真实 URL**（非跳转壳）——影响去重与用户跳转体验。

### 3.4 账号解析规范（博主 / 官方 / 账号）⭐

当监控关键词本身就是「博主/官方/账号」时，不再只搜"提及"，而是**直接解析该账号资料**并注入其最新动态。

| 平台 | 接口 | 命中规则 | 提供内容 | 免 Key 限制 |
|---|---|---|---|---|
| GitHub | `api.github.com/users/{name}` | 用户名**精确命中**（组织/用户均算），须匹配 `/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/` | 资料（名称/头像/简介/粉丝/组织or用户）+ **最近活跃仓库 8 个**（post 并入搜索流） | 未认证 60 次/时 |
| B站 | `search/type?search_type=bili_user` | 昵称**精确命中**（大小写不敏感） | 资料（昵称/头像/粉丝/签名/主页），**无视频**（WBI 签名限制） | 无 |

**缓存**：账号解析结果内存 TTL 60 分钟（含"确认非账号"的负缓存，但**仅 HTTP 404/确定无匹配才缓存负结果**，网络抖动/限流不缓存、下轮重试）。

**接入**：`collectors/index.js` 的 `searchWithAccounts(keyword)` 在 `searchAll` 基础上并入账号 posts；`scheduler.js` 将账号 posts 走正常 AI 判定/告警（`processKeyword`），并将账号资料卡写入热点（`storeAccountProfiles`，score 85 / level high，`touchHotspot` 去重防重复）。

> 账号资料卡字段约定：`title=名称（handle）`（B站 mid 为数字则不拼）、`summary=简介 · 官方组织/用户/UP主 · N 粉丝`、`url=主页`、`source=平台`。复用现有热点卡片展示，无前端改动。

### 4.1 直连优先 + 代理兜底

- **默认直连**；仅当检测到代理环境变量（`HTTP_PROXY`/`HTTPS_PROXY`/`ALL_PROXY` 等）且直连失败时，**再走代理一次**。
- **重要**：代理 scheme 必须写 `http://`。写成 `https://127.0.0.1:xxx` 会导致 undici 无法识别而直接失败（历史 bug，已修正 `.env` 示例）。

### 4.2 参数约定

| 参数 | 值 | 说明 |
|---|---|---|
| `timeoutMs` | 默认 **6500ms** | 熔断期间降为 1200ms 快速失败 |
| `retries` | 默认 **1** 次 | 熔断期间不重试 |
| 全局限频 `GAP_MS` | **1200ms** + 0~800ms 随机抖动 | 任意两次请求之间 |
| UA | 桌面 Chrome UA；中文源可覆盖移动端 UA | — |

### 4.3 熔断器（Circuit Breaker）

- 同一来源连续失败 **2** 次 → 进入 10 分钟冷却；
- 冷却期间该源请求**短超时（1200ms）+ 不重试**，快速失败放行，不拖慢整轮扫描；
- 请求成功即解除冷却。

> 效果：被墙源（Google/DDG/Reddit）只在前两轮付出完整超时成本，之后每轮仅 1.2s 即跳过。

### 4.4 微信源自保护（搜狗微信反爬）

`weixin.sogou.com` 对「短时间连续请求」敏感，密集探测会返回 302 → `antispider` 页（临时封 IP）。`weixin.js` 内置两级保护：

- **节流**：同源请求最小间隔 60s，不足则本轮直接跳过（best-effort）；
- **反爬冷却**：检测到 `antispider/验证码` → 进入 15 分钟冷却，期间返回空数组不请求，到期自恢复。

> 该源偶尔为空属预期（被封 IP），不影响其他源；恢复后自动继续采集。

---

## 五、内容过滤规则规范（`filter.js`）⭐ 核心

所有采集器结果**必须**经 `applyFilter()` 过滤后才进入 `dedupeItem` / AI 判定。

### 5.1 判定顺序（一条内容依次过关）

```
原始条目 → cleanTitle() → isNoise() → 长度校验 → 通过（携带 site/cleanTitle/heat）
```

### 5.2 `cleanTitle(title)` — 标题清洗

返回 `[cleanTitle, site]`：
- 剥离尾部站点段：`标题 - 站点` / `标题 | 站点` / `标题__站点`；
- 分隔符统一为空格：`_` `-` `—` `|` `·` 全部折叠；
- 转小写、去首尾空白。

> 用于两个场景：① 黑名单匹配；② 生成去重键 `normKey = cleanTitle + '||' + source`。

### 5.3 `isNoise(title, site)` — 噪音判定（命中任一即拦截）

| 类别 | 规则词（当前清单） | 典型误抓案例 |
|---|---|---|
| **标题黑名单** `TITLE_BLACKLIST` | 下载 / 官方版 / 电脑版 / 手机版 / 客户端 / 安装 / 免费版 / 正版 / 最新版 / app / 软件宝库 / 软件商店 / 官网 / 换脸 / 高清版 | `DeepSeek下载_官方最新版`、`ai换脸明星淫高清版` |
| **站点黑名单** `SITE_BLACKLIST` | 百科 / baike / wiki / 软件宝库 / 软件下载 / 下载站 / 站长网 / 教程 / 菜鸟教程 | `DeepSeek - 搜狗百科`、`baike.so.com` |
| **内容特征** `CONTENT_BLACKLIST` | 是什么 / 是什么意思 / 什么是 / 有哪些 / 怎么用 / 入门 / 教程 / 简介 / 基本概念 | `你知道什么是AI吗`、`什么是AI大模型?入门到精通` |
| **垃圾/广告** `SPAM_BLACKLIST` | 售卖 / 出售 / 转让 / 招聘 / 内推 / 求职 / 不加班 / 揭秘 / 体验 / 全新版 / 域名重定向 / 求算法 / 求后端 | `售卖一组人工智能域名`、`[上海]不加班AI教育公司招聘` |
| **URL 当标题** | 标题以 `http://` 或 `https://` 开头直接拦截 | `http://ai/` |
| **过短标题** | `cleanTitle` 长度 < 4 拦截 | `AI`、`GPT` 单关键词条目 |

### 5.4 扩充黑名单的流程（新增规则词三步）

1. 在 `filter.js` 对应 `*_BLACKLIST` 数组追加词；
2. 用 `node --input-type=module -e "import { isNoise } from './server/collectors/filter.js'; ..."` 对已知正/反样例验证（反例不得误伤）；
3. 跑 `scripts/smoke.mjs` 确认各源输出量未塌方。

> **不要**把所有"看起来不相关"都塞进黑名单——相关性是 AI 的职责，黑名单只拦**确定性噪音**（下载站/百科/垃圾广告）。规则过紧会漏掉真实的社区讨论。

---

## 六、去重规范（`db.js`）

### 6.1 去重键

| 键 | 计算方式 | 适用 |
|---|---|---|
| `url_hash` | `sha1(title + '||' + url)` | URL 稳定的源（GitHub/Reddit/HN） |
| `norm_hash` | `sha1(normKey(title, source))` = `sha1(cleanTitle + '||' + source)` | **搜索引擎源**（搜狗/360/百度 URL 带随机参数） |

`items` 表同时存两列，`dedupeItem()` 先查 `url_hash = ? OR norm_hash = ?`，任一命中即视为重复（刷新 `last_seen`，返回 false）。

### 6.2 热点级去重 `touchHotspot(title, source, range)`

热点按「原始标题 + 来源 + 范围」匹配，命中则刷新 `last_seen` 不重复入库（URL 变化不影响）。

### 6.3 去重层级示意

```
采集 → applyFilter 去噪 → dedupeItem 入库(items) → AI 判定 → touchHotspot 热点去重 → 写 hotspots
```

---

## 七、告警节流规范（`scheduler.js`）

- **规则**：同一关键词 + 同一规范化标题（`cleanTitle`），**24 小时内只告警一次**。
- **实现**：`processKeyword` 在 AI 判定前，查 `alerts` 表 24h 内的记录，命中则跳过。
- **目的**：与 §6 的去重形成双保险——去重管"入库"，节流管"通知"，防止搜狗/360 URL 变化导致的重复轰炸。

> 相关阈值：关键词告警相关性阈值 `AI_THRESHOLD`（`.env`，默认 0.6→60）；热点入库阈值 `HOTSPOT_THRESHOLD = 40`（代码常量）。

---

## 八、AI 判定规范（`ai.js`）

### 8.1 请求

- 批量调用 OpenRouter，`MAX_BATCH = 20` 条/次；`response_format: { type: 'json_object' }`；
- **429 / 5xx 重试一次**（2s 退避），免费模型分钟级限流通常可恢复。

### 8.2 每条条目提供给模型的信息

```
标题 / 站点(site) / 热度(heat) / 来源(source) / 摘要(snippet)
```

### 8.3 判定规则（prompt 内明文约束）

- `genuine=false` 的强制场景：
  - 下载站/软件安装页/App 推广页（标题含"下载、官方版、电脑版、免费版"）；
  - 百科词条、教程/介绍/科普类**老内容**（非新发布、无时效信息量）；
  - 无实质内容的水文、营销软文、广告、标题党、纯问答引流页；
  - 与主题无关或仅同名无关。
- **优先保留**：新发布的报道/讨论；
- **加权信号**：高热度（★stars / 回复数 / 播放量）、正规媒体或官方域名、被多个独立源同时抓到；
- `summary` **必须非空**（一句话中文摘要）。

### 8.4 降级策略（AI 不可用 / 调用失败）

| 场景 | 行为 |
|---|---|
| 无 `OPENROUTER_API_KEY` | 降级为规则匹配：标题含关键词 → `relevant=65`（中等），否则 20；`genuine=true` 全放行 |
| 429/超时且重试后仍失败 | 同上的保守降级，`reason` 注明"AI 调用失败降级匹配" |

> **关键约束**：降级评分最高 65，**严禁**无 AI 时给 90/urgent（历史 bug：免费模型 429 → 降级给 90 → 垃圾全放行）。真实性与重要性主要交给上层规则过滤把关。

### 8.5 模型选型建议

- 不推荐免费模型（`*-free`）：分钟级/日级限流，导致频繁降级，效果等同"AI 关闭"。
- 推荐：`deepseek/deepseek-chat`（已验证 OpenRouter 上存在且稳定），配置于 `.env` 的 `OPENROUTER_MODEL`。代码默认值同此。

---

## 九、数据模型变更（`db.js` 迁移）

| 变更 | 说明 |
|---|---|
| `items` 新增 `norm_hash TEXT` + 索引 | 规范化标题去重，兼容旧数据（旧行 norm_hash 为 NULL，不影响新写入） |
| `sources` seed 扩展至 13 源 | GitHub / V2EX / 360 / 百度 / Reddit 及其可用性备注 |

---

## 十、配置项汇总（`.env`）

| 变量 | 默认 | 说明 |
|---|---|---|
| `OPENROUTER_MODEL` | `deepseek/deepseek-chat` | 判定模型，勿用 `*-free` |
| `AI_THRESHOLD` | `0.6` | 关键词告警相关性阈值（0~1） |
| `MONITOR_INTERVAL_MIN` | `5` | 关键词监控间隔 |
| `HOTSPOT_INTERVAL_MIN` | `15` | 热点聚合间隔 |
| `HTTP_PROXY` / `HTTPS_PROXY` | 空（注释） | 可选，scheme 必须 `http://` |
| `TWITTERAPI_IO_KEY` | 空 | X 源，可选 |
| `SMTP_*` / `VAPID_*` | — | 通知，不变 |

---

## 十一、验收与回归清单

改动采集/过滤逻辑后，按此清单回归：

```bash
# 1. 语法检查所有改动文件
node --check server/collectors/filter.js  # 等

# 2. 冒烟测试：各源热榜 + 关键词搜索条数、失败源
node scripts/smoke.mjs "DeepSeek"

# 3. 噪音正反样例
node --input-type=module -e "import {isNoise} from './server/collectors/filter.js'; console.log(isNoise('DeepSeek下载_官方最新版',''), isNoise('计算机行业研究:再谈AI应用',''))"

# 4. 跑一轮关键词监控 + 热点聚合（写库，注意会有 OpenRouter 调用）
node -e "import('./server/scheduler.js').then(m=>Promise.all([m.runKeywordMonitor(), m.runHotspotAggregation()])).then(console.log)"
```

**通过标准**：
- 搜狗结果不含"下载/百科/介绍页"（`tsn=1` 生效）；
- 告警来源分布在 ≥3 个源（不再是搜狗单源刷屏）；
- 同一内容 24h 内不重复告警；
- 无 `[urgent] 90%` 的下载站/域名售卖类告警。

---

## 十二、维护与扩展指南

### 12.1 加一个新的信息源
1. 按 §3.3 标准评估；确定端点与解析结构；
2. 新建 `server/collectors/xxx.js`，实现 `name/collectHot/collectSearch`，结果过 `applyFilter`；
3. `collectors/index.js` 加入 `SOURCES`；`db.js` `SOURCE_SEED` 加入元数据；
4. 跑冒烟 + 正反样例；提交前更新本文档 §3.1 矩阵与 README。

### 12.2 调过滤规则
见 §5.4 三步流程；注意"宁漏勿误伤"。

### 12.3 换 AI 模型 / 调阈值
改 `.env`：`OPENROUTER_MODEL`、`AI_THRESHOLD`；热点阈值 `HOTSPOT_THRESHOLD` 在 `scheduler.js` 常量。

### 12.4 已知限制
- **跨源去重未做**：同一内容在搜狗和 360 都会出现（不同源、不同 URL），各算一条。当前按"单源严格过滤"策略接受此行为（§ 决策记录）。
- **百度搜索偶发验证码**：检测到即本轮跳过，属预期降级。
- **微博关键词搜索需登录**：热搜榜正常，搜索长期 0 条属预期。
- **GitHub 搜索 API 免 key 限 10 次/分钟**：关键词较多时可能触发，失败自动跳过，建议 ≤5 个启用关键词。

---

## 十三、关键决策记录（与用户确认，2026-08-30）

| 决策点 | 结论 |
|---|---|
| 网络策略 | 跳过代理走直连；源连不上自动跳过（保留代理兜底，不强制依赖） |
| 搜狗策略 | 只保留近 24h 新内容（`tsn=1`），宁缺毋滥 |
| 新增源 | GitHub Trending、360、百度、Reddit、V2EX（前两者直连可用，Reddit 直连不通时自动跳过） |
| 过滤强度 | 单源严格过滤 + 只保留正规媒体/高热度（不做强制多源交叉确认） |
