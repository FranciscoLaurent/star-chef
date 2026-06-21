#!/usr/bin/env node
// 列表页爬虫：先抓列表页提取有效详情 ID，再抓详情
// 避免 v2 那种 90% 404 的浪费

const fs = require('fs');
const path = require('path');
const DATA_DIR = path.join(__dirname, '..', 'data');

const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36',
];
let uaIdx = 0;
function getUA() { return UA_POOL[uaIdx++ % UA_POOL.length]; }
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 所有栏目及其列表页范围
const COLUMNS = {
  dangdai:  { pages: 80, base: 'http://www.mingchu.org' },
  zishen:   { pages: 30, base: 'http://www.mingchu.org' },
  yuanlao:  { pages: 30, base: 'http://www.mingchu.org' },
  mianhuai: { pages: 25, base: 'http://www.mingchu.org' },
};

// 加载已抓 ID 黑名单
function loadBlacklist() {
  const bl = new Set();
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && f !== '_slim.json');
  for (const f of files) {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
      d.chefs?.forEach(c => {
        const m = (c.url || c.source || '').match(/\/(dangdai|zishen|yuanlao|mianhuai)\/(\d+)\.html/);
        if (m) bl.add(m[2]);
      });
    } catch (e) {}
  }
  // 也加载已合并的数据
  try {
    const merged = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'chefs-merged.json'), 'utf8'));
    merged.chefs?.forEach(c => {
      const m = (c.source || c.url || '').match(/\/(dangdai|zishen|yuanlao|mianhuai)\/(\d+)\.html/);
      if (m) bl.add(m[2]);
    });
  } catch (e) {}
  return bl;
}

async function fetchPage(url, retries = 2) {
  for (let a = 0; a <= retries; a++) {
    try {
      const ctl = new AbortController();
      const tm = setTimeout(() => ctl.abort(), 12000);
      const r = await fetch(url, {
        signal: ctl.signal,
        headers: { 'User-Agent': getUA(), 'Accept': 'text/html', 'Accept-Language': 'zh-CN,zh;q=0.9' }
      });
      clearTimeout(tm);
      if (r.status === 200) {
        const text = await r.text();
        if (text.length > 5000 && !text.includes('IIS 10.0 详细错误')) return text;
      }
      if (r.status === 403 || r.status === 429) { await sleep(3000); continue; }
    } catch (e) {
      if (a < retries) await sleep(2000);
    }
  }
  return null;
}

// 从列表页 HTML 提取详情 ID
function extractIds(html) {
  const ids = new Set();
  // 模式1: href="/mingchu/栏目/数字.html"
  const re1 = /\/mingchu\/(dangdai|zishen|yuanlao|mianhuai)\/(\d+)\.html/g;
  let m;
  while ((m = re1.exec(html)) !== null) ids.add(m[2]);
  // 模式2: href="/d/file/mingchu/栏目/数字-xxx/xxx.jpg" (从图片路径推断)
  // 模式3: 某些模板用 onclick="location.href='...'"
  return [...ids];
}

