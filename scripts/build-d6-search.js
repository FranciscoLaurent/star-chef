#!/usr/bin/env node
// build-d6-search.js
// 搜索形态对比 demo：Command Palette / 顶部宽屏下拉 / 修复折叠式
// 三种形态共享 SearchCore（索引/匹配/排序/渲染），仅 UI 外壳不同
// 验证：拼音搜索、多行结果、直达详情、Ctrl+K、键盘导航

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data', '_slim-pinyin.json');
const OUT = path.join(ROOT, 'lineage_demo', 'demo-D6-search.html');

const dataStr = fs.readFileSync(DATA, 'utf8');

// ============================================================
// HEAD + STYLE
// ============================================================
const HEAD = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>星厨传承 · D6 · 搜索形态对比</title>
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
  body{overflow:hidden}
  ::selection{background:var(--vermillion);color:var(--paper)}

  /* —— 顶栏 —— */
  .top{
    display:flex;align-items:flex-end;justify-content:space-between;
    padding:18px 32px 10px;border-bottom:1px solid var(--ink);background:var(--paper);
  }
  .top .left h1{font-family:var(--serif);font-weight:500;font-size:26px;font-variation-settings:"opsz" 144}
  .top .left h1 em{font-style:italic;color:var(--vermillion)}
  .top .left .crumb{font-family:var(--mono);font-size:10px;letter-spacing:.2em;color:var(--dust);text-transform:uppercase;margin-top:3px}
  .top .right{display:flex;gap:18px;align-items:flex-end}
  .top .right .stat{text-align:right}
  .top .right .stat .n{font-family:var(--serif);font-style:italic;font-size:20px;color:var(--vermillion);line-height:1}
  .top .right .stat .l{font-family:var(--mono);font-size:9px;letter-spacing:.2em;color:var(--dust);text-transform:uppercase;margin-top:3px}

  /* —— 形态切换 tab —— */
  .mode-bar{
    display:flex;padding:0 32px;border-bottom:1px solid var(--ink);background:var(--paper-2);
  }
  .mode-bar .form-tab{
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

  /* 导航栏：菜系 tab + 搜索触发（形态 C 用） */
  .nav-row{
    display:flex;align-items:stretch;border-bottom:1px solid var(--ink);background:var(--paper);
  }
  .nav-row .nav-tab{
    padding:9px 18px 8px;cursor:pointer;
    font-family:var(--mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;
    color:var(--ink-soft);border-right:1px solid var(--rule);user-select:none;
  }
  .nav-row .nav-tab.active{background:var(--vermillion);color:var(--paper)}
  .nav-row .nav-tab:hover{background:var(--paper-2)}

  /* 搜索触发按钮（形态 A/B/C 共用触发点，但展开方式不同） */
  .search-trigger{
    margin-left:auto;display:flex;gap:8px;align-items:center;padding:9px 20px 8px;
    font-family:var(--mono);font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;
    color:var(--ink-soft);cursor:pointer;background:none;border:none;border-left:1px solid var(--rule);
  }
  .search-trigger:hover{background:var(--paper-2);color:var(--ink)}
  .search-trigger kbd{
    font-family:var(--mono);font-size:9px;padding:1px 5px;
    border:1px solid var(--rule-strong);background:var(--paper-2);color:var(--dust);
    border-radius:2px;letter-spacing:.05em;
  }
  .st-icon{
    display:inline-block;width:12px;height:12px;
    border:1.5px solid currentColor;border-radius:50%;position:relative;
  }
  .st-icon::after{
    content:"";position:absolute;bottom:-3px;right:-3px;
    width:1.5px;height:5px;background:currentColor;transform:rotate(-45deg);transform-origin:top center;
  }

  /* —— 主区域 三栏 —— */
  .stage{height:calc(100vh - 138px);overflow:hidden;display:grid;grid-template-columns:200px 280px 1fr}
  .col{padding:16px 20px;overflow-y:auto;border-right:1px solid var(--rule)}
  .col:last-child{border-right:none}
  .col h3{
    font-family:var(--mono);font-size:9.5px;letter-spacing:.2em;color:var(--dust);
    text-transform:uppercase;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--rule);
  }
  .col h3 em{font-family:var(--serif);font-style:italic;color:var(--vermillion);font-size:13px;margin-left:6px;letter-spacing:0}

  /* 左栏菜系列表 */
  .cu-item{
    padding:7px 10px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;
    border-bottom:1px solid var(--rule);transition:background .12s;
  }
  .cu-item:hover{background:var(--paper-2)}
  .cu-item.active{background:var(--ink);color:var(--paper)}
  .cu-item.active .cnt{color:var(--vermillion)}
  .cu-item .nm{font-family:var(--songti);font-size:13px;display:flex;gap:8px;align-items:center}
  .cu-item .stamp{
    width:22px;height:22px;background:var(--vermillion);color:var(--paper);
    display:grid;place-items:center;font-family:var(--songti);font-weight:700;font-size:11px;
  }
  .cu-item.active .stamp{background:var(--paper);color:var(--ink)}
  .cu-item .cnt{font-family:var(--mono);font-size:10px;color:var(--dust)}

  /* 中栏厨师列表 */
  .chef-item{
    padding:9px 10px;cursor:pointer;border-bottom:1px solid var(--rule);transition:all .12s;
  }
  .chef-item:hover{background:var(--paper-2);border-left:3px solid var(--vermillion);padding-left:7px}
  .chef-item.active{background:var(--paper-3);border-left:3px solid var(--ink)}
  .chef-item .row1{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
  .chef-item .nm{font-family:var(--songti);font-size:14px;font-weight:600}
  .chef-item .nm.placeholder{color:var(--dust);font-style:italic;font-weight:400}
  .chef-item .era{font-family:var(--serif);font-style:italic;font-size:10px;color:var(--dust)}
  .chef-item .row2{font-family:var(--mono);font-size:9.5px;color:var(--dust);margin-top:2px;letter-spacing:.04em}
  .chef-item .cross{color:var(--vermillion);font-weight:600}

  /* 右栏详情 */
  .detail-empty{color:var(--dust);font-family:var(--serif);font-style:italic;font-size:14px;padding:40px 20px;text-align:center;line-height:1.8}
  .detail-empty kbd{font-family:var(--mono);font-size:11px;padding:2px 6px;border:1px solid var(--rule-strong);background:var(--paper-2);color:var(--ink);border-radius:2px;font-style:normal}
  .d-head{display:flex;gap:14px;padding-bottom:14px;border-bottom:1px solid var(--rule);margin-bottom:14px}
  .d-portrait{width:88px;height:108px;flex-shrink:0;overflow:hidden;border:1px solid var(--rule)}
  .d-portrait-inner{position:relative;width:100%;height:100%;background:var(--paper-2)}
  .d-portrait-inner img{width:100%;height:100%;object-fit:cover;display:block;position:relative;z-index:1}
  .d-portrait-fallback{position:absolute;inset:0;display:grid;place-items:center;font-family:var(--songti);font-size:36px;color:var(--dust);opacity:.55}
  .d-info{flex:1;min-width:0}
  .d-name{font-family:var(--songti);font-size:24px;font-weight:700;line-height:1.2}
  .d-meta{font-family:var(--mono);font-size:10px;color:var(--dust);letter-spacing:.06em;margin-top:4px}
  .d-yrs{font-family:var(--serif);font-style:italic;font-size:13px;color:var(--ink-soft);margin-top:3px}
  .d-cuisines{display:flex;gap:6px;align-items:center;margin-top:8px;flex-wrap:wrap}
  .d-cu{width:30px;height:30px;background:var(--vermillion);color:var(--paper);display:grid;place-items:center;font-family:var(--songti);font-weight:700;font-size:14px;position:relative}
  .d-cu.sec{background:var(--paper);color:var(--ink);border:1px solid var(--ink)}
  .d-cu::after{content:"";position:absolute;inset:-3px;border:1px dashed var(--vermillion)}
  .d-cu.sec::after{border-color:var(--dust)}
  .d-sec{margin-top:14px;margin-bottom:6px}
  .d-lbl{font-family:var(--mono);font-size:9px;letter-spacing:.2em;color:var(--dust);text-transform:uppercase;margin-bottom:4px}
  .d-bio{font-family:var(--songti);font-size:13px;line-height:1.75;color:var(--ink-soft)}
  .d-titles{font-family:var(--songti);font-size:12px;line-height:1.7;color:var(--ink-soft)}
  .d-titles li{list-style:none;padding-left:14px;position:relative}
  .d-titles li::before{content:"·";position:absolute;left:4px;color:var(--vermillion)}
  .d-sig{display:flex;flex-wrap:wrap;gap:6px}
  .d-sig .s{font-family:var(--songti);font-size:11px;padding:3px 9px;background:var(--paper-2);border:1px solid var(--rule);color:var(--ink-soft)}
  .d-masters{display:flex;flex-wrap:wrap;gap:6px}
  .d-masters .m{font-family:var(--songti);font-size:12px;padding:3px 10px;background:var(--paper-2);border:1px solid var(--rule);cursor:pointer;transition:all .12s}
  .d-masters .m:hover{background:var(--vermillion);color:var(--paper);border-color:var(--vermillion)}
  .d-masters .m.placeholder{color:var(--dust);font-style:italic}
  .d-src{font-family:var(--mono);font-size:10px;color:var(--vermillion);word-break:break-all;text-decoration:none}
  .d-src:hover{text-decoration:underline}

  /* ============================================================ */
  /* 形态 A · Command Palette 浮层                                  */
  /* ============================================================ */
  .palette-overlay{
    position:fixed;inset:0;background:rgba(18,16,14,.45);z-index:1000;
    display:none;align-items:flex-start;justify-content:center;padding-top:13vh;
  }
  .palette-overlay.open{display:flex;animation:fadein .15s}
  @keyframes fadein{from{opacity:0}to{opacity:1}}
  .palette{
    width:92%;max-width:720px;background:var(--paper);
    border:1px solid var(--ink);box-shadow:8px 8px 0 var(--ink);
    display:flex;flex-direction:column;max-height:74vh;
  }
  .palette-input-wrap{
    display:flex;align-items:center;gap:12px;padding:16px 20px;
    border-bottom:1px solid var(--ink);background:var(--paper-2);
  }
  .palette-input-wrap .st-icon{width:18px;height:18px;color:var(--ink);flex-shrink:0}
  .palette-input-wrap .st-icon::after{width:2px;height:7px;bottom:-4px;right:-4px}
  .palette-input{
    flex:1;font-family:var(--songti);font-size:18px;background:none;border:none;outline:none;
    color:var(--ink);
  }
  .palette-input::placeholder{color:var(--dust);font-family:var(--serif);font-style:italic;font-size:15px}
  .palette-close{
    font-family:var(--mono);font-size:10px;color:var(--dust);padding:3px 8px;
    border:1px solid var(--rule-strong);cursor:pointer;letter-spacing:.1em;
  }
  .palette-close:hover{background:var(--paper-3);color:var(--ink)}
  .palette-results{flex:1;overflow-y:auto}
  .palette-results .sr-count{
    padding:7px 20px;font-family:var(--mono);font-size:9.5px;color:var(--dust);
    letter-spacing:.12em;border-bottom:1px solid var(--rule);background:var(--paper-2);
  }
  .palette-results .sr-more{
    padding:12px;text-align:center;font-family:var(--mono);font-size:10px;letter-spacing:.12em;
    color:var(--vermillion);cursor:pointer;border-top:1px solid var(--rule);background:var(--paper-2);
  }
  .palette-results .sr-more:hover{background:var(--paper-3)}

  /* ============================================================ */
  /* 形态 B · 顶部宽屏下拉面板                                      */
  /* ============================================================ */
  .dropdown-panel{
    position:absolute;left:0;right:0;top:100%;z-index:800;
    background:var(--paper);border:1px solid var(--ink);border-top:2px solid var(--vermillion);
    box-shadow:4px 4px 0 var(--ink);display:none;flex-direction:column;max-height:78vh;
  }
  .dropdown-panel.open{display:flex;animation:slidein .15s}
  @keyframes slidein{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
  .dd-input-wrap{
    display:flex;align-items:center;gap:12px;padding:14px 24px;
    border-bottom:1px solid var(--rule);background:var(--paper-2);
  }
  .dd-input-wrap .st-icon{width:16px;height:16px;color:var(--ink);flex-shrink:0}
  .dd-input-wrap .st-icon::after{width:2px;height:6px;bottom:-3px;right:-3px}
  .dd-input{
    flex:1;font-family:var(--songti);font-size:16px;background:none;border:none;outline:none;color:var(--ink);
  }
  .dd-input::placeholder{color:var(--dust);font-family:var(--serif);font-style:italic;font-size:14px}
  .dd-close{
    font-family:var(--mono);font-size:10px;color:var(--dust);padding:3px 8px;
    border:1px solid var(--rule-strong);cursor:pointer;letter-spacing:.1em;
  }
  .dd-close:hover{background:var(--paper-3);color:var(--ink)}
  .dd-results{flex:1;overflow-y:auto}
  .dd-results .sr-count{
    padding:7px 24px;font-family:var(--mono);font-size:9.5px;color:var(--dust);
    letter-spacing:.12em;border-bottom:1px solid var(--rule);background:var(--paper-2);
  }
  .dd-results .sr-more{
    padding:12px;text-align:center;font-family:var(--mono);font-size:10px;letter-spacing:.12em;
    color:var(--vermillion);cursor:pointer;border-top:1px solid var(--rule);background:var(--paper-2);
  }
  .dd-results .sr-more:hover{background:var(--paper-3)}

  /* ============================================================ */
  /* 共享：搜索结果项（形态 A/B/C 共用）                            */
  /* ============================================================ */
  .sr-item{
    display:grid;grid-template-columns:42px 1fr auto;gap:12px;align-items:center;
    padding:10px 20px;cursor:pointer;border-bottom:1px solid var(--rule);transition:all .12s;
  }
  .sr-item:hover,.sr-item.focus{
    background:var(--paper-2);border-left:3px solid var(--vermillion);padding-left:17px;
  }
  .sr-cui{
    width:36px;height:36px;background:var(--vermillion);color:var(--paper);
    display:grid;place-items:center;font-family:var(--songti);font-weight:700;font-size:15px;
    position:relative;flex-shrink:0;
  }
  .sr-cui::after{content:"";position:absolute;inset:-3px;border:1px dashed var(--vermillion)}
  .sr-placeholder .sr-cui{background:var(--paper);color:var(--dust);border:1px dashed var(--dust)}
  .sr-placeholder .sr-cui::after{border-color:var(--dust)}
  .sr-body{min-width:0}
  .sr-row1{display:flex;align-items:baseline;gap:8px}
  .sr-name{font-family:var(--songti);font-size:15px;font-weight:700;line-height:1.2}
  .sr-placeholder .sr-name{color:var(--dust);font-style:italic;font-weight:400}
  .sr-era{font-family:var(--serif);font-style:italic;font-size:10px;color:var(--vermillion);font-variation-settings:'opsz' 144}
  .sr-row2{
    font-family:var(--mono);font-size:10px;color:var(--ink-soft);letter-spacing:.04em;
    margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  }
  .sr-row3{
    font-family:var(--songti);font-size:11px;color:var(--dust);margin-top:2px;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  }
  .sr-pinyin{font-family:var(--mono);font-size:9px;color:var(--vermillion);letter-spacing:.08em;text-transform:uppercase}
  .sr-empty{
    padding:36px 20px;text-align:center;color:var(--dust);
    font-family:var(--serif);font-style:italic;font-size:14px;line-height:1.7;
  }

  /* ============================================================ */
  /* 形态 C · 修复折叠式（CSS 移回 style 块内）                     */
  /* ============================================================ */
  .fold-wrap{
    position:relative;display:flex;align-items:center;
  }
  .fold-expanded{display:none;align-items:center;position:relative}
  .fold-wrap.open .search-trigger{display:none}
  .fold-wrap.open .fold-expanded{display:flex}
  .fold-input{
    width:220px;padding:7px 32px 7px 12px;
    font-family:var(--songti);font-size:13px;
    border:1px solid var(--ink);background:var(--paper-2);
    color:var(--ink);outline:none;
  }
  .fold-input:focus{box-shadow:2px 2px 0 var(--ink)}
  .fold-input::placeholder{color:var(--dust);font-family:var(--serif);font-style:italic;font-size:11px}
  .fold-clear{
    position:absolute;right:6px;top:50%;transform:translateY(-50%);
    width:22px;height:22px;border:none;background:none;font-size:16px;color:var(--dust);cursor:pointer;
    font-family:var(--serif);line-height:1;display:grid;place-items:center;
  }
  .fold-clear:hover{color:var(--vermillion)}
  .fold-results{
    position:absolute;top:100%;right:0;width:380px;max-height:480px;
    z-index:900;overflow-y:auto;background:var(--paper);border:1px solid var(--ink);
    box-shadow:3px 3px 0 var(--ink);display:none;flex-direction:column;
  }
  .fold-results.open{display:flex}
  .fold-results .sr-item{padding:8px 14px;grid-template-columns:36px 1fr auto;gap:10px}
  .fold-results .sr-item:hover,.fold-results .sr-item.focus{padding-left:11px}
  .fold-results .sr-cui{width:30px;height:30px;font-size:13px}
  .fold-results .sr-name{font-size:13px}
  .fold-results .sr-count{padding:6px 14px;font-family:var(--mono);font-size:9px;color:var(--dust);letter-spacing:.1em;border-bottom:1px solid var(--rule);background:var(--paper-2)}
  .fold-results .sr-more{padding:10px;text-align:center;font-family:var(--mono);font-size:9.5px;letter-spacing:.12em;color:var(--vermillion);cursor:pointer;border-top:1px solid var(--rule);background:var(--paper-2)}
  .fold-results .sr-more:hover{background:var(--paper-3)}

  .hidden{display:none !important}
</style>
</head>`;

// ============================================================
// BODY
// ============================================================
const BODY = `<body>
  <header class="top">
    <div class="left">
      <h1>星厨传承 <em>D6</em> · 搜索形态对比</h1>
      <div class="crumb">SEARCH UX COMPARISON · A PALETTE · B DROPDOWN · C FOLD</div>
    </div>
    <div class="right">
      <div class="stat"><div class="n" id="statChefs">—</div><div class="l">Chefs</div></div>
      <div class="stat"><div class="n" id="statCuisines">—</div><div class="l">Cuisines</div></div>
      <div class="stat"><div class="n" id="statReal">—</div><div class="l">Real</div></div>
    </div>
  </header>

  <div class="mode-bar">
    <div class="form-tab active" data-form="A"><span class="tag">A</span><span class="zh">Command Palette 浮层</span></div>
    <div class="form-tab" data-form="B"><span class="tag">B</span><span class="zh">顶部宽屏下拉</span></div>
    <div class="form-tab" data-form="C"><span class="tag">C</span><span class="zh">修复折叠式</span></div>
  </div>

  <div class="nav-row">
    <div class="nav-tab active" data-cuisine="川">川菜</div>
    <div class="nav-tab" data-cuisine="粤">粤菜</div>
    <div class="nav-tab" data-cuisine="鲁">鲁菜</div>
    <div class="nav-tab" data-cuisine="淮扬">淮扬</div>
    <div class="nav-tab" data-cuisine="湘">湘菜</div>
    <div class="nav-tab" data-cuisine="京">京菜</div>
    <div class="nav-tab" data-cuisine="沪">沪菜</div>
    <button class="search-trigger" id="searchTrigger">
      <span class="st-icon"></span>
      <span>搜索</span>
      <kbd>Ctrl K</kbd>
    </button>
  </div>

  <main class="stage">
    <aside class="col" id="colCuisine">
      <h3>菜系 <em id="cuCount"></em></h3>
      <div id="cuisineList"></div>
    </aside>
    <section class="col" id="colChef">
      <h3>厨师 <em id="chefCount"></em></h3>
      <div id="chefList"></div>
    </section>
    <aside class="col" id="colDetail">
      <h3>详情 <em id="detailName"></em></h3>
      <div id="detail"></div>
    </aside>
  </main>

  <!-- 形态 A · Command Palette -->
  <div class="palette-overlay" id="paletteOverlay">
    <div class="palette">
      <div class="palette-input-wrap">
        <span class="st-icon"></span>
        <input type="text" class="palette-input" id="paletteInput" placeholder="姓名 / 拼音 / 菜系 / 头衔 / 拿手菜…" autocomplete="off" />
        <span class="palette-close" id="paletteClose">ESC</span>
      </div>
      <div class="palette-results" id="paletteResults"></div>
    </div>
  </div>

  <!-- 形态 B · 顶部下拉面板（绝对定位挂在 nav-row 下） -->
  <div class="dropdown-panel" id="dropdownPanel" style="position:fixed;left:32px;right:32px;top:138px;">
    <div class="dd-input-wrap">
      <span class="st-icon"></span>
      <input type="text" class="dd-input" id="ddInput" placeholder="姓名 / 拼音 / 菜系 / 头衔 / 拿手菜…" autocomplete="off" />
      <span class="dd-close" id="ddClose">ESC</span>
    </div>
    <div class="dd-results" id="ddResults"></div>
  </div>

  <!-- 形态 C · 折叠式（嵌在 nav-row 右侧） -->
  <div class="fold-wrap" id="foldWrap" style="position:absolute;right:0;top:0;display:none;">
    <button class="search-trigger" id="foldTrigger">
      <span class="st-icon"></span><span>搜索</span><kbd>Ctrl K</kbd>
    </button>
    <div class="fold-expanded">
      <input type="text" class="fold-input" id="foldInput" placeholder="姓名 / 拼音 / 菜系…" autocomplete="off" />
      <button class="fold-clear" id="foldClear">×</button>
    </div>
    <div class="fold-results" id="foldResults"></div>
  </div>
</body>`;

// ============================================================
// SCRIPT
// ============================================================
const SCRIPT = `<script>
const DATA = ${dataStr};

// —— 工具 ——
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
window._pErr = function(img){ img.style.display = 'none'; };
const CUISINE_STAMP = { '川':'川','粤':'粤','鲁':'鲁','淮扬':'淮','湘':'湘','京':'京','沪':'沪','浙':'浙','徽':'徽','闽':'闽','西北':'西','东北':'东','陕':'陕','豫':'豫','鄂':'鄂','晋':'晋','蒙':'蒙','清真':'清','藏':'藏','疆':'疆','滇':'滇','桂':'桂','赣':'赣','黔':'黔','辽':'辽','黑':'黑','吉':'吉','苏':'苏','港':'港','台':'台','津':'津','冀':'冀','青海':'青','陇':'陇','客家':'客','海派':'海','宫廷':'宫','素':'素' };
function cuisineStamp(cu){ return cu ? (CUISINE_STAMP[cu] || cu[0]) : '·'; }

// —— 索引 ——
const chefs = DATA.chefs;
const chefById = new Map();
const chefByName = new Map();
for(const c of chefs){
  chefById.set(c.id, c);
  chefByName.set(c.name, c);
  // 构建 searchText
  const fields = [
    c.name, c.primaryCuisine, ...(c.secondaryCuisines||[]),
    c.school, ...(c.titles||[]), c.currentRole, c.restaurant, c.city,
    ...(c.signature||[])
  ].filter(Boolean).join(' ');
  c._searchText = (fields + ' ' + (c.bio||'')).toLowerCase();
}

// —— 搜索内核 ——
const SearchCore = {
  // 匹配 + 排序，返回前 N 条
  search(q, limit){
    q = (q||'').trim().toLowerCase();
    if(!q) return [];
    const terms = q.split(/\\s+/).filter(Boolean);
    const qCompact = q.replace(/\\s/g,'');
    const isAlpha = /^[a-z]+$/.test(qCompact);
    const isShortAlpha = isAlpha && qCompact.length <= 3;
    const scored = [];
    for(const c of chefs){
      let score = 0;
      // 中文路径
      const text = c._searchText;
      const allMatch = terms.every(t => text.includes(t));
      if(allMatch) score = 1;
      // 拼音路径（纯字母输入）
      if(!allMatch && isAlpha && c.pinyin){
        const py = c.pinyin;
        if(isShortAlpha){
          // 短输入：只匹配姓名首字母，避免误匹配
          if(py.nameInitial === qCompact) score = 1.5;
          else if(py.nameInitial && py.nameInitial.startsWith(qCompact)) score = 1.0;
          else if(py.nameInitial && py.nameInitial.includes(qCompact)) score = 0.7;
        } else {
          // 长输入：匹配全拼
          if(py.nameCompact === qCompact) score = 1.5;
          else if(py.nameCompact && py.nameCompact.startsWith(qCompact)) score = 1.2;
          else if(py.nameCompact && py.nameCompact.includes(qCompact)) score = 1.0;
          else if(py.all && py.all.replace(/\\s/g,'').includes(qCompact)) score = 0.5;
        }
      }
      if(score > 0){
        // 相关性细化
        if(c.name.toLowerCase().includes(q)) score += 2;
        if(c.name.toLowerCase() === q) score += 5;
        if(c.primaryCuisine && c.primaryCuisine.includes(q)) score += 0.3;
        scored.push({ c, score });
      }
    }
    scored.sort((a,b) => b.score - a.score || (a.c.name||'').localeCompare(b.c.name||''));
    return scored.slice(0, limit || 200).map(s => s.c);
  },

  // 渲染单个结果项
  renderItem(c, idx){
    const cui = cuisineStamp(c.primaryCuisine);
    const era = c.era || '';
    const titles = (c.titles||[]).slice(0,2).join(' · ') || '';
    const restaurant = c.restaurant || c.currentRole || '';
    const city = c.city || '';
    const sig = (c.signature||[]).slice(0,2).join(' · ');
    const row2 = [titles, restaurant, city].filter(Boolean).join(' · ').slice(0, 60);
    const placeholder = c.isPlaceholder;
    const py = c.pinyin ? c.pinyin.nameCompact : '';
    return \`<div class="sr-item \${placeholder?'sr-placeholder':''}" data-idx="\${idx}" data-id="\${c.id}">
      <div class="sr-cui">\${cui}</div>
      <div class="sr-body">
        <div class="sr-row1">
          <span class="sr-name">\${c.name}</span>
          \${era?\`<span class="sr-era">\${era}</span>\`:''}
          \${py?\`<span class="sr-pinyin">\${py}</span>\`:''}
        </div>
        \${row2?\`<div class="sr-row2">\${row2}</div>\`:''}
        \${sig?\`<div class="sr-row3">★ \${sig}</div>\`:''}
      </div>
      <div></div>
    </div>\`;
  },

  // 渲染结果列表到容器
  renderResults(container, q, opts){
    opts = opts || {};
    const maxShow = opts.maxShow || 100;
    const moreStep = opts.moreStep || 100;
    const itemClickHandler = opts.onItem;
    const inputEl = opts.inputEl;

    const all = SearchCore.search(q, 1000);
    if(!q.trim()){
      container.innerHTML = '';
      return;
    }
    if(all.length === 0){
      container.innerHTML = '<div class="sr-empty">无匹配结果<br/>试试拼音首字母（如 lc）或全拼（如 liuchong）</div>';
      return;
    }
    const showing = Math.min(maxShow, all.length);
    let html = '<div class="sr-count">找到 ' + all.length + ' 位 · 显示前 ' + showing + ' 位</div>';
    for(let i=0;i<showing;i++){
      html += SearchCore.renderItem(all[i], i);
    }
    if(all.length > showing){
      html += '<div class="sr-more" data-action="more">▼ 显示更多（还有 ' + (all.length - showing) + ' 位）</div>';
    }
    container.innerHTML = html;

    // 绑定点击
    container.querySelectorAll('.sr-item').forEach(el => {
      el.onclick = () => {
        const id = el.dataset.id;
        const c = chefById.get(id);
        if(c && itemClickHandler) itemClickHandler(c);
      };
    });
    const moreBtn = container.querySelector('.sr-more');
    if(moreBtn){
      moreBtn.onclick = () => {
        opts.maxShow = showing + moreStep;
        SearchCore.renderResults(container, q, opts);
        if(inputEl) inputEl.focus();
      };
    }
  }
};

// —— 应用状态 ——
const state = {
  form: 'A',          // A/B/C
  cuisine: '川',
  chefId: null,
};

// —— 左栏：菜系列表 ——
function renderCuisineList(){
  const counts = {};
  for(const c of chefs){
    const cu = c.primaryCuisine || '其他';
    counts[cu] = (counts[cu]||0) + 1;
  }
  const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]);
  $('#cuCount').textContent = sorted.length + ' 种';
  $('#cuisineList').innerHTML = sorted.map(([cu, n]) => {
    const active = cu === state.cuisine ? 'active' : '';
    return '<div class="cu-item ' + active + '" data-cuisine="' + cu + '"><div class="nm"><div class="stamp">' + cuisineStamp(cu) + '</div>' + cu + '</div><div class="cnt">' + n + '</div></div>';
  }).join('');
  $$('#cuisineList .cu-item').forEach(el => {
    el.onclick = () => {
      state.cuisine = el.dataset.cuisine;
      state.chefId = null;
      renderCuisineList();
      renderChefList();
      renderDetail();
    };
  });
}

// —— 中栏：厨师列表 ——
function renderChefList(){
  const list = chefs.filter(c => (c.primaryCuisine||'') === state.cuisine);
  $('#chefCount').textContent = list.length + ' 位';
  // 标记 active
  $$('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.cuisine === state.cuisine));
  $('#chefList').innerHTML = list.map(c => {
    const active = c.id === state.chefId ? 'active' : '';
    const placeholder = c.isPlaceholder ? 'placeholder' : '';
    const era = c.era || '';
    const titles = (c.titles||[])[0] || '';
    const restaurant = c.restaurant || c.city || '';
    const cross = (c.secondaryCuisines&&c.secondaryCuisines.length) ? '<span class="cross">※</span> ' : '';
    return '<div class="chef-item ' + active + '" data-id="' + c.id + '"><div class="row1"><div class="nm ' + placeholder + '">' + cross + c.name + '</div><div class="era">' + era + '</div></div><div class="row2">' + [titles, restaurant].filter(Boolean).join(' · ') + '</div></div>';
  }).join('');
  $$('#chefList .chef-item').forEach(el => {
    el.onclick = () => {
      state.chefId = el.dataset.id;
      renderChefList();
      renderDetail();
    };
  });
}

// —— 右栏：详情 ——
function renderDetail(){
  const c = state.chefId ? chefById.get(state.chefId) : null;
  $('#detailName').textContent = c ? c.name : '';
  if(!c){
    $('#detail').innerHTML = '<div class="detail-empty">选择中栏厨师查看档案<br/><br/>或按 <kbd>Ctrl</kbd> + <kbd>K</kbd> 唤起搜索<br/>支持中文 / 拼音首字母 / 全拼</div>';
    return;
  }
  const py = c.pinyin ? c.pinyin.name : '';
  const yrs = c.birth ? (c.birth + (c.death?'–'+c.death:'–今')) : (c.era || '');
  let portrait;
  const fallbackChar = (c.name[0]||'?').replace(/</g,'&lt;');
  if(c.portrait){
    portrait = '<div class="d-portrait-inner"><img src="' + c.portrait + '" alt="' + c.name + '" onerror="window._pErr(this)" /><span class="d-portrait-fallback">' + fallbackChar + '</span></div>';
  } else {
    portrait = '<div class="d-portrait-inner"><span class="d-portrait-fallback">' + fallbackChar + '</span></div>';
  }
  // 师承链
  const masterChips = [];
  if(c.master && chefById.has(c.master)){
    const m = chefById.get(c.master);
    masterChips.push('<span class="m' + (m.isPlaceholder?' placeholder':'') + '" data-id="' + m.id + '">→ ' + m.name + '</span>');
  }
  if(c.masters){
    for(const m of c.masters){
      if(masterChips.some(ch => ch.includes('>'+m.name+'</span>'))) continue;
      const ref = chefByName.get(m.name);
      if(ref){
        masterChips.push('<span class="m' + (ref.isPlaceholder?' placeholder':'') + '" data-id="' + ref.id + '">→ ' + m.name + (m.title?' · '+m.title:'') + '</span>');
      } else {
        masterChips.push('<span class="m placeholder">→ ' + m.name + (m.title?' · '+m.title:'') + '</span>');
      }
    }
  }
  const secondaryCuisines = (c.secondaryCuisines||[]).map(sc => '<div class="d-cu sec" title="兼修">' + cuisineStamp(sc) + '</div>').join('');
  const titles = (c.titles||[]).map(t => '<li>' + t + '</li>').join('');
  const sig = (c.signature||[]).map(s => '<span class="s">' + s + '</span>').join('');
  const crossSec = c.secondaryCuisines && c.secondaryCuisines.length;
  const crossMasters = (c.masters||[]).filter(m => {
    const mc = chefByName.get(m.name);
    return mc && mc.primaryCuisine && mc.primaryCuisine !== c.primaryCuisine;
  });
  const isCross = crossSec || crossMasters.length;

  $('#detail').innerHTML = '<div class="d-head">' + portrait + '<div class="d-info">' +
    '<div class="d-name">' + c.name + '</div>' +
    (py ? '<div class="d-meta">' + py + '</div>' : '') +
    (c.gender||c.birthplace ? '<div class="d-meta">' + [c.gender, c.birthplace].filter(Boolean).join(' · ') + '</div>' : '') +
    (yrs ? '<div class="d-yrs">' + yrs + (c.school&&DATA.schools ? ' · ' + (DATA.schools.find(s=>s.key===c.school)||{}).name : '') + '</div>' : '') +
    (isCross ? '<div style="margin-top:6px;font-family:var(--mono);font-size:10px;color:var(--vermillion);letter-spacing:.1em">※ 跨菜系学艺</div>' : '') +
    '<div class="d-cuisines"><div class="d-cu" title="主菜系">' + cuisineStamp(c.primaryCuisine) + '</div>' + secondaryCuisines + '</div>' +
    '</div></div>' +
    (titles ? '<div class="d-sec"><div class="d-lbl">Titles · 头衔</div><ul class="d-titles">' + titles + '</ul></div>' : '') +
    ((c.restaurant||c.position||c.city) ? '<div class="d-sec"><div class="d-lbl">Position · 职务</div><div class="d-bio">' + [c.restaurant,c.position,c.city].filter(Boolean).join(' · ') + '</div></div>' : '') +
    (masterChips.length ? '<div class="d-sec"><div class="d-lbl">Lineage · 师承</div><div class="d-masters">' + masterChips.join('') + '</div></div>' : '') +
    (sig ? '<div class="d-sec"><div class="d-lbl">Signature · 拿手菜</div><div class="d-sig">' + sig + '</div></div>' : '') +
    (c.bio ? '<div class="d-sec"><div class="d-lbl">Biography · 小传</div><div class="d-bio">' + c.bio + '</div></div>' : '') +
    (c.source ? '<div class="d-sec"><div class="d-lbl">Source</div><a class="d-src" href="' + c.source + '" target="_blank">' + (c.source.length>70?c.source.slice(0,70)+'…':c.source) + '</a></div>' : '');

  // 师承 chip 跳转
  $$('#detail .d-masters .m').forEach(el => {
    if(!el.dataset.id) return;
    el.onclick = () => {
      state.chefId = el.dataset.id;
      const c2 = chefById.get(el.dataset.id);
      if(c2 && c2.primaryCuisine) state.cuisine = c2.primaryCuisine;
      renderCuisineList();
      renderChefList();
      renderDetail();
    };
  });
}

// —— selectChef：直达详情（三种形态共用） ——
function selectChef(c){
  state.chefId = c.id;
  if(c.primaryCuisine) state.cuisine = c.primaryCuisine;
  renderCuisineList();
  renderChefList();
  renderDetail();
  // 滚动详情到顶部
  $('#colDetail').scrollTop = 0;
}

// ============================================================
// 形态 A · Command Palette
// ============================================================
const PaletteUI = {
  open(){
    $('#paletteOverlay').classList.add('open');
    const input = $('#paletteInput');
    input.value = '';
    SearchCore.renderResults($('#paletteResults'), '', {
      onItem: c => { selectChef(c); PaletteUI.close(); }
    });
    setTimeout(() => input.focus(), 30);
  },
  close(){
    $('#paletteOverlay').classList.remove('open');
  },
  focusIdx: -1,
  focusItems: [],
  refreshFocus(){
    this.focusItems = $$('#paletteResults .sr-item');
  },
  setFocus(i){
    this.refreshFocus();
    if(this.focusItems.length === 0) return;
    if(i < 0) i = this.focusItems.length - 1;
    if(i >= this.focusItems.length) i = 0;
    this.focusIdx = i;
    this.focusItems.forEach((el, idx) => el.classList.toggle('focus', idx === i));
    this.focusItems[i].scrollIntoView({ block: 'nearest' });
  }
};

// ============================================================
// 形态 B · 顶部下拉面板
// ============================================================
const DropdownUI = {
  open(){
    $('#dropdownPanel').classList.add('open');
    const input = $('#ddInput');
    input.value = '';
    SearchCore.renderResults($('#ddResults'), '', {
      onItem: c => { selectChef(c); DropdownUI.close(); }
    });
    setTimeout(() => input.focus(), 30);
  },
  close(){
    $('#dropdownPanel').classList.remove('open');
  },
  focusIdx: -1,
  focusItems: [],
  refreshFocus(){
    this.focusItems = $$('#ddResults .sr-item');
  },
  setFocus(i){
    this.refreshFocus();
    if(this.focusItems.length === 0) return;
    if(i < 0) i = this.focusItems.length - 1;
    if(i >= this.focusItems.length) i = 0;
    this.focusIdx = i;
    this.focusItems.forEach((el, idx) => el.classList.toggle('focus', idx === i));
    this.focusItems[i].scrollIntoView({ block: 'nearest' });
  }
};

// ============================================================
// 形态 C · 折叠式
// ============================================================
const FoldUI = {
  open(){
    $('#foldWrap').classList.add('open');
    $('#foldResults').classList.add('open');
    const input = $('#foldInput');
    input.value = '';
    SearchCore.renderResults($('#foldResults'), '', {
      onItem: c => { selectChef(c); FoldUI.close(); }
    });
    setTimeout(() => input.focus(), 30);
  },
  close(){
    $('#foldWrap').classList.remove('open');
    $('#foldResults').classList.remove('open');
  },
  focusIdx: -1,
  focusItems: [],
  refreshFocus(){
    this.focusItems = $$('#foldResults .sr-item');
  },
  setFocus(i){
    this.refreshFocus();
    if(this.focusItems.length === 0) return;
    if(i < 0) i = this.focusItems.length - 1;
    if(i >= this.focusItems.length) i = 0;
    this.focusIdx = i;
    this.focusItems.forEach((el, idx) => el.classList.toggle('focus', idx === i));
    this.focusItems[i].scrollIntoView({ block: 'nearest' });
  }
};

// —— 当前形态切换 ——
function getActiveUI(){
  return state.form === 'A' ? PaletteUI : (state.form === 'B' ? DropdownUI : FoldUI);
}

function switchForm(f){
  state.form = f;
  $$('.form-tab').forEach(t => t.classList.toggle('active', t.dataset.form === f));
  // 形态 C 需要把 foldWrap 显示出来并替换主搜索按钮
  const mainTrigger = $('#searchTrigger');
  if(f === 'C'){
    $('#foldWrap').style.display = 'flex';
    mainTrigger.style.display = 'none';
  } else {
    $('#foldWrap').style.display = 'none';
    mainTrigger.style.display = 'flex';
  }
  // 关闭所有搜索
  PaletteUI.close();
  DropdownUI.close();
  FoldUI.close();
}

// —— 事件绑定 ——
$$('.form-tab').forEach(t => {
  t.onclick = () => switchForm(t.dataset.form);
});

$('#searchTrigger').onclick = () => getActiveUI().open();
$('#foldTrigger').onclick = () => FoldUI.open();

// 形态 A
$('#paletteClose').onclick = () => PaletteUI.close();
$('#paletteOverlay').onclick = e => { if(e.target.id === 'paletteOverlay') PaletteUI.close(); };
$('#paletteInput').addEventListener('input', e => {
  SearchCore.renderResults($('#paletteResults'), e.target.value, {
    onItem: c => { selectChef(c); PaletteUI.close(); },
    inputEl: e.target
  });
  PaletteUI.focusIdx = -1;
});
$('#paletteInput').addEventListener('keydown', e => {
  if(e.key === 'Escape'){ PaletteUI.close(); e.preventDefault(); }
  else if(e.key === 'ArrowDown'){ PaletteUI.setFocus(PaletteUI.focusIdx + 1); e.preventDefault(); }
  else if(e.key === 'ArrowUp'){ PaletteUI.setFocus(PaletteUI.focusIdx - 1); e.preventDefault(); }
  else if(e.key === 'Enter'){
    PaletteUI.refreshFocus();
    if(PaletteUI.focusIdx >= 0 && PaletteUI.focusItems[PaletteUI.focusIdx]){
      const id = PaletteUI.focusItems[PaletteUI.focusIdx].dataset.id;
      const c = chefById.get(id);
      if(c){ selectChef(c); PaletteUI.close(); }
    }
    e.preventDefault();
  }
});

// 形态 B
$('#ddClose').onclick = () => DropdownUI.close();
$('#ddInput').addEventListener('input', e => {
  SearchCore.renderResults($('#ddResults'), e.target.value, {
    onItem: c => { selectChef(c); DropdownUI.close(); },
    inputEl: e.target
  });
  DropdownUI.focusIdx = -1;
});
$('#ddInput').addEventListener('keydown', e => {
  if(e.key === 'Escape'){ DropdownUI.close(); e.preventDefault(); }
  else if(e.key === 'ArrowDown'){ DropdownUI.setFocus(DropdownUI.focusIdx + 1); e.preventDefault(); }
  else if(e.key === 'ArrowUp'){ DropdownUI.setFocus(DropdownUI.focusIdx - 1); e.preventDefault(); }
  else if(e.key === 'Enter'){
    DropdownUI.refreshFocus();
    if(DropdownUI.focusIdx >= 0 && DropdownUI.focusItems[DropdownUI.focusIdx]){
      const id = DropdownUI.focusItems[DropdownUI.focusIdx].dataset.id;
      const c = chefById.get(id);
      if(c){ selectChef(c); DropdownUI.close(); }
    }
    e.preventDefault();
  }
});

// 形态 C
$('#foldClear').onclick = () => {
  $('#foldInput').value = '';
  SearchCore.renderResults($('#foldResults'), '', {
    onItem: c => { selectChef(c); FoldUI.close(); },
    inputEl: $('#foldInput')
  });
  $('#foldInput').focus();
};
$('#foldInput').addEventListener('input', e => {
  SearchCore.renderResults($('#foldResults'), e.target.value, {
    onItem: c => { selectChef(c); FoldUI.close(); },
    inputEl: e.target
  });
  FoldUI.focusIdx = -1;
});
$('#foldInput').addEventListener('keydown', e => {
  if(e.key === 'Escape'){
    if($('#foldInput').value){
      $('#foldInput').value = '';
      SearchCore.renderResults($('#foldResults'), '', {
        onItem: c => { selectChef(c); FoldUI.close(); },
        inputEl: $('#foldInput')
      });
    } else {
      FoldUI.close();
    }
    e.preventDefault();
  }
  else if(e.key === 'ArrowDown'){ FoldUI.setFocus(FoldUI.focusIdx + 1); e.preventDefault(); }
  else if(e.key === 'ArrowUp'){ FoldUI.setFocus(FoldUI.focusIdx - 1); e.preventDefault(); }
  else if(e.key === 'Enter'){
    FoldUI.refreshFocus();
    if(FoldUI.focusIdx >= 0 && FoldUI.focusItems[FoldUI.focusIdx]){
      const id = FoldUI.focusItems[FoldUI.focusIdx].dataset.id;
      const c = chefById.get(id);
      if(c){ selectChef(c); FoldUI.close(); }
    }
    e.preventDefault();
  }
});

// 导航栏菜系 tab
$$('.nav-tab').forEach(t => {
  t.onclick = () => {
    state.cuisine = t.dataset.cuisine;
    state.chefId = null;
    renderCuisineList();
    renderChefList();
    renderDetail();
  };
});

// 全局快捷键 Ctrl+K / Cmd+K
document.addEventListener('keydown', e => {
  if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){
    e.preventDefault();
    const ui = getActiveUI();
    // 如果已打开则关闭，否则打开
    const isOpen = (state.form === 'A' && $('#paletteOverlay').classList.contains('open'))
      || (state.form === 'B' && $('#dropdownPanel').classList.contains('open'))
      || (state.form === 'C' && $('#foldWrap').classList.contains('open'));
    if(isOpen) ui.close();
    else ui.open();
  }
  // Esc 关闭任意形态
  if(e.key === 'Escape'){
    PaletteUI.close();
    DropdownUI.close();
    FoldUI.close();
  }
});

// —— 启动 ——
$('#statChefs').textContent = chefs.length;
$('#statCuisines').textContent = new Set(chefs.map(c=>c.primaryCuisine).filter(Boolean)).size;
$('#statReal').textContent = chefs.filter(c=>!c.isPlaceholder).length;
renderCuisineList();
renderChefList();
renderDetail();
</script>
</html>`;

// ============================================================
// 拼接 + 输出
// ============================================================
const html = HEAD + '\n' + BODY + '\n' + SCRIPT;
fs.writeFileSync(OUT, html);
console.log('OK: ' + OUT + ' ' + fs.statSync(OUT).size + ' bytes');
