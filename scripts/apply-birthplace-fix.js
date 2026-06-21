// scripts/apply-birthplace-fix.js
// 一次性脚本：把 data/birthplace-verify-{1-4}.json 的核实结果应用到 chefs-merged.json
// 同时重新生成 _slim.json（去掉部分字段 + 压缩）
// 用法: node scripts/apply-birthplace-fix.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');

const MERGED = JSON.parse(fs.readFileSync(path.join(DATA, 'chefs-merged.json'), 'utf8'));

const verifyFiles = [
  'birthplace-verify-1.json',
  'birthplace-verify-2.json',
  'birthplace-verify-3.json',
  'birthplace-verify-4.json',
];

const results = [];
for (const f of verifyFiles) {
  const v = JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
  results.push(...v.results);
}

console.log(`共加载 ${results.length} 条核实结果`);

const byName = new Map();
for (const r of results) {
  if (byName.has(r.name)) {
    console.warn(`  警告: 重名 ${r.name}，后者覆盖前者`);
  }
  byName.set(r.name, r);
}

const stats = { matched: 0, fixed: 0, nulled: 0, kept: 0, notFound: 0 };

for (const chef of MERGED.chefs) {
  const r = byName.get(chef.name);
  if (!r) { stats.notFound++; continue; }
  stats.matched++;
  if (r.action === 'fix') {
    chef.birthplace = r.newBirthplace;
    stats.fixed++;
  } else if (r.action === 'null') {
    chef.birthplace = null;
    stats.nulled++;
  } else if (r.action === 'keep') {
    stats.kept++;
  }
}

console.log('\n=== 应用结果 ===');
console.log(`matched: ${stats.matched}`);
console.log(`  fix: ${stats.fixed}`);
console.log(`  null: ${stats.nulled}`);
console.log(`  keep: ${stats.kept}`);
console.log(`notFound: ${stats.notFound}`);

// 写回 chefs-merged.json
fs.writeFileSync(
  path.join(DATA, 'chefs-merged.json'),
  JSON.stringify(MERGED, null, 2)
);
console.log('\nchefs-merged.json 已更新');

// 重新生成 _slim.json（去掉 ethnicity/education/title/signatureDetails/experiences/_origin，压缩）
const SLIM_FIELDS = [
  'id','name','isPlaceholder','primaryCuisine','secondaryCuisines','school',
  'gen','master','masters','masterIds','era','birth','death','birthplace','gender','titles',
  'currentRole','restaurant','position','city','signature','portrait',
  'source','bio','referencedBy'
];

const slim = {
  schools: MERGED.schools,
  chefs: MERGED.chefs.map(c => {
    const o = {};
    for (const k of SLIM_FIELDS) o[k] = c[k];
    return o;
  }),
  stats: MERGED.stats,
};

fs.writeFileSync(
  path.join(DATA, '_slim.json'),
  JSON.stringify(slim)
);
console.log('_slim.json 已重新生成');
