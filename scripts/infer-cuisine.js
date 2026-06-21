#!/usr/bin/env node
// 菜系推断脚本：基于 birthplace/city/bio 的地理线索推断菜系
const fs = require('fs');
const path = require('path');

const merged = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'chefs-merged.json'), 'utf8'));

// 地域 → 菜系映射
const REGION_CUISINE = [
  { re: /四川|成都|重庆|自贡|内江|泸州|宜宾|绵阳|德阳|眉山|乐山|遂宁|广元|达州|巴中|南充|广安|雅安|攀枝花|资阳|川/g, cui: '川' },
  { re: /广东|广州|深圳|顺德|潮州|潮汕|汕头|东莞|佛山|惠州|珠海|中山|湛江|客家|广府|香港|澳门/g, cui: '粤' },
  { re: /山东|济南|青岛|胶东|烟台|威海|潍坊|淄博|临沂|济宁|枣庄|曲阜|孔府/g, cui: '鲁' },
  { re: /江苏|扬州|淮安|镇江|苏州|无锡|常州|南京|泰州|徐州|连云港|宿迁|南通|盐城|淮阴|兴化|扬中|泗阳|灌云|射阳|江都|高邮|仪征|靖江|泰兴|如皋|启东|海门|东台|大丰|邳州|新沂/g, cui: '淮扬' },
  { re: /湖南|长沙|湘潭|株洲|衡阳|岳阳|常德|益阳|娄底|邵阳|永州|怀化|湘西|张家界/g, cui: '湘' },
  { re: /浙江|杭州|宁波|温州|绍兴|嘉兴|湖州|金华|台州|丽水|衢州|舟山/g, cui: '浙' },
  { re: /福建|福州|厦门|泉州|漳州|莆田|三明|南平|龙岩|闽南|闽西|闽北/g, cui: '闽' },
  { re: /安徽|合肥|黄山|安庆|芜湖|蚌埠|阜阳|滁州|马鞍|宿州|六安|铜陵|宣城|淮北|淮南/g, cui: '徽' },
  { re: /北京|京城|京师/g, cui: '京' },
  { re: /上海|沪|浦东/g, cui: '沪' },
  { re: /河南|郑州|洛阳|开封|南阳|许昌|新乡|安阳|信阳|周口|商丘|豫/g, cui: '豫' },
  { re: /云南|昆明|大理|丽江|曲靖|玉溪|保山|德宏|滇/g, cui: '滇' },
  { re: /贵州|贵阳|遵义|安顺|六盘水|铜仁|毕节|黔东南|黔西南|黔南/g, cui: '黔' },
  { re: /辽宁|沈阳|大连|鞍山|抚顺|本溪|丹东|锦州|营口|阜新|辽阳|铁岭|朝阳|盘锦|葫芦岛/g, cui: '辽' },
  { re: /陕西|西安|宝鸡|咸阳|渭南|汉中|延安|榆林|安康|陕/g, cui: '陕' },
  { re: /山西|太原|大同|晋中|临汾|运城|长治|忻州|吕梁/g, cui: '晋' },
  { re: /湖北|武汉|荆州|宜昌|襄阳|十堰|孝感|黄石|鄂州|黄冈|咸宁|随州|恩施|楚/g, cui: '鄂' },
  { re: /江西|南昌|九江|景德镇|赣州|上饶|宜春|吉安|抚州|新余|鹰潭|萍乡/g, cui: '赣' },
  { re: /东北|黑龙江|哈尔滨|吉林|长春|沈阳|大连/g, cui: '东北' },
  { re: /新疆|乌鲁木齐|清真|回/g, cui: '清真' },
  { re: /河北|石家庄|保定|唐山|邯郸|廊坊|沧州|衡水|张家口|承德|邢台|肥乡/g, cui: '冀' },
  { re: /海南|海口|三亚|琼/g, cui: '琼' },
  { re: /天津|津/g, cui: '津' },
  { re: /广西|南宁|桂林|柳州|北海/g, cui: '桂' },
];

function inferCuisine(chef) {
  // 优先级：籍贯 > bio前半段（通常描述出身）> 工作地 > bio全文
  const texts = [
    { text: chef.birthplace || '', weight: 1 },           // 籍贯最优先
    { text: (chef.bio || '').slice(0, 100), weight: 2 },  // bio 开头通常说籍贯
    { text: chef.bio || '', weight: 3 },                   // bio 全文
    { text: chef.city || '', weight: 4 },                  // 工作地最后
  ];

  for (const { text, weight } of texts) {
    if (!text) continue;
    for (const { re, cui } of REGION_CUISINE) {
      if (re.test(text)) return cui;
    }
  }
  return null;
}

// 只处理实人缺菜系的
const targets = merged.chefs.filter(c => !c.isPlaceholder && !c.primaryCuisine);
let inferred = 0, stillUnknown = 0;

for (const c of targets) {
  const cui = inferCuisine(c);
  if (cui) {
    c.primaryCuisine = cui;
    c.primaryCuisineInferred = true; // 标记为推断的
    inferred++;
  } else {
    stillUnknown++;
  }
}

// 也处理占位节点
for (const c of merged.chefs) {
  if (c.isPlaceholder && !c.primaryCuisine) {
    // 从 referencedBy 推断（已有逻辑在 merge 中，这里兜底）
    const cui = inferCuisine(c);
    if (cui) {
      c.primaryCuisine = cui;
      c.primaryCuisineInferred = true;
    }
  }
}

console.log(`菜系推断完成: ${inferred} 人推断出菜系, ${stillUnknown} 人仍未知`);

// 重新统计
const stats = {
  totalChefs: merged.chefs.length,
  realChefs: merged.chefs.filter(c => !c.isPlaceholder).length,
  placeholders: merged.chefs.filter(c => c.isPlaceholder).length,
  withMaster: merged.chefs.filter(c => c.master || (c.masters && c.masters.length > 0)).length,
  withCuisine: merged.chefs.filter(c => c.primaryCuisine).length,
  withInferredCuisine: merged.chefs.filter(c => c.primaryCuisineInferred).length,
  withoutCuisine: merged.chefs.filter(c => !c.primaryCuisine).length,
  byCuisine: {},
};

for (const c of merged.chefs) {
  const cui = c.primaryCuisine || '?';
  stats.byCuisine[cui] = (stats.byCuisine[cui] || 0) + 1;
}
stats.byCuisine = Object.fromEntries(Object.entries(stats.byCuisine).sort((a, b) => b[1] - a[1]));

merged.stats = stats;

fs.writeFileSync(path.join(__dirname, '..', 'data', 'chefs-merged.json'), JSON.stringify(merged, null, 2));
console.log('更新后菜系分布 (TOP 15):');
Object.entries(stats.byCuisine).slice(0, 15).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
console.log(`\n实人无菜系: ${stats.realChefs - stats.withCuisine}/${stats.realChefs}`);
