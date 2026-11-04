// 数据准备脚本：从 data/_slim-pinyin.json 提取前端需要的干净数据
// 运行方式：node web/scripts/prepare-web-data.mjs
// 输入：../../data/_slim-pinyin.json（同时有完整 chef 字段 + 拼音索引 + schools）
// 输出：web/public/data/chefs.json（前端 fetch 的文件）
// 输出：web/public/data/schools.json（门派元数据）

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyBioLineage } from './bio-lineage.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../');
const SRC = resolve(ROOT, 'data/_slim-pinyin.json');
const OUT_DIR = resolve(__dirname, '../public/data');
const PORTRAIT_DIR = resolve(__dirname, '../public/portraits');
const PORTRAIT_EXTS = ['jpg', 'jpeg', 'png', 'webp'];

// 头像本地化：只认 public/portraits/{id}.{ext}，抓不到就置 null（不再输出外链）
function localPortrait(id) {
  if (!id) return null;
  for (const ext of PORTRAIT_EXTS) {
    if (existsSync(resolve(PORTRAIT_DIR, `${id}.${ext}`))) return `/portraits/${id}.${ext}`;
  }
  return null;
}

// —— 来源网页：source 字段就是原始资料页 URL；站点名用于 UI 展示 ——
const SITE_NAMES = {
  'cyxh.org': '餐饮名厨文化平台',
  'www.cyxh.org': '餐饮名厨文化平台',
  'mingchu.org': '餐饮名厨文化平台',
  'www.mingchu.org': '餐饮名厨文化平台',
  'baike.baidu.com': '百度百科',
  'baidu.com': '百度百科',
  'canyin88.com': '餐饮88',
  'www.canyin88.com': '餐饮88',
  'sohu.com': '搜狐',
  'www.sohu.com': '搜狐',
  'people.com.cn': '人民网',
  'zhihu.com': '知乎',
  'u-cra.com': '名厨档案',
  'sctu.edu.cn': '四川旅游学院',
  'hbue.edu.cn': '湖北经济学院',
  'hrbcu.edu.cn': '哈尔滨商业大学',
};

function hostOf(url) {
  try { return new URL(url).host.replace(/^www\./, ''); } catch { return null; }
}

function siteNameOf(url) {
  if (!url) return null;
  const host = hostOf(url);
  if (!host) return null;
  return SITE_NAMES[host] || host;
}

function sourceInfo(raw) {
  const url = typeof raw.source === 'string' && /^https?:\/\//i.test(raw.source) ? raw.source : null;
  let site = siteNameOf(url);
  let siteFromPortrait = false;
  if (!site && typeof raw.portrait === 'string' && /^https?:\/\//i.test(raw.portrait)) {
    site = siteNameOf(raw.portrait);
    siteFromPortrait = !!site;
  }
  return { url, site, siteFromPortrait };
}

mkdirSync(OUT_DIR, { recursive: true });

const raw = JSON.parse(readFileSync(SRC, 'utf8'));

// id → 名字 索引（部分记录的 master 字段存的是 id 而非名字）
const idToName = new Map();
for (const c of raw.chefs) {
  if (c.id && c.name) idToName.set(c.id, c.name);
}

const CUISINE_SHORT_MAP = {
  '川菜': '川', '粤菜': '粤', '鲁菜': '鲁', '淮扬菜': '淮扬',
  '湘菜': '湘', '浙菜': '浙', '京菜': '京', '闽菜': '闽',
  '苏菜': '苏', '沪菜': '沪', '徽菜': '徽', '辽菜': '辽',
  '豫菜': '豫', '晋菜': '晋', '陕菜': '陕', '滇菜': '滇',
  '鄂菜': '鄂', '黔菜': '黔', '东北菜': '东北', '清真菜': '清真',
};

function clean(v) {
  if (v === null || v === undefined) return null;
  if (v === '?' || v === '') return null;
  return v;
}

function shortCuisine(c) {
  c = clean(c);
  if (!c) return null;
  if (CUISINE_SHORT_MAP[c]) return CUISINE_SHORT_MAP[c];
  // 已经是短码的直接返回
  if (c.length <= 3) return c;
  return c;
}

