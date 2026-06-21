// 继续抓 zishen 更深的索引页
const http = require('http');
const fs = require('fs');

function fetch(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

(async () => {
  const result = {};
  const pages = [14, 15, 16, 17, 18, 19, 20, 21, 22];
  for (const p of pages) {
    const url = `http://www.cyxh.org/mingchu/zishen/index_${p}.html`;
    try {
      const html = await fetch(url);
      const ids = [...new Set([...html.matchAll(/\/mingchu\/zishen\/(\d+)\.html/g)].map(m => m[1]))];
      result[`zishen_${p}`] = ids;
      console.log(`zishen p${p}: ${ids.length} -> ${ids.join(',')}`);
      if (ids.length === 0) break;
    } catch (e) {
      console.log(`zishen p${p}: ERR ${e.message}`);
      result[`zishen_${p}`] = [];
    }
  }
  fs.writeFileSync('data/_scratch/index_ids_deep.json', JSON.stringify(result, null, 2));
})();
