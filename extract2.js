const fs = require('fs');
const buf = fs.readFileSync('D:/Study/AI_Space/play-CC/star_chef/sohu_lml.html');
const { TextDecoder } = require('util');
const dec = new TextDecoder('utf-8');
const text = dec.decode(buf);
const stripHtml = s => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ');
const plain = stripHtml(text);
const idx = plain.indexOf('兰明路');
console.log(plain.slice(Math.max(0, idx - 200), idx + 6000));
