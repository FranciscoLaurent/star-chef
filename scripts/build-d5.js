#!/usr/bin/env node
// build-d5.js
// 流式拼接：把 data/_slim-pinyin.json 作为字符串嵌入 demo-D5-real-data.html
// 不 parse、不操作大对象，避免读全文 + 上下文爆炸

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SLIM = path.join(ROOT, 'data', '_slim-pinyin.json');
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
  .stage{height:calc(100vh - 112px);overflow:hidden;position:relative}
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

  /* 中栏：人物按 gen 行（D4 同款立柱式版面） */
  .gen-row{
    display:grid;grid-template-columns:84px 1fr;align-items:start;gap:20px;
    padding:18px 0;border-bottom:1px dashed rgba(18,16,14,.18);
  }
  .gen-row:last-child{border-bottom:0}
  .gen-label{
    border-right:1.5px solid var(--ink);padding:4px 12px 4px 4px;text-align:right;
  }
  .gen-label .num{
    font-family:var(--serif);font-style:italic;font-variation-settings:"opsz" 144;
    font-size:34px;line-height:.95;color:var(--vermillion);
  }
  .gen-label .zh{
    font-family:var(--songti);font-weight:500;font-size:12.5px;
    letter-spacing:.18em;color:var(--ink);margin-top:4px;
  }
  .gen-label .en{
    font-family:var(--mono);font-size:9px;letter-spacing:.18em;color:var(--dust);
    margin-top:3px;text-transform:uppercase;
  }
  .gen-people{display:flex;flex-wrap:wrap;gap:14px;align-items:stretch}

  /* 人物卡（D4 风格：主菜系钢印+姓名+短连线） */
  .person{
    display:grid;grid-template-columns:auto 1fr;gap:11px;align-items:center;
    padding:9px 14px 9px 9px;background:var(--paper);
    border:1px solid rgba(18,16,14,.2);width:230px;cursor:pointer;
    position:relative;transition:transform .2s,box-shadow .2s,border-color .2s;
  }
  .person > div:last-child{display:flex;flex-direction:column;justify-content:center;min-height:54px}
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
  .c-pri::after{
    content:"";position:absolute;inset:-3px;border:1px dashed rgba(202,108,82,.55);
  }
  .person.active .c-pri::after{border-color:rgba(237,232,219,.4)}
  .c-sec{
    position:absolute;right:-6px;bottom:-4px;
    width:20px;height:24px;background:var(--paper);color:var(--ink);
    border:1.2px solid var(--ink);display:grid;place-items:center;
    font-family:var(--songti);font-weight:700;font-size:11px;
    z-index:2;
  }
  .person.active .c-sec{background:var(--ink);color:var(--paper);border-color:var(--paper)}
  .c-cross-line{
    position:absolute;right:-2px;bottom:6px;width:14px;height:1px;
    border-top:1.2px dashed var(--vermillion);transform:rotate(35deg);transform-origin:right center;
    z-index:1;
  }
  .person.active .c-cross-line{border-color:var(--gold)}

  .p-name{font-family:var(--songti);font-size:15.5px;font-weight:700;letter-spacing:.04em;line-height:1.15}
  .p-yrs{font-family:var(--serif);font-style:italic;font-size:11.5px;color:var(--ink-soft);margin-top:3px;font-variation-settings:"opsz" 144}
  .p-meta{font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;color:var(--ink-soft);margin-top:3px}

  /* 师徒短连线（左侧贴卡片） */
  .person::after{
    content:"";position:absolute;left:-10px;top:50%;width:8px;height:1px;background:var(--ink);opacity:.35;
  }
  .person.placeholder{border-style:dashed;background:var(--paper)}
  .person.placeholder .c-pri{background:var(--paper);color:var(--dust);border:1px dashed var(--dust)}
  .person.placeholder .c-pri::after{border-color:rgba(139,130,112,.5)}
  .person.placeholder .p-name{color:var(--dust);font-weight:500}
  .person.placeholder.active{background:var(--paper-3);color:var(--ink);box-shadow:4px 4px 0 var(--dust);border-color:var(--ink-soft)}
  .person.placeholder.active .c-pri{background:var(--paper-2);color:var(--ink-soft)}
  .person.placeholder.active .p-name{color:var(--ink)}

  /* 跨菜系角标 / 师门枢纽徽 */
  .person .cross-badge{
    position:absolute;top:-2px;right:8px;color:var(--vermillion);font-family:var(--songti);font-size:18px;
    line-height:1;
  }
  .person.active .cross-badge{color:var(--gold)}
  .person .hub-badge{
    position:absolute;top:-9px;left:-9px;
    width:24px;height:24px;display:grid;place-items:center;
    background:var(--gold);color:var(--paper);font-family:var(--songti);font-weight:700;font-size:10px;
    border-radius:50%;letter-spacing:.04em;line-height:1;
    box-shadow:0 0 0 2px var(--paper);z-index:3;
  }

  /* 右栏：详情面板 */
  .detail{padding:0}
  .detail .empty{
    font-family:var(--serif);font-style:italic;font-size:14px;color:var(--dust);text-align:center;
    padding:60px 20px;line-height:1.7;
  }
  .detail .head{display:flex;gap:18px;align-items:stretch;margin-bottom:18px;padding-bottom:16px;border-bottom:1px solid var(--rule)}
  .detail .head .info{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:space-between;padding:2px 0}
  .detail .portrait{
    width:130px;height:174px;flex-shrink:0;border:1px solid var(--rule-strong);
    object-fit:cover;background:var(--paper-2);position:relative;
  }
  .detail .portrait-fallback{
    width:130px;height:174px;flex-shrink:0;background:var(--paper-2);color:var(--dust);
    display:grid;place-items:center;font-family:var(--songti);font-weight:300;font-size:42px;
    position:relative;border:1px solid var(--rule);opacity:.6;
  }
  .detail .portrait-fallback::after{
    content:"";position:absolute;inset:5px;border:1px dotted var(--rule);
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

  /* —— Command Palette 搜索浮层 —— */
  .palette-overlay{
    position:fixed;inset:0;background:rgba(18,16,14,.45);z-index:1000;
    display:none;align-items:flex-start;justify-content:center;padding-top:13vh;
  }
  .palette-overlay.open{display:flex;animation:palette-fadein .15s}
  @keyframes palette-fadein{from{opacity:0}to{opacity:1}}
  .palette{
    width:92%;max-width:720px;background:var(--paper);
    border:1px solid var(--ink);box-shadow:8px 8px 0 var(--ink);
    display:flex;flex-direction:column;max-height:74vh;
  }
  .palette-input-wrap{
    display:flex;align-items:center;gap:12px;padding:16px 20px;
    border-bottom:1px solid var(--ink);background:var(--paper-2);
  }
  .palette-icon{
    width:18px;height:18px;flex-shrink:0;
    border:1.8px solid var(--ink);border-radius:50%;position:relative;
  }
  .palette-icon::after{
    content:"";position:absolute;bottom:-4px;right:-4px;
    width:2px;height:7px;background:var(--ink);transform:rotate(-45deg);transform-origin:top center;
  }
  .palette-input{
    flex:1;font-family:var(--songti);font-size:18px;background:none;border:none;outline:none;color:var(--ink);
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
  .palette-results .sr-item{
    display:grid;grid-template-columns:42px 1fr auto;gap:12px;align-items:center;
    padding:10px 20px;cursor:pointer;border-bottom:1px solid var(--rule);transition:all .12s;
  }
  .palette-results .sr-item:hover,.palette-results .sr-item.focus{
    background:var(--paper-2);border-left:3px solid var(--vermillion);padding-left:17px;
  }
  .palette-results .sr-cui{
    width:36px;height:36px;background:var(--vermillion);color:var(--paper);
    display:grid;place-items:center;font-family:var(--songti);font-weight:700;font-size:15px;
    position:relative;flex-shrink:0;
  }
  .palette-results .sr-cui::after{content:"";position:absolute;inset:-3px;border:1px dashed var(--vermillion)}
  .palette-results .sr-placeholder .sr-cui{background:var(--paper);color:var(--dust);border:1px dashed var(--dust)}
  .palette-results .sr-placeholder .sr-cui::after{border-color:var(--dust)}
  .palette-results .sr-body{min-width:0}
  .palette-results .sr-row1{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
  .palette-results .sr-name{font-family:var(--songti);font-size:15px;font-weight:700;line-height:1.2}
  .palette-results .sr-placeholder .sr-name{color:var(--dust);font-style:italic;font-weight:400}
  .palette-results .sr-era{font-family:var(--serif);font-style:italic;font-size:10px;color:var(--vermillion);font-variation-settings:'opsz' 144}
  .palette-results .sr-pinyin{font-family:var(--mono);font-size:9px;color:var(--vermillion);letter-spacing:.08em;text-transform:uppercase}
  .palette-results .sr-row2{
    font-family:var(--mono);font-size:10px;color:var(--ink-soft);letter-spacing:.04em;
    margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  }
  .palette-results .sr-row3{
    font-family:var(--songti);font-size:11px;color:var(--dust);margin-top:2px;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  }
  .palette-results .sr-empty{
    padding:36px 20px;text-align:center;color:var(--dust);
    font-family:var(--serif);font-style:italic;font-size:14px;line-height:1.7;
  }

  /* 搜索触发按钮（导航栏右侧） */
  .mode-search{margin-left:auto;display:flex;align-items:center}
  .search-trigger{
    display:flex;gap:8px;align-items:center;padding:12px 22px 11px;
    font-family:var(--mono);font-size:11px;letter-spacing:.18em;text-transform:uppercase;
    color:var(--ink-soft);cursor:pointer;background:none;border:none;border-left:1px solid var(--rule);
    user-select:none;transition:background .15s;
  }
  .search-trigger:hover{background:var(--paper-3);color:var(--ink)}
  .search-trigger kbd{
    font-family:var(--mono);font-size:9px;padding:1px 5px;margin-left:4px;
    border:1px solid var(--rule-strong);background:var(--paper-2);color:var(--dust);
    border-radius:2px;letter-spacing:.05em;
  }
  .search-trigger .st-icon{
    display:inline-block;width:13px;height:13px;
    border:1.5px solid currentColor;border-radius:50%;position:relative;
  }
  .search-trigger .st-icon::after{
    content:"";position:absolute;bottom:-3px;right:-3px;
    width:1.5px;height:5px;background:currentColor;transform:rotate(-45deg);transform-origin:top center;
  }
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
    <div class="mode-search">
      <button class="search-trigger" id="searchTrigger" aria-label="搜索">
        <span class="st-icon"></span>
        <span>搜索</span>
        <kbd>Ctrl K</kbd>
      </button>
    </div>
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

  <!-- Command Palette 搜索浮层 -->
  <div class="palette-overlay" id="paletteOverlay">
    <div class="palette">
      <div class="palette-input-wrap">
        <span class="palette-icon"></span>
        <input type="text" class="palette-input" id="paletteInput" placeholder="姓名 / 拼音 / 菜系 / 头衔 / 拿手菜…" autocomplete="off" />
        <span class="palette-close" id="paletteClose">ESC</span>
      </div>
      <div class="palette-results" id="paletteResults"></div>
    </div>
  </div>
</body>`;

// ============================================================
// 客户端脚本（DATA 注入点）
// ============================================================
const SCRIPT = `<script>
const DATA = ${slimStr};

// —— 搜索（Command Palette）——————————————————————————————
(function(){
  const overlay = document.getElementById('paletteOverlay');
  const input = document.getElementById('paletteInput');
  const results = document.getElementById('paletteResults');
  const closeBtn = document.getElementById('paletteClose');
  const trigger = document.getElementById('searchTrigger');
  if(!overlay || !input) return;

  // 构建搜索索引（含拼音）
  const chefs = DATA.chefs;
  const searchIndex = chefs.map((c,i) => ({
    idx:i, id:c.id, name:c.name, cui:c.primaryCuisine||'',
    secondaryCuisines:(c.secondaryCuisines||[]).join(' '),
    era:c.era||'', birthplace:c.birthplace||'', city:c.city||'',
    restaurant:c.restaurant||'', currentRole:c.currentRole||'', position:c.position||'',
    titles:(c.titles||[]).join(' '), signature:(c.signature||[]).join(' '),
    bio:(c.bio||'').slice(0,300),
    isPlaceholder:!!c.isPlaceholder, school:c.school||'',
    pinyin:c.pinyin||null,
    searchText:''
  }));
  searchIndex.forEach(c => {
    c.searchText = [c.name,c.cui,c.secondaryCuisines,c.era,c.birthplace,c.city,
      c.restaurant,c.currentRole,c.position,c.titles,c.signature,c.bio].join(' ').toLowerCase();
  });

  let focusIdx = -1;
  let maxShow = 100;
  const moreStep = 100;

  function search(q){
    q = (q||'').trim().toLowerCase();
    if(!q) return [];
    const terms = q.split(/\\s+/).filter(Boolean);
    const qCompact = q.replace(/\\s/g,'');
    const isAlpha = /^[a-z]+$/.test(qCompact);
    const isShortAlpha = isAlpha && qCompact.length <= 3;
    const scored = [];
    for(const c of searchIndex){
      let score = 0;
      const allMatch = terms.every(t => c.searchText.includes(t));
      if(allMatch) score = 1;
      if(!allMatch && isAlpha && c.pinyin){
        const py = c.pinyin;
        if(isShortAlpha){
          if(py.nameInitial === qCompact) score = 1.5;
          else if(py.nameInitial && py.nameInitial.startsWith(qCompact)) score = 1.0;
          else if(py.nameInitial && py.nameInitial.includes(qCompact)) score = 0.7;
        } else {
          if(py.nameCompact === qCompact) score = 1.5;
          else if(py.nameCompact && py.nameCompact.startsWith(qCompact)) score = 1.2;
          else if(py.nameCompact && py.nameCompact.includes(qCompact)) score = 1.0;
          else if(py.all && py.all.replace(/\\s/g,'').includes(qCompact)) score = 0.5;
        }
      }
      if(score > 0){
        if(c.name.toLowerCase().includes(q)) score += 2;
        if(c.name.toLowerCase() === q) score += 5;
        if(c.cui && c.cui.includes(q)) score += 0.3;
        scored.push({ c, score });
      }
    }
    scored.sort((a,b) => b.score - a.score || (a.c.name||'').localeCompare(b.c.name||''));
    return scored.map(s => s.c);
  }

  function renderItem(c){
    const cui = c.cui ? c.cui[0] : '?';
    const era = c.era || '';
    const titles = (c.titles ? c.titles.split(' ').slice(0,2).join(' · ') : '');
    const restaurant = c.restaurant || c.currentRole || '';
    const city = c.city || c.birthplace || '';
    const sig = c.signature ? c.signature.split(' ').slice(0,2).join(' · ') : '';
    const row2 = [titles, restaurant, city].filter(Boolean).join(' · ').slice(0, 60);
    const py = c.pinyin ? c.pinyin.nameCompact : '';
    const placeholder = c.isPlaceholder;
    return '<div class="sr-item' + (placeholder?' sr-placeholder':'') + '" data-idx="' + c.idx + '">' +
      '<div class="sr-cui">' + cui + '</div>' +
      '<div class="sr-body">' +
        '<div class="sr-row1"><span class="sr-name">' + c.name + '</span>' +
        (era ? '<span class="sr-era">' + era + '</span>' : '') +
        (py ? '<span class="sr-pinyin">' + py + '</span>' : '') + '</div>' +
        (row2 ? '<div class="sr-row2">' + row2 + '</div>' : '') +
        (sig ? '<div class="sr-row3">★ ' + sig + '</div>' : '') +
      '</div><div></div></div>';
  }

  function doSearch(q){
    focusIdx = -1;
    if(!q.trim()){ results.innerHTML = ''; return; }
    const matched = search(q);
    if(matched.length === 0){
      results.innerHTML = '<div class="sr-empty">无匹配结果<br/>试试拼音首字母（如 lc）或全拼（如 liuchong）</div>';
      return;
    }
    const showing = Math.min(maxShow, matched.length);
    let html = '<div class="sr-count">找到 ' + matched.length + ' 位 · 显示前 ' + showing + ' 位</div>';
    for(let i=0;i<showing;i++) html += renderItem(matched[i]);
    if(matched.length > showing){
      html += '<div class="sr-more" data-action="more">▼ 显示更多（还有 ' + (matched.length - showing) + ' 位）</div>';
    }
    results.innerHTML = html;
    // 绑定点击
    results.querySelectorAll('.sr-item').forEach(el => {
      el.onclick = () => {
        const sel = searchIndex[parseInt(el.dataset.idx)];
        if(sel) selectChef(sel);
      };
    });
    const moreBtn = results.querySelector('.sr-more');
    if(moreBtn){
      moreBtn.onclick = () => {
        maxShow = showing + moreStep;
        doSearch(input.value);
        input.focus();
      };
    }
  }

  function selectChef(c){
    closePalette();
    // 强制跳转 view3 并选中该厨师
    if(typeof state !== 'undefined'){
      if(c.cui) state.cuisine = c.cui;
      state.schoolKey = c.school || null;
      state.chefId = c.id;
      if(typeof renderV3 === 'function') renderV3();
      if(typeof showView === 'function') showView(3);
    }
  }

  function openPalette(){
    overlay.classList.add('open');
    input.value = '';
    maxShow = 100;
    results.innerHTML = '';
    setTimeout(() => input.focus(), 30);
  }
  function closePalette(){
    overlay.classList.remove('open');
    input.value = '';
    results.innerHTML = '';
    focusIdx = -1;
  }

  trigger.addEventListener('click', openPalette);
  closeBtn.addEventListener('click', closePalette);
  overlay.addEventListener('click', e => { if(e.target === overlay) closePalette(); });

  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    maxShow = 100;
    timer = setTimeout(() => doSearch(input.value), 120);
  });
  input.addEventListener('keydown', e => {
    const items = results.querySelectorAll('.sr-item');
    if(e.key === 'Escape'){ closePalette(); e.preventDefault(); }
    else if(e.key === 'ArrowDown'){
      e.preventDefault();
      if(items.length === 0) return;
      focusIdx = Math.min(focusIdx + 1, items.length - 1);
      updateFocus(items);
    } else if(e.key === 'ArrowUp'){
      e.preventDefault();
      focusIdx = Math.max(focusIdx - 1, -1);
      updateFocus(items);
    } else if(e.key === 'Enter' && focusIdx >= 0){
      const sel = searchIndex[parseInt(items[focusIdx].dataset.idx)];
      if(sel) selectChef(sel);
      e.preventDefault();
    }
  });
  function updateFocus(items){
    items.forEach((el,i) => el.classList.toggle('focus', i === focusIdx));
    if(focusIdx >= 0 && items[focusIdx]) items[focusIdx].scrollIntoView({ block: 'nearest' });
  }

  // 全局快捷键 Ctrl+K / Cmd+K
  document.addEventListener('keydown', e => {
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){
      e.preventDefault();
      if(overlay.classList.contains('open')) closePalette();
      else openPalette();
    }
  });
})();

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
let _dupIdWarn = 0;
DATA.chefs.forEach(c => {
  if (chefById[c.id]) { _dupIdWarn++; console.warn('重复 id:', c.id, c.name, '覆盖', chefById[c.id].name); }
  chefById[c.id] = c;
});
if (_dupIdWarn) console.error('共发现', _dupIdWarn, '个重复 id，请检查数据源');

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
    const yrs = c.birth ? (c.birth + (c.death?'–'+c.death:'–今')) : (c.era || '');
    const meta = c.restaurant || c.position || c.city || (c.isPlaceholder?'档案待补':'');
    const priStamp = cuisineStamp(c.primaryCuisine);
    const secStamp = c.secondaryCuisines && c.secondaryCuisines.length ? cuisineStamp(c.secondaryCuisines[0]) : '';
    return \`<div class="person \${c.isPlaceholder?'placeholder':''} \${state.chefId===c.id?'active':''}" data-id="\${c.id}">
      \${isHub ? '<div class="hub-badge">枢</div>' : ''}
      \${isCross ? '<div class="cross-badge">※</div>' : ''}
      <div class="p-cuisines">
        <div class="c-pri">\${priStamp || '·'}</div>
        \${secStamp ? \`<div class="c-cross-line"></div><div class="c-sec">\${secStamp}</div>\` : ''}
      </div>
      <div>
        <div class="p-name">\${c.name}</div>
        \${yrs ? \`<div class="p-yrs">\${yrs}</div>\` : ''}
        \${meta ? \`<div class="p-meta">\${meta}</div>\` : ''}
      </div>
    </div>\`;
  };

  const genCnLabel = ['','一','二','三','四','五','六','七','八','九','十'];
  const genRoman = ['','I','II','III','IV','V','VI','VII','VIII','IX','X'];
  const genHtml = genKeys.map(g => \`<div class="gen-row">
    <div class="gen-label">
      <div class="num">\${genRoman[g] || g}</div>
      <div class="zh">第 \${genCnLabel[g] || g} 代</div>
      <div class="en">GEN \${String(g).padStart(2,'0')}</div>
    </div>
    <div class="gen-people">\${genGroups[g].map(renderChip).join('')}</div>
  </div>\`).join('');

  const eraHtml = eraKeys.map(e => \`<div class="gen-row">
    <div class="gen-label">
      <div class="num" style="font-size:22px;line-height:1.05">\${e==='?'?'?':e[0]||'?'}</div>
      <div class="zh">\${e==='?'?'时代不详':e}</div>
      <div class="en">\${eraGroups[e].length} 人</div>
    </div>
    <div class="gen-people">\${eraGroups[e].map(renderChip).join('')}</div>
  </div>\`).join('');

  $('#v3Mid').innerHTML = (genHtml || '') + (eraHtml ? \`\${genHtml ? '<div class="section-label" style="margin-top:14px;font-family:var(--mono);font-size:9.5px;letter-spacing:.22em;color:var(--dust);text-transform:uppercase;padding-bottom:8px">无世代信息 · 按时代分组</div>' : ''}\${eraHtml}\` : '');
  $('#v3Mid').onclick = e => {
    const chip = e.target.closest('.person'); if(!chip) return;
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
        <div class="info">
          <div>
            <div class="nm">\${c.name}</div>
            <div class="nm-en">PLACEHOLDER · 档案待补</div>
          </div>
          <div class="cu-row"><div class="cu">\${cuisineStamp(c.primaryCuisine)||'·'}</div></div>
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

  const yrs = c.birth ? (c.birth + (c.death?'–'+c.death:'–今')) : (c.era || '');

  right.innerHTML = \`
    <div class="head">
      \${portraitHtml}
      <div class="info">
        <div>
          <div class="nm">\${c.name}</div>
          \${c.gender||c.birthplace ? \`<div class="nm-en">\${[c.gender,c.birthplace].filter(Boolean).join(' · ')}</div>\` : ''}
          \${yrs ? \`<div class="yr">\${yrs}\${c.school&&schoolByKey[c.school] ? ' · '+schoolByKey[c.school].name : ''}</div>\` : ''}
        </div>
        <div>
          \${isCross ? '<div class="banner-cross" style="margin-bottom:6px">※ 跨菜系学艺</div>' : ''}
          \${isHub ? '<div class="banner-hub" style="margin-bottom:6px;margin-left:0">枢 师门枢纽</div>' : ''}
          <div class="cu-row">
            <div class="cu" title="主菜系">\${cuisineStamp(c.primaryCuisine)||'·'}</div>
            \${(c.secondaryCuisines||[]).map(sc=>\`<div class="cu sec" title="兼修">\${cuisineStamp(sc)||'·'}</div>\`).join('')}
            \${typeof c.gen==='number' ? \`<span style="font-family:var(--mono);font-size:9.5px;letter-spacing:.18em;color:var(--dust);margin-left:6px">GEN \${String(c.gen).padStart(2,'0')}</span>\` : ''}
          </div>
        </div>
      </div>
    </div>
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
