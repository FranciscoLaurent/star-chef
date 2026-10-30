// pages/jobs/jobs.js — 智能招聘匹配（双向）
// 平移网页版 Jobs 模块（3130–3389），并修 3 处遗留问题：
//  1. 薪资区间上限正则只取下限 → 改用 parseSalaryRange 正确取上下限
//  2. 厨师视角基准硬编码 DATA.chefs[0] → 身份选择器（可切换任意厨师）
//  3. 匹配拆解算法集中在此文件，权重：菜系40 + 地域20 + 师门25 + 薪资15
const MOCK = require('../../data/mock.js');
const { callAI, PROMPTS } = require('../../services/ai.js');
const { parseSalaryRange, surnameOf } = require('../../utils/format.js');

const FAMILY_NAMES = {
  zhang: '张派', liang: '梁派', kong: '孔派', zhou: '周派', mao: '毛派',
  song: '宋派', hu: '胡派', lin: '林派', wang: '王派', shen: '沈派'
};
const TYPE_NAMES = { hotel: '酒店', restaurant: '社会餐饮', private: '私厨', school: '院校', partner: '合伙人' };

// ---- 匹配算法（修复版）----
function matchDims(c, j) {
  const dims = [];
  // 菜系 40
  const cuisineHit = c.cuisine === j.cuisine;
  dims.push({
    key: '菜系', en: 'CUISINE', max: 40, score: cuisineHit ? 40 : 0,
    reason: cuisineHit ? `同属${c.cuisine}菜，技艺体系完全对口` : `厨师擅${c.cuisine}菜，岗位要求${j.cuisine}菜`
  });
  // 地域 20
  let regionScore = 0, regionReason = '城市不同，需考虑迁移成本';
  if (c.city === j.city) { regionScore = 20; regionReason = `同在${c.city}，零迁移成本`; }
  else if (c.city && j.city && c.city[0] === j.city[0]) { regionScore = 10; regionReason = `${c.city}与${j.city}相近，迁移成本低`; }
  dims.push({ key: '地域', en: 'REGION', max: 20, score: regionScore, reason: regionReason });
  // 师门 25
  let lineageScore = 12, lineageReason = '岗位未限定师门，按中位计'; // 网页版规则：无偏好给中位分
  if (j.lineagePref) {
    if (c.lineage === j.lineagePref) { lineageScore = 25; lineageReason = `${FAMILY_NAMES[c.lineage]}师承，正中岗位偏好`; }
    else { lineageScore = 0; lineageReason = `岗位偏好${FAMILY_NAMES[j.lineagePref]}，厨师为${FAMILY_NAMES[c.lineage] || '无派系'}`; }
  }
  dims.push({ key: '师门', en: 'LINEAGE', max: 25, score: lineageScore, reason: lineageReason });
  // 薪资 15（修复：正确解析上下限）
  const cs = parseSalaryRange(c.salaryRange), js = parseSalaryRange(j.salary);
  let salaryScore = 0, salaryReason = '薪资信息不足';
  if (cs && js) {
    if (cs.min <= js.max && js.min <= cs.max) { salaryScore = 15; salaryReason = `期望 ${c.salaryRange} 与岗位 ${j.salary} 存在交集`; }
    else if (Math.abs(cs.min - js.min) < 5) { salaryScore = 8; salaryReason = '薪资接近，有协商空间'; }
    else salaryReason = `期望 ${c.salaryRange} 与岗位 ${j.salary} 差距较大`;
  }
  dims.push({ key: '薪资', en: 'SALARY', max: 15, score: salaryScore, reason: salaryReason });
  return dims;
}
const matchScore = (c, j) => matchDims(c, j).reduce((s, d) => s + d.score, 0);
const verdictOf = s => s >= 85 ? '高度契合' : s >= 70 ? '推荐尝试' : s >= 50 ? '可以考察' : '仅供参考';

