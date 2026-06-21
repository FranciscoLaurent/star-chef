#!/usr/bin/env node
// cyxh.org 爬虫 - 用 node 原生 fetch + 正则解析
// 目标：扫遍 4 个栏目所有 ID 区间 (1-1500)，404 跳过

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const OUT_FILE = path.join(DATA_DIR, 'cyxh-crawled.json');

// 已抓 ID 黑名单（从已有文件汇总）
function loadBlacklist() {
  const bl = { dangdai: new Set(), zishen: new Set(), yuanlao: new Set(), mianhuai: new Set() };
  const files = ['cyxh-chefs.json', 'cyxh-zishen-batch2.json', 'cyxh-dangdai-batch3.json',
                 'cyxh-zishen-batch3.json', 'cyxh-mianhuai-batch2.json', 'cyxh-yuanlao-batch2.json',
                 'cyxh-dangdai-batch4.json', 'mingchu-elite.json'];
  for (const f of files) {
    const p = path.join(DATA_DIR, f);
    if (!fs.existsSync(p)) continue;
    try {
      const d = JSON.parse(fs.readFileSync(p, 'utf8'));
      d.chefs?.forEach(c => {
        const m = (c.url || c.source || '').match(/\/(dangdai|zishen|yuanlao|mianhuai)\/(\d+)\.html/);
        if (m) bl[m[1]].add(m[2]);
      });
    } catch (e) { /* skip */ }
  }
  return bl;
}

// 单字菜系归一化
const CUISINE_NORM = {
  '川菜':'川','粤菜':'粤','鲁菜':'鲁','湘菜':'湘','浙菜':'浙','徽菜':'徽','闽菜':'闽',
  '京菜':'京','沪菜':'沪','淮扬菜':'淮扬','潮汕菜':'粤','苏菜':'淮扬','赣菜':'赣',
  '豫菜':'豫','晋菜':'晋','陕菜':'陕','黔菜':'黔','滇菜':'滇','辽菜':'辽','鄂菜':'鄂',
  '楚菜':'鄂','湖北菜':'鄂','本帮菜':'沪','官府菜':'京','宫廷菜':'宫廷','御膳':'宫廷',
  '清真菜':'清真','西北菜':'西北','东北菜':'东北','黑龙江菜':'东北','龙菜':'东北'
};

