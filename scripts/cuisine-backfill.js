#!/usr/bin/env node
// 补全脚本：针对已抓取的 cyxh-crawled 条目，重新提取菜系信息
// 问题：v2 爬虫的 parseDetail 只能从 title/bio 提取菜系，遗漏了页面其他区域的菜系线索
// 方案：重新 fetch 224 条缺菜系的 crawled 条目，用增强解析

const fs = require('fs');
const path = require('path');
const DATA_DIR = path.join(__dirname, '..', 'data');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 加载所有缺菜系的爬虫条目
const merged = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'chefs-merged.json'), 'utf8'));
const targets = merged.chefs.filter(c => {
  if (c.isPlaceholder) return false;
  if (c.primaryCuisine) return false;
  // 只处理有 source URL 的条目（cyxh-crawled 系列）
  return c.source && /mingchu\/(dangdai|zishen|yuanlao|mianhuai)\/\d+\.html/.test(c.source||c.url||'');
});

console.log(`待补全菜系条目: ${targets.length}`);

async function fetchUrl(url) {
  try {
    const ctl = new AbortController();
    const tm = setTimeout(() => ctl.abort(), 10000);
    const r = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Accept-Language': 'zh-CN,zh;q=0.9' } });
    clearTimeout(tm);
    if (r.status === 200) { const t = await r.text(); if (t.length > 5000) return t; }
  } catch (e) {}
  return null;
}

// 扩展菜系关键词（含地域菜系变体）
const CUISINE_PATTERNS = [
  // 八大菜系
  { re: /川菜|川帮|蓉派|渝派|盐帮|上河帮|下河帮|小河帮|成都菜|重庆菜|四川菜/g, cui: '川' },
  { re: /粤菜|广府|潮汕菜|潮州菜|客家菜|顺德菜|广东菜|广州菜|香港菜/g, cui: '粤' },
  { re: /鲁菜|济南菜|胶东菜|孔府菜|山东菜|青岛菜/g, cui: '鲁' },
  { re: /淮扬|淮扬菜|扬州菜|镇江菜|淮安菜|苏州菜|无锡菜|南京菜|江苏菜|苏菜/g, cui: '淮扬' },
  { re: /湘菜|洞庭湖|湘西菜|湖南菜|长沙菜/g, cui: '湘' },
  { re: /浙菜|杭帮菜|宁波菜|绍兴菜|温州菜|瓯菜|浙江菜/g, cui: '浙' },
  { re: /徽菜|皖南|皖菜|安徽菜/g, cui: '徽' },
  { re: /闽菜|福州菜|闽南菜|闽西菜|福建菜|厦门菜/g, cui: '闽' },
  // 其他
  { re: /京菜|京帮|宫廷菜|官府菜|谭家菜|北京菜|烤鸭/g, cui: '京' },
  { re: /沪菜|本帮|上海菜/g, cui: '沪' },
  { re: /豫菜|河南菜/g, cui: '豫' },
  { re: /清真|清真菜|西北菜|新疆菜|兰州菜/g, cui: '清真' },
  { re: /滇菜|云南菜/g, cui: '滇' },
  { re: /黔菜|贵州菜/g, cui: '黔' },
  { re: /辽菜|辽宁菜|东北菜/g, cui: '辽' },
  { re: /陕菜|陕西菜|西安菜/g, cui: '陕' },
  { re: /晋菜|山西菜/g, cui: '晋' },
  { re: /鄂菜|湖北菜|楚菜|武汉菜/g, cui: '鄂' },
  { re: /赣菜|江西菜/g, cui: '赣' },
  { re: /国宴|钓鱼台|人民大会堂/g, cui: '国宴' },
];

function extractCuisine(html) {
  const allText = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

  // 1. 从 title 提取（最可靠）
  const titleM = html.match(/<title>([^<]+)<\/title>/);
  const title = titleM?.[1] || '';

  // 2. 从 keywords meta 提取
  const kwM = html.match(/<meta\s+name=["']keywords["']\s+content=["']([^"']+)["']/);
  const keywords = kwM?.[1] || '';

  // 3. 从 description meta
  const descM = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/);
  const desc = descM?.[1] || '';

  // 4. 从面包屑/分类标签
  const breadcrumb = (html.match(/<a[^>]*>[^<]*(?:菜|帮|派|风味)[^<]*<\/a>/gi) || []).join(' ');

  // 综合搜索文本（优先级：title > keywords > desc > breadcrumb > body）
  const searchTexts = [title, keywords, desc, breadcrumb, allText.slice(0, 3000)];

  for (const text of searchTexts) {
    if (!text) continue;
    for (const { re, cui } of CUISINE_PATTERNS) {
      re.lastIndex = 0;
      if (re.test(text)) return cui;
    }
  }

  // 5. 兜底：搜索全文
  for (const { re, cui } of CUISINE_PATTERNS) {
    re.lastIndex = 0;
    if (re.test(allText.slice(0, 5000))) return cui;
  }

  return null;
}

async function main() {
  let fixed = 0, failed = 0;
  const results = []; // { id, name, oldCui: null, newCui }

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const url = t.source || t.url;
    if (!url) { failed++; continue; }

    const html = await fetchUrl(url);
    if (!html) { failed++; continue; }

    const cui = extractCuisine(html);
    if (cui) {
      results.push({ id: t.id, name: t.name, newCuisine: cui, source: url });
      fixed++;
    }

    if ((i + 1) % 20 === 0) {
      console.log(`[${i+1}/${targets.length}] 已修复 ${fixed}, 失败 ${failed}`);
    }
    await sleep(200);
  }

  // 保存补全结果
  const out = {
    source: 'cuisine-backfill · re-parse crawled detail pages',
    scope: '菜系补全（重新解析已抓页面）',
    fetchDate: new Date().toISOString().slice(0, 10),
    results,
    stats: { total: targets.length, fixed, failed }
  };
  fs.writeFileSync(path.join(DATA_DIR, 'cuisine-backfill.json'), JSON.stringify(out, null, 2));
  console.log(`\n完成: ${fixed}/${targets.length} 条成功提取菜系`);
  console.log('输出: data/cuisine-backfill.json');
}

main().catch(e => { console.error(e); process.exit(1); });
