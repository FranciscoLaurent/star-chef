#!/usr/bin/env node
// build-d7-card-size.js
// 师承谱卡片尺寸统一 · 三方案对比 demo
// A: 固定尺寸+截断  B: 固定宽+行内等高  C: 简短meta自然等高

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data', '_slim-pinyin.json');
const OUT = path.join(ROOT, 'lineage_demo', 'demo-D7-card-size.html');

const dataStr = fs.readFileSync(DATA, 'utf8');

const HEAD = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>星厨传承 · D7 · 卡片尺寸对比</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,ital@9..144,300..700,0;9..144,300..700,1&family=Noto+Serif+SC:wght@400;600;700&family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500&display=swap" rel="stylesheet" />
<style>
  :root{
    --paper:#ede8db; --paper-2:#e3dcc8; --paper-3:#d8cfb6;
    --ink:#12100e; --ink-soft:#3a3530;
    --vermillion:#ca6c52; --vermillion-deep:#a3503b;
    --moss:#4a5a3f; --gold:#a67c00; --dust:#8b8270;
    --rule:rgba(18,16,14,.12); --rule-strong:rgba(18,16,14,.22);
    --serif:'Fraunces','Noto Serif SC',serif;
    --songti:'Noto Serif SC','Fraunces',serif;
    --sans:'Inter','Noto Serif SC',sans-serif;
    --mono:'JetBrains Mono',monospace;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{background:var(--paper);color:var(--ink);font-family:var(--sans);height:100%}
  body{overflow:auto}
  ::selection{background:var(--vermillion);color:var(--paper)}

  .top{
    display:flex;align-items:flex-end;justify-content:space-between;
    padding:18px 32px 10px;border-bottom:1px solid var(--ink);background:var(--paper);
  }
  .top h1{font-family:var(--serif);font-weight:500;font-size:24px;font-variation-settings:"opsz" 144}
  .top h1 em{font-style:italic;color:var(--vermillion)}
  .top .crumb{font-family:var(--mono);font-size:10px;letter-spacing:.2em;color:var(--dust);text-transform:uppercase;margin-top:3px}

  /* 方案切换 tab */
  .mode-bar{display:flex;padding:0 32px;border-bottom:1px solid var(--ink);background:var(--paper-2)}
  .form-tab{
    padding:10px 20px 9px;cursor:pointer;position:relative;
    font-family:var(--mono);font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;
    color:var(--ink-soft);border-right:1px solid var(--rule);user-select:none;transition:background .15s;
    display:flex;gap:8px;align-items:baseline;
  }
  .form-tab:hover{background:var(--paper-3)}
  .form-tab .tag{font-family:var(--serif);font-style:italic;font-size:14px;color:var(--vermillion)}
  .form-tab .zh{font-family:var(--songti);letter-spacing:.1em;font-size:12px}
  .form-tab.active{background:var(--ink);color:var(--paper)}
  .form-tab.active .tag{color:var(--paper)}
  .form-tab.active::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--vermillion)}

  /* 菜系切换 */
  .cuisine-bar{display:flex;flex-wrap:wrap;gap:0;padding:0 32px;border-bottom:1px solid var(--rule);background:var(--paper)}
  .cu-tab{
    padding:8px 14px;cursor:pointer;
    font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;
    color:var(--ink-soft);border-right:1px solid var(--rule);user-select:none;
  }
  .cu-tab:hover{background:var(--paper-2)}
  .cu-tab.active{background:var(--vermillion);color:var(--paper)}

  /* 方案说明 */
  .scheme-desc{
    padding:10px 32px;background:var(--paper-2);border-bottom:1px solid var(--rule);
    font-family:var(--songti);font-size:12px;color:var(--ink-soft);line-height:1.6;
  }
  .scheme-desc em{font-family:var(--serif);font-style:italic;color:var(--vermillion)}

  /* 主区域 */
  .stage{padding:24px 32px 60px;min-height:calc(100vh - 180px)}
  .section-label{
    font-family:var(--mono);font-size:10px;letter-spacing:.22em;color:var(--dust);text-transform:uppercase;
    margin-bottom:14px;display:flex;align-items:center;gap:14px;
  }
  .section-label::after{content:"";flex:1;border-bottom:1px solid var(--rule)}
  .section-label em{font-family:var(--serif);font-style:italic;color:var(--vermillion);font-size:13px;letter-spacing:0}

  /* gen-row 布局（复用 D5） */
  .gen-row{display:grid;grid-template-columns:90px 1fr;gap:18px;padding:18px 0;border-bottom:1px solid var(--rule)}
  .gen-row:last-child{border-bottom:0}
  .gen-label{padding-top:4px}
  .gen-label .num{font-family:var(--serif);font-style:italic;font-size:30px;color:var(--vermillion);line-height:1;font-variation-settings:"opsz" 144}
  .gen-label .zh{font-family:var(--songti);font-size:13px;color:var(--ink-soft);margin-top:4px;letter-spacing:.06em}
  .gen-label .en{font-family:var(--mono);font-size:9px;letter-spacing:.18em;color:var(--dust);text-transform:uppercase;margin-top:3px}
  .gen-people{display:flex;flex-wrap:wrap;gap:14px}

  /* 人物卡基础（三种方案共用） */
  .person{
    display:grid;grid-template-columns:auto 1fr;gap:11px;align-items:center;
    padding:9px 14px 9px 9px;background:var(--paper);
    border:1px solid rgba(18,16,14,.2);cursor:pointer;position:relative;
    transition:transform .2s,box-shadow .2s,border-color .2s;
  }
  .person:hover{transform:translate(-2px,-2px);box-shadow:4px 4px 0 var(--vermillion);border-color:var(--ink)}
  .person.active{background:var(--ink);color:var(--paper);border-color:var(--ink);box-shadow:6px 6px 0 var(--vermillion)}
  .person.active .p-meta{color:rgba(237,232,219,.7)}
  .person.active .p-yrs{color:rgba(237,232,219,.55)}
  .person.active .c-pri{background:var(--paper);color:var(--ink);border-color:var(--paper)}

  .p-cuisines{position:relative;width:42px;height:54px;flex-shrink:0}
  .c-pri{
    width:38px;height:48px;background:var(--vermillion);color:var(--paper);
    display:grid;place-items:center;font-family:var(--songti);font-weight:700;font-size:20px;
    position:relative;
  }
  .c-pri::after{content:"";position:absolute;inset:-3px;border:1px dashed rgba(202,108,82,.55)}
  .person.active .c-pri::after{border-color:rgba(237,232,219,.4)}

  .p-name{font-family:var(--songti);font-size:15.5px;font-weight:700;letter-spacing:.04em;line-height:1.15}
  .p-yrs{font-family:var(--serif);font-style:italic;font-size:11.5px;color:var(--ink-soft);margin-top:3px;font-variation-settings:"opsz" 144}
  .p-meta{font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;color:var(--ink-soft);margin-top:3px}

  .person.placeholder{border-style:dashed;background:var(--paper)}
  .person.placeholder .c-pri{background:var(--paper);color:var(--dust);border:1px dashed var(--dust)}
  .person.placeholder .p-name{color:var(--dust);font-weight:500}

  /* ============ 方案 A：固定尺寸 + 截断 ============ */
  .mode-A .person{ width:230px; height:96px; overflow:hidden; }
  .mode-A .p-meta{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:160px; }

  /* ============ 方案 B：固定宽度 + 行内等高 ============ */
  .mode-B .person{ width:230px; }
  .mode-B .gen-people{ align-items:stretch; }
  .mode-B .person > div:last-child{ display:flex; flex-direction:column; justify-content:center; min-height:54px; }

  /* ============ 方案 C：简短 meta 自然等高 ============ */
  .mode-C .person{ width:230px; }
  .mode-C .gen-people{ align-items:stretch; }

  /* 滚动条 */
  ::-webkit-scrollbar{width:8px;height:8px}
  ::-webkit-scrollbar-thumb{background:rgba(18,16,14,.18);border-radius:4px}