// 解析详情页（复用 v2 的解析逻辑）
function parseDetail(html, column, id, base) {
  const titleM = html.match(/<title>([^<]+)<\/title>/);
  const title = titleM?.[1] || '';
  const beforeUnder = title.split('_')[0];
  let name = beforeUnder.split(/[|｜]/)[0];
  name = name.replace(/^[【\[「]?(?:缅怀名厨?|缅怀|国家名厨录|国家名厨|资深|元老|当代|《国家名厨》人物：)[】\]」]?\s*/g, '');
  name = name.replace(/^[「【]/, '').replace(/[】」]$/, '').trim();
  const nameZh = name.match(/^[一-龥]{2,5}/)?.[0];
  if (!nameZh || nameZh.length < 2) return null;

  const descM = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/);
  let bio = descM?.[1] || '';
  if (!bio) {
    const bodyText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 2000);
    bio = bodyText;
  }

  // 先提取全文文本用于解析
  const allText = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"').replace(/&middot;/g, '·').replace(/\s+/g, ' ');

  const portM = html.match(new RegExp(`src=["']([^"']*?/mingchu/${column}/[^"']+\\.(jpg|jpeg|png))`));
  let portrait = portM ? (portM[1].startsWith('http') ? portM[1] : base + portM[1]) : null;
  if (!portrait) {
    const imgM = html.match(/src=["'](\/d\/file\/mingchu\/[^"']+\.(jpg|jpeg|png))["']/);
    if (imgM) portrait = 'http://www.cyxh.org' + imgM[1];
  }

  // 性别
  const genderM = bio.match(/[，,]([男女])[，,]/) || bio.match(/^[^，]{2,5}[，,]\s*([男女])/);
  const gender = genderM?.[1] || null;

  // 民族
  const ethnicityM = allText.match(/([汉满回蒙藏壮苗维吾尔哈萨克朝鲜彝白傣黎瑶土家布依侗畲]族)/);
  const ethnicity = ethnicityM?.[1] || null;

  // 出生年份
  const birthM = allText.match(/(\d{4})\s*年[\s\d月]*生/) || allText.match(/生于(\d{4})年/) || allText.match(/(\d{4})\s*年\s*出?生/);
  const birth = birthM ? parseInt(birthM[1]) : null;

  // 去世年份
  let death = null;
  const deathM = allText.match(/(\d{4})\s*年\s*\d*\s*月?\s*去世/) || allText.match(/逝世于\s*(\d{4})/);
  if (deathM) death = parseInt(deathM[1]);

  // 籍贯
  const birthplaceM = allText.match(/([一-龥]{2,8}(?:省|市))?([一-龥]{1,8}[市县区])人/) || allText.match(/[，,]\s*([一-龥]{2,10})人/);
  const birthplace = birthplaceM?.[0]?.replace(/人$/, '').replace(/^[，,]/, '') || null;

  // 菜系识别（在全文搜索）
  const cuiOrder = ['淮扬','川','粤','鲁','湘','浙','徽','闽','京','沪','晋','豫','黔','滇','辽','鄂','楚','陕','赣','清真','国宴','宫廷','西北','东北','蒙','滇','琼','冀','津','吉','桂'];
  let primaryCuisine = null;
  for (const cu of cuiOrder) {
    if (new RegExp(cu + '(?:菜|帮菜|帮|大菜|风味|流派)').test(allText) ||
        new RegExp(cu + '菜大师|' + cu + '菜泰斗|' + cu + '菜宗师').test(title)) {
      primaryCuisine = cu === '楚' ? '鄂' : cu;
      break;
    }
  }
  // 兜底：从 title 提取
  if (!primaryCuisine) {
    const cuM = title.match(/(川|粤|鲁|淮扬|湘|浙|徽|闽|京|沪|晋|豫|黔|滇|辽|鄂|楚|陕|赣)菜/);
    if (cuM) primaryCuisine = cuM[1] === '楚' ? '鄂' : cuM[1];
  }
  // 京帮菜 → 京
  if (!primaryCuisine && /京帮|北京菜/.test(allText)) primaryCuisine = '京';
  if (!primaryCuisine && /本帮|上海菜/.test(allText)) primaryCuisine = '沪';

  // 师承提取
  const masters = [];
  const seenNames = new Set();
  const masterRe = /(?:师承|师从|受教于|受业于|拜)(?:了|中国烹饪大师|国家级烹饪大师|国宝级烹饪大师|国宴大师|[一-龥]+大师|[一-龥]+泰斗)?\s*([一-龥]{2,4})\s*(?:大师|先生|师傅|师父|女士)?/g;
  let mm;
  while ((mm = masterRe.exec(allText)) !== null) {
    const mn = mm[1];
    const SURNAMES = '王李张刘陈杨黄赵吴周徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭曾肖田董袁潘于蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦付方白邹孟熊秦邱江尹薛闫段雷侯龙史陶黎贺顾毛郝龚邵万钱严覃武戴莫孔向汤裴温和耿冷牛奎欧司诸上皇令慕殷常乔房';
    if (!mn || mn.length < 2 || seenNames.has(mn) || !SURNAMES.includes(mn[0])) continue;
    // 排除非人名（用 Set 替代正则，避免中文编码导致 regex 解析错误）
    const BAD_WORDS = new Set('菜协院校店厅团司牌列堂理会主席部局科秘问家委跟随承学钻研系统国宴中华中国京沪粤川湘京宁桂滇晋豫陕宋元清明唐汉菜协'.split(''));
    if ([...mn].some(ch => BAD_WORDS.has(ch))) continue;
    seenNames.add(mn);
    masters.push({ name: mn, rawText: mm[0].slice(0, 60) });
    if (masters.length >= 5) break;
  }

  // 头衔
  const titles = [];
  const titleSet = new Set();
  const titleRe = /(?:中国烹饪大师|中国烹饪名师|国家名厨|中华名厨|中国名厨|国宴大师|高级技师|烹调技师|烹饪大师|面点大师|[一-龥]+菜大师|非遗传承人|国际评委|注册裁判|劳动模范|技术能手|首席技师)/g;
  let tm;
  while ((tm = titleRe.exec(allText)) !== null) {
    const t = tm[0];
    if (!titleSet.has(t)) { titleSet.add(t); titles.push(t); }
  }

  // 现任职务
  const roleM = allText.match(/(?:现任|担任)(.{4,40}?)(?:[，,。.；;]|$)/);
  const currentRole = roleM?.[1] || null;

  // 代表菜
  const signature = [];
  const sigBlock = (html.match(/代表作品[\s\S]{0,5000}?<\/p>/) || [''])[0];
  const dishRe = /<b[^>]*>([\s\S]*?)<\/b>/g;
  let dm;
  while ((dm = dishRe.exec(sigBlock)) !== null) {
    const dish = dm[1].replace(/<[^>]+>/g, '').replace(/\s+/g, '').trim();
    if (dish && dish.length >= 2 && dish.length <= 16 && !signature.includes(dish)
        && !/代表作品|做法|用料|特色|食材|主料|辅料|姓名|职位|地区|单位|擅长/.test(dish)) {
      signature.push(dish);
      if (signature.length >= 8) break;
    }
  }

  return {
    id: `cyxh-${column}-${id}`,
    url: `${base}/mingchu/${column}/${id}.html`,
    column,
    name: nameZh,
    gender, ethnicity, birth, death, birthplace,
    primaryCuisine,
    secondaryCuisines: [],
    titles,
    currentRole,
    city: null,
    masters,
    experiences: [],
    signature,
    portrait,
    bio: bio.slice(0, 500),
    source: `${base}/mingchu/${column}/${id}.html`,
  };
}