Page({
  data: {
    statusBarHeight: 20,
    role: 'chef',            // chef 厨师找岗 / employer 餐厅找人
    // 身份（厨师视角）与目标岗位（雇主视角）
    me: null, meId: 'c001',
    targetJob: null, targetJobId: 'j01',
    // 筛选
    cuisines: [], activeCuisines: [],
    cities: [], activeCity: '',
    // 列表
    list: [], listNote: '',
    // 详情
    detail: null, detailDims: [], detailScore: 0, detailVerdict: '', recs: [],
    aiText: '', aiBusy: false,
    // 选择器弹层
    pickerOpen: false, pickerType: '', pickerQuery: '', pickerList: []
  },

  onLoad() {
    const app = getApp();
    this.chefById = {};
    MOCK.chefs.forEach(c => { this.chefById[c.id] = c; });
    this.jobById = {};
    MOCK.jobs.forEach(j => { this.jobById[j.id] = j; });

    const cuisines = [...new Set(MOCK.jobs.map(j => j.cuisine))];
    const cities = [...new Set(MOCK.jobs.map(j => j.city))];
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight,
      cuisines, cities,
      me: this.chefById.c001,
      targetJob: this.jobById.j01
    });
    this.renderList();
  },

  onShow() {
    const tab = this.getTabBar && this.getTabBar();
    if (tab) tab.setData({ selected: 2 });
  },

  // ============ 角色切换 ============
  switchRole(e) {
    const role = e.currentTarget.dataset.role;
    if (role === this.data.role) return;
    this.setData({ role, detail: null, activeCuisines: [], activeCity: '' });
    this.renderList();
  },

  // ============ 筛选 ============
  toggleCuisine(e) {
    const cu = e.currentTarget.dataset.cu;
    const set = new Set(this.data.activeCuisines);
    if (set.has(cu)) set.delete(cu); else set.add(cu);
    this.setData({ activeCuisines: [...set] });
    this.renderList();
  },
  toggleCity(e) {
    const city = e.currentTarget.dataset.city;
    this.setData({ activeCity: this.data.activeCity === city ? '' : city });
    this.renderList();
  },

  // ============ 列表渲染 ============
  renderList() {
    const { role, activeCuisines, activeCity, me, targetJob } = this.data;
    let items, note;
    if (role === 'chef') {
      items = MOCK.jobs.map(j => ({ kind: 'job', obj: j, score: matchScore(me, j) }));
      note = `以「${me.name}」的档案为基准匹配`;
    } else {
      items = MOCK.chefs
        .filter(c => c.position !== '学徒') // 平移网页版规则：雇主视角不推学徒
        .map(c => ({ kind: 'chef', obj: c, score: matchScore(c, targetJob) }));
      note = `为「${targetJob.employer} · ${targetJob.position}」推荐人选`;
    }
    if (activeCuisines.length) {
      const set = new Set(activeCuisines);
      items = items.filter(it => it.obj.cuisine && set.has(it.obj.cuisine));
    }
    if (activeCity) items = items.filter(it => it.obj.city === activeCity);
    items.sort((a, b) => b.score - a.score);

    const list = items.map(it => {
      const o = it.obj;
      return it.kind === 'job' ? {
        key: o.id, kind: 'job', id: o.id, score: it.score, verdict: verdictOf(it.score),
        title: `${o.employer} · ${o.position}`,
        sub: `${o.city} · ${o.cuisine}菜 · ${TYPE_NAMES[o.type] || o.type}`,
        salary: o.salary,
        pref: o.lineagePref ? `偏好${FAMILY_NAMES[o.lineagePref]}` : ''
      } : {
        key: o.id, kind: 'chef', id: o.id, score: it.score, verdict: verdictOf(it.score),
        stamp: surnameOf(o.name),
        title: `${o.name} · ${o.position}`,
        sub: `${o.city} · ${o.cuisine}菜 · ${o.years}年 · ${FAMILY_NAMES[o.lineage] || ''}`,
        salary: o.salaryRange,
        pref: o.verified ? '已认证' : ''
      };
    });
    this.setData({ list, listNote: note });
  },

  // ============ 详情 ============
  openDetail(e) {
    const { kind, id } = e.currentTarget.dataset;
    const { me, targetJob } = this.data;
    let chef, job;
    if (kind === 'job') { job = this.jobById[id]; chef = me; }
    else { chef = this.chefById[id]; job = targetJob; }

    const dims = matchDims(chef, job);
    const score = dims.reduce((s, d) => s + d.score, 0);
    // 对侧 Top3 推荐（平移网页版 recs：同菜系、非学徒、取前 3）
    let recs;
    if (kind === 'job') {
      recs = MOCK.chefs
        .filter(c => c.cuisine === job.cuisine && c.position !== '学徒')
        .map(c => ({ id: c.id, name: c.name, sub: `${c.position} · ${c.city}`, score: matchScore(c, job) }))
        .sort((a, b) => b.score - a.score).slice(0, 3);
    } else {
      recs = MOCK.jobs
        .filter(j => j.cuisine === chef.cuisine)
        .map(j => ({ id: j.id, name: `${j.employer} · ${j.position}`, sub: `${j.city} · ${j.salary}`, score: matchScore(chef, j) }))
        .sort((a, b) => b.score - a.score).slice(0, 3);
    }

    this.setData({
      detail: {
        kind, chef, job,
        chefStamp: surnameOf(chef.name),
        chefFamily: FAMILY_NAMES[chef.lineage] || '无派系',
        jobType: TYPE_NAMES[job.type] || job.type,
        jobPref: job.lineagePref ? FAMILY_NAMES[job.lineagePref] : ''
      },
      detailDims: dims.map(d => ({ ...d, pct: Math.round(d.score / d.max * 100) })),
      detailScore: score,
      detailVerdict: verdictOf(score),
      recs,
      aiText: '', aiBusy: false
    });
    // 拆解条动画：先 0 后真实值（靠 WXSS transition）
    setTimeout(() => {
      this.setData({ detailDims: this.data.detailDims.map(d => ({ ...d, shown: d.pct })) });
    }, 60);
  },

  closeDetail() {
    if (this.data.aiBusy) return;
    this.setData({ detail: null });
  },

  // AI 解释推荐理由（mock 流式）
  aiExplain() {
    if (this.data.aiBusy || !this.data.detail) return;
    const { chef, job } = this.data.detail;
    this.setData({ aiBusy: true, aiText: '' });
    callAI(PROMPTS.matchExplain(chef, job, this.data.detailScore), {
      onToken: (delta, full) => this.setData({ aiText: full })
    }).then(() => this.setData({ aiBusy: false }));
  },

  // 投递 / 联系（演示）
  applyNow() {
    wx.showToast({ title: this.data.role === 'chef' ? '已投递（演示）' : '已发送邀约（演示）', icon: 'none' });
  },

  // ============ 身份 / 岗位选择器 ============
  openPicker(e) {
    const type = e.currentTarget.dataset.type; // me | job
    this.setData({ pickerOpen: true, pickerType: type, pickerQuery: '' });
    this.renderPicker('');
  },
  closePicker() { this.setData({ pickerOpen: false }); },
  onPickerInput(e) { this.renderPicker((e.detail.value || '').trim()); },

  renderPicker(q) {
    let list;
    if (this.data.pickerType === 'me') {
      list = MOCK.chefs
        .filter(c => !q || c.name.includes(q) || c.position.includes(q))
        .map(c => ({ id: c.id, title: `${c.name} · ${c.position}`, sub: `${c.city} · ${c.cuisine}菜 · ${FAMILY_NAMES[c.lineage] || ''}` }));
    } else {
      list = MOCK.jobs
        .filter(j => !q || j.employer.includes(q) || j.position.includes(q))
        .map(j => ({ id: j.id, title: `${j.employer} · ${j.position}`, sub: `${j.city} · ${j.cuisine}菜 · ${j.salary}` }));
    }
    this.setData({ pickerList: list.slice(0, 60), pickerQuery: q });
  },

  pickItem(e) {
    const id = e.currentTarget.dataset.id;
    if (this.data.pickerType === 'me') {
      this.setData({ meId: id, me: this.chefById[id], pickerOpen: false, detail: null });
    } else {
      this.setData({ targetJobId: id, targetJob: this.jobById[id], pickerOpen: false, detail: null });
    }
    this.renderList();
  }
});
