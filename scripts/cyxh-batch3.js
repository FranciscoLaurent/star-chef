/**
 * 批量抓取中国餐饮协会 cyxh.org/mingchu/dangdai 详情页并解析为 schema 一致的 JSON。
 *
 * 节流策略：所有抓取在单进程内串行，间隔 250ms，避免对站点造成压力。
 * 失败重试：每页最多 2 次。
 */
const http = require('http');
const fs = require('fs');

const SKIP = new Set(['49','456','717','819','1010','1088','1090','1209','1229','1323','1347','1368','1431','1464']);
const CANDIDATES = require('../tmp_ids.json');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function fetchUrl(url, retries = 2) {
  return new Promise((resolve, reject) => {
    const tryOnce = (left) => {
      const req = http.get(url, { timeout: 15000 }, res => {
        if (res.statusCode !== 200) {
          res.resume();
          if (left > 0) return setTimeout(() => tryOnce(left - 1), 800);
          return reject(new Error('HTTP ' + res.statusCode));
        }
        let buf = [];
        res.on('data', c => buf.push(c));
        res.on('end', () => resolve(Buffer.concat(buf).toString('utf8')));
      });
      req.on('timeout', () => { req.destroy(); if (left > 0) setTimeout(() => tryOnce(left - 1), 800); else reject(new Error('timeout')); });
      req.on('error', e => { if (left > 0) setTimeout(() => tryOnce(left - 1), 800); else reject(e); });
    };
    tryOnce(retries);
  });
}

