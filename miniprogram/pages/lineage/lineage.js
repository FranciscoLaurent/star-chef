// pages/lineage/lineage.js — 数字师承谱（真实数据 1537 位名厨）
// 三级下钻：V1 菜系网格 → V2 流派/时代 → V3 师承树；另有拼音搜索、全景星图、人物详情弹层
// 交互模型借鉴 lineage_demo/demo-D5-real-data.html（已验证的移动端下钻模式）
const REAL = require('../../data/chefs-real.js');
const { callAI, PROMPTS } = require('../../services/ai.js');
const { surnameOf, lifeSpan, buildTrees, lineageChain } = require('../../utils/format.js');

// 时代排序（与 D5 一致）
const ERA_ORDER = ['清末', '清末民初', '民国', '近代', '近代-当代', '近代/当代', '当代', '?'];
// 派系色盘（全景星图用，按菜系循环取色）
const PALETTE = ['#B8321A', '#4A5A3F', '#A67C00', '#2F4A6B', '#6B3A5B', '#3A6B5A', '#8B5A2B', '#5B5B3A'];

Page({
  data: {
    statusBarHeight: 20,
    level: 1,               // 1 菜系网格 / 2 流派·时代 / 3 师承树
    stats: REAL.stats,
    // V1
    cuisines: [],
    // V2
    cuisine: '', cuisineStamp: '', cuisineCount: 0,
    schools: [], eraGroups: [],
    // V3
    treeTitle: '', treeRows: [], treeEmpty: false,
    panoramaOn: false,
    // 详情弹层
    detail: null, detailChain: [], detailApprentices: [],
    aiText: '', aiBusy: false,
    // 搜索
    searchOpen: false, searchQuery: '', searchResults: [], searchHint: true
  },

  onLoad() {
    const app = getApp();
    // 索引：byId / byCuisine（null 菜系归入「其他」）
    this.byId = {};
    this.byCuisine = {};
    REAL.chefs.forEach(c => {
      this.byId[c.id] = c;
      const cu = c.cuisine || '其他';
      (this.byCuisine[cu] = this.byCuisine[cu] || []).push(c);
    });
    this.schoolByKey = {};
    REAL.schools.forEach(s => { this.schoolByKey[s.key] = s; });

    // V1 菜系卡片：按人数降序
    const cuisines = Object.keys(this.byCuisine).map((cu, i) => ({
      name: cu,
      stamp: cu.charAt(0),
      count: this.byCuisine[cu].length,
      schoolCount: REAL.schools.filter(s => s.cuisine === cu).length,
      color: PALETTE[i % PALETTE.length]
    })).sort((a, b) => b.count - a.count);
    this.cuisineColor = {};
    cuisines.forEach(c => { this.cuisineColor[c.name] = c.color; });

    this.setData({ statusBarHeight: app.globalData.statusBarHeight, cuisines });
  },

  onShow() {
    const tab = this.getTabBar && this.getTabBar();
    if (tab) tab.setData({ selected: 1 });
  },

  // ============ V1 → V2 ============
  enterCuisine(e) {
    const cu = e.currentTarget.dataset.cu;
    const list = this.byCuisine[cu] || [];
    // 流派卡（该菜系下，仅保留有成员的流派）
    const schools = REAL.schools
      .filter(s => s.cuisine === cu)
      .map(s => {
        const members = list.filter(c => c.school === s.key);
        return { ...s, memberCount: members.length, reps: members.slice(0, 3) };
      })
      .filter(s => s.memberCount > 0);
    // 无流派者按时代分组
    const noSchool = list.filter(c => !c.school);
    const groups = {};
    noSchool.forEach(c => { const k = c.era || '?'; (groups[k] = groups[k] || []).push(c); });
    const eraGroups = ERA_ORDER.filter(k => groups[k]).map(k => ({
      era: k === '?' ? '时代不详' : k,
      count: groups[k].length,
      chefs: groups[k].map(c => ({ ...c, stamp: surnameOf(c.name), sub: c.restaurant || c.position || c.city || '—' }))
    }));
    this.currentList = list;
    this.setData({
      level: 2,
      cuisine: cu,
      cuisineStamp: cu.charAt(0),
      cuisineCount: list.length,
      schools,
      eraGroups,
      panoramaOn: false
    });
  },

  // ============ V2 → V3（流派树）============
  enterSchool(e) {
    const key = e.currentTarget.dataset.key;
    const school = this.schoolByKey[key];
    const members = this.currentList.filter(c => c.school === key);
    this.openTree(`${school.name} · ${school.subName || ''}`, members);
  },

  // 整菜系师承树（V2 顶部入口）
  enterCuisineTree() {
    this.openTree(`${this.data.cuisine}菜 · 全菜系师承`, this.currentList);
  },

  // 由某位厨师进入其所在树的上下文（时代列表点入）
  enterChefContext(e) {
    const id = e.currentTarget.dataset.id;
    const chef = this.byId[id];
    if (!chef) return;
    const rootSet = this.currentList && this.currentList.length ? this.currentList : REAL.chefs;
    const ids = new Set(rootSet.map(c => c.id));
    // 沿 master 上溯到集合内最顶端，取其整棵子树为上下文
    let root = chef, guard = 0;
    while (root.master && this.byId[root.master] && ids.has(root.master) && guard++ < 10) {
      root = this.byId[root.master];
    }
    const { childrenOf } = buildTrees(rootSet);
    const subtree = [];
    const walk = (node) => { subtree.push(node); (childrenOf[node.id] || []).forEach(walk); };
    walk(root);
    this.openTree(`${root.name} 一脉`, subtree, id);
  },

  // 建树并拍平成缩进行（WXML 不便递归，JS 侧 flatten）
  openTree(title, members, focusId) {
    const { roots, childrenOf } = buildTrees(members);
    const rows = [];
    const walk = (node, depth) => {
      rows.push({
        id: node.id, name: node.name, depth,
        stamp: surnameOf(node.name),
        sub: [node.position, node.city].filter(Boolean).join(' · '),
        era: node.era || '',
        isPlaceholder: node.isPlaceholder,
        focus: node.id === focusId
      });
      (childrenOf[node.id] || []).forEach(ch => walk(ch, depth + 1));
    };
    roots.forEach(r => walk(r, 0));
    this.treeMembers = members;
    this.setData({ level: 3, treeTitle: title, treeRows: rows, treeEmpty: rows.length === 0, panoramaOn: false });
  },

  // ============ 返回 ============
  goBack() {
    if (this.data.level === 3) this.setData({ level: 2, panoramaOn: false });
    else if (this.data.level === 2) this.setData({ level: 1 });
  },

  // ============ 详情弹层 ============
  openDetail(e) {
    const id = e.currentTarget.dataset.id;
    const chef = this.byId[id];
    if (!chef) return;
    const chain = lineageChain(chef, this.byId).map(c => ({ id: c.id, name: c.name, self: c.id === id }));
    const apprentices = REAL.chefs.filter(c => c.master === id)
      .map(c => ({ id: c.id, name: c.name, stamp: surnameOf(c.name) }));
    const masterName = chef.master && this.byId[chef.master] ? this.byId[chef.master].name : '';
    this.setData({
      detail: {
        ...chef,
        stamp: surnameOf(chef.name),
        span: lifeSpan(chef),
        masterName,
        schoolName: chef.school && this.schoolByKey[chef.school] ? this.schoolByKey[chef.school].name : ''
      },
      detailChain: chain,
      detailApprentices: apprentices,
      aiText: '',
      aiBusy: false,
      searchOpen: false
    });
  },

  closeDetail() {
    if (this.data.aiBusy) return; // 流式进行中不允许误关
    this.setData({ detail: null });
  },

  // 详情内点师承链/徒弟跳转
  jumpChef(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ detail: null }, () => this.openDetail({ currentTarget: { dataset: { id } } }));
  },

  // AI 推断师承（mock 流式）
  aiInfer() {
    if (this.data.aiBusy || !this.data.detail) return;
    const d = this.data.detail;
    this.setData({ aiBusy: true, aiText: '' });
    const peers = this.treeMembers
      ? this.treeMembers.filter(c => c.id !== d.id).slice(0, 8).map(c => c.name).join('、')
      : '';
    callAI(PROMPTS.lineageInfer(d, d.masterName, peers), {
      onToken: (delta, full) => this.setData({ aiText: full })
    }).then(() => this.setData({ aiBusy: false }));
  },

  // ============ 搜索 ============
  openSearch() { this.setData({ searchOpen: true, searchQuery: '', searchResults: [], searchHint: true }); },
  closeSearch() { this.setData({ searchOpen: false }); },

  onSearchInput(e) {
    const q = (e.detail.value || '').trim().toLowerCase();
    if (!q) { this.setData({ searchQuery: q, searchResults: [], searchHint: true }); return; }
    const isPinyin = /^[a-z]+$/.test(q);
    const results = [];
    for (const c of REAL.chefs) {
      const hit = isPinyin
        ? ((c.py.n && c.py.n.startsWith(q)) || (c.py.i && c.py.i.startsWith(q)))
        : c.name.includes(q);
      if (hit) {
        results.push({
          id: c.id, name: c.name, stamp: surnameOf(c.name),
          sub: [c.cuisine ? c.cuisine + '菜' : '', c.position || c.restaurant || c.city || ''].filter(Boolean).join(' · '),
          py: c.py.n
        });
        if (results.length >= 50) break; // 限 50 条防长列表卡顿
      }
    }
    this.setData({ searchQuery: q, searchResults: results, searchHint: false });
  },

  // 搜索结果点入：直接开详情（可经师承链继续跳转）
  pickSearchResult(e) { this.openDetail(e); },

  // ============ 全景星图 ============
  togglePanorama() {
    const on = !this.data.panoramaOn;
    this.setData({ panoramaOn: on }, () => { if (on) this.drawPanorama(); });
  },

  // 平移自网页版 renderPanorama（2995–3075）：伪随机星点 + 同心轨道 + 按代际半径 + 师承连线
  drawPanorama() {
    const members = (this.treeMembers && this.data.level === 3 ? this.treeMembers : this.currentList) || [];
    if (!members.length) return;
    const query = wx.createSelectorQuery().in(this);
    query.select('#panorama').fields({ node: true, size: true }).exec(res => {
      if (!res || !res[0] || !res[0].node) return;
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const w = res[0].width, h = res[0].height;
      const dpr = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).pixelRatio || 2;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.scale(dpr, dpr);

      const cx = w / 2, cy = h / 2;
      const maxR = Math.min(w, h) / 2 - 24;
      const color = this.cuisineColor[this.data.cuisine] || '#B8321A';
      // 伪随机（与网页版一致的 sin hash，保证每次绘制星点相同）
      const pseudoRandom = seed => { const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

      // 背景
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR + 30);
      bg.addColorStop(0, '#1A1712'); bg.addColorStop(1, '#0D0B09');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      // 星点
      ctx.fillStyle = 'rgba(237,232,219,.5)';
      for (let i = 0; i < 600; i++) {
        const a = pseudoRandom(i) * Math.PI * 2;
        const r = pseudoRandom(i + 1000) * maxR * 1.15;
        ctx.globalAlpha = 0.15 + pseudoRandom(i + 2000) * 0.5;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0.6 + pseudoRandom(i + 3000) * 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // 同心轨道
      ctx.strokeStyle = 'rgba(237,232,219,.14)';
      ctx.lineWidth = 0.6;
      for (let k = 1; k <= 4; k++) {
        ctx.beginPath(); ctx.arc(cx, cy, maxR * k / 4, 0, Math.PI * 2); ctx.stroke();
      }

      // 节点位置：按 gen 分层半径，角度均布
      const pos = {};
      const N = members.length;
      members.forEach((c, i) => {
        const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
        const depth = Math.min((c.gen || 2) - 1, 3);
        const radius = c.gen ? maxR * (0.3 + depth * 0.22) + pseudoRandom(i + 5000) * 18 : maxR * 0.92;
        pos[c.id] = { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
      });
      // 师承连线（虚线）
      members.forEach(c => {
        if (!c.master || !pos[c.master]) return;
        const a = pos[c.master], b = pos[c.id];
        ctx.beginPath();
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = 'rgba(237,232,219,.28)';
        ctx.lineWidth = 0.7;
        ctx.setLineDash([3, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      });
      // 节点
      members.forEach(c => {
        const p = pos[c.id];
        const isRoot = !c.master || !pos[c.master];
        ctx.beginPath();
        ctx.arc(p.x, p.y, isRoot ? 5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        if (isRoot) { // 祖师光晕
          ctx.beginPath();
          ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
          ctx.strokeStyle = color; ctx.globalAlpha = .5; ctx.lineWidth = 1;
          ctx.stroke(); ctx.globalAlpha = 1;
        }
      });
      // 中心标签
      const label = `${this.data.cuisine || ''} · ${members.length} 位名厨`;
      ctx.font = '13px serif';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(18,16,14,.78)';
      ctx.fillRect(cx - tw / 2 - 14, cy - 16, tw + 28, 32);
      ctx.fillStyle = '#EDE8DB';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, cx, cy);
    });
  }
});
