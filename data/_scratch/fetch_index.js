// 抓索引页提取详情页 URL
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
  const pages = [
    ['zishen', 7], ['zishen', 8], ['zishen', 9], ['zishen', 10],
    ['zishen', 11], ['zishen', 12], ['zishen', 13],
    ['yuanlao', 6], ['yuanlao', 7], ['yuanlao', 8], ['yuanlao', 9],
    ['yuanlao', 10], ['yuanlao', 11], ['yuanlao', 12]
  ];
  for (const [col, p] of pages) {
    const url = `http://www.cyxh.org/mingchu/${col}/index_${p}.html`;
    try {
      const html = await fetch(url);
      const ids = [...new Set([...html.matchAll(new RegExp(`/mingchu/${col}/(\\d+)\\.html`, 'g'))].map(m => m[1]))];
      result[`${col}_${p}`] = ids;
      console.log(`${col} p${p}: ${ids.length} -> ${ids.join(',')}`);
    } catch (e) {
      console.log(`${col} p${p}: ERR ${e.message}`);
      result[`${col}_${p}`] = [];
    }
  }
  fs.writeFileSync('D:/Study/AI_Space/play-CC/star_chef/data/_scratch/index_ids.json', JSON.stringify(result, null, 2));
})();