// ---------- 工具：清洗 HTML ----------
function stripTags(s) {
  return s
    .replace(/<o:p[\s\S]*?<\/o:p>/g, '')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
    .replace(/&middot;/g, '·')
    .replace(/&hellip;/g, '…')
    .replace(/&quot;/g, '"')
    .replace(/&#10;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// 把内容区拆成段落数组（保留段落边界）
function extractParagraphs(html) {
  const start = html.indexOf('id="myPrintArea"');
  if (start < 0) return [];
  const end = html.indexOf('class="clear"', start);
  const body = html.slice(start, end > 0 ? end : start + 60000);
  const ps = [];
  for (const m of body.matchAll(/<p[\s\S]*?<\/p>/g)) {
    const t = stripTags(m[0]);
    if (t) ps.push(t);
  }
  // 还提取 h1/h2 标题
  const h1 = body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  return { title: h1 ? stripTags(h1[1]) : '', paragraphs: ps, raw: body };
}

// ---------- 字段提取 ----------
const CUISINE_KEYWORDS = [
  '鲁菜','川菜','粤菜','苏菜','淮扬菜','闽菜','浙菜','湘菜','徽菜',
  '京菜','京帮菜','宫廷菜','官府菜','谭家菜','本帮菜','沪菜','上海菜',
  '清真菜','清真','西北菜','陕菜','陇菜','晋菜','豫菜','辽菜','东北菜',
  '滇菜','黔菜','鄂菜','湖北菜','楚菜','赣菜','桂菜','琼菜',
  '潮州菜','潮汕菜','客家菜','广府菜','顺德菜','成都菜','重庆菜','江湖菜',
  '杭帮菜','宁波菜','温州菜','南京菜','无锡菜','扬州菜','苏州菜','常熟菜',
  '国宴菜','官府菜','药膳','养生菜','分子料理','融合菜','西餐','法餐','日料','韩餐',
  '烤鸭','烤鸭菜','烤肉','面点','面食','糕点','甜品','冷菜','热菜','卤菜','烧腊','凉菜',
  '徐州菜','淮安菜','洛阳菜','开封菜','长沙菜','武汉菜','沔阳菜','荆州菜',
  '佛跳墙','咖喱菜','满汉','炖菜','蒙餐'
];

const TITLE_KEYWORDS = [
  '中国烹饪大师','中国烹饪名师','国家名厨','中华名厨','中国名厨','中国餐饮大师','中国餐饮服务大师',
  '高级技师','高级烹调师','中式烹调师','中式烹调技师','烹饪高级技师','中式面点师','西式烹调师',
  '世界中餐业联合会国际评委','国际评委','注册裁判员','技能竞赛裁判员','评审专家','智库专家',
  '行政总厨','厨师长','总经理','技术总监','技术顾问','顾问','名厨委员会委员','理事',
  '劳动模范','五一劳动奖章','技术能手','首席技师','技能大师','非遗传承人','传承人',
  '党员','共青团员'
];

function findFirst(text, patterns) {
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m;
  }
  return null;
}

function parseChef(id, html) {
  const { title, paragraphs } = extractParagraphs(html);
  if (!paragraphs.length) return null;
  // bio 区：通常前 5 段最关键
  const head = paragraphs.slice(0, 8).join(' ');
  const allText = paragraphs.join(' ');

  // ---- name (优先从「XXX，男/女，」结构提取，最稳) ----
  let name = null;
  let m = head.match(/([一-龥]{2,5})\s*(?:\([A-Za-z\s]+\))?\s*[，,]\s*[男女]\s*[，,]/);
  if (m) name = m[1];
  // 兜底 1：title 中冒号后的人名
  if (!name) {
    m = title.match(/[人物：:、]\s*([一-龥]{2,5})\s*[\s_：（]/);
    if (m) name = m[1];
  }
  // 兜底 2：title 中「中国烹饪大师裴广伟：」之类的格式
  if (!name) {
    m = title.match(/大师\s*([一-龥]{2,4})\s*[：:_]/);
    if (m) name = m[1];
  }
  // 兜底 3：title 起始为人名
  if (!name) {
    m = title.match(/^([一-龥]{2,4})[\s|｜\|]/);
    if (m) name = m[1];
  }
  if (!name) return null;

  // ---- gender ----
  let gender = null;
  m = head.match(new RegExp(name + '\\s*[，,]\\s*([男女])'));
  if (m) gender = m[1];
  else { m = head.match(/[，,]\s*([男女])\s*[，,]/); if (m) gender = m[1]; }

  // ---- ethnicity ----
  let ethnicity = null;
  m = head.match(/(汉|回|满|蒙古|藏|维吾尔|苗|壮|彝|朝鲜|土家|布依|侗|瑶|白|哈尼|傣|傈僳|佤|拉祜|纳西|景颇|柯尔克孜|达斡尔|羌|撒拉|毛南|仡佬|锡伯|阿昌|普米|塔吉克|怒|乌孜别克|俄罗斯|鄂温克|德昂|保安|裕固|京|塔塔尔|独龙|鄂伦春|赫哲|门巴|珞巴|基诺|高山|畲|黎)族/);
  if (m) ethnicity = m[1] + '族';

  // ---- birth year ----
  let birth = null;
  m = head.match(/(\d{4})\s*年\s*\d{1,2}\s*月\s*(?:出?生|出?生于)/);
  if (m) birth = parseInt(m[1]);
  if (!birth) { m = head.match(/(\d{4})\s*年\s*(?:出?生|出?生于)/); if (m) birth = parseInt(m[1]); }
  if (!birth) { m = head.match(/生于\s*(\d{4})\s*年/); if (m) birth = parseInt(m[1]); }

  // ---- birthplace ----
  let birthplace = null;
  // 「YYYY年X月生/出生，XX人」或「YYYY年X月生/出生于XX，」
  m = head.match(/(?:出?生|出?生于)\s*[，,]?\s*([一-龥]{2,12}?)人[，,]/);
  if (m) birthplace = m[1].trim();
  if (!birthplace) {
    m = head.match(/生于\s*([一-龥]{2,15}?)[，,]/);
    if (m) birthplace = m[1];
  }
  if (!birthplace) {
    // 兜底：第一段「，XX人，」
    m = head.match(/[，,]\s*([一-龥]{2,10}?(?:省|市|县|区|州)?[一-龥]{0,8}?)人\s*[，,]/);
    if (m && m[1].length >= 2) birthplace = m[1];
  }

  // ---- city（现工作地）----
  let city = null;
  m = head.match(/定居\s*([一-龥]{2,8})/);
  if (m) city = m[1];
  if (!city) {
    m = head.match(/现工作\s*(?:于|在)\s*([一-龥]{2,10})/);
    if (m) city = m[1];
  }

  // ---- education ----
  let education = null;
  for (const e of ['博士','硕士','研究生','本科','大学','大专','中专','高中','初中']) {
    if (head.includes(e + '学历') || head.includes(e + '文化')) { education = e; break; }
  }

  // ---- titles ----
  const titles = [];
  for (const t of TITLE_KEYWORDS) {
    if (head.includes(t) && !titles.includes(t)) titles.push(t);
  }
  // 附加：在 head 里捕获 "X月生..." 之后逗号分隔的称号
  // 简单：扫描分句，凡含「大师/师/委员/专家/评委/总厨/厨师长/总监/顾问/会员/理事」的短句加入
  const sentences = head.split(/[，,。.；;]/).map(s => s.trim()).filter(Boolean);
  for (const s of sentences) {
    if (s.length < 4 || s.length > 30) continue;
    if (/[名厨大师评委专家委员理事会员总厨厨师长总监顾问技师传承人状元].{0,3}$/.test(s)) {
      if (!titles.includes(s) && !/^\d/.test(s) && !s.includes('师承')) titles.push(s);
    }
  }

  // ---- currentRole ----
  let currentRole = null;
  m = head.match(/现任\s*([^，,。.；;]{4,40})/);
  if (m) currentRole = m[1].trim();
  if (!currentRole) {
    m = head.match(/任职于?\s*([^，,。.；;]{4,40})/);
    if (m) currentRole = m[1].trim();
  }

  // ---- masters ----
  // 思路：扫描含「师承/师从/拜...为师/跟随...学习」的句子，
  // 在该上下文中找形如 "XX大师|XX先生|XX师傅|XX老师|传人XX大师" 的中文人名（2-4 字）。
  const masters = [];
  const cueRe = /(师承|师从|拜师|拜|跟随|追随|受教于|受业于)[^。.；;]{2,120}/g;
  const seenNames = new Set();
  // 排除非人名的高频干扰词
  const NAME_BLACKLIST = new Set([
    '泰斗','宗师','大师','名师','大厨','师傅','名厨','先生','老师','协会','学院','学校','酒店','饭店',
    '国宴','正统','元老','一代','国家','国宝','顶级','侯门','国家级','非遗','国家高级','国家中式','北京','上海','广州','深圳','香港','澳门',
    '中华','中国','人民','中央','创始','创办','主席','会长','研究','研究院','烹饪','餐饮','食雕','粤菜','川菜','淮扬','鲁菜','闽菜','湘菜','徽菜','苏菜','浙菜',
    '匠心','守艺','根基','传承','创新','技艺','理念','心路','历程','现场','展示','经典','烹制','烧腊','艺术','创作','大众','传播','文化','精神','学艺','初心',
    '冠绝','业界','本人','厨艺','之路','改良','善于','追求','色香','味形','俱全','品质','料理','具备','扎实','理论','功底','实践','经验','获评','协会','秘书',
    '世界','御厨','协会','会员','大会','大堂','西餐','原','先后','技术','能手','美食','工匠','荣誉','称号','现任','运城','一尊','皇牛','鹅皇','道','餐饮','品牌',
    '科长','局长','主任','部长','理事','顾问','评委','专家','智库','大学','学院','教授','院士','博士','硕士','研究','研究员','中心','基地','单位','部门','机构',
    '高端','接待','重大','保障','实体','创业','行业','赋能','格局','广式','食雕','作品','典藏','收藏','藏品','藏家','学员','学徒','弟子','门人','门生','门下',
    '荟萃','汇集','汇聚','聚集','汇合','结合','融合','结合','结合','结合','结合','结合','结合','结合','结合','结合','结合','结合','结合','结合','结合',
    '系统','研习','钻研','学习','深造','培训','培养','培训','培训','培训','培训','培训','培训','培训','培训','培训','培训','培训','培训','培训','培训',
    '彭州','成都','重庆','成都市','重庆市','北京市','上海市','广州市','深圳市','香港市','澳门市','台湾','台湾省','台湾市','台湾县','台湾区','台湾州','台湾盟','台湾省',
    '从厨','学徒','入行','入门','上岗','工作','服务','服务于','服务过','服务过','服务过','服务过','服务过','服务过','服务过','服务过','服务过','服务过','服务过',
    '当地','信阳','信阳菜','信阳菜名','信阳菜名家','信阳菜名家',
    '诸多','星级','林星','林星级','级名厨','米其林','级名','米其','其林','大利','法国','意大','澳洲','西班','班牙','德国','日本','韩国'
  ]);
  for (const cm of allText.matchAll(cueRe)) {
    const ctx = cm[0];
    const titleRe = /(先生|大师|师傅|老师|前辈|名厨|国师|宗师|泰斗)/g;
    const SURNAMES = '王李张刘陈杨黄赵吴周徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭曾肖田董袁潘于蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦付方白邹孟熊秦邱江尹薛闫段雷侯龙史陶黎贺顾毛郝龚邵万钱严覃武戴莫孔向汤裴温和耿冷牛奎欧司诸上皇令慕殷常乔房乔';
    const BAD_CHARS = '菜协院校店厅团司牌列堂厨师长理会主席部局科秘问家委裁判跟随承学研钻研系统当地国宴中华中国京沪粤川湘京宁桂滇晋豫陕宋元清明唐汉清正侯门';
    for (const tm of ctx.matchAll(titleRe)) {
      const titlePos = tm.index;
      let picked = null;
      // 优先取 2 字（最短最稳），其次 3 字
      for (const len of [2, 3]) {
        if (titlePos < len) continue;
        const left = ctx.slice(titlePos - len, titlePos);
        if (!/^[一-龥]+$/.test(left)) continue;
        if (NAME_BLACKLIST.has(left)) continue;
        if (!SURNAMES.includes(left[0])) continue;
        let bad = false;
        for (const ch of left) if (BAD_CHARS.includes(ch)) { bad = true; break; }
        if (bad) continue;
        picked = left;
        break;
      }
      if (!picked) continue;
      if (seenNames.has(picked)) continue;
      seenNames.add(picked);
      let titleHint = ctx.slice(0, titlePos - picked.length).replace(/^(师承|师从|拜|跟随|追随|受教于|受业于)/, '').replace(/[，,]/g, ' ').trim();
      if (titleHint.length > 30) titleHint = titleHint.slice(-30);
      masters.push({
        name: picked,
        title: titleHint || null,
        rawText: ctx.slice(0, 120).trim()
      });
      if (masters.length >= 5) break;
    }
    if (masters.length >= 5) break;
  }

  // ---- experiences ----
  const experiences = [];
  // 抓「YYYY年...动词...」短句
  for (const s of allText.split(/[。.；;]/)) {
    const t = s.trim();
    if (t.length < 6 || t.length > 60) continue;
    if (/\d{4}\s*年/.test(t) && /(投身|入职|任职|担任|创立|创办|成立|加入|进入|调入|晋升|获评|获得|荣获|斩获|获奖|斩获|出任|参与|赴|入选|入编|拜|发表|出版|主编|参编|出席|参加|赴港|赴美|开业|创建)/.test(t)) {
      experiences.push(t.replace(/^[，,]/, ''));
      if (experiences.length >= 8) break;
    }
  }

  // ---- signature 代表作品 ----
  const signature = [];
  const SIG_BLACKLIST = /^(姓名|职位|地区|单位|擅长|代表作品|做法|用料|特色|主料|辅料|食材|配料|步骤|说明|备注|工艺|时间|温度|份量|价格|备料|准备|出品|完成|食用|品评|点评|心得|心得体会|备注|附注)[：:]/;
  // 抓 h2 "代表作品" 后的 <b>菜名</b>
  const sigStart = html.indexOf('代表作品');
  if (sigStart > 0) {
    const sigBlock = html.slice(sigStart, sigStart + 30000);
    for (const mm of sigBlock.matchAll(/<b[^>]*>[\s\S]*?<span[^>]*>([一-龥][一-龥\d·\-—\s]{1,18})<\/span>[\s\S]*?<\/b>/g)) {
      const d = stripTags(mm[1]).replace(/\s+/g, '');
      if (d && d.length >= 2 && d.length <= 16 && !signature.includes(d) && !SIG_BLACKLIST.test(d + '：') && !/代表作品|做法|用料|特色|姓名|职位|地区|单位|擅长/.test(d)) {
        signature.push(d);
      }
    }
    // 兜底：直接抓 <b>...</b> 内文本
    if (signature.length < 2) {
      for (const mm of sigBlock.matchAll(/<b[^>]*>([\s\S]*?)<\/b>/g)) {
        const d = stripTags(mm[1]).replace(/\s+/g, '');
        if (d && d.length >= 2 && d.length <= 16 && !signature.includes(d) && !SIG_BLACKLIST.test(d + '：') && !/代表作品|做法|用料|特色|食材|主料|辅料|姓名|职位|地区|单位|擅长/.test(d)) {
          signature.push(d);
          if (signature.length >= 8) break;
        }
      }
    }
  }

  // ---- portrait ----
  let portrait = null;
  m = html.match(/<img\s+src="(\/d\/file\/mingchu\/dangdai\/[^"]+\.(?:jpg|png|jpeg))"/);
  if (m) portrait = 'http://www.cyxh.org' + m[1];

  // ---- cuisines ----
  const cuisinesFound = [];
  for (const c of CUISINE_KEYWORDS) {
    if (allText.includes(c) && !cuisinesFound.includes(c)) cuisinesFound.push(c);
  }
  // primary = 第一个出现，secondary = 其余前 3 个
  const primaryCuisine = cuisinesFound[0] || null;
  const secondaryCuisines = cuisinesFound.slice(1, 4);

  // ---- bio：摘前两段精炼 ----
  let bio = paragraphs[1] || paragraphs[0] || '';
  if (bio.length > 200) bio = bio.slice(0, 200) + '…';

  return {
    id: 'cyxh-dangdai-' + id,
    url: 'http://www.cyxh.org/mingchu/dangdai/' + id + '.html',
    column: 'dangdai',
    name,
    gender,
    ethnicity,
    birth,
    death: null,
    birthplace,
    primaryCuisine,
    secondaryCuisines,
    education,
    titles: titles.slice(0, 12),
    currentRole,
    city,
    masters,
    experiences,
    signature: signature.slice(0, 8),
    signatureDetails: [],
    portrait,
    bio
  };
}