async function main() {
  const blacklist = loadBlacklist();
  console.log('已抓 ID 黑名单:', blacklist.size);

  // 第一步：抓所有列表页，收集有效详情 ID
  const validIds = {};  // { col: [id1, id2, ...] }
  let listPagesChecked = 0;
  let listPagesFailed = 0;

  for (const [col, cfg] of Object.entries(COLUMNS)) {
    validIds[col] = [];
    console.log(`\n=== 扫描 ${col} 列表页 (1-${cfg.pages}) ===`);
    for (let p = 1; p <= cfg.pages; p++) {
      const url = p === 1
        ? `${cfg.base}/mingchu/${col}/`
        : `${cfg.base}/mingchu/${col}/index_${p}.html`;
      const html = await fetchPage(url);
      listPagesChecked++;
      if (!html) {
        listPagesFailed++;
        if (listPagesFailed <= 3) console.log(`  [缺页] ${col}/index_${p}.html`);
        continue;
      }
      const ids = extractIds(html);
      const newIds = ids.filter(id => !blacklist.has(id));
      if (newIds.length > 0) {
        validIds[col].push(...newIds);
        if (p <= 3 || p % 10 === 0) console.log(`  页${p}: ${ids.length} IDs, ${newIds.length} 新`);
      }
      await sleep(200);
    }
    // 去重
    validIds[col] = [...new Set(validIds[col])];
    console.log(`  ${col} 合计: ${validIds[col].length} 个新详情待抓`);
  }

  const totalTasks = Object.values(validIds).reduce((s, a) => s + a.length, 0);
  console.log(`\n=== 列表页扫描完成: ${listPagesChecked} 页, 共 ${totalTasks} 个新详情 ===`);

  // 第二步：抓详情
  const allChefs = [];
  let detailDone = 0, detailOk = 0, detailFail = 0;
  const startTs = Date.now();

  for (const [col, ids] of Object.entries(validIds)) {
    const base = COLUMNS[col].base;
    for (const id of ids) {
      const html = await fetchPage(`${base}/mingchu/${col}/${id}.html`);
      detailDone++;
      if (html) {
        const chef = parseDetail(html, col, id, base);
        if (chef && chef.name) {
          allChefs.push(chef);
          detailOk++;
          if (detailOk % 20 === 0) {
            const el = ((Date.now()-startTs)/1000).toFixed(0);
            console.log(`[${el}s] 抓 ${detailDone}/${totalTasks} 成功 ${detailOk}`);
            // 增量保存
            fs.writeFileSync(path.join(DATA_DIR, 'cyxh-list-crawled.json'), JSON.stringify({
              source: 'cyxh.org + mingchu.org list-crawler',
              scope: 'list-based crawl',
              fetchDate: new Date().toISOString().slice(0,10),
              chefs: allChefs,
              stats: { total: allChefs.length, detailDone, detailOk, detailFail }
            }, null, 2));
          }
        } else detailFail++;
      } else detailFail++;
      await sleep(250);
    }
  }

  // 最终保存
  const elapsed = ((Date.now()-startTs)/1000).toFixed(0);
  const byCol = {}, byCui = {};
  allChefs.forEach(c => {
    byCol[c.column] = (byCol[c.column]||0)+1;
    byCui[c.primaryCuisine||'?'] = (byCui[c.primaryCuisine||'?']||0)+1;
  });

  fs.writeFileSync(path.join(DATA_DIR, 'cyxh-list-crawled.json'), JSON.stringify({
    source: 'cyxh.org + mingchu.org list-crawler (列表页精准抓取)',
    scope: 'all columns via list pages',
    fetchDate: new Date().toISOString().slice(0,10),
    chefs: allChefs,
    stats: {
      total: allChefs.length,
      listPagesChecked, listPagesFailed,
      detailDone, detailOk, detailFail,
      byColumn: byCol,
      byCuisine: byCui,
      withPortrait: allChefs.filter(c => c.portrait).length,
      withMasters: allChefs.filter(c => c.masters?.length > 0).length,
    }
  }, null, 2));

  console.log(`\n=== 列表爬虫完成 ${elapsed}s ===`);
  console.log('byColumn:', byCol);
  console.log('byCuisine:', byCui);
  console.log('portrait:', allChefs.filter(c=>c.portrait).length, '/', allChefs.length);
  console.log('masters:', allChefs.filter(c=>c.masters?.length>0).length, '/', allChefs.length);
  console.log(`输出: ${path.join(DATA_DIR, 'cyxh-list-crawled.json')}`);
}

main().catch(e => { console.error(e); process.exit(1); });
