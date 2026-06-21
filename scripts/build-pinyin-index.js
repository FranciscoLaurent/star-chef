#!/usr/bin/env node
// build-pinyin-index.js
// 为 _slim.json 每位厨师生成拼音字段，输出 _slim-pinyin.json
// 拼音数据来源：mozillazg/pinyin-data 的 kMandarin_8105.txt（通用规范汉字表 8105 字最常用读音）

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SLIM = path.join(ROOT, 'data', '_slim.json');
const PINYIN_SRC = path.join(ROOT, 'data', '_pinyin', 'kMandarin_8105.txt');
const OUT = path.join(ROOT, 'data', '_slim-pinyin.json');

// —— 解析拼音表 ——
const TONE_MAP = { ā:'a',á:'a',ǎ:'a',à:'a',ē:'e',é:'e',ě:'e',è:'e',ī:'i',í:'i',ǐ:'i',ì:'i',ō:'o',ó:'o',ǒ:'o',ò:'o',ū:'u',ú:'u',ǔ:'u',ù:'u',ǖ:'u',ǘ:'u',ǚ:'u',ǜ:'u',ü:'u' };
function stripTone(s) {
  return s.replace(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/g, c => TONE_MAP[c] || c);
}
const pinyinMap = new Map(); // 字 -> 拼音（不带声调）
const raw = fs.readFileSync(PINYIN_SRC, 'utf8');
for (const line of raw.split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const m = line.match(/^U\+([0-9A-F]+):\s*([a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]+)/i);
  if (!m) continue;
  const code = parseInt(m[1], 16);
  const char = String.fromCodePoint(code);
  const pinyin = stripTone(m[2].toLowerCase());
  pinyinMap.set(char, pinyin);
}
console.log(`拼音表加载: ${pinyinMap.size} 字`);

// —— 工具：文本转拼音 ——
function toPinyin(text) {
  let result = '';
  let initial = '';
  for (const ch of text) {
    if (/[一-鿿]/.test(ch)) {
      const p = pinyinMap.get(ch);
      if (p) {
        result += (result ? ' ' : '') + p;
        initial += p[0];
      }
    } else if (/[a-zA-Z0-9]/.test(ch)) {
      result += ch;
      initial += ch.toLowerCase();
    }
  }
  return { full: result, initial };
}

// —— 读 _slim.json ——
const slim = JSON.parse(fs.readFileSync(SLIM, 'utf8'));

let missingChars = new Set();
let processed = 0;

for (const chef of slim.chefs) {
  // 姓名拼音
  const namePy = toPinyin(chef.name || '');
  // 索引字段拼音（name + primaryCuisine 中文 + titles + currentRole + city + signature）
  const indexFields = [
    chef.name || '',
    chef.primaryCuisine || '',
    ...(chef.secondaryCuisines || []),
    chef.school || '',
    ...(chef.titles || []),
    chef.currentRole || '',
    chef.restaurant || '',
    chef.city || '',
    ...(chef.signature || []),
  ].filter(Boolean).join(' ');
  const indexPy = toPinyin(indexFields);

  chef.pinyin = {
    name: namePy.full,
    nameInitial: namePy.initial,
    nameCompact: namePy.full.replace(/\s+/g, ''),
    all: indexPy.full,
    allInitial: indexPy.initial,
  };

  // 统计未覆盖字
  for (const ch of (chef.name || '')) {
    if (/[一-鿿]/.test(ch) && !pinyinMap.has(ch)) missingChars.add(ch);
  }
  processed++;
}

console.log(`处理 ${processed} 位厨师`);
console.log(`未覆盖字 (${missingChars.size}): ${[...missingChars].join('') || '无'}`);

// —— 输出 ——
fs.writeFileSync(OUT, JSON.stringify(slim));
console.log(`\n输出: ${OUT}`);
console.log(`大小: ${(fs.statSync(OUT).size / 1024).toFixed(1)} KB`);

// —— 验证：刘冲 ——
const lc = slim.chefs.find(c => c.name === '刘冲');
if (lc) {
  console.log('\n验证 刘冲:');
  console.log('  name:', lc.pinyin.name);
  console.log('  nameInitial:', lc.pinyin.nameInitial);
  console.log('  nameCompact:', lc.pinyin.nameCompact);
}
const lm = slim.chefs.find(c => c.name === '蓝光鉴');
if (lm) {
  console.log('\n验证 蓝光鉴:');
  console.log('  name:', lm.pinyin.name);
  console.log('  nameInitial:', lm.pinyin.nameInitial);
}
