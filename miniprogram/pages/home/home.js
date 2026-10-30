// pages/home/home.js — 首页（品牌叙事长页）
// 平移网页版 view-home：hero / 走马灯 / §01 问题 / §01.5 田野故事 / §02 能力索引 /
// §03 双支柱 / §04 流程 / §05 社会价值 / §05.5 商业飞轮 / §06 CTA
// 飞轮 SVG → canvas 重绘；滚动显现 → wx.createIntersectionObserver
Page({
  data: {
    statusBarHeight: 20,
    heroIn: false,          // hero 逐行揭示
    in: {},                 // 滚动显现标记 { rv0: true, ... }
    marquee: '川菜 ✺ 粤菜 ✺ 鲁菜 ✺ 淮扬菜 ✺ 湘菜 ✺ 徽菜 ✺ 浙菜 ✺ 闽菜 ✺ 苏菜 ✺ 京菜 ✺ 沪菜 ✺ ',
    features: [
      { ix: '01 / 06', name: '数字师承谱', tag: '核心', meta: '传承主线', desc: '可视化师承树，记录师从关系、派系归属、拿手菜系，追溯手艺源流。', tab: '/pages/lineage/lineage' },
      { ix: '02 / 06', name: '智能招聘匹配', tag: '核心', meta: '招聘主线', desc: '基于师承、菜系、地域、技能为厨师与雇主双向推荐最匹配的机会。', tab: '/pages/jobs/jobs' },
      { ix: '03 / 06', name: '厨师交流社区', tag: '', meta: '社交主线', desc: '按菜系、地域、师门形成圈子，同行切磋、师傅招徒、学徒拜师。', tab: '/pages/community/community' },
      { ix: '04 / 06', name: 'AI 求职助手', tag: '', meta: 'AI 能力', desc: '厨师用口语描述经历，AI 自动生成规范求职档案，降低表达门槛。', tab: '/pages/assistant/assistant' },
      { ix: '05 / 06', name: '师门信用认证', tag: '', meta: '信任机制', desc: '师傅认证徒弟、同行交叉背书，AI 校验异常师承声明。', tab: '' },
      { ix: '06 / 06', name: '雇主人才库', tag: '', meta: 'B 端服务', desc: '酒店与餐厅可按师门派系精准筛选，直接触达可信赖的厨师网络。', tab: '' }
    ],
    steps: [
      { n: 'i.', t: '建档', d: '厨师用手机号或微信注册，语音或文字描述工作经历，AI 自动生成基础档案。', dur: '2 分钟' },
      { n: 'ii.', t: '连脉', d: '添加师傅、同门，完善师承关系。师傅认证通过后，个人档案获得信任背书。', dur: '1-3 天' },
      { n: 'iii.', t: '匹配', d: '系统根据师承、菜系、地域、薪资期望推荐岗位。雇主也可主动发起邀约。', dur: '实时' },
      { n: 'iv.', t: '上岗', d: '双向确认后建立联系。入职后更新任职状态，师门网络持续生长。', dur: '长期' }
    ],
    stats: [
      { n: '2000', u: '万+', label: '潜在服务厨师群体', note: '覆盖酒店、社会餐饮、私厨、烹饪院校全品类。' },
      { n: '68', u: '%', label: '当前依赖熟人介绍', note: '这正是平台要打破的信息壁垒与机会不均。' },
      { n: '3', u: '个月', label: '平均岗位匹配周期', note: '通过精准匹配，目标缩短至 2-4 周。' },
      { n: '100', u: '万+', label: '计划三年连接岗位', note: '为基层厨师创造真实、可追踪的就业机会。' }
    ],
    storyStats: [
      { n: '87%', label: '仍靠熟人介绍找工作', desc: '中烹协 2024 行业调研：超过八成的资深厨师从未通过线上平台获得过 offer。' },
      { n: '6.3 倍', label: '熟人推荐 vs. 平台', desc: '同样资历，熟人圈推荐的回复率，是公开招聘平台的 6.3 倍——这就是"师承网络"的隐性价值。' },
      { n: '1/3', label: '手艺被错误归类', desc: '许多区域菜系（漳州古早、潮汕宵夜、徽州山珍）在主流分类中根本不存在，导致老师傅在系统里"消失"。' },
      { n: '0', label: '现存平台支持师承录入', desc: '这是星厨传承存在的理由——把"陈守德们"背后那张看不见的网，变成可以被搜索和验证的职业资产。' }
    ],
    flywheelRows: [
      { n: 'i', t: '师承录入即资产沉淀', d: '厨师每写一段经历，平台都自动结构化为师承图节点——这是通用招聘平台拿不到的、专属餐饮的第一方关系数据。' },
      { n: 'ii', t: '关系密度→匹配精度', d: '师门关系越密，跨派系/同源派系的匹配权重越准——每多一个厨师入驻，平台的匹配能力就会变强一档。' },
      { n: 'iii', t: '雇主付费，但厨师免费', d: '厨师端零费率以保证供给侧规模；雇主端按成功匹配抽佣 8%（单次收入 ¥2.4k–8k），并提供高级师承溯源服务。' },
      { n: 'iv', t: '成功反哺数据闭环', d: '每次匹配成功后的留任数据会回流到 AI 评估模型，持续优化"看不见的"师承评分——这条护城河随时间指数增厚。' }
    ],
    revenues: [
      { tag: '收入 · A', t: '雇主匹配抽佣 8%', d: '成功入职后从雇主端按首月年化薪资 8% 抽佣。预估 2027 年覆盖 5 万岗位 = 年化 ¥3.2 亿。' },
      { tag: '收入 · B', t: '师承认证 SaaS', d: '面向连锁餐饮集团，按月订阅"师承溯源 + 留任风险评估"——¥1.8k/月/品牌，后端可观。' },
      { tag: '收入 · C', t: '行业培训分成', d: '与烹饪学院 / 行业协会共建认证课程，平台导流并按学费分成 15%——长期价值锚定。' }
    ]
  },

  onLoad() {
    const app = getApp();
    this.setData({ statusBarHeight: app.globalData.statusBarHeight });
    // hero 逐行揭示（平移网页版 load 动画 3880–3887）
    setTimeout(() => this.setData({ heroIn: true }), 120);
  },

  onShow() {
    const tab = this.getTabBar && this.getTabBar();
    if (tab) tab.setData({ selected: 0 });
  },

  onReady() {
    this.setupReveal();
    this.drawFlywheel();
  },

  // 滚动显现：给每个 .rv-N 建观察器（平移 IntersectionObserver 逻辑 3892–3899）
  setupReveal() {
    const N = 12; // 与 WXML 中 rv 序号数量一致
    for (let i = 0; i < N; i++) {
      wx.createIntersectionObserver(this)
        .relativeToViewport({ top: -60 })
        .observe(`.rv-${i}`, res => {
          if (res.intersectionRatio > 0 && !this.data.in['rv' + i]) {
            this.setData({ [`in.rv${i}`]: true });
          }
        });
    }
  },

  // 能力索引 / CTA 跳转
  navTo(e) {
    const { tab } = e.currentTarget.dataset;
    if (tab) wx.switchTab({ url: tab });
    else wx.showToast({ title: '规划中，敬请期待', icon: 'none' });
  },

  // 商业飞轮 canvas 重绘（平移 flywheel-svg 1829–1877：双环 + 4 弧 + 4 节点）
  drawFlywheel() {
    const query = wx.createSelectorQuery().in(this);
    query.select('#flywheel').fields({ node: true, size: true }).exec(res => {
      if (!res || !res[0] || !res[0].node) return;
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const w = res[0].width, h = res[0].height;
      const dpr = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).pixelRatio || 2;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.scale(dpr, dpr);

      const cx = w / 2, cy = h / 2;
      const R = Math.min(w, h) / 2 - 46;  // 外环半径（留标签位置）
      const INK = '#12100E', VERMILION = '#B8321A', PAPER = '#EDE8DB', DUST = '#8B8270';

      // 外环 + 内虚线环
      ctx.strokeStyle = 'rgba(18,16,14,.35)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([2, 6]);
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.74, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);

      // 4 段弧（朱砂色，带箭头）
      const nodeR = R * 0.19;
      ctx.strokeStyle = VERMILION;
      ctx.lineWidth = 2;
      const gap = Math.PI / 10; // 节点处留空
      for (let k = 0; k < 4; k++) {
        const a0 = -Math.PI / 2 + k * Math.PI / 2 + gap;
        const a1 = -Math.PI / 2 + (k + 1) * Math.PI / 2 - gap;
        ctx.beginPath(); ctx.arc(cx, cy, R, a0, a1); ctx.stroke();
        // 箭头（画在下一段起点处）
        const ax = cx + Math.cos(a1 + gap * 0.4) * R;
        const ay = cy + Math.sin(a1 + gap * 0.4) * R;
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(a1 + gap * 0.4 + Math.PI / 2);
        ctx.fillStyle = VERMILION;
        ctx.beginPath();
        ctx.moveTo(0, -6); ctx.lineTo(5, 4); ctx.lineTo(-5, 4);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }

      // 中心文字
      ctx.fillStyle = INK;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '600 17px serif';
      ctx.fillText('师承网络', cx, cy - 10);
      ctx.fillStyle = DUST;
      ctx.font = '9px monospace';
      ctx.fillText('DATA · TRUST · MATCH', cx, cy + 12);

      // 4 节点：厨师(上)/数据(右)/匹配(下)/回流(左)
      const nodes = [
        { zh: '厨师', en: 'SUPPLY', active: true },
        { zh: '数据', en: 'DATA', active: false },
        { zh: '匹配', en: 'MATCH', active: false },
        { zh: '回流', en: 'LOOP', active: false }
      ];
      const labels = ['① 厨师录入手艺与师承', '② 师承网络越来越密', '③ 雇主匹配精度提升', '④ 成功匹配反哺师承补全'];
      nodes.forEach((n, k) => {
        const a = -Math.PI / 2 + k * Math.PI / 2;
        const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
        ctx.beginPath(); ctx.arc(x, y, nodeR, 0, Math.PI * 2);
        ctx.fillStyle = n.active ? VERMILION : PAPER;
        ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.fillStyle = n.active ? PAPER : INK;
        ctx.font = '600 14px serif';
        ctx.fillText(n.zh, x, y - 5);
        ctx.font = '7px monospace';
        ctx.fillText(n.en, x, y + 10);
        // 节点外标签
        ctx.fillStyle = INK;
        ctx.font = '11px sans-serif';
        const ly = y + (k === 0 ? -nodeR - 12 : k === 2 ? nodeR + 16 : 4);
        const lx = k === 1 ? x + nodeR + 8 : k === 3 ? x - nodeR - 8 : x;
        ctx.textAlign = k === 1 ? 'left' : k === 3 ? 'right' : 'center';
        ctx.fillText(labels[k], lx, ly);
        ctx.textAlign = 'center';
      });
    });
  }
});
