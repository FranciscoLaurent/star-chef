#!/usr/bin/env node
// build-mp-mock.js
// 从 星厨传承.html 的 `const DATA = {...}`（2507 行起）机械提取 mock 数据
// 输出 miniprogram/data/mock.js（96 厨师 / 32 岗位 / 18 帖子，供招聘、社区、AI 助手使用）
// 用法: node scripts/build-mp-mock.js

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HTML = path.join(ROOT, '星厨传承.html');
const OUT_DIR = path.join(ROOT, 'miniprogram', 'data');
const OUT = path.join(OUT_DIR, 'mock.js');

const html = fs.readFileSync(HTML, 'utf8');
const startMark = 'const DATA = ';
const start = html.indexOf(startMark);
if (start < 0) throw new Error('未找到 const DATA');
const objStart = start + startMark.length;
// DATA 对象内没有独占一行的 "};"（条目都是单行对象），第一个 \n}; 即为收尾
const end = html.indexOf('\n};', objStart);
if (end < 0) throw new Error('未找到 DATA 收尾');
const objText = html.slice(objStart, end + 3); // 含 "};"

// 安全求值：DATA 是纯字面量（含注释），用 Function 包一层即可
const DATA = new Function(`return (${objText.replace(/;\s*$/, '')});`)();

// 师承边在网页端是运行时推导的，这里同样推导一次，免得到小程序再写一遍
const lineage = DATA.chefs.filter(c => c.master)
  .map(c => ({ master: c.master, apprentice: c.id, verified: c.verified }));

const payload = {
  generatedAt: new Date().toISOString(),
  chefs: DATA.chefs,
  jobs: DATA.jobs,
  posts: DATA.posts,
  lineage
};

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
const banner = '// 【生成产物 勿手改】由 scripts/build-mp-mock.js 从 星厨传承.html 的 const DATA 提取\n';
fs.writeFileSync(OUT, banner + 'module.exports = ' + JSON.stringify(payload, null, 1) + ';\n');

console.log(`chefs: ${DATA.chefs.length} | jobs: ${DATA.jobs.length} | posts: ${DATA.posts.length} | lineage: ${lineage.length}`);
console.log(`输出: ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(1)} KB)`);
