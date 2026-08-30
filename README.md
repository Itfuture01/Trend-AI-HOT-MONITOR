# Trend AI HOT MONITOR · AI 热点雷达

一个轻量的 AI 热点监控工具：**第一时间**发现 AI / 科技 / 编程领域的热点变化，关键词命中即刻通知，热点自动聚合到网页查看。

- 🎯 **关键词监控** — 手动输入关键词，多源并行搜索，AI 识别假冒/无关内容后即时告警。
- 📡 **热点聚合** — 定时自动收集指定范围（如「AI 编程」）的热点，网页可视化查看。
- 🔔 **多渠道通知** — 浏览器实时推送（Web Push）+ 邮件（SMTP）。
- 🌐 **14 信息源并行** — Twitter/X、Google、Bing、DuckDuckGo、HackerNews、搜狗(近24h新内容)、B站、微博、GitHub Trending、V2EX、360、百度、Reddit、微信(公众号)，多源冗余避免单一源。
- 👤 **账号解析** — 关键词本身是 GitHub 组织/用户或 B站 UP主 时，直接拉取账号资料（名称/简介/粉丝数/主页）并注入其最新动态。
- 🤖 **AI 判定** — OpenRouter 接入，批量判断相关性、识别下载站/百科/营销号/标题党/同名无关内容，并生成中文摘要。
- 🧩 **Agent Skills** — 封装为 skill，可交给其他 AI（如 Claude Code）监控/发现热点。

## 快速开始

> 需要 Node.js ≥ 23（内置 `node:sqlite` 与原生 fetch）。

```bash
npm install

# 1. 配置密钥（复制模板后填写）
cp .env.example .env
# 编辑 .env，至少填 OPENROUTER_API_KEY；可选 SMTP_* 与 TWITTERAPI_IO_KEY

# 2. 构建前端
npm run build

# 3. 启动服务
npm start
```

启动后访问 **http://localhost:3000** 查看雷达监控台。

开发模式（前端热更新 + 后端热重启）：

```bash
npm run dev:web   # 终端 1：Vite 开发服务器（5173，代理 /api → 3000）
npm run dev       # 终端 2：后端（--watch）
```

## 配置（.env）

| 变量 | 说明 | 默认 |
|---|---|---|
| `PORT` | 服务端口 | `3000` |
| `OPENROUTER_API_KEY` | OpenRouter 密钥（**必填**，否则降级为关键词匹配） | — |
| `OPENROUTER_MODEL` | 判定模型（勿用 `*-free` 免费版，限流会频繁降级） | `deepseek/deepseek-chat` |
| `TWITTERAPI_IO_KEY` | [twitterapi.io](https://twitterapi.io/) 密钥（X 源，可选） | — |
| `SMTP_HOST/PORT/SECURE/USER/PASS/FROM/TO` | 邮件通知（可选，全填才启用） | — |
| `MONITOR_INTERVAL_MIN` | 关键词监控间隔（分钟） | `5` |
| `HOTSPOT_INTERVAL_MIN` | 热点聚合间隔（分钟） | `15` |
| `AI_THRESHOLD` | 关键词告警相关性阈值（0~1） | `0.6` |
| `DEFAULT_RANGE` | 默认热点范围 | `AI编程` |
| `HTTP_PROXY` / `HTTPS_PROXY` | 代理（Google/Bing/DDG 在国内网络下需要） | — |
| `VAPID_*` | Web Push 密钥，首次启动自动生成 | 自动 |

## 网页端

- **顶部状态条**：AI/邮件/推送/X/代理/连接状态灯，一键「立即扫描」。
- **雷达**：热点信号可视化（光点大小/亮度 = 相关性强弱，旋转扫描扇面）。
- **关键词监控**：增删关键词、开关、命中文案。
- **热点信号**：按范围筛选，卡片含来源、AI 摘要、相关性、时间、外链。
- **实时告警流**：SSE 推送，展示命中关键词、AI 判定、投递渠道。
- **设置**：开启/关闭浏览器推送，测试邮件与推送。

## CLI 与 Agent Skills

命令行入口 `cli.mjs`（服务需先启动）：

```bash
node cli.mjs status
node cli.mjs list-hotspots --range AI编程 --limit 20
node cli.mjs add-keyword "GPT-5" --scope AI编程
node cli.mjs remove-keyword 1
node cli.mjs scan
node cli.mjs alerts
```

Agent Skill 定义见 [`skills/trend-monitor/SKILL.md`](skills/trend-monitor/SKILL.md)，已软链接到 `.claude/skills/trend-monitor`，Claude Code 会自动发现该 skill，从而让任意 AI 代理也能监控/发现热点。

## 目录结构

```
server/            后端（Express + SQLite + 调度 + 采集 + AI + 通知）
  collectors/      14 个信息源采集器 + 账号解析
  routes/          REST API
src/               前端（Vite + React + Tailwind v4）
  components/      雷达 / 关键词 / 热点 / 告警 / 设置
public/            静态资源（Service Worker / manifest / icon）
skills/            Agent Skill 定义
cli.mjs            命令行入口
scripts/smoke.mjs  采集器冒烟测试
docs/              需求与设计文档
```

## 数据源可用性说明

> 默认直连，单源连不上自动跳过（不影响其他源）。被墙的源（Google/DDG/Reddit/V2EX）在配置代理后自动恢复。

| 源 | 是否需要配置 | 备注 |
|---|---|---|
| Twitter/X | `TWITTERAPI_IO_KEY` | 免费额度有限，无 key 自动跳过 |
| Google / DuckDuckGo / Reddit / V2EX | 直连常不通，需代理 | 失败自动跳过，不影响其他源 |
| Bing / GitHub / 360 / 百度 | 无需 | 国内可直连 |
| HackerNews / 搜狗 / B站 / 微博 | 无需 | 搜狗仅抓近 24h 新内容；微博关键词搜索需登录，热搜榜可用 |
| 微信 | 无需 | 公众号内容（搜狗微信），敏感反爬自动跳过、15 分钟冷却自恢复 |

## 可靠性与降噪策略

- **搜狗 `tsn=1`**：只抓近 24 小时新发布内容，从源头剔除百科/下载站/介绍页等老页面。
- **统一噪音过滤层**：黑名单（下载/官方版/百科/教程/是什么等）+ 站点名提取 + 标题清洗。
- **稳定去重**：`sha1(规范化标题 + 来源)`，URL 带随机参数的源也能跨轮去重。
- **告警节流**：同关键词 + 同内容 24h 内只告警一次，杜绝重复轰炸。
- **AI 增强判定**：识别下载站/百科/营销号/标题党/同名无关，正规媒体与社区热度（stars/回复/播放）加权。

## 注意事项

- 采集器带限频与随机抖动，单源失败不影响整体；HTML 结构变动时解析失败仅告警不崩溃。
- Web Push 需安全上下文（`localhost` 或 HTTPS）。
