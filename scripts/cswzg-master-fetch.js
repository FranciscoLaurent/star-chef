// 批量 fetch cswzg.com 详情页，提取师承信息
const fs = require('fs');
const path = require('path');
const DATA_DIR = path.join(__dirname, '..', 'data');
const OUT = path.join(DATA_DIR, 'cswzg-masters.json');

const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'chefs-merged.json'), 'utf8'));
const real = d.chefs.filter(c => !c.isPlaceholder);
const noMaster = real.filter(c => !c.master && (!c.masters || c.masters.length === 0));

// 找有 cswzg mc 详情页 URL 的
const targets = [];
noMaster.forEach(c => {
  const src = c.source || '';
  const m = src.match(/(?:cswzg\.com|zgcsw\.cn)\/mc\/(\d+)\.html/);
  if (m) targets.push({ name: c.name, id: c.id, url: src, mcId: m[1] });
});

console.log('待 fetch:', targets.length);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SURNAMES = new Set('王李张刘陈杨黄赵吴周徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭曾肖田董袁潘于蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦付方白邹孟熊秦邱江尹薛闫段雷侯龙史陶黎贺顾毛郝龚邵万钱严覃武戴莫孔向汤裴温和耿冷牛奎欧司诸上皇令慕殷常乔房'.split(''));

async function fetchUrl(url) {
  try {
    const ctl = new AbortController();
    const tm = setTimeout(() => ctl.abort(), 10000);
    const r = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': UA, 'Accept': 'text/html' } });
    clearTimeout(tm);
    if (r.status === 200) { const t = await r.text(); if (t.length > 2000) return t; }
  } catch(e) {}
  return null;
}

function extractMasters(html, chefName) {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  const masters = [];
  const seen = new Set();

  const patterns = [
    /师从(?:于|了)?\s*([一-龥]{2,4})(?:大师|先生|师傅|师父|名厨|泰斗)?/g,
    /师承\s*([一-龥]{2,4})(?:大师|先生|师傅|师父)?/g,
    /拜(?:师|了)?\s*([一-龥]{2,4})(?:大师|先生|师傅)?\s*(?:为师|学艺)/g,
    /(?:跟随|随|追随)\s*([一-龥]{2,4})(?:大师|先生|师傅)?\s*(?:学习|学艺)/g,
    /([一-龥]{2,4})(?:大师|先生)的(?:亲传|嫡传|关门)?(?:弟子|门生)/g,
  ];

  for (const pat of patterns) {
    pat.lastIndex = 0;
    let m;
    while ((m = pat.exec(text)) !== null) {
      const name = m[1];
      if (!name || name === chefName || seen.has(name) || name.length < 2 || !SURNAMES.has(name[0])) continue;
      if (!/^[一-龥]+$/.test(name)) continue;
      seen.add(name);
      masters.push({ name, rawText: (m[0]||'').slice(0,60) });
    }
  }
  return masters;
}

async function main() {
  const results = [];
  let done = 0, found = 0;
  const start = Date.now();

  const CONCURRENCY = 10;
  const queue = [...targets];

  async function worker() {
    while (queue.length > 0) {
      const t = queue.shift();
      if (!t) break;
      done++;

      const html = await fetchUrl(t.url);
      if (!html) { await sleep(200); continue; }

      const masters = extractMasters(html, t.name);
      if (masters.length > 0) {
        results.push({ name: t.name, id: t.id, masters, source: t.url });
        found++;
      }

      if (done % 20 === 0) {
        const el = ((Date.now() - start)/1000).toFixed(0);
        console.log(`[${el}s] ${done}/${targets.length} 找到 ${found}`);
        fs.writeFileSync(OUT, JSON.stringify({ source: 'cswzg mc pages', results, stats: { total: targets.length, done, found } }, null, 2));
      }
      await sleep(200);
    }
  }

  await Promise.all(Array(CONCURRENCY).fill(0).map(() => worker()));

  const el = ((Date.now() - start)/1000).toFixed(0);
  fs.writeFileSync(OUT, JSON.stringify({
    source: 'cswzg.com mc pages · 师承提取',
    results,
    stats: { total: targets.length, found, done, elapsed: el }
  }, null, 2));

  console.log(`\n=== ${el}s 完成: ${found}/${targets.length} 找到师承 ===`);
}

main().catch(e => { console.error(e); process.exit(1); });
