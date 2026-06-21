// 根据审计报告修复所有数据质量问题
const fs = require('fs');
const d = JSON.parse(fs.readFileSync('D:/Study/AI_Space/play-CC/star_chef/data/chefs-merged.json','utf8'));

let fixes = 0;
const report = { badNamesRemoved: 0, badNamesFixed: 0, mastersFixed: 0, cuisinesFixed: 0, duplicatesMerged: 0 };

// === 1. 删除纯头衔/截断/非人名的 chef 条目 ===
const REMOVE_IDS = new Set([
  'cyxh-dangdai-172', // 中国名厨
  'cyxh-dangdai-177', // 中国烹饪名
  'cyxh-dangdai-178', // 中国烹饪大
  'cyxh-dangdai-188', // 中华金厨
  'cyxh-dangdai-386', // 百强技能大
  'mp-111', // 国家名厨
  'mp-119', // 国宝级大师
  'mp-099', // 亚洲大厨
  'mp-096', // 山东省烹饪
  'mp-108', // 著名中国烹
  'mp-104', // 已故国家名
  'mp-121', // 资深中国烹
  'mp-116', // 中国特二级
  'mp-118', // 于国家级烹
  'mp-124', // 中国瓯菜宗
  'mp-120', // 中国饭店协
  'mp-117', // 中华食雕第
  'mp-105', // 知名饮食养
  'mp-125', // 世界川菜名
  'mp-127', // 香港名厨周
  'mp-128', // 新派川菜领
  'mp-114', // 香港国际十
  'mp-113', // 卢华学习川
  'mp-103', // 海鲜姿造创
  'mp-134', // 江苏淮安
  'mp-106', // 宫庭御膳房
  'mp-123', // 故宫御膳房
  'mp-049', // 莫家传人
  'mp-095', // 当代
  'mp-018', // 家学
]);

d.chefs = d.chefs.filter(c => {
  if (REMOVE_IDS.has(c.id)) { report.badNamesRemoved++; fixes++; return false; }
  return true;
});

// === 2. 修复占位中的名称后缀 ===
const NAME_FIX = {
  '李玉伟先生': '李玉伟', '王墨泉先生': '王墨泉', '郑峰先生': '郑峰',
  '居长龙先生': '居长龙', '王荫曾先生': '王荫曾', '唐文斌先生': '唐文斌',
  '石万荣先生': '石万荣', '房泽利先生': '房泽利', '潘晓林先生': '潘晓林',
  '钱以斌先生': '钱以斌', '郑秀生先生': '郑秀生', '潘仕琪先生': '潘仕琪',
  '周朝晖大师': '周朝晖', '郑秀生先': '郑秀生', '郭成全先': '郭成全',
  '刘书军大': '刘书军', '李燕生门下': '李燕生', '郭辉全门下': '郭辉全',
};

d.chefs.forEach(c => {
  if (NAME_FIX[c.name]) { c.name = NAME_FIX[c.name]; report.badNamesFixed++; fixes++; }
});

// === 3. 修复 masters[] 中的垃圾引用 ===
const MASTER_FIX = {
  '李玉伟先生': '李玉伟', '王墨泉先生': '王墨泉', '居长龙先生': '居长龙',
  '王荫曾先生': '王荫曾', '唐文斌先生': '唐文斌', '石万荣先生': '石万荣',
  '房泽利先生': '房泽利', '潘晓林先生': '潘晓林', '钱以斌先生': '钱以斌',
  '郑秀生先生': '郑秀生', '潘仕琪先生': '潘仕琪', '周朝晖大师': '周朝晖',
  '郑秀生先': '郑秀生', '郭成全先': '郭成全', '侯仲华先': '侯仲华',
  '李燕生门下': '李燕生', '郭辉全门下': '郭辉全', '刘书军大': '刘书军',
};

const MASTER_REMOVE = new Set([
  '著名中国烹', '中国饭店协', '山东省烹饪', '国家名厨', '中国烹饪大',
  '中华金厨', '百强技能大', '国宝级大师', '亚洲大厨', '宫庭御膳房',
  '故宫御膳房', '莫家传人', '当代', '家学', '江苏淮安',
  '祖父', '叔叔', '梅兰芳家厨', '齐门（满汉全席）', '罗二', '朱兆',
  '重庆吴氏第三代传人',
]);

// 从 bio 中推断截断 master 的真名
const MASTER_RECOVER = {
  '已故国家名': { searchBio: /陈洛平/, recoverTo: '陈洛平' },
  '资深中国烹': { searchBio: /杨俊/, recoverTo: '杨俊' },
  '中国特二级': { searchBio: /王四荣/, recoverTo: '王四荣' },
  '于国家级烹': { searchBio: /喻永波/, recoverTo: '喻永波' },
  '中国瓯菜宗': { searchBio: /叶国光/, recoverTo: '叶国光' },
  '知名饮食养': { searchBio: /张文彦/, recoverTo: '张文彦' },
  '世界川菜名': { searchBio: /杨俊/, recoverTo: '杨俊' },
  '香港名厨周': { searchBio: /周五根/, recoverTo: '周五根' },
  '新派川菜领': { searchBio: /李佳豪/, recoverTo: '李佳豪' },
  '香港国际十': { searchBio: /施辉/, recoverTo: '施辉' },
  '卢华学习川': { searchBio: /卢华/, recoverTo: '卢华' },
  '海鲜姿造创': { searchBio: /徐卿云/, recoverTo: '徐卿云' },
  '中华食雕第': { searchBio: /赵慧源/, recoverTo: '赵慧源' },
};

