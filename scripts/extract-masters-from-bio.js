#!/usr/bin/env node
// extract-masters-from-bio.js
// 阶段 1：从 chefs-merged.json 的 bio 文本提取师承关系
// 零网络成本，纯正则挖掘

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MERGED = path.join(ROOT, 'data', 'chefs-merged.json');
const OUT = path.join(ROOT, 'data', 'bio-masters.json');

const data = JSON.parse(fs.readFileSync(MERGED, 'utf8'));
const chefs = data.chefs;

// 姓氏集（复用 master-backfill.js）
const SURNAMES = new Set('王李张刘陈杨黄赵吴周徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭曾肖田董袁潘于蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦付方白邹孟熊秦邱江尹薛闫段雷侯龙史陶黎贺顾毛郝龚邵万钱严覃武戴莫孔向汤裴温和耿冷牛奎欧司诸上皇令慕殷常乔房'.split(''));

// 过滤词（菜名/地名/职务等易误判）
const BAD_WORDS = new Set([
  // 职务/头衔词
  '菜协','院校','店厅','团司','牌列','堂理','主席','部局','科秘','家委','大师','名厨','泰斗','宗师','先生','师傅','师父','老师','祖师','弟子','徒弟','门人','门下','技艺','技术','流派','菜系',
  // 地理词（易被误判为姓名）
  '上游','法国','意大利','西班牙','德国','澳洲','美国','日本','韩国','英国','湖南','江苏','浙江','广东','四川','山东','山西','陕西','河南','河北','安徽','福建','江西','云南','贵州','辽宁','吉林','黑龙江','湖北','广西','海南','甘肃','青海','宁夏','新疆','西藏','内蒙','北京','上海','天津','重庆','南京','苏州','无锡','常州','扬州','镇江','南通','盐城','徐州','淮安','连云港','宿迁','泰州','杭州','宁波','温州','绍兴','嘉兴','湖州','金华','衢州','舟山','台州','丽水','合肥','芜湖','蚌埠','淮南','马鞍山','淮北','铜陵','安庆','黄山','滁州','阜阳','宿州','六安','亳州','池州','宣城','广州','深圳','珠海','汕头','佛山','韶关','湛江','肇庆','江门','茂名','惠州','梅州','汕尾','河源','阳江','清远','东莞','中山','潮州','揭阳','云浮','成都','自贡','攀枝花','泸州','德阳','绵阳','广元','遂宁','内江','乐山','南充','眉山','宜宾','广安','达州','雅安','巴中','资阳','济南','青岛','淄博','枣庄','东营','烟台','潍坊','济宁','泰安','威海','日照','莱芜','临沂','德州','聊城','滨州','菏泽','太原','大同','阳泉','长治','晋城','朔州','晋中','运城','忻州','临汾','吕梁','西安','铜川','宝鸡','咸阳','渭南','延安','汉中','榆林','安康','商洛','郑州','开封','洛阳','平顶山','安阳','鹤壁','新乡','焦作','濮阳','许昌','漯河','三门峡','南阳','商丘','信阳','周口','驻马店','武汉','黄石','十堰','宜昌','襄阳','鄂州','荆门','孝感','荆州','黄冈','咸宁','随州','恩施','长沙','株洲','湘潭','衡阳','邵阳','岳阳','常德','张家界','益阳','郴州','永州','怀化','娄底','湘西','广州','香港','澳门','台湾','常胜','江苏','淮安',
  // 其他误判词
  '门下','常胜','鲍鱼','亲传'
]);

