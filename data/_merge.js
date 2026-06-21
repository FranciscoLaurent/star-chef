// v2: 加入 master 占位节点 + 修正菜系归一化（潮→粤/吉→吉林）
const fs = require('fs');
const path = require('path');
const DATA_DIR = 'D:/Study/AI_Space/play-CC/star_chef/data';

const files = [
  { path: 'manual-adds.json',       type: 'manual' },
  { path: 'cuisine-chuan.json',  type: 'cuisine' },
  { path: 'cuisine-yue.json',    type: 'cuisine' },
  { path: 'cuisine-xiang.json',  type: 'cuisine' },
  { path: 'cyxh-chefs.json',     type: 'cyxh' },
  { path: 'cyxh-zishen-batch2.json', type: 'cyxh' },
  { path: 'cyxh-dangdai-batch3.json', type: 'cyxh' },
  { path: 'cyxh-zishen-batch3.json',  type: 'cyxh' },
  { path: 'cyxh-mianhuai-batch2.json', type: 'cyxh' },
  { path: 'cyxh-yuanlao-batch2.json',  type: 'cyxh' },
  { path: 'mingchu-elite.json',        type: 'cyxh', optional: true },
  { path: 'placeholder-fills.json',    type: 'fill', optional: true },
  // 后续批次:
  { path: 'cyxh-dangdai-batch4.json',  type: 'cyxh', optional: true },
  { path: 'cyxh-zishen-yuanlao-batch5.json', type: 'cyxh', optional: true },
  { path: 'cyxh-final-batch.json',     type: 'cyxh', optional: true },
  { path: 'academy-chefs.json',        type: 'cyxh', optional: true },
  { path: 'cyxh-crawled.json',         type: 'cyxh', optional: true },
  { path: 'cyxh-crawled2.json',        type: 'cyxh', optional: true },
  { path: 'cyxh-crawled3.json',        type: 'cyxh', optional: true },
  { path: 'cyxh-list-crawled.json',   type: 'cyxh', optional: true },
  { path: 'cyxh-crawled4.json',        type: 'cyxh', optional: true },
  { path: 'cmccx-chefs.json',          type: 'cyxh', optional: true },
  { path: 'cswzg-chefs.json',          type: 'cyxh', optional: true },
  { path: 'cswzg-fills-a.json',        type: 'fill', optional: true },
  { path: 'cswzg-fills-b.json',        type: 'fill', optional: true },
  { path: 'placeholder-fills3.json',   type: 'fill', optional: true },
  { path: 'baike-chefs.json',          type: 'cyxh', optional: true },
  { path: 'wiki-chefs.json',           type: 'cyxh', optional: true },
  { path: 'provincial-chefs.json',     type: 'cyxh', optional: true },
  { path: 'mingchu-org-extras.json',   type: 'cyxh', optional: true },
];

// 菜系归一化（合并同义词 / 去掉"菜"后缀 / 别名）
const CUISINE_NORMALIZE = {
  // 后缀清理（A1 batch3 用了带"菜"后缀格式）
  '川菜': '川', '粤菜': '粤', '鲁菜': '鲁', '湘菜': '湘',
  '浙菜': '浙', '徽菜': '徽', '闽菜': '闽', '京菜': '京', '沪菜': '沪',
  '淮扬菜': '淮扬', '潮汕菜': '粤', '苏菜': '淮扬', '赣菜': '赣',
  '豫菜': '豫', '晋菜': '晋', '陕菜': '陕', '黔菜': '黔', '滇菜': '滇',
  '辽菜': '辽', '鄂菜': '鄂', '湖北菜': '鄂',
  // 旧映射保持
  '潮': '粤',
  '辽（盛京满汉全席）': '辽',
  '钓鱼台菜': '国宴',
  '苏': '淮扬',
  '面点': '点心', '面食': '点心',
  '新疆清真': '清真',
  '吉': '东北',
  // 其他工种归类
  '食雕': '工艺', '药膳': '药膳', '烤鸭': '京',
  '热菜': null, '融合菜': null, '其他': null, // 抹除模糊分类
  '西餐': '西餐', '法餐': '西餐', '西点': '西餐',
};

const allChefs = [];
const allSchools = [];
const allCrossLinks = [];

