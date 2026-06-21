#!/usr/bin/env node
// 师承关系增强提取脚本
// 重新 fetch 有 detail URL 的条目，用更全面的模式提取师承
const fs = require('fs');
const path = require('path');
const DATA_DIR = path.join(__dirname, '..', 'data');
const OUT = path.join(DATA_DIR, 'master-backfill.json');

const merged = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'chefs-merged.json'), 'utf8'));

// 筛选：有 detail URL 且无师承的实人（覆盖 cyxh / cswzg / mingchu 三源）
const targets = merged.chefs.filter(c => {
  if (c.isPlaceholder) return false;
  if (c.master || (c.masters && c.masters.length > 0)) return false;
  const url = c.source || c.url || '';
  return /mingchu\/(dangdai|zishen|yuanlao|mianhuai)\/\d+\.html/.test(url)
      || /cswzg\.com|zgcsw\.cn\/mc\//.test(url)
      || /mingchu\.org\/mingchu\//.test(url);
});

console.log(`待提取师承: ${targets.length}`);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SURNAMES = new Set('王李张刘陈杨黄赵吴周徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭曾肖田董袁潘于蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦付方白邹孟熊秦邱江尹薛闫段雷侯龙史陶黎贺顾毛郝龚邵万钱严覃武戴莫孔向汤裴温和耿冷牛奎欧司诸上皇令慕殷常乔房'.split(''));

const BAD_WORDS = new Set('菜协院校店厅团司牌列堂理会主席部局科秘问家委跟随承学钻研系统国宴中华中国京沪粤川湘京宁桂滇晋豫陕宋元清明唐汉菜协烹饪餐饮食雕学习进修培训'.split(''));

async function fetchUrl(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const ctl = new AbortController();
      const tm = setTimeout(() => ctl.abort(), 15000);
      const r = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Accept-Language': 'zh-CN,zh;q=0.9' } });
      clearTimeout(tm);
      if (r.status === 200) { const t = await r.text(); if (t.length > 5000) return t; }
      if (r.status === 429 || r.status === 503) { await sleep(2000 * (attempt + 1)); continue; }
    } catch (e) { await sleep(1000 * (attempt + 1)); continue; }
    break;
  }
  return null;
}

function extractMasters(html, chefName) {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"').replace(/\s+/g, ' ');

  const masters = [];
  const seen = new Set();

  // 模式1: "师承XXX大师/先生/师傅"
  // 模式2: "师从XXX"
  // 模式3: "拜XXX为师/大师为师"
  // 模式4: "XXX大师的弟子/传人/高徒"
  // 模式5: "亲传弟子"
  // 模式6: "随XXX学习/学艺"
  // 模式7: "XXX大师亲授"
  // 模式8: "曾在XXX门下"

  const patterns = [
    // 师承/师从 + 人名 + 称号（高置信：人名紧跟敬称）
    /(?:师承|师从|受教于|受业于|拜师|拜)(?:了|中国烹饪大师|国家级烹饪大师|国宝级烹饪大师|国宴大师|著名|名厨)?\s*([一-龥]{2,4})\s*(?:大师|先生|师傅|师父|女士|老师|名厨|泰斗)/g,
    // 师承 + 修饰词(菜系+泰斗/大师) + 人名（如"师承清真菜泰斗马志和大师"）
    /(?:师承|师从|受教于|受业于)\s*(?:[一-龥]{2,6}(?:菜|帮|派))?(?:泰斗|宗师|大师|名厨)?\s*([一-龥]{2,4})(?=大师|先生|师傅|师父|名厨|泰斗|宗师|，|。|、|；|：|擅长|精通|深|曾|现|是)/g,
    // XXX大师的弟子/传人
    /([一-龥]{2,4})(?:大师|先生|师傅|师父|泰斗|名厨)的(?:亲传|嫡传|高徒|得意门生|关门弟子|弟子|传人)/g,
    // 拜XXX为师
    /拜\s*([一-龥]{2,4})\s*(?:大师|先生|师傅|师父)?\s*为师/g,
    // 随XXX学习/学艺
    /(?:跟随|随|追随)\s*([一-龥]{2,4})(?:大师|先生|师傅|师父)?\s*(?:学习|学艺|深造)/g,
    // 入XXX门下
    /(?:入|投入)\s*([一-龥]{2,4})(?:大师|先生|师傅)?\s*门下/g,
    // XXX亲授/传授
    /([一-龥]{2,4})(?:大师|先生|师傅)?亲(?:授|传)/g,
    // 恩师XXX
    /恩师\s*([一-龥]{2,4})(?:大师|先生|师傅)?/g,
    // 师傅XXX（在"师傅是XXX"的语境）
    /(?:师傅|师父)(?:是|为)\s*([一-龥]{2,4})(?:大师|先生|师傅|师父)?/g,
  ];

  for (const pat of patterns) {
    pat.lastIndex = 0;
    let m;
    while ((m = pat.exec(text)) !== null) {
      const name = m[1];
      if (!name || name === chefName || seen.has(name)) continue;
      if (name.length < 2 || name.length > 4) continue;
      if (!SURNAMES.has(name[0])) continue;
      if ([...name].some(ch => BAD_WORDS.has(ch))) continue;
      // 排除以敬称字结尾（"大""师""傅""门"等，除非 2 字真名）
      if (name.length >= 3 && /[大师傅门徒生哥老]$/.test(name)) continue;
      if (name.length === 2 && /[大师傅门徒]$/.test(name[1])) continue;
      // 排除地名结尾
      if (/省|市|县|区|州|国人$/.test(name)) continue;
      // 额外过滤：不含数字、标点
      if (!/^[一-龥]+$/.test(name)) continue;
      seen.add(name);
      masters.push({ name, rawText: (m[0] || '').slice(0, 80) });
      if (masters.length >= 5) break;
    }
    if (masters.length >= 5) break;
  }

  return masters;
}

async function main() {
  const results = [];
  let done = 0, found = 0, failed = 0;
  const start = Date.now();

  // 控制并发（cyxh 限流严格，降到 3 并发 + 重试）
  const CONCURRENCY = 3;
  const queue = [...targets];

  async function worker() {
    while (queue.length > 0) {
      const t = queue.shift();
      if (!t) break;
      const url = t.source || t.url;
      done++;

      const html = await fetchUrl(url);
      if (!html) { failed++; await sleep(200); continue; }

      const masters = extractMasters(html, t.name);
      if (masters.length > 0) {
        results.push({ name: t.name, id: t.id, masters, source: url });
        found++;
      }

      if (done % 30 === 0) {
        const el = ((Date.now() - start)/1000).toFixed(0);
        const rate = (done / el).toFixed(1);
        console.log(`[${el}s] ${done}/${targets.length} 找到 ${found} (${rate}/s)`);
      }
      await sleep(200);
    }
  }

  await Promise.all(Array(CONCURRENCY).fill(0).map(() => worker()));

  const el = ((Date.now() - start)/1000).toFixed(0);
  console.log(`\n=== 完成 ${el}s ===`);
  console.log(`提取到师承: ${found}/${targets.length}`);
  console.log(`失败/无师承: ${failed}/${targets.length - found}`);

  fs.writeFileSync(OUT, JSON.stringify({
    source: 'master-backfill · re-parse detail pages for master relationships',
    scope: '师承增强提取',
    fetchDate: new Date().toISOString().slice(0,10),
    results,
    stats: { total: targets.length, found, failed: targets.length - found - found + failed }
  }, null, 2));
  console.log(`输出: ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