function normalizeMaster(rawMaster) {
  // raw master 可能是 "auto-魏兴国-川" 这种字符串，或者 {name,title} 对象，或者是 ID 如 "mp-001"
  if (!rawMaster) return null;
  if (typeof rawMaster === 'string') {
    if (/^[a-z]+-?\d+$/i.test(rawMaster)) return idToName.get(rawMaster) || null; // ID → 解析成真名
    // 提取 "auto-X-Y" 里的 X（名字）
    const m = rawMaster.match(/^auto-(.+?)-.+$/);
    if (m) return m[1];
    return rawMaster;
  }
  if (typeof rawMaster === 'object' && rawMaster.name) return rawMaster.name;
  return null;
}

function normalizeChef(raw) {
  // 跳过 placeholder（占位符没真实价值）
  if (raw.isPlaceholder) return null;

  // 取 master 名字：优先 masters 数组里的第一个
  let masterName = null;
  if (Array.isArray(raw.masters) && raw.masters.length > 0) {
    masterName = raw.masters[0].name || null;
  } else if (raw.master) {
    masterName = normalizeMaster(raw.master);
  }

  // 所有师傅名字（用于搜索师承链）
  const allMasters = [];
  if (Array.isArray(raw.masters)) {
    raw.masters.forEach(m => { if (m.name) allMasters.push(m.name); });
  }
  if (masterName && !allMasters.includes(masterName)) allMasters.unshift(masterName);

  // 拿手菜
  const sigs = Array.isArray(raw.signature) ? raw.signature.filter(Boolean) : [];

  // 年代：只保留有意义的值
  const era = clean(raw.era);
  const eraValid = era && era !== '?';

  const src = sourceInfo(raw);

  return {
    id: raw.id,
    name: raw.name,
    cuisine: shortCuisine(raw.primaryCuisine),
    school: clean(raw.school),
    era: eraValid ? era : null,
    birthYear: clean(raw.birth),
    deathYear: clean(raw.death),
    birthplace: clean(raw.birthplace),
    city: clean(raw.city),
    position: clean(raw.position),
    restaurant: clean(raw.restaurant),
    bio: clean(raw.bio),
    portrait: localPortrait(raw.id),
    signatureDishes: sigs.slice(0, 8),
    master: masterName,
    masters: allMasters,
    titles: Array.isArray(raw.titles) ? raw.titles.filter(Boolean) : [],
    gen: clean(raw.gen),
    pinyin: raw.pinyin ? {
      name: raw.pinyin.name || '',
      initial: raw.pinyin.nameInitial || '',
      compact: raw.pinyin.nameCompact || '',
      all: raw.pinyin.all || '',
    } : null,
    source: clean(raw.source),
    sourceUrl: src.url,
    sourceSite: src.site,
    sourceSiteFromPortrait: src.siteFromPortrait,
  };
}

const normalized = raw.chefs.map(normalizeChef).filter(Boolean);

// —— 师承补全补丁：从简介/结构化提及中补出缺失的师傅实体，并建立师徒边 ——
const patch = applyBioLineage(normalized, idToName);
const chefs = patch.chefs;

console.log(
  `✓ 师承补丁：提及 ${patch.stats.mentions} 条 · 缺失师傅 ` +
  `${patch.stats.structuredMissing + patch.stats.bioOnlyMissing} 条 · ` +
  `新增实体 ${patch.stats.createdEntities} · 新增/补齐师徒边 ${patch.stats.edges}`
);

// 构建反向索引：徒弟列表
const apprenticeMap = new Map(); // masterName → [chefId]
for (const c of chefs) {
  for (const m of c.masters) {
    if (!apprenticeMap.has(m)) apprenticeMap.set(m, []);
    apprenticeMap.get(m).push(c.id);
  }
}