// 垃圾名字过滤器（源头阻断爬虫解析错误）
const NAME_BLACKLIST = new Set([
  '中国名厨','中华名厨','国家名厨','中国烹饪大师','中国烹饪名师',
  '中国厨师名','中国名厨人','中国烹饪名','中国烹饪大','中华金厨',
  '百强技能大','国宝级大师','亚洲大厨','顺德十大名厨',
  '祖父','叔叔','家学','当代','梅兰芳家厨','齐门（满汉全席）',
  '宫庭御膳房','故宫御膳房','莫家传人',
  '著名中国烹','中国饭店协','山东省烹饪','资深中国烹',
  '中国特二级','于国家级烹','中国瓯菜宗','知名饮食养',
  '世界川菜名','香港名厨周','新派川菜领','香港国际十',
  '卢华学习川','海鲜姿造创','中华食雕第','已故国家名',
  '重庆吴氏第三代传人','江苏淮安','高美琼大师','湘菜名师吴',
]);
function isGarbageName(name) {
  if (!name || name.length < 2 || name.length > 5) return true;
  if (NAME_BLACKLIST.has(name)) return true;
  if (/^(中国|中华|国家|国宝|亚洲|世界|香港|山东|江苏|广东)(厨师|名厨|烹饪|餐饮|大师|大厨|食雕)/.test(name)) return true;
  if (/^(川|粤|鲁|淮扬|湘|浙|徽|闽|京|沪|晋|豫|黔|滇|辽|鄂|陕|赣|清真|国宴|宫廷|东北|西北)?(菜|帮)?(大师|名师|泰斗|名厨|宗师)[一-龥]{0,2}$/.test(name)) return true;
  if (/先生$|大师$|门下$/.test(name)) return true;
  if (!/[一-龥]/.test(name)) return true;
  return false;
}

for (const f of files) {
  if (f.optional && !fs.existsSync(path.join(DATA_DIR, f.path))) continue;
  const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f.path), 'utf8'));
  if (d.schools) allSchools.push(...d.schools.map(s => ({...s, _cuisine: d.cuisine})));
  if (d.crossLinks) allCrossLinks.push(...d.crossLinks);
  for (const c of d.chefs) {
    if (isGarbageName(c.name)) continue;
    allChefs.push({ ...c, _source: f.path, _type: f.type });
  }
}

// === 合并相同人物（按名字） ===
const byName = new Map();
for (const c of allChefs) {
  const existing = byName.get(c.name);
  if (!existing) { byName.set(c.name, c); continue; }
  let primary, secondary;
  // 优先级: fill (subagent验证) > cuisine (手工策展) > cyxh (爬虫)
  const TYPE_PRIORITY = { manual: 5, fill: 4, cuisine: 3, cyxh: 2, placeholder: 1 };
  const cP = TYPE_PRIORITY[c._type] || 0;
  const eP = TYPE_PRIORITY[existing._type] || 0;
  if (cP > eP || (cP === eP && (c.bio?.length||0) > (existing.bio?.length||0))) { primary = c; secondary = existing; }
  else { primary = existing; secondary = c; }
  const merged = {
    ...primary,
    school: primary.school || secondary.school,
    master: primary.master || secondary.master,
    gen: primary.gen != null ? primary.gen : secondary.gen,
    era: primary.era || secondary.era,
    restaurant: primary.restaurant || primary.currentRole || secondary.restaurant,
    position: primary.position || secondary.position,
    source: primary.url || primary.source || secondary.source,
    _mergedFrom: [primary._source, secondary._source],
  };
  byName.set(c.name, merged);
}

// === 收集所有被引用的师承名字 → 占位节点 ===
const allMasterNames = new Set();
for (const c of byName.values()) {
  if (c.masters) {
    for (const m of c.masters) allMasterNames.add(m.name);
  }
}
// 已存在节点的名字
const existingNames = new Set(byName.keys());
// 占位 = 被引用但不在数据集里的师承
const placeholders = [...allMasterNames].filter(n => !existingNames.has(n) && !isGarbageName(n));