// ---------- 主流程 ----------
(async () => {
  // 控制总数：目标 60-80
  const TARGET = 75;
  const list = CANDIDATES.slice(0, TARGET);
  console.log('[start] candidates:', list.length);
  const chefs = [];
  const failed = [];
  for (let i = 0; i < list.length; i++) {
    const id = list[i];
    if (SKIP.has(id)) continue;
    const url = 'http://www.cyxh.org/mingchu/dangdai/' + id + '.html';
    process.stdout.write(`[${i + 1}/${list.length}] ${id} ... `);
    try {
      const html = await fetchUrl(url);
      const chef = parseChef(id, html);
      if (!chef || !chef.name) {
        console.log('parse-fail');
        failed.push({ id, reason: 'parse-fail' });
      } else {
        chefs.push(chef);
        console.log('OK ' + chef.name + ' [' + (chef.primaryCuisine || '?') + ']' + (chef.masters.length ? ' M=' + chef.masters.length : ''));
      }
    } catch (e) {
      console.log('ERR ' + e.message);
      failed.push({ id, reason: e.message });
    }
    await sleep(250);
  }

  // 统计
  const stats = {
    total: chefs.length,
    withMaster: chefs.filter(c => c.masters.length).length,
    uniqueMasters: [...new Set(chefs.flatMap(c => c.masters.map(m => m.name)))],
    byCuisine: {},
    failed: failed.length
  };
  for (const c of chefs) {
    const k = c.primaryCuisine || '未识别';
    stats.byCuisine[k] = (stats.byCuisine[k] || 0) + 1;
  }
  const out = {
    source: '中国餐饮协会国家名厨网 cyxh.org',
    scope: 'dangdai-batch3',
    fetchDate: '2026-06-21',
    chefs,
    stats,
    failed
  };
  fs.writeFileSync('D:/Study/AI_Space/play-CC/star_chef/data/cyxh-dangdai-batch3.json', JSON.stringify(out, null, 2));
  console.log('\n[done] total=' + chefs.length + ' failed=' + failed.length + ' withMaster=' + stats.withMaster);
  console.log('cuisines:', JSON.stringify(stats.byCuisine));
})();
