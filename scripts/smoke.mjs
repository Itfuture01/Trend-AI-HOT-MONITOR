// 冒烟测试：逐个采集源实测拉取，打印各源条数/错误
import { SOURCES, searchAll, hotAll } from '../server/collectors/index.js';

const kw = process.argv[2] || 'GPT-5';

function report(label, { items, errors }) {
  console.log(`\n=== ${label}：共 ${items.length} 条，${errors.length} 个源失败 ===`);
  for (const s of SOURCES) {
    const n = items.filter((i) => i.source === s.name).length;
    const err = errors.find((e) => e.startsWith(s.name + ':'));
    console.log(`  ${n > 0 ? '✅' : '—'} ${s.name}: ${n} 条${err ? '   ❌ ' + err : ''}`);
  }
}

console.log('### 热点榜测试（hotAll）###');
const hot = await hotAll();
report('热点榜', hot);
if (hot.items.length) {
  console.log('\n  样例：');
  for (const it of hot.items.slice(0, 3)) console.log(`    [${it.source}] ${it.title.slice(0, 50)}`);
}

console.log(`\n### 关键词搜索测试（searchAll "${kw}"）###`);
const res = await searchAll(kw);
report('关键词搜索', res);
if (res.items.length) {
  console.log('\n  样例：');
  for (const it of res.items.slice(0, 5)) console.log(`    [${it.source}] ${it.title.slice(0, 60)}`);
}

console.log('\n完成。');
