// 解析所有详情 HTML，输出清洗后的文本，方便 LLM 后续结构化
const fs = require('fs');
const path = require('path');

const dir = 'data/_scratch/html';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

function stripTags(html) {
  // 删除 script/style
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<style[\s\S]*?<\/style>/gi, '');
  // 提取 myPrintArea 内容
  const m = html.match(/<div[^>]*id=["']myPrintArea["'][^>]*>([\s\S]*?)<\/div>\s*<!--gongneng/);
  let body = m ? m[1] : html;
  // 转 br/p 为换行
  body = body.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<\/h[1-6]>/gi, '\n');
  // 删除 HTML 标签
  body = body.replace(/<[^>]+>/g, '');
  // 解码常见 entity
  body = body.replace(/&nbsp;/g, ' ').replace(/&middot;/g, '·').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  // 合并多空白
  body = body.split('\n').map(l => l.trim()).filter(l => l).join('\n');
  return body;
}

function extractPortrait(html, col) {
  // 找正文第一张人物照
  const re = /<img[^>]+src=["'](\/d\/file\/mingchu\/[^"']+\.(jpg|jpeg|png|webp))["']/gi;
  let m;
  while ((m = re.exec(html))) {
    return 'http://www.cyxh.org' + m[1];
  }
  return null;
}

function extractTitle(html) {
  const m = html.match(/<h1>([\s\S]*?)<\/h1>/);
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : '';
}

function extractDate(html) {
  const m = html.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

const out = [];
for (const f of files.sort()) {
  const html = fs.readFileSync(path.join(dir, f), 'utf8');
  const [col, idExt] = f.replace('.html', '').split('_');
  const id = idExt;
  const title = extractTitle(html);
  const portrait = extractPortrait(html, col);
  const body = stripTags(html);
  out.push({ col, id, title, portrait, body });
}

fs.writeFileSync('data/_scratch/parsed.json', JSON.stringify(out, null, 2));
console.log(`Parsed ${out.length} pages.`);
console.log(`With portrait: ${out.filter(x => x.portrait).length}`);
// 输出汇总
out.forEach(o => {
  console.log(`---\n[${o.col}/${o.id}] ${o.title}\nPortrait: ${o.portrait}\nBody(${o.body.length}c): ${o.body.slice(0, 200)}...`);
});
