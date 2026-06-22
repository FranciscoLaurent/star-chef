const fs = require('fs');
const buf = fs.readFileSync('D:/Study/AI_Space/play-CC/star_chef/lml_toutiao2.html');
const { TextDecoder } = require('util');
const dec = new TextDecoder('utf-8');
const text = dec.decode(buf);
const stripHtml = s => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ');
const plain = stripHtml(text);
let idxs = [];
let from = 0;
while ((idx = plain.indexOf('兰明路', from)) !== -1 && idxs.length < 5) {
  idxs.push(idx);
  from = idx + 1;
}
idxs.forEach(i => console.log('---idx', i, '---', plain.slice(Math.max(0, i - 200), i + 1000)));
console.log('=== end ===');
// Also search for 史正良
let s_idxs = [];
from = 0;
while ((idx = plain.indexOf('史正良', from)) !== -1 && s_idxs.length < 5) {
  s_idxs.push(idx);
  from = idx + 1;
}
s_idxs.forEach(i => console.log('---SZL idx', i, '---', plain.slice(Math.max(0, i - 200), i + 1000)));