// HTML 解析（无 cheerio，用正则）
function parseDetail(html, column, id) {
  if (!html || html.includes('404 - Not Found') || html.includes('detailed-error')) return null;

  // title 提取人物名
  const titleM = html.match(/<title>([^<]+)<\/title>/);
  const title = titleM?.[1] || '';
  // 形如 "何定文|国家名厨 顺德名厨_..." 或 "【缅怀】XXX..."
  // 抽 "_" 前的部分
  const beforeUnder = title.split('_')[0];
  // 第一个 |（含中英文）前的部分是 name 或 "【缅怀】name"
  let name = beforeUnder.split(/[|｜]/)[0];
  name = name.replace(/^[【\[「]?(?:缅怀名厨?|缅怀|国家名厨录|国家名厨|资深|元老|当代)[】\]」]?\s*/g, '');
  name = name.replace(/^[「【]/, '').replace(/[】」]$/, '').trim();
  // 取前 2-4 个汉字作为可能的姓名（最常见的中文人名长度）
  const nameZh = name.match(/^[一-龥]{2,5}/)?.[0];
  if (!nameZh) return null;

  // description meta（第一段摘要）
  const descM = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/);
  let bio = descM?.[1] || '';

  // portrait（首张 mingchu/<col>/ 内的图）
  const portM = html.match(new RegExp(`src=["']([^"']*?/mingchu/${column}/[^"']+\\.(jpg|jpeg|png))`));
  const portrait = portM ? (portM[1].startsWith('http') ? portM[1] : 'http://www.cyxh.org' + portM[1]) : null;

  // 摘要 / 正文里的常规字段提取
  // 性别
  const genderM = bio.match(/[，,]([男女])[，,]/) || bio.match(/^[^，]{2,5}[，,]\s*([男女])/);
  const gender = genderM?.[1] || null;
  // 民族
  const ethnicityM = bio.match(/([汉满回蒙藏壮苗维吾尔哈萨克朝鲜彝白傣黎瑶土家布依]族)/);
  const ethnicity = ethnicityM?.[1] || null;
  // 生年
  const birthM = bio.match(/(\d{4})\s*年[\s\d月]*生/) || bio.match(/生于(\d{4})年/) || bio.match(/(\d{4})[年\.\-]/);
  const birth = birthM ? parseInt(birthM[1]) : null;
  // 卒年（缅怀栏）
  let death = null;
  const deathM = bio.match(/[（(](\d{4})[-—－至到](\d{4})[)）]/) || bio.match(/(\d{4})\s*年\s*\d*\s*月?\s*去世/) || bio.match(/逝世于\s*(\d{4})/);
  if (deathM) death = parseInt(deathM[2] || deathM[1]);
  // 籍贯
  const birthplaceM = bio.match(/([一-龥]{2,8}省?[一-龥]{1,8}[市县区])人/) || bio.match(/[，,]\s*([一-龥]{2,8})人/);
  const birthplace = birthplaceM?.[1] || null;

  // 菜系（从 bio 找"X菜"关键字）
  let primaryCuisine = null;
  const cuiOrder = ['川','粤','鲁','淮扬','湘','浙','徽','闽','京','沪','晋','豫','黔','滇','辽','鄂','楚','陕','赣','宫廷','清真','西北','东北'];
  for (const cu of cuiOrder) {
    if (new RegExp(`${cu}(菜|帮菜|帮)`).test(bio) || new RegExp(`${cu}菜大师|${cu}菜泰斗`).test(title)) {
      primaryCuisine = cu;
      break;
    }
  }
  // 兜底：title 含"鲁菜大师"
  if (!primaryCuisine) {
    const cuM = title.match(/(川|粤|鲁|淮扬|湘|浙|徽|闽|京|沪|晋|豫|黔|滇|辽|鄂|楚|陕|赣)菜/);
    if (cuM) primaryCuisine = cuM[1] === '楚' ? '鄂' : cuM[1];
  }

  // 师承（关键字段）
  const masters = [];
  const masterPatterns = [
    /师承(?:中国烹饪大师|国家级烹饪大师|国宝级烹饪大师|国宴大师|淮扬菜泰斗|川菜泰斗|粤菜泰斗|鲁菜泰斗|[\w]+大师|[\w]+泰斗)?([一-龥]{2,5})(?:大师|先生|师傅|师父)?/g,
    /师从(?:于)?(?:中国烹饪大师|国家级烹饪大师|国宝级烹饪大师|[\w]+大师|[\w]+泰斗)?([一-龥]{2,5})(?:大师|先生|师傅|师父)?/g,
    /拜([一-龥]{2,5})(?:为师|大师为师|师傅为师)/g,
    /([一-龥]{2,5})大师的(?:亲传|嫡传|高徒|得意门生|关门弟子)/g,
  ];
  const seen = new Set();
  for (const pat of masterPatterns) {
    let m;
    pat.lastIndex = 0;
    while ((m = pat.exec(bio)) !== null) {
      const masterName = m[1];
      if (masterName && masterName !== nameZh && !seen.has(masterName)) {
        seen.add(masterName);
        masters.push({ name: masterName, rawText: m[0].slice(0, 50) });
      }
    }
  }

  // 拿手菜（简化：从 "代表作品有X、Y、Z" 或 "X菜、Y菜" 提取）
  const signature = [];
  const sigM = bio.match(/(?:代表作品|代表菜品|代表菜|拿手菜|招牌菜)[有为是]?[：:]?\s*([^。.；;]+)/);
  if (sigM) {
    signature.push(...sigM[1].split(/[、，,]/).map(s => s.trim().replace(/等$/, '')).filter(s => s && s.length <= 12));
  }

  // 头衔（从摘要中"中国烹饪大师"等关键词）
  const titles = [];
  const titlePatterns = [
    /国宝级[一-龥]{2,8}/g, /中国烹饪大师/g, /中国烹饪名师/g, /国家名厨/g,
    /[一-龥]{1,3}菜泰斗/g, /[一-龥]{1,3}菜大师/g, /国宴大师/g, /国家(?:特一级|高级|中级)?(?:烹饪)?技师/g,
    /[一-龥]{2,4}省[一-龥]{2,6}/g, /中华名厨/g, /国家级评委/g, /非物质文化遗产[^。，；]{0,15}/g,
  ];
  const titleSet = new Set();
  for (const pat of titlePatterns) {
    let tm;
    pat.lastIndex = 0;
    while ((tm = pat.exec(bio)) !== null) {
      const t = tm[0].slice(0, 30);
      if (!titleSet.has(t)) { titleSet.add(t); titles.push(t); }
      if (titles.length >= 8) break;
    }
    if (titles.length >= 8) break;
  }

  // currentRole / city
  const roleM = bio.match(/(?:现任|曾任)([^。，；]{4,30})/);
  const currentRole = roleM?.[1] || null;

  return {
    id: `cyxh-${column}-${id}`,
    url: `http://www.cyxh.org/mingchu/${column}/${id}.html`,
    column,
    name: nameZh,
    gender, ethnicity,
    birth, death,
    birthplace,
    primaryCuisine,
    secondaryCuisines: [],
    titles,
    currentRole,
    city: null,
    masters,
    experiences: [],
    signature,
    portrait,
    bio: bio.slice(0, 400),
    source: `http://www.cyxh.org/mingchu/${column}/${id}.html`,
  };
}

