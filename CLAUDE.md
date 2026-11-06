# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目定位

「星厨传承」—— 以师承关系为信任底层的厨师职业平台。**交付形态是单个 HTML 文件**（`星厨传承.html`，~3900 行），内嵌全部 CSS / HTML / JS / 数据，无任何构建工具、无测试框架、无包管理。

## 硬约束（参赛形态决定，不可违反）

- **交付物必须保持单文件**：`星厨传承.html` 不允许拆出外部 CSS/JS 文件。实验性代码请放 `lineage_demo/`。
- **视觉风格不可回退**：Fraunces 衬线 + Noto Serif SC，复古纸纹色板（CSS 变量 `--paper` / `--ink` / `--vermillion` / `--moss` / `--gold`），报刊版式 + 钢印元素。
- **不得明文写入任何 API Key**：DeepSeek key 由用户在页面密码框（`#aiKeyInput`）输入，存内存调用 `https://api.deepseek.com/chat/completions`（流式）。
- 注释用中文。

## 运行方式

- 主作品：浏览器直接打开 `星厨传承.html`（纯静态，无 server）。
- demo：`lineage_demo/demo-*.html` 同样直接打开；其中 D5/D6/D7 由脚本生成，**改 demo 请改生成器再重新生成**，不要手改产物：
  - `node scripts/build-d5.js`（读 `data/_slim-pinyin.json` → `demo-D5-real-data.html`）
  - `node scripts/build-d6-search.js`、`node scripts/build-d7-card-size.js` 同理
  - `node scripts/build-pinyin-index.js` 重新生成 `_slim-pinyin.json`（姓名拼音搜索索引）

## 架构：两条线

### 1. 主作品（内嵌 mock 数据）

`星厨传承.html` 第 2507 行 `const DATA = {...}` 内嵌演示数据（chefs / jobs / posts），`lineage` 师承数组由 chefs 的 `master` 字段在运行时推导（~2692 行）。5 个视图（首页 / 师承谱 / 招聘匹配 / AI 求职 / 社区）由 ViewCtrl 切换。4 处 DeepSeek 调用均有独立 prompt，改 AI 行为时逐处检查。

### 2. 真实厨师数据管线（data/ + scripts/）

真实数据（数百名真实名厨、师承关系）独立演进，供 demo 使用、未来可能替换 mock：

```
爬虫脚本 (scripts/cyxh-crawler*.js, cmccx-crawler.js, cswzg-*.js, list-crawler.js)
  → data/ 下各来源 JSON（cyxh-*、cuisine-*、cswzg-*、bfs-*、placeholder-fills*、manual-adds.json…）
  → node data/_merge.js  ← 合并唯一入口：去重、菜系归一化（CUISINE_NORMALIZE 映射表在此文件内）、师承关系注入
  → data/chefs-merged.json（57k 行，schools + chefs + lineage）
  → build-pinyin-index.js → data/_slim-pinyin.json → build-d5/d6/d7 → lineage_demo/*.html
```

要点：
- **改数据只改来源 JSON 或 `_merge.js`，然后重跑 `node data/_merge.js`**；不要手编 `chefs-merged.json`（它是产物）。
- `data/` 下 `_` 前缀文件是 scratch/中间产物，随时可删；根目录大量 `sogou*.html`、`lml_*.html` 等是爬虫抓取的原始网页快照，`extract*.js` 是一次性提取脚本，均非作品代码。
- 师承关系补充走 BFS 模式：单个厨师的批次文件 `data/bfs-chef-<姓名>.json`，汇总进 `bfs-chefs.json` 再合并（见近期 commit）。

## 协作约定

- Commit 用 conventional commits + 中文描述（`feat(data): …`、`fix(d5): …`），scope 常用 `data` / `demo` / `d5` / `lineage`。
- 数据类改动注意：真实人物的师承、籍贯等信息必须来自可溯源来源，宁缺毋滥（历史上多次批量修正 URL / 籍贯 / 师承错误）。
- `.claude/` 已 gitignore，勿提交。
