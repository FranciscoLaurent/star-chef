// 输出所有解析记录的精简版（body + 元信息），方便 LLM 阅读结构化
const fs = require('fs');
const p = JSON.parse(fs.readFileSync('data/_scratch/parsed.json', 'utf8'));

let out = '';
p.forEach(x => {
  out += `\n========== ${x.col}/${x.id} ==========\n`;
  out += `URL: http://www.cyxh.org/mingchu/${x.col}/${x.id}.html\n`;
  out += `TITLE: ${x.title}\n`;
  out += `PORTRAIT: ${x.portrait}\n`;
  out += `BODY:\n${x.body}\n`;
});
fs.writeFileSync('data/_scratch/all_bodies.txt', out);
console.log('Wrote ' + out.length + ' chars to all_bodies.txt');
