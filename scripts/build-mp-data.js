#!/usr/bin/env node
// build-mp-data.js
// 从 data/chefs-merged.json 生成小程序专用数据 miniprogram/data/chefs-real.js
// 裁剪字段控制包体（目标 < 600KB），并为每位厨师预生成拼音索引（姓名全拼/首字母/紧凑拼）
// 用法: node scripts/build-mp-data.js

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'data', 'chefs-merged.json');
const PINYIN_SRC = path.join(ROOT, 'data', '_pinyin', 'kMandarin_8105.txt');
const OUT_DIR = path.join(ROOT, 'miniprogram', 'data');
const OUT = path.join(OUT_DIR, 'chefs-real.js');

// —— 拼音表（复用 build-pinyin-index.js 的方案）——
const TONE_MAP = { ā:'a',á:'a',ǎ:'a',à:'a',ē:'e',é:'e',ě:'e',è:'e',ī:'i',í:'i',ǐ:'i',ì:'i',ō:'o',ó:'o',ǒ:'o',ò:'o',ū:'u',ú:'u',ǔ:'u',ù:'u',ǖ:'u',ǘ:'u',ǚ:'u',ǜ:'u',ü:'u' };
const stripTone = s => s.replace(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/g, c => TONE_MAP[c] || c);
const pinyinMap = new Map();
for (const line of fs.readFileSync(PINYIN_SRC, 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const m = line.match(/^U\+([0-9A-F]+):\s*([a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]+)/i);
  if (!m) continue;
  pinyinMap.set(String.fromCodePoint(parseInt(m[1], 16)), stripTone(m[2].toLowerCase()));
}

function toPinyin(text) {
  let full = '', initial = '';
  for (const ch of text) {
    if (/[一-鿿]/.test(ch)) {
      const p = pinyinMap.get(ch);
      if (p) { full += p; initial += p[0]; }
    } else if (/[a-zA-Z0-9]/.test(ch)) {
      full += ch.toLowerCase(); initial += ch.toLowerCase();
    }
  }
  return { full, initial };
}

// —— 读源数据 ——
const merged = JSON.parse(fs.readFileSync(SRC, 'utf8'));

// 字段裁剪：师承谱展示与搜索需要的最小集合
const chefs = merged.chefs.map(x => {
  const py = toPinyin(x.name || '');
  return {
    id: x.id,
    name: x.name,
    school: x.school || null,
    gen: x.gen || null,
    master: x.master || null,
    cuisine: x.primaryCuisine || null,
    era: x.era || null,
    birth: x.birth || null,
    death: x.death || null,
    birthplace: x.birthplace || null,
    titles: (x.titles || []).slice(0, 2),
    signature: (x.signature || []).slice(0, 4),
    restaurant: x.restaurant || null,
    position: x.position || null,
    city: x.city || null,
    bio: (x.bio || '').slice(0, 120),
    portrait: x.portrait || null,
    isPlaceholder: !!x.isPlaceholder,
    py: { n: py.full, i: py.initial }
  };
});

// 流派元数据去掉内部字段
const schools = (merged.schools || []).map(({ key, stamp, name, subName, en, region, styles, desc, _cuisine }) =>
  ({ key, stamp, name, subName, en, region, styles, desc, cuisine: _cuisine }));

const stats = {
  total: chefs.length,
  withMaster: chefs.filter(c => c.master).length,
  withPortrait: chefs.filter(c => c.portrait).length,
  cuisines: new Set(chefs.map(c => c.cuisine).filter(Boolean)).size
};

const payload = { generatedAt: new Date().toISOString(), stats, schools, chefs };

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
const banner = '// 【生成产物 勿手改】由 scripts/build-mp-data.js 从 data/chefs-merged.json 生成\n';
fs.writeFileSync(OUT, banner + 'module.exports = ' + JSON.stringify(payload) + ';\n');

const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log(`厨师: ${stats.total} | 有师承: ${stats.withMaster} | 有头像: ${stats.withPortrait} | 菜系: ${stats.cuisines}`);
console.log(`输出: ${OUT} (${kb} KB)`);
