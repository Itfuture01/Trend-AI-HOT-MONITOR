---
name: trend-monitor
description: 当需要监控 AI/科技/编程热点、发现新趋势、管理监控关键词、触发一次扫描或查看热点与告警记录时使用。通过调用本地 Trend AI HOT MONITOR 服务的 CLI（node cli.mjs）完成，覆盖 8 个信息源（Twitter/X、Bing、Google、DuckDuckGo、HackerNews、搜狗、B站、微博），并用 AI 识别假冒/无关内容。
---

# Trend Monitor — AI 热点监控与发现

调用本项目内置的命令行工具，让任意 AI 代理也能第一时间发现热点、监控指定关键词、查看告警。

## 前置条件

本地服务必须已启动，否则 CLI 会报 `无法连接服务`。启动方式：

```bash
npm start        # 前台启动（或 npm run dev 开发模式）
```

启动后默认监听 `http://localhost:3000`（`.env` 中的 `PORT` 可改）。服务提供网页端（雷达监控台）与 REST API，本 skill 只通过 CLI 访问。

## 命令总览

所有命令在项目根目录执行：

| 命令 | 作用 |
|---|---|
| `node cli.mjs status` | 查看统计与配置状态（AI/邮件/推送/Twitter/代理是否就绪） |
| `node cli.mjs list-hotspots [--range X] [--limit N]` | 查看聚合热点 |
| `node cli.mjs list-keywords` | 查看监控关键词 |
| `node cli.mjs add-keyword "<词>" [--scope 范围]` | 添加监控关键词 |
| `node cli.mjs remove-keyword <id>` | 删除关键词 |
| `node cli.mjs list-sources` | 查看数据源及开关状态 |
| `node cli.mjs set-source <名称> on\|off` | 启用/停用某数据源 |
| `node cli.mjs scan` | 手动触发一次扫描（后台执行） |
| `node cli.mjs alerts [--limit N]` | 查看告警记录 |

## 命令详解

### 1. 查看状态 — `status`
返回 JSON：`keywords`（关键词数）、`hotspots`（热点数）、`alerts`（告警数）、`subscriptions`（浏览器订阅数）、`aiEnabled`、`emailEnabled`、`twitterEnabled`、`hasProxy`、`model`（当前 AI 模型）、`defaultRange`、`status.lastRun`（各任务最近执行时间戳）。

用途：判断 AI 是否配置（`aiEnabled`）、X 源是否可用（`twitterEnabled`）、通知是否就绪，再决定下一步。

### 2. 发现热点 — `list-hotspots`
```bash
node cli.mjs list-hotspots                  # 全部热点
node cli.mjs list-hotspots --range AI编程    # 只看某个范围
node cli.mjs list-hotspots --limit 30
```
每条输出格式：`[来源] 标题 — 摘要 (score)` 换行 `url`。
- `score`：AI 判定的相关性，0~1，越高越可能是真热点。
- 范围（range）会自动包含 `.env` 的 `DEFAULT_RANGE` 与所有关键词的 `scope`。

### 3. 管理关键词 — `list-keywords` / `add-keyword` / `remove-keyword`
```bash
node cli.mjs add-keyword "GPT-5" --scope AI编程   # 添加并归入范围
node cli.mjs list-keywords                          # 查看 id / scope / enabled / 告警数
node cli.mjs remove-keyword 1                       # 按 id 删除
```
关键词添加后，定时任务（默认每 5 分钟）会自动用 8 个源并行搜索，命中真实相关内容即告警。

### 4. 触发扫描 — `scan`
```bash
node cli.mjs scan
```
立即执行一次「关键词监控 + 热点聚合」，后台运行。之后用 `list-hotspots` / `alerts` 查看结果。

### 5. 管理数据源 — `list-sources` / `set-source`
```bash
node cli.mjs list-sources           # 列出 8 个源及 [ON]/[OFF] 状态、所需配置
node cli.mjs set-source Google off  # 停用某源（名称：Twitter/Google/Bing/DuckDuckGo/HackerNews/搜狗/B站/微博）
node cli.mjs set-source 搜狗 on
```
停用后该源不再参与关键词搜索与热点聚合，立即生效。

### 6. 查看告警 — `alerts`
```bash
node cli.mjs alerts --limit 20
```
输出格式：`[时间] 关键词「X」: 标题 (来源, 渠道: email/push/none)`。

## 典型工作流

**场景 A：探索当前 AI 领域有什么热点**
```bash
node cli.mjs status
node cli.mjs list-hotspots --limit 20
```

**场景 B：监控一个新关键词（如某新模型发布）**
```bash
node cli.mjs add-keyword "GPT-6" --scope AI编程
node cli.mjs scan
node cli.mjs alerts
```

**场景 C：把某个热点追到手**
```bash
node cli.mjs list-hotspots --range AI编程
# 记下感兴趣条目的 title/url，向用户复述并附链接
```

## 结果字段说明

- `source`：信息来源，取值 `twitter` / `bing` / `google` / `duckduckgo` / `hackernews` / `sogou` / `bilibili` / `weibo` 之一。
- `score`（热点）/ `ai_verdict`（告警）：AI（OpenRouter）对相关性与真实性的判定。无 AI key 时降级为「标题含关键词即相关」，识别较弱。
- `sent_via`：告警实际投递渠道，`email` / `push` / `none`。

## 注意事项

- 信息源为多源并行；单个源失败不影响整体。Google/Bing/DuckDuckGo 在国内网络下需在 `.env` 配置 `HTTP_PROXY` / `HTTPS_PROXY`；Twitter/X 需 `TWITTERAPI_IO_KEY`。
- 同一内容按 `sha1(标题+URL)` 去重，不会重复告警。
- 采集器有频率限制与随机抖动，`scan` 是耗时操作（约数秒~数十秒），属正常现象。
- 若 CLI 报「无法连接服务」，先 `npm start` 再重试。
