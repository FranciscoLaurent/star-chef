// 从 cyxh.org/mingchu 列表页摘要中提取师承信息
const fs = require('fs');
const path = require('path');
const DATA_DIR = path.join(__dirname, '..', 'data');
const OUT = path.join(DATA_DIR, 'list-masters.json');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SURNAMES = new Set('王李张刘陈杨黄赵吴周徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭曾肖田董袁潘于蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦付方白邹孟熊秦邱江尹薛闫段雷侯龙史陶黎贺顾毛郝龚邵万钱严覃武戴莫孔向汤裴温和耿冷牛奎欧司诸上皇令慕殷常乔房'.split(''));

const COLUMNS = {
  dangdai: { base: 'http://www.cyxh.org/mingchu/dangdai', pages: 112, name: '当代名厨' },
  zishen: { base: 'http://www.cyxh.org/mingchu/zishen', pages: 60, name: '资深名厨' },
  yuanlao: { base: 'http://www.cyxh.org/mingchu/yuanlao', pages: 50, name: '元老名厨' },
  mianhuai: { base: 'http://www.cyxh.org/mingchu/mianhuai', pages: 40, name: '缅怀名厨' },
};

async function fetchUrl(url, retries = 1) {
  for (let a = 0; a <= retries; a++) {
    try {
      const ctl = new AbortController();
      const tm = setTimeout(() => ctl.abort(), 12000);
      const r = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': UA, 'Accept': 'text/html' } });
      clearTimeout(tm);
      if (r.status === 200) { const t = await r.text(); if (t.length > 5000) return t; }
    } catch (e) { if (a < retries) await sleep(2000); }
  }
  return null;
}

function extractFromPage(html) {
  const results = [];
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

  // 每个条目格式：《标题》人物：姓名 ... 摘要 ...
  // 找所有含"师从/师承/拜师"的片段
  const patterns = [
    // 师从 XXX大师
    /师从(?:于|了)?\s*(?:[一-龥]+大师|著名|资深|元老级)?\s*([一-龥]{2,4})(?:大师|先生|师傅|师父|名厨|泰斗)?/g,
    // 师承 XXX
    /师承\s*(?:[一-龥]+大师|著名|资深)?\s*([一-龥]{2,4})(?:大师|先生|师傅|师父)?/g,
    // 拜XXX为师
    /拜(?:师|了)?\s*([一-龥]{2,4})(?:大师|先生|师傅)?\s*(?:为师|学艺)/g,
  ];

  for (const pat of patterns) {
    pat.lastIndex = 0;
    let m;
    while ((m = pat.exec(text)) !== null) {
      const masterName = m[1];
      if (!masterName || masterName.length < 2 || !SURNAMES.has(masterName[0])) continue;
      // 从前文找学生名字：在每个匹配之前找到最近的标题模式
      const matchPos = m.index;
      const before = text.slice(Math.max(0, matchPos - 300), matchPos);
      const nameM = before.match(/人物[：:]\s*([一-龥]{2,4})/);
      if (nameM) {
        const studentName = nameM[1];
        if (studentName !== masterName) {
          results.push({ student: studentName, master: masterName, raw: m[0].slice(0, 60) });
        }
      }
    }
  }

  // 去重
  const seen = new Set();
  return results.filter(r => {
    const key = r.student + '→' + r.master;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function main() {
  const allResults = [];
  let pagesChecked = 0, pagesFailed = 0;

  for (const [col, cfg] of Object.entries(COLUMNS)) {
    console.log(`\n=== ${cfg.name} (${col}) ===`);
    let emptyStreak = 0;

    for (let p = 1; p <= cfg.pages; p++) {
      const url = p === 1 ? cfg.base + '/' : cfg.base + '/index_' + p + '.html';
      const html = await fetchUrl(url);
      pagesChecked++;

      if (!html) {
        pagesFailed++;
        emptyStreak++;
        if (emptyStreak >= 5) { console.log(`  ${col} 连缺5页，停止`); break; }
        continue;
      }
      emptyStreak = 0;

      const results = extractFromPage(html);
      if (results.length > 0) {
        allResults.push(...results);
        if (p <= 3 || results.length >= 2) {
          console.log(`  页${p}: ${results.length}条`);
          results.forEach(r => console.log(`    ${r.student} → ${r.master}`));
        }
      }

      if (p % 20 === 0) {
        console.log(`  [${pagesChecked}页] 累计 ${allResults.length} 条`);
        fs.writeFileSync(OUT, JSON.stringify({ results: allResults, stats: { pagesChecked, pagesFailed, total: allResults.length } }, null, 2));
      }
      await sleep(300);
    }
  }

  // 去重
  const seen = new Set();
  const unique = allResults.filter(r => {
    const key = r.student + '→' + r.master;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  fs.writeFileSync(OUT, JSON.stringify({
    source: 'cyxh.org listing pages · 师承提取',
    results: unique,
    stats: { pagesChecked, pagesFailed, total: unique.length, allExtracted: allResults.length }
  }, null, 2));

  console.log(`\n=== 完成: ${unique.length} 条唯师承关系 ===`);
  unique.slice(0, 30).forEach(r => console.log(`  ${r.student} → ${r.master}`));
}

main().catch(e => { console.error(e); process.exit(1); });
