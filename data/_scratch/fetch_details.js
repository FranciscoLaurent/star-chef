// 并发抓 cyxh 详情页 HTML，保存到本地
const http = require('http');
const fs = require('fs');
const path = require('path');

function fetch(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 25000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

const newIds = JSON.parse(fs.readFileSync('data/_scratch/new_ids_all.json', 'utf8'));

// 目标 ~65 篇：yuanlao 全部 12 + zishen 53 个
const targets = [];
newIds.yuanlao.forEach(id => targets.push(['yuanlao', id]));
newIds.zishen.slice(0, 55).forEach(id => targets.push(['zishen', id]));

const outDir = 'data/_scratch/html';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

async function runBatch(items, concurrency = 6) {
  const results = [];
  let idx = 0;
  let done = 0;
  const total = items.length;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      const [col, id] = items[i];
      const url = `http://www.cyxh.org/mingchu/${col}/${id}.html`;
      const file = path.join(outDir, `${col}_${id}.html`);
      if (fs.existsSync(file) && fs.statSync(file).size > 1000) {
        done++;
        continue;
      }
      let html = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          html = await fetch(url);
          break;
        } catch (e) {
          if (attempt === 1) console.log(`FAIL ${col}/${id}: ${e.message}`);
        }
      }
      if (html) {
        fs.writeFileSync(file, html);
        results.push([col, id, true]);
      } else {
        results.push([col, id, false]);
      }
      done++;
      if (done % 5 === 0) console.log(`progress ${done}/${total}`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

(async () => {
  console.log(`Fetching ${targets.length} detail pages...`);
  const res = await runBatch(targets, 6);
  const ok = res.filter(r => r[2]).length;
  const fail = res.filter(r => !r[2]).length;
  console.log(`Done: ${ok} ok, ${fail} fail`);
  fs.writeFileSync('data/_scratch/fetch_results.json', JSON.stringify(res, null, 2));
})();
