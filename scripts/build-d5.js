#!/usr/bin/env node
// build-d5.js
// 流式拼接：把 data/_slim.json 作为字符串嵌入 demo-D5-real-data.html
// 不 parse、不操作大对象，避免读全文 + 上下文爆炸

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SLIM = path.join(ROOT, 'data', '_slim.json');
const OUT = path.join(ROOT, 'lineage_demo', 'demo-D5-real-data.html');

const slimStr = fs.readFileSync(SLIM, 'utf8');

// ============================================================
// HTML 模板 —— 三段：HEAD/STYLE、BODY、SCRIPT
// 设计语言完全沿用 D4：paper / ink / vermillion + Fraunces / Noto Serif SC
// ============================================================

const HEAD_STYLE = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>星厨传承 · D5 · 真实数据三层视图</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,ital@9..144,300..700,0;9..144,300..700,1&family=Noto+Serif+SC:wght@400;600;700&family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500&display=swap" rel="stylesheet" />
<style>
  :root{
    --paper:#ede8db;
    --paper-2:#e3dcc8;
    --paper-3:#d8cfb6;
    --ink:#12100e;
    --ink-soft:#3a3530;
    --vermillion:#ca6c52;
    --vermillion-deep:#a3503b;
    --moss:#4a5a3f;
    --gold:#a67c00;
    --dust:#8b8270;
    --rule:rgba(18,16,14,.12);
    --rule-strong:rgba(18,16,14,.22);
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
    padding:22px 36px 12px;border-bottom:1px solid var(--ink);background:var(--paper);
  }
  .top .left h1{font-family:var(--serif);font-weight:500;font-size:30px;font-variation-settings:"opsz" 144;letter-spacing:.01em}
  .top .left h1 em{font-style:italic;color:var(--vermillion)}
  .top .left .crumb{font-family:var(--mono);font-size:10.5px;letter-spacing:.2em;color:var(--dust);text-transform:uppercase;margin-top:4px}
  .top .right{display:flex;gap:22px;align-items:flex-end}
  .top .right .stat{text-align:right}
  .top .right .stat .n{font-family:var(--serif);font-style:italic;font-size:24px;color:var(--vermillion);font-variation-settings:"opsz" 144;line-height:1}
  .top .right .stat .l{font-family:var(--mono);font-size:9px;letter-spacing:.22em;color:var(--dust);text-transform:uppercase;margin-top:4px}

  /* —— 视图标签条 —— */
  .modes{
    display:flex;padding:0 36px;border-bottom:1px solid var(--ink);
    background:var(--paper-2);
  }
  .mode-tab{
    padding:12px 22px 11px;cursor:pointer;position:relative;display:flex;gap:10px;align-items:baseline;
    font-family:var(--mono);font-size:11px;letter-spacing:.18em;text-transform:uppercase;
    color:var(--ink-soft);border-right:1px solid var(--rule);user-select:none;transition:background .15s;
  }
  .mode-tab:hover{background:var(--paper-3)}
  .mode-tab .num{font-family:var(--serif);font-style:italic;font-size:17px;color:var(--vermillion);font-variation-settings:"opsz" 144}
  .mode-tab .zh{font-family:var(--songti);letter-spacing:.12em;font-size:13px}
  .mode-tab.active{background:var(--ink);color:var(--paper)}
  .mode-tab.active .num{color:var(--paper)}
  .mode-tab.active::after{
    content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--vermillion);
  }

  /* —— 视图容器 —— */
  .stage{height:calc(100vh - 84px);overflow:hidden;position:relative}
  .view{display:none;height:100%;overflow:auto;padding:24px 36px 40px}
  .view.active{display:block}
  .section-label{
    font-family:var(--mono);font-size:10px;letter-spacing:.22em;color:var(--dust);text-transform:uppercase;
    margin-bottom:14px;display:flex;align-items:center;gap:14px;
  }
  .section-label::after{content:"";flex:1;border-bottom:1px solid var(--rule)}

  /* —— View1: 菜系巡礼 —— */
  .v1-hero{
    display:grid;grid-template-columns:1.2fr 1fr;gap:48px;align-items:end;
    padding:6px 0 28px;border-bottom:1px solid var(--ink);margin-bottom:24px;
  }
  .v1-hero .title{font-family:var(--songti);font-weight:700;font-size:54px;line-height:1.1;letter-spacing:.05em}
  .v1-hero .title em{font-style:italic;color:var(--vermillion);font-family:var(--serif);font-variation-settings:"opsz" 144;font-weight:400}
  .v1-hero .sub{font-family:var(--mono);font-size:11px;letter-spacing:.22em;color:var(--ink-soft);margin-top:14px}
  .v1-hero .lede{font-family:var(--serif);font-size:15.5px;line-height:1.75;color:var(--ink-soft)}
  .v1-hero .lede em{font-style:italic;color:var(--vermillion)}

  .cuisine-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:14px}
  .cuisine-card{
    aspect-ratio:1/1.18;border:1px solid var(--rule-strong);background:var(--paper);
    padding:14px 12px 12px;display:flex;flex-direction:column;justify-content:space-between;
    cursor:pointer;position:relative;transition:all .18s;
  }
  .cuisine-card:hover{background:var(--ink);color:var(--paper);border-color:var(--ink);transform:translateY(-2px)}
  .cuisine-card .big{
    font-family:var(--songti);font-weight:700;font-size:58px;line-height:.9;color:var(--vermillion);
    align-self:center;margin-top:8px;
    text-shadow:1px 1px 0 rgba(0,0,0,.03);
  }
  .cuisine-card:hover .big{color:var(--vermillion)}
  .cuisine-card .meta{display:flex;justify-content:space-between;align-items:end;font-family:var(--mono);font-size:9.5px;letter-spacing:.16em;text-transform:uppercase}
  .cuisine-card .meta .ppl{font-family:var(--serif);font-style:italic;font-size:20px;color:var(--ink);font-variation-settings:"opsz" 144;line-height:1}
  .cuisine-card:hover .meta .ppl{color:var(--paper)}
  .cuisine-card .corner{
    position:absolute;top:7px;right:9px;font-family:var(--mono);font-size:8.5px;letter-spacing:.14em;
    color:var(--dust);
  }
  .cuisine-card:hover .corner{color:var(--paper-3)}
  .cuisine-card .schools-dot{
    position:absolute;bottom:7px;left:9px;font-family:var(--mono);font-size:8.5px;letter-spacing:.14em;color:var(--moss);
  }
  .cuisine-card:hover .schools-dot{color:var(--paper-3)}

  /* —— View2: 流派图谱 —— */
  .v2-bar{
    display:flex;align-items:center;justify-content:space-between;gap:18px;
    padding:8px 0 22px;border-bottom:1px solid var(--ink);margin-bottom:22px;
  }
  .v2-bar .left{display:flex;align-items:center;gap:24px}
  .big-stamp{
    width:84px;height:84px;display:grid;place-items:center;
    font-family:var(--songti);font-weight:700;font-size:54px;color:var(--paper);
    background:var(--vermillion);position:relative;flex-shrink:0;
    box-shadow:1px 1px 0 rgba(0,0,0,.15);
  }
  .big-stamp::after{
    content:"";position:absolute;inset:3px;border:1px dashed rgba(237,232,219,.6);
  }
  .v2-bar .title{font-family:var(--songti);font-weight:700;font-size:30px;letter-spacing:.08em}
  .v2-bar .title em{font-style:italic;color:var(--vermillion);font-family:var(--serif);font-variation-settings:"opsz" 144;font-weight:400}
  .v2-bar .sub{font-family:var(--mono);font-size:10.5px;letter-spacing:.22em;color:var(--ink-soft);margin-top:6px}
  .back-btn{
    font-family:var(--mono);font-size:10.5px;letter-spacing:.22em;padding:8px 14px;
    background:transparent;border:1px solid var(--ink);color:var(--ink);cursor:pointer;text-transform:uppercase;
  }
  .back-btn:hover{background:var(--ink);color:var(--paper)}

  .schools-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-bottom:24px}
  .school-card{
    border:1px solid var(--rule-strong);background:var(--paper);padding:18px 18px 16px;
    display:flex;flex-direction:column;gap:12px;cursor:pointer;transition:all .18s;position:relative;
  }
  .school-card:hover{border-color:var(--ink);transform:translateY(-2px);box-shadow:2px 2px 0 var(--ink)}
  .school-card .head{display:flex;align-items:center;gap:14px}
  .school-stamp{
    width:54px;height:54px;display:grid;place-items:center;
    font-family:var(--songti);font-weight:700;font-size:30px;color:var(--paper);
    background:var(--ink);position:relative;flex-shrink:0;
  }
  .school-stamp::after{
    content:"";position:absolute;inset:2px;border:1px dashed rgba(237,232,219,.45);
  }
  .school-card .name{font-family:var(--songti);font-weight:700;font-size:21px;letter-spacing:.04em;line-height:1.15}
  .school-card .subname{font-family:var(--serif);font-style:italic;font-size:13px;color:var(--vermillion);margin-top:2px;font-variation-settings:"opsz" 144}
  .school-card .region{font-family:var(--mono);font-size:9.5px;letter-spacing:.18em;color:var(--dust);text-transform:uppercase;margin-top:5px}
  .school-card .desc{font-family:var(--serif);font-size:13.5px;line-height:1.6;color:var(--ink-soft)}
  .school-card .tags{display:flex;flex-wrap:wrap;gap:6px}
  .school-card .tag{
    font-family:var(--songti);font-size:10.5px;padding:3px 8px;border:1px solid var(--rule-strong);
    color:var(--ink-soft);letter-spacing:.08em;
  }
  .school-card .reps{
    display:flex;gap:10px;padding-top:10px;border-top:1px dashed var(--rule);
    font-family:var(--songti);font-size:13px;color:var(--ink);
  }
  .school-card .reps .rep{padding:2px 6px;background:var(--paper-2);border-radius:2px}
  .school-card .count{
    position:absolute;top:14px;right:16px;font-family:var(--serif);font-style:italic;
    font-size:30px;color:var(--vermillion);font-variation-settings:"opsz" 144;line-height:1;
  }
  .school-card .count-label{
    position:absolute;top:48px;right:16px;font-family:var(--mono);font-size:8.5px;letter-spacing:.18em;color:var(--dust);
  }

  /* era 分组 (无 schools 菜系) */
  .era-row{margin-bottom:18px}
  .era-row .head{
    display:flex;align-items:baseline;gap:14px;margin-bottom:10px;
    border-bottom:1px solid var(--rule);padding-bottom:6px;
  }
  .era-row .head .zh{font-family:var(--songti);font-weight:700;font-size:18px;letter-spacing:.05em}
  .era-row .head .n{font-family:var(--serif);font-style:italic;font-size:15px;color:var(--vermillion);font-variation-settings:"opsz" 144}
  .era-row .chefs{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
  .era-chef{
    border:1px solid var(--rule);padding:10px 12px;background:var(--paper);cursor:pointer;
    display:flex;flex-direction:column;gap:3px;transition:all .15s;
  }
  .era-chef:hover{border-color:var(--ink);background:var(--paper-2)}
  .era-chef .n{font-family:var(--songti);font-weight:700;font-size:15px}
  .era-chef .r{font-family:var(--mono);font-size:9.5px;letter-spacing:.14em;color:var(--dust);text-transform:uppercase}

  /* —— View3: 师承谱 (三栏) —— */
  .v3-bar{
    display:flex;align-items:center;justify-content:space-between;gap:18px;
    padding:4px 0 16px;border-bottom:1px solid var(--ink);margin-bottom:0;
  }
  .v3-bar .crumb{font-family:var(--mono);font-size:10.5px;letter-spacing:.22em;color:var(--ink-soft);text-transform:uppercase}
  .v3-bar .crumb em{color:var(--vermillion);font-style:normal;font-family:var(--serif);font-variation-settings:"opsz" 144;font-size:13px}
  .v3-grid{
    display:grid;grid-template-columns:200px 1fr 380px;gap:0;
    height:calc(100% - 60px);border-top:1px solid var(--rule);
  }
  .v3-col{padding:18px 18px;overflow:auto;border-right:1px solid var(--rule)}
  .v3-col:last-child{border-right:none}

  /* 左栏：流派列表 */
  .school-list .item{
    padding:10px 12px;border:1px solid transparent;cursor:pointer;margin-bottom:4px;
    display:flex;justify-content:space-between;align-items:baseline;
  }
  .school-list .item:hover{background:var(--paper-2)}
  .school-list .item.active{border-color:var(--ink);background:var(--paper-2)}
  .school-list .item .n{font-family:var(--songti);font-weight:700;font-size:14px}
  .school-list .item .c{font-family:var(--serif);font-style:italic;font-size:13px;color:var(--vermillion);font-variation-settings:"opsz" 144}

  /* 中栏：人物按 gen 行 */
  .gen-row{margin-bottom:22px;position:relative}
  .gen-row .glabel{
    font-family:var(--mono);font-size:9.5px;letter-spacing:.22em;color:var(--dust);
    text-transform:uppercase;margin-bottom:9px;padding-left:2px;
  }
  .gen-row .glabel em{font-family:var(--serif);font-style:italic;color:var(--vermillion);font-size:14px;font-variation-settings:"opsz" 144;margin-right:6px}
  .gen-chefs{display:flex;flex-wrap:wrap;gap:10px}
  .chef-chip{
    border:1px solid var(--rule-strong);padding:10px 13px 9px;background:var(--paper);cursor:pointer;
    min-width:120px;position:relative;transition:all .15s;
  }
  .chef-chip:hover{border-color:var(--ink);background:var(--paper-2)}
  .chef-chip.active{border-color:var(--vermillion);background:var(--paper-2);box-shadow:0 0 0 2px var(--vermillion) inset}
  .chef-chip .name{font-family:var(--songti);font-weight:700;font-size:15px;letter-spacing:.04em;line-height:1.1}
  .chef-chip .meta{font-family:var(--mono);font-size:8.5px;letter-spacing:.14em;color:var(--dust);margin-top:4px;text-transform:uppercase}
  .chef-chip .yrs{font-family:var(--serif);font-style:italic;font-size:11px;color:var(--ink-soft);margin-top:2px;font-variation-settings:"opsz" 144}
  .chef-chip.placeholder{
    border-style:dashed;color:var(--dust);background:var(--paper);
  }
  .chef-chip.placeholder .name{color:var(--dust);font-weight:400}
  .chef-chip .cross{
    position:absolute;top:-5px;right:-5px;
    width:18px;height:18px;display:grid;place-items:center;
    background:var(--vermillion);color:var(--paper);font-size:11px;font-weight:700;
    line-height:1;border-radius:50%;font-family:var(--songti);
  }
  .chef-chip .hub{
    position:absolute;top:-7px;left:-7px;
    width:22px;height:22px;display:grid;place-items:center;
    background:var(--gold);color:var(--paper);font-family:var(--songti);font-weight:700;font-size:9px;
    border-radius:50%;letter-spacing:.04em;line-height:1;
    box-shadow:0 0 0 2px var(--paper);
  }

  /* 右栏：详情面板 */
  .detail{padding:0}
  .detail .empty{
    font-family:var(--serif);font-style:italic;font-size:14px;color:var(--dust);text-align:center;
    padding:60px 20px;line-height:1.7;
  }
  .detail .head{display:flex;gap:16px;align-items:flex-start;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid var(--rule)}
  .detail .portrait{
    width:84px;height:84px;flex-shrink:0;border:1px solid var(--rule-strong);
    object-fit:cover;background:var(--paper-2);
  }
  .detail .portrait-fallback{
    width:84px;height:84px;flex-shrink:0;background:var(--ink);color:var(--paper);
    display:grid;place-items:center;font-family:var(--songti);font-weight:700;font-size:36px;
    position:relative;
  }
  .detail .portrait-fallback::after{
    content:"";position:absolute;inset:3px;border:1px dashed rgba(237,232,219,.4);
  }
  .detail .nm{font-family:var(--songti);font-weight:700;font-size:26px;letter-spacing:.05em;line-height:1.1}
  .detail .nm-en{font-family:var(--serif);font-style:italic;font-size:12px;color:var(--vermillion);font-variation-settings:"opsz" 144;margin-top:3px}
  .detail .yr{font-family:var(--mono);font-size:10px;letter-spacing:.18em;color:var(--dust);text-transform:uppercase;margin-top:5px}
  .detail .cu-row{display:flex;gap:6px;margin-top:7px;align-items:center;flex-wrap:wrap}
  .detail .cu-row .cu{
    width:22px;height:22px;display:grid;place-items:center;
    font-family:var(--songti);font-weight:700;font-size:12px;color:var(--paper);
    background:var(--vermillion);position:relative;
  }
  .detail .cu-row .cu.sec{background:var(--ink);font-size:11px}

  .detail .banner-cross{
    background:var(--vermillion);color:var(--paper);font-family:var(--mono);font-size:9.5px;
    letter-spacing:.2em;padding:5px 10px;text-transform:uppercase;margin-bottom:12px;display:inline-block;
  }
  .detail .banner-hub{
    background:var(--gold);color:var(--paper);font-family:var(--mono);font-size:9.5px;
    letter-spacing:.2em;padding:5px 10px;text-transform:uppercase;margin-bottom:12px;display:inline-block;margin-left:6px;
  }
  .detail .sec{margin-bottom:14px}
  .detail .sec .lbl{
    font-family:var(--mono);font-size:9.5px;letter-spacing:.22em;color:var(--dust);
    text-transform:uppercase;margin-bottom:6px;
  }
  .detail .titles{display:flex;flex-direction:column;gap:3px}
  .detail .titles li{
    font-family:var(--songti);font-size:13px;color:var(--ink);line-height:1.5;padding-left:14px;position:relative;
  }
  .detail .titles li::before{
    content:"";position:absolute;left:0;top:8px;width:6px;height:6px;background:var(--vermillion);
  }
  .detail .masters{display:flex;flex-wrap:wrap;gap:6px}
  .detail .masters .m{
    font-family:var(--songti);font-size:13px;padding:4px 9px;background:var(--paper-2);border:1px solid var(--rule);
    cursor:pointer;transition:all .15s;
  }
  .detail .masters .m:hover{background:var(--ink);color:var(--paper)}
  .detail .masters .m.placeholder{border-style:dashed;color:var(--dust)}
  .detail .masters .m .ar{color:var(--vermillion);margin-right:4px;font-family:var(--serif);font-style:italic;font-variation-settings:"opsz" 144}
  .detail .sig{display:flex;flex-wrap:wrap;gap:6px}
  .detail .sig .s{
    font-family:var(--songti);font-size:12.5px;padding:3px 8px;
    border:1px solid var(--rule-strong);color:var(--ink-soft);
  }
  .detail .exp{display:flex;flex-direction:column;gap:5px}
  .detail .exp li{
    font-family:var(--serif);font-size:12.5px;line-height:1.55;color:var(--ink-soft);
    padding-left:14px;position:relative;border-left:1px solid var(--rule);padding-bottom:2px;
  }
  .detail .exp li::before{
    content:"";position:absolute;left:-3px;top:7px;width:5px;height:5px;background:var(--vermillion);border-radius:50%;
  }
  .detail .bio{font-family:var(--serif);font-size:13.5px;line-height:1.7;color:var(--ink-soft)}
  .detail .src{
    font-family:var(--mono);font-size:9.5px;letter-spacing:.18em;color:var(--dust);
    word-break:break-all;text-decoration:none;display:inline-block;margin-top:6px;
  }
  .detail .src:hover{color:var(--vermillion)}

  /* scrollbar */
  ::-webkit-scrollbar{width:8px;height:8px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:rgba(18,16,14,.18);border-radius:4px}
  ::-webkit-scrollbar-thumb:hover{background:rgba(18,16,14,.32)}
</style>
</head>`;

const BODY = `<body>
  <header class="top">
    <div class="left">
      <h1>星厨传承 <em>D5</em> · 真实数据三层视图</h1>
      <div class="crumb">REAL CHEF DATASET · 188 NODES · 18 CUISINES · 9 SCHOOLS</div>
    </div>
    <div class="right">
      <div class="stat"><div class="n">188</div><div class="l">Chefs</div></div>
      <div class="stat"><div class="n">114</div><div class="l">Real</div></div>
      <div class="stat"><div class="n">74</div><div class="l">Placeholder</div></div>
      <div class="stat"><div class="n">62</div><div class="l">Lineage</div></div>
      <div class="stat"><div class="n">57</div><div class="l">Portraits</div></div>
    </div>
  </header>

  <nav class="modes">
    <div class="mode-tab active" data-view="1"><span class="num">01</span><span class="zh">菜系巡礼</span></div>
    <div class="mode-tab" data-view="2"><span class="num">02</span><span class="zh">流派图谱</span></div>
    <div class="mode-tab" data-view="3"><span class="num">03</span><span class="zh">师承谱</span></div>
  </nav>

  <main class="stage">
    <section class="view view-1 active" id="view1">
      <div class="v1-hero">
        <div>
          <div class="title">十八菜系 <em>一席</em></div>
          <div class="sub">EIGHTEEN CUISINES IN ONE SCROLL · 一八九六 — 二〇二六</div>
        </div>
        <div class="lede">
          这张谱系采集自烹饪协会档案、百度百科与餐饮行业网站，共录入 <em>188</em> 位名厨，
          覆盖 <em>18</em> 个菜系，识别出 <em>9</em> 个流派与 <em>62</em> 段师徒承传。
          点击任意菜系印记进入流派图谱。
        </div>
      </div>
      <div class="section-label">CUISINES · 按人数排序</div>
      <div class="cuisine-grid" id="cuisineGrid"></div>
    </section>

    <section class="view view-2" id="view2">
      <div class="v2-bar">
        <div class="left">
          <div class="big-stamp" id="v2Stamp">川</div>
          <div>
            <div class="title" id="v2Title">川菜 <em>Sichuan</em></div>
            <div class="sub" id="v2Sub">3 SCHOOLS · 24 CHEFS</div>
          </div>
        </div>
        <button class="back-btn" data-view="1">← 返回菜系</button>
      </div>
      <div class="section-label">SCHOOLS · 流派分立</div>
      <div id="v2Body"></div>
    </section>

    <section class="view view-3" id="view3">
      <div class="v3-bar">
        <div class="crumb" id="v3Crumb">CUISINE · <em>川菜</em> · SCHOOL · <em>蓉派</em></div>
        <button class="back-btn" data-view="2">← 返回流派</button>
      </div>
      <div class="v3-grid">
        <aside class="v3-col school-list" id="v3Left"></aside>
        <section class="v3-col" id="v3Mid"></section>
        <aside class="v3-col detail" id="v3Right"><div class="empty">选择左侧人物以查看完整档案</div></aside>
      </div>
    </section>
  </main>
</body>`;

// ============================================================
// 客户端脚本（DATA 注入点）
// ============================================================
const SCRIPT = `<script>
const DATA = ${slimStr};

// —— 工具函数 ——————————————————————————————————
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

// 主菜系 → stamp 字符（取第一个汉字）
function cuisineStamp(cu){
  if(!cu) return '？';
  return cu[0];
}

// 厨师 ID → chef 对象
const chefById = {};
DATA.chefs.forEach(c => { chefById[c.id] = c; });

// 厨师名 → chef 对象（用于 masters[].name 反查）
const chefByName = {};
DATA.chefs.forEach(c => { chefByName[c.name] = c; });

// school key → school 对象
const schoolByKey = {};
DATA.schools.forEach(s => { schoolByKey[s.key] = s; });

// 师门枢纽：被 >=3 人引用者
const HUB_NAMES = new Set(Object.entries(DATA.stats.topMastersByApprenticeCount||{})
  .filter(([k,v])=>v>=3 && !/^h\\d+$/.test(k) && !/^mp-/.test(k))
  .map(([k])=>k));

// 按菜系分组
const byCuisine = {};
DATA.chefs.forEach(c => {
  const cu = c.primaryCuisine || '其他';
  (byCuisine[cu] = byCuisine[cu] || []).push(c);
});
// 按菜系排序（人数倒序）
const cuisinesSorted = Object.keys(byCuisine).sort((a,b)=>byCuisine[b].length-byCuisine[a].length);

// 每菜系 → schools 数组（key 列表）
const schoolsByCuisine = {};
DATA.schools.forEach(s => {
  (schoolsByCuisine[s.cuisine] = schoolsByCuisine[s.cuisine] || []).push(s);
});

// 当前状态
const state = {
  view: 1,
  cuisine: null,
  schoolKey: null,
  chefId: null,
};

// —— 视图切换 ——————————————————————————————————
function showView(n){
  state.view = n;
  $$('.view').forEach(v=>v.classList.remove('active'));
  $('#view'+n).classList.add('active');
  $$('.mode-tab').forEach(t=>t.classList.toggle('active', +t.dataset.view===n));
}

// —— View 1: 菜系网格 ——————————————————————————————————
function renderV1(){
  const grid = $('#cuisineGrid');
  grid.innerHTML = cuisinesSorted.map(cu => {
    const list = byCuisine[cu];
    const schoolN = (schoolsByCuisine[cu]||[]).length;
    return \`<div class="cuisine-card" data-cuisine="\${cu}">
      <div class="corner">\${String(cuisinesSorted.indexOf(cu)+1).padStart(2,'0')}</div>
      <div class="big">\${cuisineStamp(cu)}</div>
      <div class="meta">
        <span>\${cu}</span>
        <span class="ppl">\${list.length}</span>
      </div>
      \${schoolN ? \`<div class="schools-dot">+ \${schoolN} schools</div>\` : ''}
    </div>\`;
  }).join('');
  grid.addEventListener('click', e => {
    const card = e.target.closest('.cuisine-card');
    if(!card) return;
    enterCuisine(card.dataset.cuisine);
  });
}

// —— View 2: 流派图谱 ——————————————————————————————————
function enterCuisine(cu){
  state.cuisine = cu;
  state.schoolKey = null;
  const list = byCuisine[cu] || [];
  $('#v2Stamp').textContent = cuisineStamp(cu);
  $('#v2Title').innerHTML = \`\${cu}菜 <em>\${cu==='国宴'?'State Banquet':cu==='淮扬'?'Huaiyang':cu==='粤'?'Cantonese':cu==='川'?'Sichuan':cu==='湘'?'Hunan':cu==='鲁'?'Shandong':''}\`;
  const schools = schoolsByCuisine[cu] || [];
  $('#v2Sub').textContent = \`\${schools.length} SCHOOLS · \${list.length} CHEFS\`;
  const body = $('#v2Body');

  if(schools.length){
    body.innerHTML = '<div class="schools-grid">' + schools.map(s => {
      const members = list.filter(c => c.school === s.key);
      const reps = members.slice(0,3).map(c => \`<span class="rep">\${c.name}</span>\`).join('');
      return \`<div class="school-card" data-school="\${s.key}">
        <div class="count">\${members.length}</div>
        <div class="count-label">CHEFS</div>
        <div class="head">
          <div class="school-stamp">\${s.stamp}</div>
          <div>
            <div class="name">\${s.name}</div>
            <div class="subname">\${s.subName||''} · \${s.en||''}</div>
            <div class="region">\${s.region||''}</div>
          </div>
        </div>
        <div class="desc">\${s.desc||''}</div>
        <div class="tags">\${(s.styles||[]).map(t=>\`<span class="tag">\${t}</span>\`).join('')}</div>
        \${reps ? \`<div class="reps">\${reps}</div>\` : ''}
      </div>\`;
    }).join('') + '</div>';

    // 把"未归入流派"的人也展示
    const noSchool = list.filter(c => !c.school);
    if(noSchool.length){
      body.innerHTML += renderEraGroups('未归入流派 · 按时代', noSchool);
    }
  } else {
    body.innerHTML = renderEraGroups('按时代分组 · TIME-GROUPED', list);
  }

  body.onclick = e => {
    const card = e.target.closest('.school-card');
    if(card){ enterSchool(card.dataset.school); return; }
    const ec = e.target.closest('.era-chef');
    if(ec){
      enterSchoolForChef(ec.dataset.id);
    }
  };
  showView(2);
}

function renderEraGroups(title, chefs){
  const order = ['清末','清末民初','民国','近代','近代-当代','近代/当代','当代','?'];
  const groups = {};
  chefs.forEach(c => {
    const e = c.era || '?';
    (groups[e] = groups[e] || []).push(c);
  });
  const keys = order.filter(k=>groups[k]);
  return \`<div class="section-label">\${title}</div>\` + keys.map(k => {
    return \`<div class="era-row">
      <div class="head"><span class="zh">\${k==='?'?'时代不详':k}</span><span class="n">\${groups[k].length}</span></div>
      <div class="chefs">\${groups[k].map(c => \`<div class="era-chef" data-id="\${c.id}"><div class="n">\${c.name}\${c.isPlaceholder?' <span style="color:var(--dust);font-size:11px">·</span>':''}</div><div class="r">\${c.restaurant||c.position||c.city||'—'}</div></div>\`).join('')}</div>
    </div>\`;
  }).join('');
}

// —— View 3: 师承谱 ——————————————————————————————————
function enterSchool(schoolKey){
  state.schoolKey = schoolKey;
  state.chefId = null;
  renderV3();
  showView(3);
}
function enterSchoolForChef(chefId){
  // 由"按时代"卡片直接跳入 V3，schoolKey 设为 null（即整菜系视图）
  state.schoolKey = null;
  state.chefId = chefId;
  renderV3();
  showView(3);
}

function renderV3(){
  const cu = state.cuisine;
  const allInCu = byCuisine[cu] || [];
  const schools = schoolsByCuisine[cu] || [];

  // 左栏：流派列表（含"全部" / "未归入"）
  const left = $('#v3Left');
  const items = [];
  items.push({key:'__all__', name:'全部', n:allInCu.length});
  schools.forEach(s => items.push({key:s.key, name:s.name, sub:s.subName, n:allInCu.filter(c=>c.school===s.key).length}));
  const noSchool = allInCu.filter(c=>!c.school).length;
  if(noSchool) items.push({key:'__none__', name:'未归入流派', n:noSchool});
  const activeKey = state.schoolKey || '__all__';
  left.innerHTML = items.map(it => \`<div class="item \${it.key===activeKey?'active':''}" data-key="\${it.key}">
    <span class="n">\${it.name}\${it.sub?\` <span style="color:var(--dust);font-size:11px">· \${it.sub}</span>\`:''}</span>
    <span class="c">\${it.n}</span>
  </div>\`).join('');
  left.onclick = e => {
    const it = e.target.closest('.item'); if(!it) return;
    state.schoolKey = it.dataset.key === '__all__' ? null : (it.dataset.key === '__none__' ? '__none__' : it.dataset.key);
    state.chefId = null;
    renderV3();
  };

  // 中栏：人物（按 gen 分行；无 gen 的按 era 分行）
  let chefs;
  if(!state.schoolKey){
    chefs = allInCu;
  } else if(state.schoolKey === '__none__'){
    chefs = allInCu.filter(c=>!c.school);
  } else {
    chefs = allInCu.filter(c=>c.school===state.schoolKey);
  }

  $('#v3Crumb').innerHTML = \`CUISINE · <em>\${cu}菜</em>\${state.schoolKey&&state.schoolKey!=='__none__' ? ' · SCHOOL · <em>'+(schoolByKey[state.schoolKey]?.name||'')+'</em>':''}\`;

  // 分组：有 gen 用 gen；其余按 era
  const genGroups = {};
  const eraGroups = {};
  chefs.forEach(c => {
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

  const renderChip = c => {
    const isCross = (c.secondaryCuisines && c.secondaryCuisines.length) ||
                    (c.masters && c.masters.some(m => {
                      const mc = chefByName[m.name];
                      return mc && mc.primaryCuisine && mc.primaryCuisine !== c.primaryCuisine;
                    }));
    const isHub = HUB_NAMES.has(c.name);
    const yrs = c.birth ? (c.birth + (c.death?'–'+c.death:'–')) : (c.era || '');
    return \`<div class="chef-chip \${c.isPlaceholder?'placeholder':''} \${state.chefId===c.id?'active':''}" data-id="\${c.id}">
      \${isHub ? '<div class="hub">枢</div>' : ''}
      \${isCross ? '<div class="cross">※</div>' : ''}
      <div class="name">\${c.name}</div>
      <div class="yrs">\${yrs}</div>
      <div class="meta">\${(c.restaurant||c.position||c.city||(c.isPlaceholder?'档案待补':'—'))}</div>
    </div>\`;
  };

  const genHtml = genKeys.map(g => \`<div class="gen-row">
    <div class="glabel"><em>第 \${g} 代</em>GEN \${String(g).padStart(2,'0')} · \${genGroups[g].length} 人</div>
    <div class="gen-chefs">\${genGroups[g].map(renderChip).join('')}</div>
  </div>\`).join('');

  const eraHtml = eraKeys.map(e => \`<div class="gen-row">
    <div class="glabel"><em>\${e==='?'?'时代不详':e}</em>· \${eraGroups[e].length} 人</div>
    <div class="gen-chefs">\${eraGroups[e].map(renderChip).join('')}</div>
  </div>\`).join('');

  $('#v3Mid').innerHTML = (genHtml || '') + (eraHtml ? \`<div class="section-label" style="margin-top:8px">无世代信息 · 按时代</div>\${eraHtml}\` : '');
  $('#v3Mid').onclick = e => {
    const chip = e.target.closest('.chef-chip'); if(!chip) return;
    state.chefId = chip.dataset.id;
    renderV3();
  };

  // 右栏：详情
  renderDetail();
}

function renderDetail(){
  const c = state.chefId ? chefById[state.chefId] : null;
  const right = $('#v3Right');
  if(!c){
    right.innerHTML = '<div class="empty">选择中栏人物以查看完整档案<br/><br/>★ 红色 ※ 角标 = 跨菜系学艺<br/>★ 金色「枢」徽 = 师门枢纽（≥3 弟子）<br/>★ 虚线方框 = 档案待补</div>';
    return;
  }
  if(c.isPlaceholder){
    right.innerHTML = \`
      <div class="head">
        <div class="portrait-fallback">\${c.name[0]}</div>
        <div>
          <div class="nm">\${c.name}</div>
          <div class="yr">PLACEHOLDER · 档案待补</div>
          <div class="cu-row"><div class="cu">\${cuisineStamp(c.primaryCuisine)}</div></div>
        </div>
      </div>
      <div class="sec"><div class="lbl">Status</div><div class="bio" style="font-style:italic;color:var(--dust)">该祖师暂无完整档案。被其弟子在文献中援引为师承——邀请社区为其补充完整资料。</div></div>
      \${c.title ? \`<div class="sec"><div class="lbl">Reference</div><div class="bio">\${c.title}</div></div>\` : ''}
      \${c.referencedBy && c.referencedBy.length ? \`<div class="sec"><div class="lbl">Referenced By</div><div class="masters">\${c.referencedBy.map(n => \`<span class="m">\${n}</span>\`).join('')}</div></div>\` : ''}
    \`;
    return;
  }

  // 跨菜系判定
  const crossSec = c.secondaryCuisines || [];
  const crossMasters = (c.masters || []).filter(m => {
    const mc = chefByName[m.name];
    return mc && mc.primaryCuisine && mc.primaryCuisine !== c.primaryCuisine;
  });
  const isCross = crossSec.length || crossMasters.length;
  const isHub = HUB_NAMES.has(c.name);

  // portrait + fallback
  let portraitHtml;
  if(c.portrait){
    portraitHtml = \`<img class="portrait" src="\${c.portrait}" alt="\${c.name}"
      onerror="this.outerHTML='<div class=&quot;portrait-fallback&quot;>\${c.name[0]}</div>'" />\`;
  } else {
    portraitHtml = \`<div class="portrait-fallback">\${c.name[0]}</div>\`;
  }

  // master 链：master(id) + masters[](name)
  const masterChips = [];
  if(c.master && chefById[c.master]){
    const m = chefById[c.master];
    masterChips.push(\`<span class="m \${m.isPlaceholder?'placeholder':''}" data-id="\${m.id}"><span class="ar">→</span>\${m.name}</span>\`);
  }
  if(c.masterIds){
    c.masterIds.forEach(mid => {
      if(mid !== c.master && chefById[mid]){
        const m = chefById[mid];
        masterChips.push(\`<span class="m \${m.isPlaceholder?'placeholder':''}" data-id="\${m.id}"><span class="ar">→</span>\${m.name}</span>\`);
      }
    });
  }
  if(c.masters){
    c.masters.forEach(m => {
      // 若已在 masterIds 中通过 chefById 命中过同名，跳过
      const exist = masterChips.some(ch => ch.includes('>'+m.name+'</span>'));
      if(exist) return;
      const ref = chefByName[m.name];
      if(ref){
        masterChips.push(\`<span class="m \${ref.isPlaceholder?'placeholder':''}" data-id="\${ref.id}"><span class="ar">→</span>\${m.name}\${m.title?\` · <span style="color:var(--dust);font-size:11px">\${m.title}</span>\`:''}</span>\`);
      } else {
        masterChips.push(\`<span class="m placeholder"><span class="ar">→</span>\${m.name}\${m.title?\` · <span style="color:var(--dust);font-size:11px">\${m.title}</span>\`:''}</span>\`);
      }
    });
  }

  const yrs = c.birth ? (c.birth + (c.death?'–'+c.death:'–')) : (c.era || '');

  right.innerHTML = \`
    <div class="head">
      \${portraitHtml}
      <div>
        <div class="nm">\${c.name}</div>
        \${c.gender||c.birthplace ? \`<div class="nm-en">\${[c.gender,c.birthplace].filter(Boolean).join(' · ')}</div>\` : ''}
        <div class="yr">\${yrs} \${c.school&&schoolByKey[c.school] ? '· '+schoolByKey[c.school].name : ''}</div>
        <div class="cu-row">
          <div class="cu" title="主菜系">\${cuisineStamp(c.primaryCuisine)}</div>
          \${(c.secondaryCuisines||[]).map(sc=>\`<div class="cu sec" title="兼修">\${cuisineStamp(sc)}</div>\`).join('')}
          \${typeof c.gen==='number' ? \`<span style="font-family:var(--mono);font-size:9.5px;letter-spacing:.18em;color:var(--dust);margin-left:6px">GEN \${String(c.gen).padStart(2,'0')}</span>\` : ''}
        </div>
      </div>
    </div>
    \${isCross ? '<div class="banner-cross">※ 跨菜系学艺</div>' : ''}
    \${isHub ? '<div class="banner-hub">枢 师门枢纽</div>' : ''}
    \${c.titles && c.titles.length ? \`<div class="sec"><div class="lbl">Titles · 头衔</div><ul class="titles">\${c.titles.map(t=>\`<li>\${t}</li>\`).join('')}</ul></div>\` : ''}
    \${(c.restaurant||c.position||c.city) ? \`<div class="sec"><div class="lbl">Position · 职务</div><div class="bio">\${[c.restaurant,c.position,c.city].filter(Boolean).join(' · ')}</div></div>\` : ''}
    \${masterChips.length ? \`<div class="sec"><div class="lbl">Lineage · 师承</div><div class="masters">\${masterChips.join('')}</div></div>\` : ''}
    \${c.signature && c.signature.length ? \`<div class="sec"><div class="lbl">Signature · 拿手菜</div><div class="sig">\${c.signature.map(s=>\`<span class="s">\${s}</span>\`).join('')}</div></div>\` : ''}
    \${c.experiences && c.experiences.length ? \`<div class="sec"><div class="lbl">Experiences · 经历</div><ul class="exp">\${c.experiences.map(x=>\`<li>\${x}</li>\`).join('')}</ul></div>\` : ''}
    \${c.bio ? \`<div class="sec"><div class="lbl">Biography · 小传</div><div class="bio">\${c.bio}</div></div>\` : ''}
    \${c.source ? \`<div class="sec"><div class="lbl">Source</div><a class="src" href="\${c.source}" target="_blank">\${c.source.length>60?c.source.slice(0,60)+'…':c.source}</a></div>\` : ''}
  \`;

  // master chip 跳转
  right.querySelectorAll('.masters .m').forEach(el => {
    if(!el.dataset.id) return;
    el.style.cursor = 'pointer';
    el.onclick = () => {
      state.chefId = el.dataset.id;
      renderV3();
    };
  });
}

// —— 顶部 tab / back-btn ——————————————————————————————————
$$('.mode-tab').forEach(t => {
  t.onclick = () => {
    const v = +t.dataset.view;
    if(v===2 && !state.cuisine) state.cuisine = cuisinesSorted[0];
    if(v===3 && !state.cuisine) state.cuisine = cuisinesSorted[0];
    if(v===2) enterCuisine(state.cuisine);
    else if(v===3) renderV3(), showView(3);
    else showView(v);
  };
});
$$('.back-btn').forEach(b => {
  b.onclick = () => {
    const v = +b.dataset.view;
    if(v===1) showView(1);
    else if(v===2) enterCuisine(state.cuisine);
  };
});

// —— 启动 ——————————————————————————————————
renderV1();
</script>
</html>`;

const html = HEAD_STYLE + '\n' + BODY + '\n' + SCRIPT;
fs.writeFileSync(OUT, html);
console.log('OK:', OUT, fs.statSync(OUT).size, 'bytes');
