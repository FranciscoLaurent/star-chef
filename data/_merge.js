// v2: 加入 master 占位节点 + 修正菜系归一化（潮→粤/吉→吉林）
const fs = require('fs');
const path = require('path');
const DATA_DIR = 'D:/Study/AI_Space/play-CC/star_chef/data';

const files = [
  { path: 'cuisine-chuan.json',  type: 'cuisine' },
  { path: 'cuisine-yue.json',    type: 'cuisine' },
  { path: 'cuisine-xiang.json',  type: 'cuisine' },
  { path: 'cyxh-chefs.json',     type: 'cyxh' },
  { path: 'cyxh-zishen-batch2.json', type: 'cyxh' },
  { path: 'cyxh-dangdai-batch3.json', type: 'cyxh' },
  { path: 'cyxh-zishen-batch3.json',  type: 'cyxh' },
  { path: 'cyxh-mianhuai-batch2.json', type: 'cyxh' },
  { path: 'cyxh-yuanlao-batch2.json',  type: 'cyxh', optional: true },
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

for (const f of files) {
  if (f.optional && !fs.existsSync(path.join(DATA_DIR, f.path))) continue;
  const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f.path), 'utf8'));
  if (d.schools) allSchools.push(...d.schools.map(s => ({...s, _cuisine: d.cuisine})));
  if (d.crossLinks) allCrossLinks.push(...d.crossLinks);
  for (const c of d.chefs) {
    allChefs.push({ ...c, _source: f.path, _type: f.type });
  }
}

// === 合并相同人物（按名字） ===
const byName = new Map();
for (const c of allChefs) {
  const existing = byName.get(c.name);
  if (!existing) { byName.set(c.name, c); continue; }
  let primary, secondary;
  if (c._type === 'cyxh' && existing._type === 'cuisine') { primary = c; secondary = existing; }
  else if (existing._type === 'cyxh' && c._type === 'cuisine') { primary = existing; secondary = c; }
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
const placeholders = [...allMasterNames].filter(n => !existingNames.has(n));

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
    id: c.id,
    name: c.name,
    isPlaceholder: c.isPlaceholder || false,
    primaryCuisine: normCui,
    primaryCuisineRaw: rawCui !== normCui ? rawCui : undefined,
    secondaryCuisines: c.secondaryCuisines || [],
    school: c.school || null,
    gen: c.gen != null ? c.gen : null,
    master: c.master || null,
    era: c.era || null,
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
  source: '聚合自 cuisine-{chuan,yue,xiang}.json + cyxh-{chefs,zishen-batch2}.json',
  cuisineNormalized: CUISINE_NORMALIZE,
  schools: [...schoolByKey.values()],
  chefs: merged,
  stats,
};

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