</style>
</head>`;

const BODY = `<body>
  <header class="top">
    <div>
      <h1>星厨传承 <em>D7</em> · 卡片尺寸对比</h1>
      <div class="crumb">CARD SIZE COMPARISON · A FIXED · B STRETCH · C SHORT META</div>
    </div>
  </header>

  <div class="mode-bar">
    <div class="form-tab active" data-mode="A"><span class="tag">A</span><span class="zh">固定尺寸 + 截断</span></div>
    <div class="form-tab" data-mode="B"><span class="tag">B</span><span class="zh">固定宽 · 行内等高</span></div>
    <div class="form-tab" data-mode="C"><span class="tag">C</span><span class="zh">简短 meta · 自然等高</span></div>
  </div>

  <div class="scheme-desc" id="schemeDesc"></div>

  <div class="cuisine-bar" id="cuisineBar"></div>

  <main class="stage" id="stage">
    <div class="section-label">CHEFS · <em id="cuLabel">粤菜</em> · <span id="chefCount">—</span> 位</div>
    <div id="body"></div>
  </main>
</body>`;

const SCRIPT = `<script>
const DATA = ${dataStr};
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const CUISINE_STAMP = {'川':'川','粤':'粤','鲁':'鲁','淮扬':'淮','湘':'湘','京':'京','沪':'沪','浙':'浙','徽':'徽','闽':'闽','西北':'西','东北':'东','陕':'陕','豫':'豫','鄂':'鄂','晋':'晋','蒙':'蒙','清真':'清','藏':'藏','滇':'滇','桂':'桂','赣':'赣','黔':'黔','辽':'辽','黑':'黑','吉':'吉','苏':'苏','港':'港','台':'台','津':'津','冀':'冀','宫廷':'宫','素':'素','点心':'点','未知':'?'};
function cuisineStamp(cu){ return cu ? (CUISINE_STAMP[cu] || cu[0]) : '·'; }

