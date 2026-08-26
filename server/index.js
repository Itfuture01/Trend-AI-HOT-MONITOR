import express from 'express';
import path from 'node:path';
import { config } from './config.js';
import apiRouter from './routes/api.js';
import { sseHandler } from './events.js';
import { startScheduler } from './scheduler.js';

const app = express();
app.use(express.json());

// SSE 实时流（需在静态托管前注册，无 JSON 解析影响）
app.get('/api/events', sseHandler);

// REST API
app.use('/api', apiRouter);

// 托管前端构建产物（dist 优先，public 兜底 sw.js/manifest/icon 等静态资源）
app.use(express.static(path.join(config.root, 'dist')));
app.use(express.static(path.join(config.root, 'public')));

app.listen(config.port, () => {
  console.log(`[TrendMonitor] 服务已启动 → http://localhost:${config.port}`);
  console.log(`[TrendMonitor] 数据目录 → ${config.dataDir}`);
  console.log(`[TrendMonitor] AI: ${config.openrouter.apiKey ? '已配置' : '未配置（降级为关键词匹配）'}`);
  console.log(`[TrendMonitor] Twitter: ${config.twitter.apiKey ? '已配置' : '未配置（跳过该源）'}`);

  startScheduler();
});
