#!/usr/bin/env node
// 数据清理脚本：删除假名字、修正截断文本、清理占位后缀
const fs = require('fs');
const path = require('path');

const d = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'chefs-merged.json'), 'utf8'));

// === 1. 删除纯头衔/截断文本条目（非人名） ===
const GARBAGE_NAMES = new Set([
  '中国名厨', '中华金厨', '国家名厨', '国宝级大师', '亚洲大厨',
  '顺德十大名厨', '中国烹饪大', '百强技能大', '著名中国烹',
  '中国饭店协', '山东省烹饪', '祖父', '叔叔', '梅兰芳家厨',
  '齐门（满汉全席）', '罗二', '朱兆',
]);

// === 2. 修正占位节点中带后缀的名字 ===
const FIX_SUFFIX = {
  '王墨泉先生': '王墨泉',
  '居长龙先生': '居长龙',
  '王荫曾先生': '王荫曾',
  '石万荣先生': '石万荣',
  '房泽利先生': '房泽利',
  '潘晓林先生': '潘晓林',
  '钱以斌先生': '钱以斌',
  '郑秀生先生': '郑秀生',
  '周朝晖大师': '周朝晖',
  '潘仕琪先生': '潘仕琪',
  '唐文斌先生': '唐文斌',
  '郭成全先': '郭成全',
  '刘书军大': '刘书军',
  '郑峰先生': '郑峰',
  '郑秀生先': '郑秀生',
};

let removedGarbage = 0;
let fixedSuffix = 0;

// 删除垃圾
const before = d.chefs.length;
d.chefs = d.chefs.filter(c => {
  if (GARBAGE_NAMES.has(c.name)) {
    removedGarbage++;
    return false;
  }
  return true;
});

// 修正后缀
for (const c of d.chefs) {
  if (FIX_SUFFIX[c.name]) {
    c.name = FIX_SUFFIX[c.name];
    fixedSuffix++;
  }
}

// 去重（修复后缀后可能产生重名）
const seen = new Map();
const duplicates = [];
for (const c of d.chefs) {
  const existing = seen.get(c.name);
  if (existing) {
    // 保留信息更丰富的
    if ((c.bio?.length||0) > (existing.bio?.length||0) ||
        (c.primaryCuisine && !existing.primaryCuisine) ||
        (c.masters?.length||0) > (existing.masters?.length||0)) {
      duplicates.push(existing.name);
      seen.set(c.name, c);
    } else {
      duplicates.push(c.name);
    }
  } else {
    seen.set(c.name, c);
  }
}
d.chefs = [...seen.values()];

console.log('删除垃圾条目:', removedGarbage);
console.log('修正后缀:', fixedSuffix);
console.log('合并重复:', duplicates.length, duplicates.slice(0,10));

// === 3. 重新统计 ===
const real = d.chefs.filter(c => !c.isPlaceholder);
const ph = d.chefs.filter(c => c.isPlaceholder);

// 更新 stats
const byCuisine = {};
const byEra = {};
const apprenticeCount = {};
for (const c of d.chefs) {
  const cui = c.primaryCuisine || '?';
  byCuisine[cui] = (byCuisine[cui]||0) + 1;
  const era = c.era || (c.death ? '近代' : c.birth && c.birth > 1960 ? '当代' : '?');
  byEra[era] = (byEra[era]||0) + 1;
  if (c.masters) {
    for (const m of c.masters) {
      apprenticeCount[m.name] = (apprenticeCount[m.name]||0) + 1;
    }
  }
}

d.stats = {
  ...d.stats,
  totalChefs: d.chefs.length,
  realChefs: real.length,
  placeholders: ph.length,
  withMaster: d.chefs.filter(c => c.master || (c.masters && c.masters.length > 0)).length,
  withCuisine: d.chefs.filter(c => c.primaryCuisine).length,
  withoutCuisine: d.chefs.filter(c => !c.primaryCuisine).length,
  withPortrait: d.chefs.filter(c => c.portrait).length,
  byCuisine: Object.fromEntries(Object.entries(byCuisine).sort((a,b) => b[1]-a[1])),
  byEra,
  topMastersByApprenticeCount: Object.fromEntries(
    Object.entries(apprenticeCount).sort((a,b) => b[1]-a[1]).slice(0, 15)
  ),
};

fs.writeFileSync(path.join(__dirname, '..', 'data', 'chefs-merged.json'), JSON.stringify(d, null, 2));

console.log('\n=== 清理后统计 ===');
console.log('总节点:', d.stats.totalChefs);
console.log('实人:', d.stats.realChefs);
console.log('占位:', d.stats.placeholders);
console.log('有菜系:', d.stats.withCuisine);
console.log('无菜系:', d.stats.withoutCuisine);
console.log('有师承:', d.stats.withMaster);
console.log('\nTop 10 Masters:');
Object.entries(d.stats.topMastersByApprenticeCount).slice(0,10).forEach(([n,c]) => console.log(`  ${n}: ${c}徒`));
