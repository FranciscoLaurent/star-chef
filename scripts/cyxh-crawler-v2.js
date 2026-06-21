#!/usr/bin/env node
// cyxh / mingchu 双源爬虫 v2
// 改进：低并发 + 延迟 + UA 轮换 + 双源 fallback

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const OUT_FILE = path.join(DATA_DIR, 'cyxh-crawled2.json');

const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
];
let uaIdx = 0;
function getUA() { return UA_POOL[uaIdx++ % UA_POOL.length]; }

const sleep = ms => new Promise(r => setTimeout(r, ms));

function loadBlacklist() {
  const bl = { dangdai: new Set(), zishen: new Set(), yuanlao: new Set(), mianhuai: new Set() };
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && f !== 'chefs-merged.json' && f !== '_slim.json');
  for (const f of files) {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
      d.chefs?.forEach(c => {
        const m = (c.url || c.source || '').match(/\/(dangdai|zishen|yuanlao|mianhuai)\/(\d+)\.html/);
        if (m && bl[m[1]]) bl[m[1]].add(m[2]);
      });
    } catch (e) {}
  }
  return bl;
}

async function fetchOne(url, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const ctl = new AbortController();
      const tm = setTimeout(() => ctl.abort(), 10000);
      const r = await fetch(url, {
        signal: ctl.signal,
        headers: { 'User-Agent': getUA(), 'Accept': 'text/html', 'Accept-Language': 'zh-CN,zh;q=0.9' }
      });
      clearTimeout(tm);
      if (r.status === 200) {
        const text = await r.text();
        // 静态 404：内容很短 or 含 IIS 错误页
        if (text.length < 8000 || text.includes('IIS 10.0 详细错误') || text.includes('detailed-error')) return null;
        return text;
      }
      if (r.status === 403 || r.status === 429) {
        // 反爬：等待长一点
        await sleep(3000);
        continue;
      }
      return null;
    } catch (e) {
      if (attempt < retries) await sleep(2000);
    }
  }
  return null;
}

function parseDetail(html, column, id, urlBase) {
  if (!html) return null;
  const titleM = html.match(/<title>([^<]+)<\/title>/);
  const title = titleM?.[1] || '';
  const beforeUnder = title.split('_')[0];
  let name = beforeUnder.split(/[|｜]/)[0];
  name = name.replace(/^[【\[「]?(?:缅怀名厨?|缅怀|国家名厨录|国家名厨|资深|元老|当代)[】\]」]?\s*/g, '');
  name = name.replace(/^[「【]/, '').replace(/[】」]$/, '').trim();
  const nameZh = name.match(/^[一-龥]{2,5}/)?.[0];
  if (!nameZh) return null;

  const descM = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/);
  let bio = descM?.[1] || '';

  const portM = html.match(new RegExp(`src=["']([^"']*?/mingchu/${column}/[^"']+\\.(jpg|jpeg|png))`));
  const portrait = portM ? (portM[1].startsWith('http') ? portM[1] : urlBase + portM[1]) : null;

  const genderM = bio.match(/[，,]([男女])[，,]/) || bio.match(/^[^，]{2,5}[，,]\s*([男女])/);
  const gender = genderM?.[1] || null;
  const ethnicityM = bio.match(/([汉满回蒙藏壮苗维吾尔哈萨克朝鲜彝白傣黎瑶土家布依]族)/);
  const ethnicity = ethnicityM?.[1] || null;
  const birthM = bio.match(/(\d{4})\s*年[\s\d月]*生/) || bio.match(/生于(\d{4})年/);
  const birth = birthM ? parseInt(birthM[1]) : null;
  let death = null;
  const deathM = bio.match(/[（(](\d{4})[-—－至到](\d{4})[)）]/) || bio.match(/(\d{4})\s*年\s*\d*\s*月?\s*去世/) || bio.match(/逝世于\s*(\d{4})/);
  if (deathM) death = parseInt(deathM[2] || deathM[1]);
  const birthplaceM = bio.match(/([一-龥]{2,8}省?[一-龥]{1,8}[市县区])人/) || bio.match(/[，,]\s*([一-龥]{2,8})人/);
  const birthplace = birthplaceM?.[1] || null;

  let primaryCuisine = null;
  const cuiOrder = ['川','粤','鲁','淮扬','湘','浙','徽','闽','京','沪','晋','豫','黔','滇','辽','鄂','楚','陕','赣','宫廷','清真','西北','东北','黔'];
  for (const cu of cuiOrder) {
    if (new RegExp(`${cu}(菜|帮菜|帮)`).test(bio) || new RegExp(`${cu}菜大师|${cu}菜泰斗|${cu}菜宗师`).test(title)) {
      primaryCuisine = cu === '楚' ? '鄂' : cu;
      break;
    }
  }
  if (!primaryCuisine) {
    const cuM = title.match(/(川|粤|鲁|淮扬|湘|浙|徽|闽|京|沪|晋|豫|黔|滇|辽|鄂|楚|陕|赣)菜/);
    if (cuM) primaryCuisine = cuM[1] === '楚' ? '鄂' : cuM[1];
  }

  const masters = [];
  const masterPatterns = [
    /师承(?:中国烹饪大师|国家级烹饪大师|国宝级烹饪大师|国宴大师|淮扬菜泰斗|川菜泰斗|粤菜泰斗|鲁菜泰斗|[一-龥]+大师|[一-龥]+泰斗)?([一-龥]{2,5})(?:大师|先生|师傅|师父)?/g,
    /师从(?:于)?(?:中国烹饪大师|国家级烹饪大师|国宝级烹饪大师|[一-龥]+大师|[一-龥]+泰斗)?([一-龥]{2,5})(?:大师|先生|师傅|师父)?/g,
    /拜([一-龥]{2,5})(?:为师|大师为师|师傅为师)/g,
    /([一-龥]{2,5})大师的(?:亲传|嫡传|高徒|得意门生|关门弟子)/g,
  ];
  const seen = new Set();
  for (const pat of masterPatterns) {
    pat.lastIndex = 0;
    let m;
    while ((m = pat.exec(bio)) !== null) {
      const mn = m[1];
      if (mn && mn !== nameZh && !seen.has(mn)) {
        seen.add(mn);
        masters.push({ name: mn, rawText: m[0].slice(0, 50) });
      }
    }
  }

  const titles = [];
  const titlePatterns = [
    /国宝级[一-龥]{2,8}/g, /中国烹饪大师/g, /中国烹饪名师/g, /国家名厨/g,
    /[一-龥]{1,3}菜泰斗/g, /[一-龥]{1,3}菜大师/g, /国宴大师/g,
    /国家(?:特一级|高级|中级)?(?:烹饪)?技师/g, /中华名厨/g, /国家级评委/g,
  ];
  const titleSet = new Set();
  for (const pat of titlePatterns) {
    pat.lastIndex = 0;
    let tm;
    while ((tm = pat.exec(bio)) !== null) {
      const t = tm[0].slice(0, 30);
      if (!titleSet.has(t)) { titleSet.add(t); titles.push(t); }
      if (titles.length >= 8) break;
    }
    if (titles.length >= 8) break;
  }

  const roleM = bio.match(/(?:现任|曾任)([^。，；]{4,30})/);
  const currentRole = roleM?.[1] || null;

  return {
    id: `cyxh-${column}-${id}`,
    url: `${urlBase}/mingchu/${column}/${id}.html`,
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
    signature: [],
    portrait,
    bio: bio.slice(0, 400),
    source: `${urlBase}/mingchu/${column}/${id}.html`,
  };
}