// —— 代际重算（新口径）——
// 规则：丢弃原始 gen 字段（覆盖率仅 61/1415 且存在倒挂），只沿有记录的师徒链推算。
// 基准代 = 有徒弟、且库内无可解析师傅者（该链"可考起点"），记第 1 代；
// 下游 gen = max(所有可解析师傅 gen) + 1（多师傅取最深链，保证徒弟严格晚于任一师傅）；
// 无师承关系者（无师无徒）或环内节点 → gen = null，UI 标"代际待考"，不显示第 N 代。
function computeGen(chefs, apprenticeMap) {
  const byName = new Map();
  for (const c of chefs) if (!byName.has(c.name)) byName.set(c.name, c);
  const resolved = new Map(); // id → [可解析的师傅 chef]
  for (const c of chefs) {
    resolved.set(c.id, (c.masters || [])
      .map(n => byName.get(n))
      .filter(m => m && m.id !== c.id));
  }
  const gen = new Map(); // id → number
  for (const c of chefs) {
    const hasDisciples = (apprenticeMap.get(c.name) || []).length > 0;
    if (hasDisciples && resolved.get(c.id).length === 0) gen.set(c.id, 1); // 基准代
  }
  let changed = true, iter = 0;
  while (changed && iter < 60) {
    changed = false; iter++;
    for (const c of chefs) {
      const known = resolved.get(c.id).map(m => gen.get(m.id)).filter(g => typeof g === 'number');
      if (!known.length) continue;
      const g = Math.max(...known) + 1;
      if (gen.get(c.id) !== g) { gen.set(c.id, g); changed = true; }
    }
  }
  // 环检测：有可解析师傅却始终未赋值 → 师承成环
  const cycles = [];
  for (const c of chefs) {
    if (gen.has(c.id) || !resolved.get(c.id).length) continue;
    const seen = new Set(); let cur = c; let isCycle = false;
    for (let i = 0; i < 30; i++) {
      if (seen.has(cur.id)) { isCycle = true; break; }
      seen.add(cur.id);
      const next = resolved.get(cur.id)[0];
      if (!next) break;
      cur = next;
    }
    cycles.push({ id: c.id, name: c.name, cycle: isCycle });
  }
  // 异常报告（只报告，不篡改）
  const birthInversions = [];
  const youngRoots = [];
  for (const c of chefs) {
    const g = gen.get(c.id);
    if (g === 1 && c.birthYear && c.birthYear >= 1980) {
      youngRoots.push({ name: c.name, cuisine: c.cuisine, birth: c.birthYear });
    }
    if (typeof g !== 'number' || !c.birthYear) continue;
    for (const m of resolved.get(c.id)) {
      if (m.birthYear && c.birthYear <= m.birthYear) {
        birthInversions.push({ chef: c.name, chefBirth: c.birthYear, master: m.name, masterBirth: m.birthYear });
      }
    }
  }
  return { gen, cycles, birthInversions, youngRoots };
}

const genResult = computeGen(chefs, apprenticeMap);
let genAssigned = 0;
for (const c of chefs) {
  const g = genResult.gen.get(c.id);
  c.gen = typeof g === 'number' ? g : null;
  if (typeof g === 'number') genAssigned++;
}
const genDist = {};
for (const c of chefs) if (typeof c.gen === 'number') genDist[c.gen] = (genDist[c.gen] || 0) + 1;
console.log(`✓ 代际重算：可考 ${genAssigned}/${chefs.length} · 待考 ${chefs.length - genAssigned} · 分布 ${JSON.stringify(genDist)}`);
if (genResult.cycles.length) console.log(`  ⚠ 师承成环/断链 ${genResult.cycles.length}：${genResult.cycles.slice(0, 5).map(x => x.name).join('、')}`);
if (genResult.birthInversions.length) console.log(`  ⚠ 生年倒挂（徒弟不晚于师傅）${genResult.birthInversions.length}：${genResult.birthInversions.slice(0, 5).map(x => `${x.chef}(${x.chefBirth})≤${x.master}(${x.masterBirth})`).join('、')}`);
if (genResult.youngRoots.length) console.log(`  ⚠ 1980 后出生的基准代 ${genResult.youngRoots.length}：${genResult.youngRoots.slice(0, 5).map(x => `${x.name}(${x.birth})`).join('、')}`);

