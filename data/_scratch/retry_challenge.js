// 重抓被反爬挑战页拦截的 16 篇
const http = require('http');
const fs = require('fs');
const path = require('path');

function fetch(url, cookies = '') {
  return new Promise((resolve, reject) => {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'Referer': 'http://www.cyxh.org/'
    };
    if (cookies) headers['Cookie'] = cookies;
    const req = http.get(url, { timeout: 25000, headers }, (res) => {
      const setCookie = res.headers['set-cookie'] || [];
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ html: Buffer.concat(chunks).toString('utf8'), setCookie }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithChallenge(url) {
  // 第一次访问，拿到 Set-Cookie 中的 _wtsjsk
  const first = await fetch(url);
  // 检测是否是挑战页
  if (!first.html.includes('Browser security check') && first.html.length > 2000) {
    return first.html;
  }
  // 拼接挑战页中 document.cookie 设置的 _wtsjsk + 服务器的 Set-Cookie
  const cookies = [];
  const m1 = first.html.match(/document\.cookie\s*=\s*"([^"]+)"/);
  if (m1) cookies.push(m1[1].split(';')[0]);
  first.setCookie.forEach(c => cookies.push(c.split(';')[0]));
  const cookieStr = cookies.join('; ');
  await sleep(2000);
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, cookieStr);
    if (!r.html.includes('Browser security check') && r.html.length > 2000) {
      return r.html;
    }
    await sleep(2000);
  }
  return null;
}

const failed = ['214', '227', '237', '250', '256', '257', '260', '262', '263', '264', '266', '269', '270', '280', '283', '284'];

(async () => {
  const outDir = 'data/_scratch/html';
  let ok = 0, fail = 0;
  for (const id of failed) {
    const url = `http://www.cyxh.org/mingchu/zishen/${id}.html`;
    try {
      const html = await fetchWithChallenge(url);
      if (html) {
        fs.writeFileSync(path.join(outDir, `zishen_${id}.html`), html);
        console.log(`OK zishen/${id}: ${html.length}c`);
        ok++;
      } else {
        console.log(`FAIL zishen/${id}: still challenged`);
        fail++;
      }
    } catch (e) {
      console.log(`FAIL zishen/${id}: ${e.message}`);
      fail++;
    }
  }
  console.log(`Retry done: ${ok} ok, ${fail} fail`);
})();