async function tryFetch(column, id) {
  // cyxh 之前的 ban 可能还在；优先用 mingchu 镜像（独立 IP）
  for (const base of ['http://www.mingchu.org', 'http://www.cyxh.org']) {
    const url = `${base}/mingchu/${column}/${id}.html`;
    const html = await fetchOne(url, 1);
    if (html) {
      const c = parseDetail(html, column, id, base);
      if (c && c.name && c.bio.length > 30) return c;
    }
    await sleep(200);
  }
  return null;
}

async function main() {
  const bl = loadBlacklist();
  console.log('黑名单:', JSON.stringify({
    dangdai: bl.dangdai.size, zishen: bl.zishen.size,
    yuanlao: bl.yuanlao.size, mianhuai: bl.mianhuai.size,
  }));

  // 任务：只跑高价值历史栏目，缩小范围避免太长
  const ranges = {
    mianhuai: [1, 200],
    yuanlao:  [1, 250],
    zishen:   [1, 250],
  };

  const tasks = [];
  for (const [col, [lo, hi]] of Object.entries(ranges)) {
    for (let id = lo; id <= hi; id++) {
      if (bl[col].has(String(id))) continue;
      tasks.push({ col, id });
    }
  }
  console.log('待抓任务:', tasks.length);

  const CONCURRENCY = 6;
  const chefs = [];
  let processed = 0, success = 0, notfound = 0;
  const startTs = Date.now();

  async function worker(taskQueue) {
    while (taskQueue.length > 0) {
      const t = taskQueue.shift();
      if (!t) break;
      const c = await tryFetch(t.col, t.id);
      processed++;
      if (c) { chefs.push(c); success++; }
      else notfound++;
      if (processed % 50 === 0) {
        const elapsed = ((Date.now() - startTs)/1000).toFixed(0);
        const rate = (processed/elapsed).toFixed(1);
        console.log(`[${elapsed}s] ${processed}/${tasks.length} | 抓到 ${success} | 失败 ${notfound} | ${rate}/s`);
        // 增量保存
        fs.writeFileSync(OUT_FILE, JSON.stringify({
          source: 'cyxh.org + mingchu.org dual-fetcher',
          scope: 'crawler-batch2',
          partial: true,
          chefs,
          stats: { total: chefs.length, processed, notfound }
        }, null, 2));
      }
      await sleep(300);  // 礼貌延迟
    }
  }

  const taskQueue = [...tasks];
  await Promise.all(Array(CONCURRENCY).fill(0).map(() => worker(taskQueue)));

  const elapsed = ((Date.now() - startTs)/1000).toFixed(0);
  console.log(`\n=== 完成 ${elapsed}s, 抓到 ${success} ===`);

  const byCol = {}, byCui = {};
  chefs.forEach(c => {
    byCol[c.column] = (byCol[c.column] || 0) + 1;
    byCui[c.primaryCuisine || '?'] = (byCui[c.primaryCuisine || '?'] || 0) + 1;
  });

  fs.writeFileSync(OUT_FILE, JSON.stringify({
    source: 'cyxh.org + mingchu.org dual-fetcher',
    scope: 'crawler-batch2',
    fetchDate: new Date().toISOString().slice(0,10),
    chefs,
    stats: {
      total: chefs.length, processed, notfound,
      byColumn: byCol, byCuisine: byCui,
      withPortrait: chefs.filter(c => c.portrait).length,
      withMasters: chefs.filter(c => c.masters.length > 0).length,
    }
  }, null, 2));
  console.log('byColumn:', byCol);
  console.log('byCuisine:', byCui);
  console.log('portrait:', chefs.filter(c => c.portrait).length, '/', chefs.length);
  console.log('masters:', chefs.filter(c => c.masters.length > 0).length, '/', chefs.length);
  console.log(`\n输出: ${OUT_FILE}`);
}

main().catch(e => { console.error(e); process.exit(1); });