const chefs = DATA.chefs;
const chefById = {};
chefs.forEach(c => { chefById[c.id] = c; });

const state = { mode:'A', cuisine:'粤' };

const SCHEME_DESC = {
  A: '方案 A · <em>固定尺寸 + 截断</em>：所有卡片宽 230px 高 96px，meta 超长部分用省略号截断。最整齐如邮票阵列，但 meta 信息有损（hover 可见完整）。',
  B: '方案 B · <em>固定宽 · 行内等高</em>：卡片宽 230px，高度随内容自适应，同一行 flex 自动拉伸等高。保留完整 meta，同行整齐，跨行可能略差。',
  C: '方案 C · <em>简短 meta · 自然等高</em>：meta 统一改为简短标签（优先城市，否则餐厅前 8 字），从源头控制长度，卡片自然等高。信息精简，完整 meta 在详情页查看。'
};

function renderCuisineBar(){
  const counts = {};
  for(const c of chefs){
    const cu = c.primaryCuisine || '其他';
    counts[cu] = (counts[cu]||0) + 1;
  }
  const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  $('#cuisineBar').innerHTML = sorted.map(([cu,n]) => {
    const active = cu === state.cuisine ? 'active' : '';
    return '<div class="cu-tab ' + active + '" data-cuisine="' + cu + '">' + cu + ' · ' + n + '</div>';
  }).join('');
  $$('.cu-tab').forEach(t => {
    t.onclick = () => { state.cuisine = t.dataset.cuisine; renderCuisineBar(); renderBody(); };
  });
}