// 为占位创建简单节点（标记 isPlaceholder: true，仅含名字+被多少人引用）
let placeholderIdCounter = 1;
for (const name of placeholders) {
  const referencedBy = [];
  for (const c of byName.values()) {
    if (c.masters && c.masters.some(m => m.name === name)) referencedBy.push(c.name);
  }
  // 推断流派 / 菜系：取被引用者的众数
  const cuisineVotes = {};
  for (const studentName of referencedBy) {
    const stu = byName.get(studentName);
    if (stu?.primaryCuisine) cuisineVotes[stu.primaryCuisine] = (cuisineVotes[stu.primaryCuisine]||0)+1;
  }
  const inferredCuisine = Object.entries(cuisineVotes).sort((a,b)=>b[1]-a[1])[0]?.[0];
  // 从徒弟原文里抽 title
  let title = '';
  for (const studentName of referencedBy) {
    const stu = byName.get(studentName);
    const m = stu?.masters?.find(x => x.name === name);
    if (m?.title) { title = m.title; break; }
  }
  byName.set(name, {
    id: `mp-${String(placeholderIdCounter++).padStart(3, '0')}`,
    name,
    isPlaceholder: true,
    primaryCuisine: inferredCuisine || null,
    secondaryCuisines: [],
    school: null,
    gen: null,
    master: null,
    era: null,
    title,
    bio: title ? `${title}。被 ${referencedBy.length} 位徒弟援引为师承。` : `被 ${referencedBy.length} 位徒弟援引为师承。`,
    referencedBy,
    _source: 'placeholder-from-masters[]',
    _type: 'placeholder',
  });
}

console.log(`After placeholder creation: ${byName.size} nodes (${placeholders.length} placeholders added)`);

// === 师承反查 → masterIds + masterId（单数主链） ===
const idToName = new Map();
const nameToId = new Map();
for (const c of byName.values()) {
  if (c.id) {
    idToName.set(c.id, c.name);
    nameToId.set(c.name, c.id);
  }
}

const merged = [];
for (const c of byName.values()) {
  // 归一化菜系
  const rawCui = c.primaryCuisine || c.cuisine || null;
  const normCui = rawCui ? (CUISINE_NORMALIZE[rawCui] || rawCui) : null;

  const out = {
    id: c.id || `auto-${c.name}-${normCui || 'NA'}`,
    name: c.name,
    isPlaceholder: c.isPlaceholder || false,
    primaryCuisine: normCui,
    primaryCuisineRaw: rawCui !== normCui ? rawCui : undefined,
    secondaryCuisines: c.secondaryCuisines || [],
    school: c.school || null,
    gen: c.gen != null ? c.gen : null,
    master: c.master || null,
    era: c.era || (c.birth && c.birth > 1960 ? '当代' : c.birth && c.birth >= 1912 ? '近代' : c.birth ? '清末民初' : c.death ? '近代' : null),
    birth: c.birth != null ? c.birth : null,
    death: c.death != null ? c.death : null,
    gender: c.gender || null,
    ethnicity: c.ethnicity || null,
    birthplace: c.birthplace || null,
    education: c.education || null,
    titles: c.titles || null,
    title: c.title || null,
    currentRole: c.currentRole || c.restaurant || null,
    restaurant: c.restaurant || c.currentRole || null,
    position: c.position || null,
    city: c.city || null,
    signature: c.signature || [],
    signatureDetails: c.signatureDetails || null,
    experiences: c.experiences || null,
    portrait: c.portrait || null,
    source: c.source || c.url || null,
    bio: c.bio || null,
    referencedBy: c.referencedBy || null,
    _origin: c._source || null,
  };

  // 师承反查：masters[] 的每个名字尝试匹配 id（包括 placeholder）
  if (c.masters && c.masters.length > 0) {
    out.masters = c.masters;
    out.masterIds = c.masters
      .map(m => nameToId.get(m.name) || null)
      .filter(Boolean);
    // 如果没有 master 但有 masterIds，把第一个作为主师承
    if (!out.master && out.masterIds.length > 0) {
      out.master = out.masterIds[0];
    }
  }

  // 清理 masters[] 中的垃圾引用和名称后缀
  if (out.masters && out.masters.length > 0) {
    const MASTER_FIX = {
      '郑峰先生':'郑峰','郑秀生先':'郑秀生','郑秀生先生':'郑秀生',
      '高美琼大师':'高美琼','王墨泉先生':'王墨泉',
    };
    const MASTER_REMOVE = new Set(['著名中国烹','中国饭店协','山东省烹饪','国家名厨','资深中国烹','中国特二级','于国家级烹','中国瓯菜宗','知名饮食养','世界川菜名','香港名厨周','新派川菜领','香港国际十','卢华学习川','海鲜姿造创','中华食雕第','已故国家名','宫庭御膳房','故宫御膳房','莫家传人','当代','祖父','叔叔','家学','亚洲大厨','国宝级大师','重庆吴氏第三代传人','江苏淮安']);
    out.masters = out.masters
      .filter(m => !MASTER_REMOVE.has(m.name) && !isGarbageName(m.name))
      .map(m => { if (MASTER_FIX[m.name]) m.name = MASTER_FIX[m.name]; return m; });
    if (out.masters.length === 0) out.masters = undefined;
  }

  merged.push(out);
}

