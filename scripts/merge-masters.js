#!/usr/bin/env node
// merge-masters.js
// 汇总所有师承来源，合入 chefs-merged.json
// 来源优先级：bio > page > agent > news（置信度递减）

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const MERGED = path.join(DATA, 'chefs-merged.json');

// 师承来源文件（按优先级）
const SOURCES = [
  { file: 'bio-masters.json',      tag: 'bio',    priority: 4 },
  { file: 'master-backfill.json',  tag: 'page',   priority: 3 },
  { file: 'agent-masters-1.json',  tag: 'agent1', priority: 2 },
  { file: 'agent-masters-2.json',  tag: 'agent2', priority: 2 },
  { file: 'agent-masters-3.json',  tag: 'agent3', priority: 2 },
  { file: 'news-masters.json',     tag: 'news',   priority: 1 },
];

const merged = JSON.parse(fs.readFileSync(MERGED, 'utf8'));
const chefs = merged.chefs;

// 构建反查
const chefByName = new Map();
const chefById = new Map();
for (const c of chefs) {
  if (c.name) chefByName.set(c.name, c);
  if (c.id) chefById.set(c.id, c);
}

// 加载所有源，统一成 {student, master, source, title?} 对
const allPairs = [];
for (const s of SOURCES) {
  const fp = path.join(DATA, s.file);
  if (!fs.existsSync(fp)) {
    console.log('跳过(不存在):', s.file);
    continue;
  }
  const j = JSON.parse(fs.readFileSync(fp, 'utf8'));
  let arr;
  if (Array.isArray(j)) arr = j;
  else if (j.results) arr = j.results;
  else if (j.masters) arr = j.masters;
  else arr = [];

  let count = 0;
  for (const r of arr) {
    // bio-masters / page-masters 格式: {studentName, masterName/masterId, masterInLib}
    if (r.studentName && (r.masterName || r.masterId)) {
      allPairs.push({
        student: r.studentName,
        master: r.masterName,
        masterId: r.masterId,
        source: r.source || s.tag,
        title: r.masterTitle,
        priority: s.priority,
        tag: s.tag
      });
      count++;
    }
    // news-masters / agent-masters 格式: {student, master, source}
    else if (r.student && r.master) {
      allPairs.push({
        student: r.student,
        master: r.master,
        source: r.source || s.tag,
        title: r.title,
        priority: s.priority,
        tag: s.tag
      });
      count++;
    }
    // page-masters 另一种: {name, masters:[{name}], source}
    else if (r.name && r.masters && Array.isArray(r.masters)) {
      for (const m of r.masters) {
        allPairs.push({
          student: r.name,
          master: m.name,
          source: r.source || s.tag,
          title: m.title,
          priority: s.priority,
          tag: s.tag
        });
        count++;
      }
    }
  }
  console.log('加载', s.file, ':', count, '条');
}

console.log('\n总师承对:', allPairs.length);

// 去重：同一 (student, master) 只保留优先级最高的
const pairKey = (s, m) => s + '|' + m;
const bestPair = new Map();
for (const p of allPairs) {
  const key = pairKey(p.student, p.master);
  if (!bestPair.has(key) || bestPair.get(key).priority < p.priority) {
    bestPair.set(key, p);
  }
}
console.log('去重后:', bestPair.size);

// 按 student 聚合（一个学生可能有多个师父）
const byStudent = new Map();
for (const p of bestPair.values()) {
  if (!byStudent.has(p.student)) byStudent.set(p.student, []);
  byStudent.get(p.student).push(p);
}

// 应用到 chefs
let updated = 0, created = 0, skippedHasMaster = 0, skippedNotFound = 0;
const newPlaceholders = []; // 库外师父需建占位

for (const [studentName, pairs] of byStudent) {
  const student = chefByName.get(studentName);
  if (!student) { skippedNotFound++; continue; }
  // 已有 master 跳过（不覆盖）
  if (student.master || (student.masters && student.masters.length > 0)) {
    skippedHasMaster++;
    continue;
  }

  // 处理每个师父
  const masterChips = [];
  for (const p of pairs) {
    let masterChef = chefByName.get(p.master);
    if (!masterChef && p.masterId) masterChef = chefById.get(p.masterId);

    if (masterChef) {
      masterChips.push({ id: masterChef.id, name: masterChef.name, title: p.title });
    } else {
      // 库外师父：创建占位
      const placeholderId = 'mp-master-' + p.student + '-' + p.master;
      masterChips.push({ id: placeholderId, name: p.master, title: p.title, isPlaceholder: true });
      // 记录待建占位
      if (!chefById.has(placeholderId)) {
        newPlaceholders.push({
          id: placeholderId,
          name: p.master,
          isPlaceholder: true,
          primaryCuisine: student.primaryCuisine, // 从徒弟推断
          title: p.title || '师承援引',
          source: p.source,
          bio: null,
          referencedBy: [studentName]
        });
      }
    }
  }

  if (masterChips.length === 0) continue;

  // 主 master：第一个（优先库内）
  const primary = masterChips.find(m => !m.isPlaceholder) || masterChips[0];
  student.master = primary.id;
  student.masters = masterChips.map(m => ({
    name: m.name,
    title: m.title || undefined
  })).filter(x => x.name);
  updated++;
}

console.log('\n=== 应用结果 ===');
console.log('更新厨师(新增师承):', updated);
console.log('跳过(已有master):', skippedHasMaster);
console.log('跳过(学生库外):', skippedNotFound);
console.log('新建占位师父:', newPlaceholders.length);

// 追加占位到 chefs
for (const p of newPlaceholders) {
  if (!chefById.has(p.id)) {
    chefs.push(p);
    chefById.set(p.id, p);
    chefByName.set(p.name, p);
  }
}

// 重新计算 stats
const realChefs = chefs.filter(c => !c.isPlaceholder).length;
const withMaster = chefs.filter(c => c.master || (c.masters && c.masters.length > 0)).length;
const realWithMaster = chefs.filter(c => !c.isPlaceholder && (c.master || (c.masters && c.masters.length > 0))).length;

console.log('\n=== 最终统计 ===');
console.log('总节点:', chefs.length, '(实人', realChefs, '+ 占位', chefs.length - realChefs, ')');
console.log('有师承:', withMaster, '(覆盖率', (withMaster / realChefs * 100).toFixed(1) + '%)');

// 写回
merged.stats = merged.stats || {};
merged.stats.totalChefs = chefs.length;
merged.stats.realChefs = realChefs;
merged.stats.placeholders = chefs.length - realChefs;
merged.stats.withMaster = withMaster;

fs.writeFileSync(MERGED, JSON.stringify(merged, null, 2));
console.log('\n已写回:', MERGED);