function renderChip(c, mode){
  const priStamp = cuisineStamp(c.primaryCuisine);
  const yrs = c.birth ? (c.birth + (c.death?'–'+c.death:'–今')) : (c.era || '');
  let meta;
  let title = '';
  if(mode === 'C'){
    meta = c.city || (c.restaurant ? c.restaurant.slice(0,8) : '') || (c.position ? c.position.slice(0,8) : '') || '';
  } else {
    meta = c.restaurant || c.position || c.city || '';
    // 方案 A 加 title 显示完整
    if(mode === 'A' && meta) title = ' title="' + meta.replace(/"/g,'&quot;') + '"';
  }
  const placeholder = c.isPlaceholder ? ' placeholder' : '';
  return '<div class="person' + placeholder + '" data-id="' + c.id + '"' + title + '>' +
    '<div class="p-cuisines"><div class="c-pri">' + (priStamp||'·') + '</div></div>' +
    '<div>' +
      '<div class="p-name">' + c.name + '</div>' +
      (yrs ? '<div class="p-yrs">' + yrs + '</div>' : '') +
      (meta ? '<div class="p-meta">' + meta + '</div>' : '') +
    '</div>' +
  '</div>';
}

function renderBody(){
  const list = chefs.filter(c => (c.primaryCuisine||'') === state.cuisine);
  $('#cuLabel').textContent = state.cuisine + '菜';
  $('#chefCount').textContent = list.length;

  // 分组：有 gen 用 gen；其余按 era
  const genGroups = {};
  const eraGroups = {};
  list.forEach(c => {
    if(typeof c.gen === 'number'){
      (genGroups[c.gen] = genGroups[c.gen] || []).push(c);
    } else {
      const e = c.era || '?';
      (eraGroups[e] = eraGroups[e] || []).push(c);
    }
  });
  const genKeys = Object.keys(genGroups).map(Number).sort((a,b)=>a-b);
  const eraOrder = ['清末','清末民初','民国','近代','近代-当代','近代/当代','当代','?'];
  const eraKeys = eraOrder.filter(k=>eraGroups[k]);

  const genCnLabel = ['','一','二','三','四','五','六','七','八','九','十'];
  const genRoman = ['','I','II','III','IV','V','VI','VII','VIII','IX','X'];

  let html = '';
  for(const g of genKeys){
    html += '<div class="gen-row"><div class="gen-label">' +
      '<div class="num">' + (genRoman[g]||g) + '</div>' +
      '<div class="zh">第 ' + (genCnLabel[g]||g) + ' 代</div>' +
      '<div class="en">GEN ' + String(g).padStart(2,'0') + '</div>' +
      '</div><div class="gen-people">' + genGroups[g].map(c => renderChip(c, state.mode)).join('') + '</div></div>';
  }
  if(eraKeys.length){
    if(genKeys.length) html += '<div class="section-label" style="margin-top:18px">无世代信息 · 按时代分组</div>';
    for(const e of eraKeys){
      html += '<div class="gen-row"><div class="gen-label">' +
        '<div class="num" style="font-size:24px">' + (e==='?'?'?':e[0]||'?') + '</div>' +
        '<div class="zh">' + (e==='?'?'时代不详':e) + '</div>' +
        '<div class="en">' + eraGroups[e].length + ' 人</div>' +
        '</div><div class="gen-people">' + eraGroups[e].map(c => renderChip(c, state.mode)).join('') + '</div></div>';
    }
  }
  $('#body').innerHTML = html;

  // 点击高亮
  $$('#body .person').forEach(el => {
    el.onclick = () => {
      $$('#body .person').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
    };
  });
}

function switchMode(m){
  state.mode = m;
  $$('.form-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === m));
  document.body.className = 'mode-' + m;
  $('#schemeDesc').innerHTML = SCHEME_DESC[m];
  renderBody();
}

$$('.form-tab').forEach(t => {
  t.onclick = () => switchMode(t.dataset.mode);
});

// 启动
switchMode('A');
renderCuisineBar();
</script>
</html>`;

const html = HEAD + '\n' + BODY + '\n' + SCRIPT;
fs.writeFileSync(OUT, html);
console.log('OK: ' + OUT + ' ' + fs.statSync(OUT).size + ' bytes');
