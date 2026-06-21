#!/usr/bin/env node
// cmccx.cn (中国名厨查询网) 爬虫
const fs = require('fs');
const path = require('path');
const DATA_DIR = path.join(__dirname, '..', 'data');
const OUT = path.join(DATA_DIR, 'cmccx-chefs.json');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchUrl(url, retries=2) {
  for (let a=0; a<=retries; a++) {
    try {
      const ctl = new AbortController();
      const tm = setTimeout(()=>ctl.abort(), 12000);
      const r = await fetch(url, {signal:ctl.signal, headers:{'User-Agent':UA,'Accept':'text/html','Accept-Language':'zh-CN,zh;q=0.9'}});
      clearTimeout(tm);
      if (r.status===200) { const t=await r.text(); if (t.length>3000) return t; }
      if (r.status===403||r.status===429) { await sleep(3000); continue; }
    } catch(e) { if (a<retries) await sleep(2000); }
  }
  return null;
}

// cmccx.cn 的各栏目列表页
const SECTIONS = [
  { name: 'pengtantaidou', label: '国宝级功勋大师', pages: 5 },
  { name: 'pengtanxianfeng', label: '烹饪先锋', pages: 5 },
  { name: 'mingchugushi', label: '名厨故事', pages: 5 },
  { name: 'chuyirensheng', label: '厨艺人生', pages: 5 },
];

function extractNames(html) {
  const names = new Set();
  const re = /href="\/a\/[^"]+\/(\d+)\.html"[^>]*>([^<]{2,30})<\/a>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const name = m[2].replace(/<[^>]+>/g,'').trim();
    if (/^[一-龥]{2,5}$/.test(name)) names.add(name);
  }
  // Also try: title tags
  const titleRe = /<a[^>]*href="(\/a\/[^"]+)"[^>]*title="([^"]+)"/g;
  while ((m = titleRe.exec(html)) !== null) {
    const name = m[2].trim();
    if (/^[一-龥]{2,5}$/.test(name)) names.add(name);
  }
  return [...names];
}

function parseDetail(html, url) {
  const allText = html.replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ');

  // title
  const titleM = html.match(/<title>([^<]+)<\/title>/);
  const title = titleM?.[1] || '';
  let name = title.split(/[|_\-]/)[0].replace(/^[【\[]/, '').replace(/[】\]]$/, '').trim();
  const nameM = name.match(/^([一-龥]{2,4})/);
  if (!nameM) return null;
  name = nameM[1];

  // 菜系
  let cui = null;
  const cuiOrder = ['淮扬','川','粤','鲁','湘','浙','徽','闽','京','沪','晋','豫','黔','滇','辽','鄂','楚','陕','赣','清真','国宴','宫廷'];
  for (const c of cuiOrder) {
    if (new RegExp(c+'(?:菜|帮菜|帮)').test(allText) || new RegExp(c+'菜大师|'+c+'菜泰斗').test(title)) {
      cui = c==='楚'?'鄂':c;
      break;
    }
  }

  // 师承
  const masters = [];
  const mRe = /(?:师承|师从|拜)(?:了)?\s*([一-龥]{2,4})\s*(?:大师|先生|师傅|师父)?/g;
  let mm;
  const seen = new Set();
  while ((mm = mRe.exec(allText)) !== null) {
    const mn = mm[1];
const SURNAME_SET = new Set('王李张刘陈杨黄赵吴周徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭曾肖田董袁潘于蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦付方白邹孟熊秦邱江尹薛闫段雷侯龙史陶黎贺顾毛郝龚邵万钱严覃武戴莫孔向汤裴温和耿冷牛奎欧司诸上皇令慕殷常乔房'.split(''));
    if (!seen.has(mn) && SURNAME_SET.has(mn[0])) {
      seen.add(mn);
      masters.push({name:mn, rawText:mm[0].slice(0,60)});
    }
  }

  // 头衔
  const titles = [];
  const tRe = /(中国烹饪大师|中国烹饪名师|国家名厨|中华名厨|国宴大师|高级技师|烹饪大师|面点大师)/g;
  let tm;
  while ((tm = tRe.exec(allText)) !== null) if (!titles.includes(tm[0])) titles.push(tm[0]);

  // 出生年
  const birthM = allText.match(/(\d{4})\s*年[\s\d月]*生/) || allText.match(/生于(\d{4})/);
  const birth = birthM ? parseInt(birthM[1]) : null;

  // 简介
  const bio = allText.slice(0, 500);

  // 照片
  const imgM = html.match(/src=["'](\/uploads\/[^"']+\.(jpg|png|jpeg))["']/);
  const portrait = imgM ? 'http://www.cmccx.cn'+imgM[1] : null;

  return { id:'cmccx-'+Date.now()+'-'+Math.random().toString(36).slice(2,6), url, name, primaryCuisine:cui, secondaryCuisines:[], birth, death:null, birthplace:null, gender:null, titles, masters, signature:[], portrait, bio, source:url };
}

async function main() {
  console.log('=== cmccx.cn 爬虫 ===');
  const allChefs = [];
  const seenNames = new Set(); // 防止同一页面重复

  for (const sec of SECTIONS) {
    console.log(`\n栏目: ${sec.label}`);
    for (let p=1; p<=sec.pages; p++) {
      const url = p===1
        ? `http://www.cmccx.cn/a/chujiexianfengmingrenbang/${sec.name}/`
        : `http://www.cmccx.cn/a/chujiexianfengmingrenbang/${sec.name}/index_${p}.html`;
      const html = await fetchUrl(url);
      if (!html) { console.log(`  页${p}: 无内容`); continue; }

      // 提取详情链接
      const detailUrls = [];
      const re = /href="(\/a\/chujiexianfengmingrenbang\/[^"]+\.html)"/g;
      let m;
      while ((m = re.exec(html)) !== null) detailUrls.push('http://www.cmccx.cn'+m[1]);

      console.log(`  页${p}: ${detailUrls.length} 个详情链接`);

      for (const dUrl of detailUrls) {
        const dHtml = await fetchUrl(dUrl);
        if (!dHtml) continue;
        const chef = parseDetail(dHtml, dUrl);
        if (chef && chef.name && !seenNames.has(chef.name)) {
          seenNames.add(chef.name);
          allChefs.push(chef);
        }
        await sleep(300);
      }
      await sleep(300);
    }
  }

  // 保存
  const byCui = {};
  allChefs.forEach(c => { const k=c.primaryCuisine||'?'; byCui[k]=(byCui[k]||0)+1; });

  fs.writeFileSync(OUT, JSON.stringify({
    source:'中国名厨查询网 cmccx.cn',
    scope:'国宝级功勋大师+烹饪先锋+名厨故事+厨艺人生',
    fetchDate:new Date().toISOString().slice(0,10),
    chefs:allChefs,
    stats:{total:allChefs.length, byCuisine:byCui, withMasters:allChefs.filter(c=>c.masters?.length>0).length}
  },null,2));

  console.log(`\n=== cmccx 完成: ${allChefs.length} chefs ===`);
  console.log('byCuisine:', JSON.stringify(byCui));
  console.log('output:', OUT);
}

main().catch(e=>{console.error(e);process.exit(1);});