// === 统计 ===
const stats = {
  totalChefs: merged.length,
  realChefs: merged.filter(c => !c.isPlaceholder).length,
  placeholders: merged.filter(c => c.isPlaceholder).length,
  withMaster: merged.filter(c => c.master || (c.masters && c.masters.length > 0)).length,
  withMasterId: merged.filter(c => c.master).length,
  withSchool: merged.filter(c => c.school).length,
  withSignature: merged.filter(c => c.signature && c.signature.length > 0).length,
  withBirth: merged.filter(c => c.birth).length,
  withPortrait: merged.filter(c => c.portrait).length,
  byCuisine: {},
  byEra: {},
  topMastersByApprenticeCount: {},
};

const apprenticeCount = {};
for (const c of merged) {
  const cui = c.primaryCuisine || '?';
  stats.byCuisine[cui] = (stats.byCuisine[cui] || 0) + 1;
  const era = c.era || (c.death ? '近代' : c.birth && c.birth > 1960 ? '当代' : '?');
  stats.byEra[era] = (stats.byEra[era] || 0) + 1;
  if (c.master) {
    const masterName = idToName.get(c.master) || c.master;
    apprenticeCount[masterName] = (apprenticeCount[masterName] || 0) + 1;
  }
  if (c.masters) {
    for (const m of c.masters) {
      apprenticeCount[m.name] = (apprenticeCount[m.name] || 0) + 1;
    }
  }
}
stats.topMastersByApprenticeCount = Object.fromEntries(
  Object.entries(apprenticeCount).sort((a, b) => b[1] - a[1]).slice(0, 15)
);
stats.byCuisine = Object.fromEntries(Object.entries(stats.byCuisine).sort((a, b) => b[1] - a[1]));

// === 流派去重 ===
const schoolByKey = new Map();
for (const s of allSchools) {
  const key = s.key + '__' + s._cuisine;
  if (!schoolByKey.has(key)) schoolByKey.set(key, s);
}

const result = {
  generatedAt: new Date().toISOString(),
  source: '聚合自 cuisine-{chuan,yue,xiang}.json + cyxh-{chefs,zishen-batch2}.json + 师承源',
  cuisineNormalized: CUISINE_NORMALIZE,
  schools: [...schoolByKey.values()],
  chefs: merged,
  stats,
};

