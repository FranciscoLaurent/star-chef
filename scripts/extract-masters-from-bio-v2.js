#!/usr/bin/env node
// extract-masters-from-bio-v2.js
// 更宽松的师承提取：找到"师承/师从/拜师"后最近的符合姓名规则的2-4字

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const MERGED = path.join(ROOT, 'data', 'chefs-merged.json');
const OUT = path.join(ROOT, 'data', 'bio-masters.json');

const data = JSON.parse(fs.readFileSync(MERGED, 'utf8'));
const chefs = data.chefs;

const SURNAMES = new Set('王李张刘陈杨黄赵吴周徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭曾肖田董袁潘于蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦付方白邹孟熊秦邱江尹薛闫段雷侯龙史陶黎贺顾毛郝龚邵万钱严覃武戴莫孔向汤裴温和耿冷牛奎欧司诸上皇令慕殷常乔房'.split(''));
const BAD_WORDS=new Set('菜协院校店厅团司牌列堂理主席部局科秘家委大师名厨泰斗宗师先生师傅师父老师祖师弟子徒弟门人门下技艺流派菜系烹饪餐饮学习进修培训国宴中华中国京沪粤川湘宁桂滇晋豫陕'.split(''));
const GEO_WORDS=new Set(['北京','上海','天津','重庆','南京','武汉','广州','深圳','成都','西安','杭州','沈阳','哈尔滨','长沙','昆明','郑州','济南','青岛','大连','厦门','苏州','无锡','常州','扬州','镇江','南通','盐城','徐州','淮安','广东','广西','山东','山西','河南','河北','湖南','湖北','江西','江苏','浙江','安徽','福建','四川','贵州','云南','陕西','甘肃','宁夏','青海','西藏','新疆','内蒙','吉林','辽宁','黑龙江','海南','香港','澳门','台湾','本帮']);
const GEO_END = /省|市|县|区|州|国人$/;

const chefByName = new Map();
for (const c of chefs) { if (c.name) chefByName.set(c.name, c); }

// 核心策略：匹配 "(师承/师从/拜师/...) [任意文字] (姓名2-4字)(大师/先生/师傅/师父/门下)"
// 姓名和敬称必须紧挨，中间只能有空格。这是防止误判的关键。
// 示例：
//   "师承资深中国烹饪大师邓正波" → 邓正波+大师 ✓
//   "师从于国宝级烹调大师李玉伟先生" → 李玉伟+先生 ✓
//   "师承上游" → 上游+"" ✗（敬称缺失）

function extractMasters(bio) {
  const found = [];
  // 找"师承/师从/拜师..."关键词后的所有"姓名+敬称"对
  for (const kw of ['师承','师从','拜师','拜入','师事','受教于','学艺于','投师','从师']) {
    let pos = 0;
    while ((pos = bio.indexOf(kw, pos)) !== -1) {
      // 关键词后200字内找所有"姓名+敬称"对，取第一个通过姓名校验的
      const after = bio.slice(pos + kw.length, pos + kw.length + 200);
      const matches = [...after.matchAll(/([一-龥]{2,4})(大师|先生|师傅|师父|名厨|泰斗|宗师|门下|巨匠|前辈)/g)];
      for (const m of matches) {
        const name = m[1];
        if (SURNAMES.has(name[0]) && ![...name].some(ch => BAD_WORDS.has(ch))
            && !GEO_END.test(name) && !GEO_WORDS.has(name)
            && !name.includes('本帮') && !name.includes('菜') && !name.includes('厨') && !name.includes('烹'))
        {
          found.push(name);
          break;
        }
      }
      pos += kw.length; // 前进
    }
  }

  // 反向模式1：大师/先生/泰斗 + 姓名（如"师承资深中国烹饪大师邓正波"）
  for (const kw of ['师承','师从','拜师','受教于']) {
    let pos = 0;
    while ((pos = bio.indexOf(kw, pos)) !== -1) {
      const after = bio.slice(pos + kw.length, pos + kw.length + 200);
      // 匹配 "大师/先生/泰斗 + 姓名(2-4字)" 其中姓氏验证
      const m = after.match(/(?:大师|先生|师傅|师父|名厨|泰斗|宗师|门下|巨匠)\s*([一-龥]{2,4})(?:，|。|、|；|：|\s|先生|大师|师傅|$)/);
      if (m) {
        const name = m[1];
        if (SURNAMES.has(name[0]) && ![...name].some(ch => BAD_WORDS.has(ch))
            && !GEO_END.test(name) && !GEO_WORDS.has(name)
            && !name.includes('本帮') && !name.includes('菜') && !name.includes('厨') && !name.includes('烹')
            && !name.endsWith('等'))
        {
          found.push(name.endsWith('等') ? name.slice(0, -1) : name);
        }
      }
      pos += kw.length;
    }
  }

  // 反向模式2：XXX大师的弟子 / 拜入XXX门下
  const revPattern = /([一-龥]{2,4})(大师|先生|师傅|师父|泰斗|名厨|宗师)(?:的|门下|亲传|嫡传)/g;
  let rm;
  while ((rm = revPattern.exec(bio)) !== null) {
    const name = rm[1];
    if (SURNAMES.has(name[0]) && ![...name].some(ch => BAD_WORDS.has(ch)) && !name.endsWith('等')) {
      found.push(name);
    }
  }

  return [...new Set(found)];
}

const results = [];
let inLib = 0, outLib = 0;
for (const c of chefs) {
  if (c.isPlaceholder) continue;
  if (c.master || (c.masters && c.masters.length > 0)) continue;
  if (!c.bio) continue;

  const masters = extractMasters(c.bio);
  if (masters.length === 0) continue;

  for (const name of masters) {
    const masterChef = chefByName.get(name);
    if (masterChef) {
      results.push({ studentId: c.id, studentName: c.name, masterId: masterChef.id, masterName: name, masterInLib: true, source:'bio-v2' });
      inLib++;
    } else {
      results.push({ studentId: c.id, studentName: c.name, masterName: name, masterInLib: false, source:'bio-v2' });
      outLib++;
    }
  }
}

console.log('=== bio v2 挖掘 ===');
console.log('提取师承:', results.length, '库内:', inLib, '库外:', outLib);
// 去重
const byStudent = new Map();
for (const r of results) {
  if (!byStudent.has(r.studentId) || (!byStudent.get(r.studentId).masterInLib && r.masterInLib)) {
    byStudent.set(r.studentId, r);
  }
}
const deduped = [...byStudent.values()];
console.log('去重(每学生1师父):', deduped.length, '库内:', deduped.filter(r=>r.masterInLib).length);

fs.writeFileSync(OUT, JSON.stringify({source:'bio-v2',fetchDate:new Date().toISOString(),results:deduped,stats:{total:deduped.length,inLib:deduped.filter(r=>r.masterInLib).length,outLib:deduped.filter(r=>!r.masterInLib).length}},null,2));
console.log('输出:',OUT);
console.log('样本(前20):');
deduped.slice(0,20).forEach(r=>console.log('  '+r.studentName+' → '+r.masterName+(r.masterInLib?' (库内)':' (库外)')));