// 构建学校（门派）索引
const schools = (raw.schools || []).map(s => ({
  key: s.key,
  name: s.name,
  subName: s.subName,
  en: s.en,
  region: s.region,
  stamp: s.stamp,
  cuisine: s._cuisine || null,
  desc: s.desc,
  styles: s.styles || [],
}));

// 统计（只统计真实档案，补出来的"待补师傅"不计入菜系/门派分布）
const realChefs = chefs.filter(c => !c.derived);
const withSourceUrl = realChefs.filter(c => c.sourceUrl).length;
const sourceSiteCount = {};
for (const c of realChefs) if (c.sourceSite) sourceSiteCount[c.sourceSite] = (sourceSiteCount[c.sourceSite] || 0) + 1;
const sourceTop = Object.entries(sourceSiteCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
console.log(
  `✓ 来源覆盖：有原始网页 ${withSourceUrl}/${realChefs.length}（${(withSourceUrl / realChefs.length * 100).toFixed(1)}%）` +
  ` · 仅站点推断 ${realChefs.filter(c => !c.sourceUrl && c.sourceSite).length}` +
  ` · 未知 ${realChefs.filter(c => !c.sourceSite).length}`
);
console.log(`  来源站点 Top5：${sourceTop.map(([k, v]) => `${k}:${v}`).join(' · ')}`);
const cuisineCounts = {};
const eraCounts = {};
for (const c of realChefs) {
  if (c.cuisine) cuisineCounts[c.cuisine] = (cuisineCounts[c.cuisine] || 0) + 1;
  if (c.era) eraCounts[c.era] = (eraCounts[c.era] || 0) + 1;
}

const schoolsWithCount = schools.map(s => ({
  ...s,
  chefCount: realChefs.filter(c => c.school === s.key).length,
})).sort((a, b) => b.chefCount - a.chefCount);

// 输出
const output = {
  generatedAt: new Date().toISOString(),
  meta: {
    total: realChefs.length,
    withMaster: realChefs.filter(c => c.master).length,
    withPortrait: realChefs.filter(c => c.portrait).length,
    withSignature: realChefs.filter(c => c.signatureDishes.length > 0).length,
    cuisines: Object.keys(cuisineCounts).length,
    schools: schoolsWithCount.filter(s => s.chefCount > 0).length,
    // 补丁统计：由简介/提及推断出的"档案待补"师傅
    derivedChefs: patch.stats.createdEntities,
    bioMentions: patch.stats.mentions,
    inferredEdges: patch.stats.edges,
    sourceWithUrl: withSourceUrl,
    sourceSiteOnly: realChefs.filter(c => !c.sourceUrl && c.sourceSite).length,
    sourceUnknown: realChefs.filter(c => !c.sourceSite).length,
    // 代际新口径：只沿有记录的师徒链推算；null = 代际待考
    genAssigned,
    genPending: chefs.length - genAssigned,
    genDist,
  },
  cuisineCounts: Object.fromEntries(
    Object.entries(cuisineCounts).sort((a, b) => b[1] - a[1])
  ),
  eraCounts,
  apprenticeMap: Object.fromEntries(apprenticeMap),
  schools: schoolsWithCount.filter(s => s.chefCount > 0),
  chefs,
};

writeFileSync(resolve(OUT_DIR, 'chefs.json'), JSON.stringify(output, null, 2), 'utf8');
console.log(`✓ chefs.json: ${chefs.length} 条（真实 ${realChefs.length} + 待补 ${patch.stats.createdEntities}）, ${schoolsWithCount.filter(s => s.chefCount > 0).length} schools`);
console.log(`  withMaster: ${output.meta.withMaster}, withPortrait: ${output.meta.withPortrait}`);
console.log(`  cuisines: ${Object.keys(cuisineCounts).length}, top: ${Object.entries(cuisineCounts).slice(0,5).map(([k,v])=>k+':'+v).join(' ')}`);