d.chefs.forEach(c => {
  if (!c.masters || !c.masters.length) return;
  const before = c.masters.length;

  // 删除垃圾
  c.masters = c.masters.filter(m => !MASTER_REMOVE.has(m.name));

  // 修复名称
  c.masters.forEach(m => {
    if (MASTER_FIX[m.name]) { m.name = MASTER_FIX[m.name]; report.mastersFixed++; fixes++; }
    // 尝试从 bio 恢复
    if (MASTER_RECOVER[m.name]) {
      m.name = MASTER_RECOVER[m.name].recoverTo;
      m.note = '已从截断恢复';
      report.mastersFixed++;
      fixes++;
    }
  });

  if (c.masters.length < before) report.mastersFixed += (before - c.masters.length);
});

// === 4. 合并重复占位节点（同名保留 bio 更详细的） ===
const byName = new Map();
const toMerge = [];
d.chefs.forEach(c => {
  if (c.isPlaceholder && byName.has(c.name)) {
    const existing = byName.get(c.name);
    if ((c.referencedBy||[]).length > (existing.referencedBy||[]).length) {
      toMerge.push(existing.id);
      byName.set(c.name, c);
    } else {
      toMerge.push(c.id);
    }
  } else {
    byName.set(c.name, c);
  }
});

const mergeSet = new Set(toMerge);
d.chefs = d.chefs.filter(c => !mergeSet.has(c.id));
report.duplicatesMerged = mergeSet.size;

// === 5. 修复菜系 ===
const CUISINE_FIX = { '楚': '鄂', '京帮': '京', '京苏': '淮扬', '未知': null, '其他': null };
d.chefs.forEach(c => {
  if (c.primaryCuisine && CUISINE_FIX[c.primaryCuisine] !== undefined) {
    const newCui = CUISINE_FIX[c.primaryCuisine];
    if (newCui !== c.primaryCuisine) {
      c.primaryCuisine = newCui;
      report.cuisinesFixed++;
      fixes++;
    }
  }
});

// === 重新统计 ===
const real = d.chefs.filter(c => !c.isPlaceholder);
const ph = d.chefs.filter(c => c.isPlaceholder);
const hasMaster = real.filter(c => c.master || (c.masters && c.masters.length > 0));
const byCui = {};
d.chefs.forEach(c => { const k = c.primaryCuisine || '?'; byCui[k] = (byCui[k]||0)+1; });

const masterCount = {};
d.chefs.forEach(c => { if (c.masters) c.masters.forEach(m => { masterCount[m.name] = (masterCount[m.name]||0)+1; }); });

d.stats = {
  ...d.stats,
  totalChefs: d.chefs.length,
  realChefs: real.length,
  placeholders: ph.length,
  withMaster: hasMaster.length,
  withCuisine: d.chefs.filter(c => c.primaryCuisine).length,
  withoutCuisine: d.chefs.filter(c => !c.primaryCuisine).length,
  byCuisine: Object.fromEntries(Object.entries(byCui).sort((a,b) => b[1]-a[1])),
  topMastersByApprenticeCount: Object.fromEntries(Object.entries(masterCount).sort((a,b) => b[1]-a[1]).slice(0, 15)),
};

fs.writeFileSync('D:/Study/AI_Space/play-CC/star_chef/data/chefs-merged.json', JSON.stringify(d, null, 2));

console.log('=== 审计修复完成 ===');
console.log('删除坏名占位:', report.badNamesRemoved);
console.log('修复名称:', report.badNamesFixed);
console.log('修复 masters:', report.mastersFixed);
console.log('修复菜系:', report.cuisinesFixed);
console.log('合并重复:', report.duplicatesMerged);
console.log('总修复数:', fixes);
console.log('');
console.log('修复后统计:');
console.log('  总节点:', d.stats.totalChefs);
console.log('  实人:', d.stats.realChefs);
console.log('  占位:', d.stats.placeholders);
console.log('  有师承:', d.stats.withMaster, '(' + (d.stats.withMaster/d.stats.realChefs*100).toFixed(1) + '%)');
console.log('  有菜系:', d.stats.withCuisine);
console.log('  无菜系:', d.stats.withoutCuisine);
console.log('');
console.log('Top Masters:');
Object.entries(d.stats.topMastersByApprenticeCount).slice(0,10).forEach(([n,c]) => console.log('  ' + n + ': ' + c + '徒'));