// === 师承合并：从外部师承源文件注入 master 关系 ===
// 避免被 _merge 覆盖，在写文件前合并
(function mergeMasterSources(){
  const MASTER_SOURCES = [
    { file: 'bio-masters.json',      tag: 'bio',    priority: 4 },
    { file: 'master-backfill.json',  tag: 'page',   priority: 3 },
    { file: 'agent-masters-1.json',  tag: 'agent1', priority: 2 },
    { file: 'agent-masters-2.json',  tag: 'agent2', priority: 2 },
    { file: 'agent-masters-3.json',  tag: 'agent3', priority: 2 },
    { file: 'news-masters.json',     tag: 'news',   priority: 1 },
  ];
  const byName = new Map();
  const byId = new Map();
  for (const c of merged) {
    if (c.name) byName.set(c.name, c);
    if (c.id) byId.set(c.id, c);
  }
  const allPairs = [];
  for (const s of MASTER_SOURCES) {
    const fp = path.join(DATA_DIR, s.file);
    if (!fs.existsSync(fp)) continue;
    let j;
    try { j = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch(e) { continue; }
    const arr = Array.isArray(j) ? j : (j.results || j.masters || []);
    for (const r of arr) {
      if (r.studentName && (r.masterName || r.masterId)) {
        allPairs.push({ student: r.studentName, master: r.masterName, masterId: r.masterId, source: r.source || s.tag, title: r.masterTitle, priority: s.priority });
      } else if (r.student && r.master) {
        allPairs.push({ student: r.student, master: r.master, source: r.source || s.tag, title: r.title, priority: s.priority });
      } else if (r.name && r.masters && Array.isArray(r.masters)) {
        for (const m of r.masters) {
          allPairs.push({ student: r.name, master: m.name, source: r.source || s.tag, title: m.title, priority: s.priority });
        }
      }
    }
  }
  // 去重：同一 (student, master) 取最高优先级
  const bestPair = new Map();
  for (const p of allPairs) {
    const key = p.student + '|' + p.master;
    if (!bestPair.has(key) || bestPair.get(key).priority < p.priority) bestPair.set(key, p);
  }
  // 按 student 聚合
  const byStudent = new Map();
  for (const p of bestPair.values()) {
    if (!byStudent.has(p.student)) byStudent.set(p.student, []);
    byStudent.get(p.student).push(p);
  }
  let updated = 0, newPlaceholders = 0, newStudentPlaceholders = 0;
  for (const [studentName, pairs] of byStudent) {
    let student = byName.get(studentName);
    // 学生不在库内但师父在库内 → 为学生建占位（徒弟节点扩展师承网络）
    if (!student) {
      const pairWithLibMaster = pairs.find(p => byName.has(p.master));
      if (!pairWithLibMaster) continue;
      const sid = 'mp-student-' + studentName + '-' + pairWithLibMaster.master;
      student = { id: sid, name: studentName, isPlaceholder: true,
        primaryCuisine: (byName.get(pairWithLibMaster.master)||{}).primaryCuisine || '其他',
        title: pairs[0].title || '师门弟子', source: pairs[0].source, bio: null };
      merged.push(student);
      byName.set(studentName, student);
      byId.set(sid, student);
      newStudentPlaceholders++;
    }
    if (student.master || (student.masters && student.masters.length > 0)) continue;
    const chips = [];
    for (const p of pairs) {
      let mc = byName.get(p.master);
      if (!mc && p.masterId) mc = byId.get(p.masterId);
      if (mc) {
        chips.push({ id: mc.id, name: mc.name, title: p.title });
      } else {
        const pid = 'mp-master-' + studentName + '-' + p.master;
        chips.push({ id: pid, name: p.master, title: p.title, isPlaceholder: true });
        if (!byId.has(pid)) {
          merged.push({ id: pid, name: p.master, isPlaceholder: true, primaryCuisine: student.primaryCuisine, title: p.title || '师承援引', source: p.source, bio: null, referencedBy: [studentName] });
          byId.set(pid, merged[merged.length - 1]);
          byName.set(p.master, merged[merged.length - 1]);
          newPlaceholders++;
        }
      }
    }
    if (chips.length === 0) continue;
    const primary = chips.find(m => !m.isPlaceholder) || chips[0];
    student.master = primary.id;
    student.masters = chips.map(m => ({ name: m.name, title: m.title || undefined })).filter(x => x.name);
    updated++;
  }
  // 重算 stats
  stats.totalChefs = merged.length;
  stats.realChefs = merged.filter(c => !c.isPlaceholder).length;
  stats.placeholders = stats.totalChefs - stats.realChefs;
  stats.withMaster = merged.filter(c => c.master || (c.masters && c.masters.length > 0)).length;
  console.log(`\n=== 师承合并 ===`);
  console.log(`师承源对: ${bestPair.size} · 更新厨师: ${updated} · 新建占位师父: ${newPlaceholders} · 新建占位学生: ${newStudentPlaceholders}`);
  console.log(`有师承: ${stats.withMaster} / 实人 ${stats.realChefs} (${(stats.withMaster/stats.realChefs*100).toFixed(1)}%)`);
})();

fs.writeFileSync(path.join(DATA_DIR, 'chefs-merged.json'), JSON.stringify(result, null, 2));
console.log('\n=== 合并完成 ===');
console.log(`总节点数: ${stats.totalChefs} (实人 ${stats.realChefs} + 占位 ${stats.placeholders})`);
console.log(`含师承字段: ${stats.withMaster}`);
console.log(`可反查 master ID 的: ${stats.withMasterId}`);
console.log(`含流派: ${stats.withSchool}`);
console.log(`含拿手菜: ${stats.withSignature}`);
console.log(`流派定义数: ${result.schools.length}`);
console.log(`\nTop 15 被引用为师承的（带徒最多的）:`);
Object.entries(stats.topMastersByApprenticeCount).forEach(([n, c]) => console.log(`  ${n}: ${c} 徒`));
console.log(`\n菜系分布:`);
Object.entries(stats.byCuisine).forEach(([n, c]) => console.log(`  ${n}: ${c}`));
console.log(`\n年代分布:`);
Object.entries(stats.byEra).forEach(([n, c]) => console.log(`  ${n}: ${c}`));