// 师承关键词 + 姓名提取模式
// 策略：只匹配"师承/师从/拜师 + X大师/先生/师傅"这种 X 紧跟敬称的高置信模式
// X 必须是 2-4 字中文姓名，且后接敬称词作为锚点
const HONOR = '大师|先生|师傅|师父|名厨|泰斗|宗师|巨匠|前辈';
const PATTERNS = [
  // 师承 X 大师 / 师承于 X 大师
  new RegExp('师承[于了]?\\s*([一-龥]{2,4})(' + HONOR + ')', 'g'),
  // 师从 X 大师 / 师从于 X 大师
  new RegExp('师从[于了]?\\s*([一-龥]{2,4})(' + HONOR + ')', 'g'),
  // 拜 X 大师 为师 / 拜师 X 大师 / 拜入 X 大师门下
  new RegExp('拜[师事]?\\s*([一-龥]{2,4})(' + HONOR + ')(?:为师|门下)?', 'g'),
  // 学艺于 X 大师 / 受教于 X 大师 / 投师 X 大师
  new RegExp('(?:学艺于|受教于|投师|从师)\\s*([一-龥]{2,4})(' + HONOR + ')', 'g'),
  // 随 X 大师 学艺/学厨
  new RegExp('随\\s*([一-龥]{2,4})(' + HONOR + ')(?:学艺|学厨|学菜|习艺|学习)', 'g'),
  // X 大师 的弟子 / X 大师 亲传 / X 大师 门下（反向：X 是师父）
  new RegExp('([一-龥]{2,4})(' + HONOR + ')(?:的弟子|亲传弟子|门下弟子|门人|亲传|门下)', 'g'),
  // X 大师 收其为徒 / X 大师 收徒
  new RegExp('([一-龥]{2,4})(' + HONOR + ')(?:收其为徒|收徒|收其为弟子)', 'g'),
];

// 省份/城市名集合（用于判断姓名是否实为地名）
const GEO_WORDS = new Set([
  '江苏','浙江','广东','四川','山东','山西','陕西','河南','河北','安徽','福建','江西','云南','贵州','辽宁','吉林','黑龙江','湖北','湖南','广西','海南','甘肃','青海','宁夏','新疆','西藏','内蒙','北京','上海','天津','重庆',
  '南京','苏州','无锡','常州','扬州','镇江','南通','盐城','徐州','淮安','连云港','宿迁','泰州',
  '杭州','宁波','温州','绍兴','嘉兴','湖州','金华','衢州','舟山','台州','丽水',
  '广州','深圳','珠海','汕头','佛山','韶关','湛江','肇庆','江门','茂名','惠州','梅州','汕尾','河源','阳江','清远','东莞','中山','潮州','揭阳','云浮',
  '成都','自贡','攀枝花','泸州','德阳','绵阳','广元','遂宁','内江','乐山','南充','眉山','宜宾','广安','达州','雅安','巴中','资阳',
  '济南','青岛','淄博','枣庄','东营','烟台','潍坊','济宁','泰安','威海','日照','莱芜','临沂','德州','聊城','滨州','菏泽',
  '太原','大同','阳泉','长治','晋城','朔州','晋中','运城','忻州','临汾','吕梁',
  '西安','铜川','宝鸡','咸阳','渭南','延安','汉中','榆林','安康','商洛',
  '郑州','开封','洛阳','平顶山','安阳','鹤壁','新乡','焦作','濮阳','许昌','漯河','三门峡','南阳','商丘','信阳','周口','驻马店',
  '武汉','黄石','十堰','宜昌','襄阳','鄂州','荆门','孝感','荆州','黄冈','咸宁','随州','恩施',
  '长沙','株洲','湘潭','衡阳','邵阳','岳阳','常德','张家界','益阳','郴州','永州','怀化','娄底','湘西',
  '合肥','芜湖','蚌埠','淮南','马鞍山','淮北','铜陵','安庆','黄山','滁州','阜阳','宿州','六安','亳州','池州','宣城',
  '江苏淮安','江苏南京','江苏扬州','江苏苏州','江苏南通','江苏徐州','江苏盐城','江苏连云港','江苏宿迁','江苏泰州','江苏无锡','江苏常州','江苏镇江'
]);