async function fetchOne(url, timeout = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, {
      signal: ctl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html'
      }
    });
    clearTimeout(t);
    if (r.status !== 200) return null;
    const text = await r.text();
    // cyxh.org 404 用 IIS 错误页（HTML 但只有 4-8KB）
    if (text.length < 8000 || text.includes('IIS 10.0 详细错误') || text.includes('detailed-error')) return null;
    return text;
  } catch (e) {
    clearTimeout(t);
    return null;
  }
}

async function main() {
  const bl = loadBlacklist();
  console.log('黑名单:', JSON.stringify({
    dangdai: bl.dangdai.size, zishen: bl.zishen.size,
    yuanlao: bl.yuanlao.size, mianhuai: bl.mianhuai.size,
  }));

  // 扫描范围：每栏目 1-1500
  const tasks = [];
  for (const col of ['mianhuai', 'yuanlao', 'zishen', 'dangdai']) {  // 先抓历史价值高的
    const range = col === 'mianhuai' ? [1, 1200]
                : col === 'yuanlao'  ? [1, 1500]
                : col === 'zishen'   ? [1, 1500]
                : [1, 1500];
    for (let id = range[0]; id <= range[1]; id++) {
      if (bl[col].has(String(id))) continue;
      tasks.push({ col, id });
    }
  }
  console.log('待抓任务:', tasks.length);

  const CONCURRENCY = 12;
  const chefs = [];
  let processed = 0, success = 0, notfound = 0, parsefail = 0;
  const startTs = Date.now();

  async function worker(taskQueue) {
    while (taskQueue.length > 0) {
      const t = taskQueue.shift();
      if (!t) break;
      const url = `http://www.cyxh.org/mingchu/${t.col}/${t.id}.html`;
      const html = await fetchOne(url);
      processed++;
      if (!html) { notfound++; }
      else {
        const c = parseDetail(html, t.col, t.id);
        if (c && c.name && c.bio && c.bio.length > 30) {
          chefs.push(c);
          success++;
        } else parsefail++;
      }
      if (processed % 50 === 0) {
        const elapsed = ((Date.now() - startTs)/1000).toFixed(0);
        const rate = (processed/elapsed).toFixed(1);
        console.log(`[${elapsed}s] 已处理 ${processed}/${tasks.length}, 抓到 ${success}, 404=${notfound}, 解析失败=${parsefail}, ${rate}/s`);
      }
    }
  }

  const taskQueue = [...tasks];
  await Promise.all(Array(CONCURRENCY).fill(0).map(() => worker(taskQueue)));

  const elapsed = ((Date.now() - startTs)/1000).toFixed(0);
  console.log(`\n=== 完成 ${elapsed}s ===`);
  console.log(`处理 ${processed}, 成功 ${success}, 404 ${notfound}, 解析失败 ${parsefail}`);

  // 统计
  const byCol = {}, byCui = {};
  chefs.forEach(c => {
    byCol[c.column] = (byCol[c.column] || 0) + 1;
    byCui[c.primaryCuisine || '?'] = (byCui[c.primaryCuisine || '?'] || 0) + 1;
  });
  console.log('byColumn:', byCol);
  console.log('byCuisine:', byCui);
  console.log('with portrait:', chefs.filter(c => c.portrait).length);
  console.log('with masters:', chefs.filter(c => c.masters.length > 0).length);

  fs.writeFileSync(OUT_FILE, JSON.stringify({
    source: 'cyxh.org via node-fetch crawler',
    scope: 'crawler-batch1',
    fetchDate: new Date().toISOString().slice(0,10),
    chefs,
    stats: {
      total: chefs.length,
      processed, notfound, parsefail,
      byColumn: byCol,
      byCuisine: byCui,
      withPortrait: chefs.filter(c => c.portrait).length,
      withMasters: chefs.filter(c => c.masters.length > 0).length,
    }
  }, null, 2));
  console.log(`\n输出: ${OUT_FILE}`);
}

main().catch(e => { console.error(e); process.exit(1); });
