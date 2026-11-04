// 头像本地化：把数据里的 portrait 外链下载到 web/public/portraits/
// 用法：node web/scripts/fetch-portraits.mjs
//       node web/scripts/fetch-portraits.mjs --limit 200   # 只处理前 200 条（分批调试）
// 特性：并发 6、单张 10s 超时、失败重试 1 次、断点续跑（已存在跳过）、每 100 张打印进度
//
// 说明：只读取 web/public/data/chefs.json（生成产物），不修改 data/ 原始数据。

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const DATA = resolve(ROOT, 'web/public/data/chefs.json');
const OUT = resolve(ROOT, 'web/public/portraits');
const FAIL_FILE = resolve(__dirname, 'portrait-failures.json');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const CONCURRENCY = 6;
const TIMEOUT_MS = 10_000;

mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const limitArg = args.indexOf('--limit');
const LIMIT = limitArg >= 0 ? Number(args[limitArg + 1]) || 0 : 0;

const data = JSON.parse(readFileSync(DATA, 'utf8'));
const targets = data.chefs.filter(c => {
  if (!c.portrait || !/^https?:\/\//i.test(c.portrait)) return false;
  const ext = extname(new URL(c.portrait).pathname).toLowerCase().replace('.', '');
  return ['jpg', 'jpeg', 'png', 'webp'].includes(ext);
});

const pool = LIMIT ? targets.slice(0, LIMIT) : targets;
console.log(`目标 ${pool.length} 张（数据中 ${data.chefs.filter(c => c.portrait).length} 个 portrait 字段）`);

const failures = [];
const byReason = {};
let ok = 0, existed = 0, failed = 0, done = 0;

function addReason(reason) { byReason[reason] = (byReason[reason] || 0) + 1; }

function extOf(url) {
  try {
    const e = extname(new URL(url).pathname).toLowerCase().replace('.', '');
    return ['jpg', 'jpeg', 'png', 'webp'].includes(e) ? e : null;
  } catch { return null; }
}

function sniff(buf, contentType) {
  if (!buf || buf.length < 12) return null;
  const b = buf;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (/gif/i.test(contentType || '')) return null;
  if (/^image\//i.test(contentType || '')) return 'jpg'; // 未知图片格式，按 jpg 存
  return null;
}

async function downloadOnce(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const origin = new URL(url).origin;
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': UA,
        'Referer': `${origin}/`,
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
    });
    if (!res.ok) {
      return { error: res.status === 403 || res.status === 401 ? 'blocked' : res.status === 404 ? 'notfound' : 'http-' + res.status };
    }
    const contentType = res.headers.get('content-type') || '';
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = sniff(buf, contentType) || extOf(url);
    if (!ext) return { error: 'notimage' };
    if (/text\/html/i.test(contentType)) return { error: 'notimage' };
    return { buf, ext };
  } catch (e) {
    return { error: e?.name === 'AbortError' ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}

async function handle(chef) {
  const url = chef.portrait;
  const ext = extOf(url);
  if (!ext) { failed++; addReason('unsupported-type'); failures.push({ id: chef.id, name: chef.name, url, reason: 'unsupported-type' }); return; }

  const file = resolve(OUT, `${chef.id}.${ext}`);
  if (existsSync(file) && statSync(file).size > 800) { existed++; return; }

  let res = await downloadOnce(url);
  if (res.error) res = await downloadOnce(url); // 重试 1 次

  if (res.error) {
    failed++;
    addReason(res.error);
    failures.push({ id: chef.id, name: chef.name, url, reason: res.error });
    return;
  }
  writeFileSync(file, res.buf);
  ok++;
}

async function main() {
  let cursor = 0;
  const started = Date.now();

  const worker = async () => {
    while (true) {
      const i = cursor++;
      if (i >= pool.length) return;
      await handle(pool[i]);
      done++;
      if (done % 100 === 0 || done === pool.length) {
        const rate = done / ((Date.now() - started) / 1000);
        console.log(`  ${done}/${pool.length} · 成功 ${ok} · 已存在 ${existed} · 失败 ${failed} · ${rate.toFixed(1)} 张/秒`);
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  writeFileSync(FAIL_FILE, JSON.stringify({
    generatedAt: new Date().toISOString(),
    total: pool.length,
    ok,
    existed,
    failed,
    byReason,
    failures,
  }, null, 2), 'utf8');

  console.log('— 完成 —');
  console.log(`  成功下载 ${ok} · 已有跳过 ${existed} · 失败 ${failed}`);
  console.log(`  失败原因：${Object.entries(byReason).map(([k, v]) => `${k} ${v}`).join(' · ') || '无'}`);
  console.log(`  失败清单：${FAIL_FILE.replace(ROOT + '\\', '')}`);
}

main();
