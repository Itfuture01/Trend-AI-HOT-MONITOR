#!/usr/bin/env node
// Trend AI HOT MONITOR 命令行入口（供 Agent Skills 与手动使用）
import { config } from './server/config.js';

const BASE = `http://localhost:${config.port}`;

const HELP = `Trend AI HOT MONITOR CLI
用法: node cli.mjs <command> [args]

命令:
  status                              查看统计与配置状态
  list-hotspots [--range X] [--limit N]  查看热点（--range 指定范围）
  list-keywords                       查看关键词
  add-keyword <关键词> [--scope 范围]     添加监控关键词
  remove-keyword <id>                 删除关键词
  list-sources                       查看数据源及开关状态
  set-source <名称> on|off             启用/停用某数据源
  scan                                手动触发一次扫描（后台执行）
  alerts [--limit N]                  查看告警记录
`;

async function api(method, path, body) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(`无法连接服务 ${BASE}，请先运行 \`npm start\``);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} 失败(${res.status}): ${data.error || res.statusText}`);
  return data;
}

function argValue(flags) {
  for (const f of flags) {
    const i = args.indexOf(f);
    if (i !== -1 && args[i + 1]) return args[i + 1];
  }
  return null;
}

const [cmd, ...args] = process.argv.slice(2);

async function main() {
  switch (cmd) {
    case 'status': {
      const s = await api('GET', '/api/stats');
      console.log(JSON.stringify(s, null, 2));
      break;
    }
    case 'list-hotspots': {
      const range = argValue(['--range', '-r']) || '';
      const limit = argValue(['--limit', '-n']) || '20';
      const d = await api('GET', `/api/hotspots?range=${encodeURIComponent(range)}&limit=${limit}`);
      console.log(
        range
          ? `# 范围「${range}」热点（${d.hotspots.length} 条）`
          : `# 全部热点（${d.hotspots.length} 条），可用范围：${d.ranges.join(', ') || '(无)'}`,
      );
      for (const h of d.hotspots) {
        console.log(
          `[${h.source}] ${h.title}${h.summary ? ' — ' + h.summary : ''} (${(h.score || 0).toFixed(2)})\n   ${h.url}`,
        );
      }
      break;
    }
    case 'list-keywords': {
      const d = await api('GET', '/api/keywords');
      if (!d.keywords.length) return console.log('(暂无关键词)');
      for (const k of d.keywords) {
        console.log(`#${k.id} ${k.keyword} (scope=${k.scope || '-'}, enabled=${k.enabled}, 告警${k.alert_count})`);
      }
      break;
    }
    case 'add-keyword': {
      const kw = args[0];
      if (!kw) {
        console.error('用法: node cli.mjs add-keyword "关键词" [--scope 范围]');
        process.exit(1);
      }
      const scope = argValue(['--scope', '-s']) || '';
      const d = await api('POST', '/api/keywords', { keyword: kw, scope });
      console.log(`已添加关键词：${d.keyword.keyword} (id=${d.keyword.id}, scope=${d.keyword.scope || '-'})`);
      break;
    }
    case 'remove-keyword': {
      const id = Number(args[0]);
      if (!id) {
        console.error('用法: node cli.mjs remove-keyword <id>');
        process.exit(1);
      }
      await api('DELETE', `/api/keywords/${id}`);
      console.log(`已删除关键词 id=${id}`);
      break;
    }
    case 'list-sources': {
      const d = await api('GET', '/api/sources');
      if (!d.sources.length) return console.log('(暂无数据源)');
      for (const s of d.sources) {
        console.log(
          `${s.enabled ? '[ ON ]' : '[OFF ]'} ${s.name}${s.label ? ` (${s.label})` : ''}${s.note ? ' — ' + s.note : ''}`,
        );
      }
      break;
    }
    case 'set-source': {
      const name = args[0];
      const onoff = (args[1] || '').toLowerCase();
      if (!name || (onoff !== 'on' && onoff !== 'off')) {
        console.error('用法: node cli.mjs set-source <名称> on|off');
        process.exit(1);
      }
      const d = await api('PATCH', `/api/sources/${encodeURIComponent(name)}`, {
        enabled: onoff === 'on',
      });
      console.log(`已${onoff === 'on' ? '启用' : '停用'}数据源：${d.source.name}`);
      break;
    }
    case 'scan': {
      await api('POST', '/api/scan');
      console.log('已触发扫描（后台执行），稍后查看 list-hotspots / alerts');
      break;
    }
    case 'alerts': {
      const limit = argValue(['--limit', '-n']) || '20';
      const d = await api('GET', `/api/alerts?limit=${limit}`);
      if (!d.alerts.length) return console.log('(暂无告警)');
      for (const a of d.alerts) {
        console.log(`[${a.created_at}] 关键词「${a.keyword}」: ${a.title} (${a.source}, 渠道: ${a.sent_via})`);
      }
      break;
    }
    default:
      console.log(HELP);
  }
}

main().catch((e) => {
  console.error('错误:', e.message);
  process.exit(1);
});