// 验证姓名有效性
function isValidName(name) {
  if (!name || name.length < 2 || name.length > 4) return false;
  if (!SURNAMES.has(name[0])) return false;
  if (BAD_WORDS.has(name)) return false;
  if (GEO_WORDS.has(name)) return false;
  // 含地名子串（如"江苏淮安"含"江苏"）—— 检查是否以已知地名开头
  for (const g of GEO_WORDS) {
    if (name.startsWith(g) && name.length <= g.length + 2) return false;
  }
  // 排除含菜系/职务词的
  if (/菜|帮|派|厨|师|徒|门|会|协|院|校|局|部|长|主|任|理|事/.test(name.slice(1))) {
    if (name.length === 2 && /师|厨|徒|门/.test(name[1])) return false;
  }
  // 排除地名结尾
  if (/省|市|县|区|州|国人$/.test(name)) return false;
  return true;
}

// 构建 name → chef 反查
const chefByName = new Map();
const chefById = new Map();
for (const c of chefs) {
  if (c.name) chefByName.set(c.name, c);
  if (c.id) chefById.set(c.id, c);
}

const results = [];
let inLibCount = 0, outLibCount = 0;
let processedCount = 0;

for (const c of chefs) {
  if (c.isPlaceholder) continue;
  // 已有 master 跳过
  if (c.master || (c.masters && c.masters.length > 0)) continue;
  if (!c.bio) continue;

  const found = new Map(); // masterName → honor
  for (const p of PATTERNS) {
    p.lastIndex = 0;
    let m;
    while ((m = p.exec(c.bio)) !== null) {
      const name = m[1];
      const honor = m[2] || '';
      if (isValidName(name)) found.set(name, honor);
    }
  }

  if (found.size === 0) continue;

  for (const [masterName, honor] of found) {
    const masterChef = chefByName.get(masterName);
    if (masterChef) {
      results.push({
        studentId: c.id,
        studentName: c.name,
        masterId: masterChef.id,
        masterName: masterName,
        masterInLib: true,
        source: 'bio',
        raw: c.bio.match(new RegExp('.{0,20}' + masterName + '.{0,15}'))?.[0] || ''
      });
      inLibCount++;
    } else {
      results.push({
        studentId: c.id,
        studentName: c.name,
        masterName: masterName,
        masterTitle: honor,
        masterInLib: false,
        source: 'bio',
        raw: c.bio.match(new RegExp('.{0,20}' + masterName + '.{0,15}'))?.[0] || ''
      });
      outLibCount++;
    }
  }
  processedCount++;
}

console.log('=== 阶段 1 · bio 文本挖掘 ===');
console.log('处理厨师数:', processedCount);
console.log('提取师承关系:', results.length);
console.log('  库内师父:', inLibCount);
console.log('  库外师父:', outLibCount);

// 按 student 去重（一个 student 只保留第一个 master，优先库内）
const byStudent = new Map();
for (const r of results) {
  if (!byStudent.has(r.studentId)) {
    byStudent.set(r.studentId, r);
  } else {
    // 已有，若新的是库内且旧的是库外，替换
    const old = byStudent.get(r.studentId);
    if (!old.masterInLib && r.masterInLib) byStudent.set(r.studentId, r);
  }
}
const deduped = [...byStudent.values()];
console.log('去重后（每学生 1 师父）:', deduped.length);

fs.writeFileSync(OUT, JSON.stringify({
  source: 'bio-text-mining',
  fetchDate: new Date().toISOString(),
  results: deduped,
  stats: { total: deduped.length, inLib: deduped.filter(r => r.masterInLib).length, outLib: deduped.filter(r => !r.masterInLib).length }
}, null, 2));

console.log('\n输出:', OUT);
console.log('样本（前 15）:');
deduped.slice(0, 15).forEach(r => {
  console.log('  ' + r.studentName + ' → ' + r.masterName + (r.masterInLib ? ' (库内)' : ' (库外)') + '  | ' + r.raw.slice(0, 40));
});
