// pages/assistant/assistant.js — AI 求职助手
// 平移网页版 Assistant 模块（3394–3561）：示例 / 一键演示 / 流式生成 / 档案卡 / 完整度提示
// 变更：砍掉语音输入（Web Speech API 不可用，同声传译插件需 AppID，游客模式跑不了）；
// contenteditable → input/textarea 双向绑定
const { callAI, PROMPTS } = require('../../services/ai.js');

const EXAMPLES = {
  chuan: '我叫张德海，今年 42，川菜师傅，从 18 岁跟着成都锦江春的陈师傅学炒锅，干了 24 年，会 80 多道川菜，拿过四川省烹饪大赛金奖，现在想找成都或重庆的酒店炒锅或厨师长位置，工资期望 18-25K。',
  yue: '我叫梁润根，38 岁，粤菜师傅，广州人，15 岁入行跟香港师傅学粤菜，会做白切鸡、烧鹅、各式点心，在深圳干了 10 年，想回广州找个厨师长岗位，薪资 20-30K。',
  huai: '我叫周慕白，55 岁，淮扬菜老师傅，扬州人，30 年淮扬功夫，刀工见长，文思豆腐、大煮干丝是拿手绝活，带过 20 多个徒弟，现在想找个高级酒店的淮扬菜顾问或行政总厨岗位，地域不限，薪资 30K 以上。'
};

Page({
  data: {
    statusBarHeight: 20,
    text: '',
    examples: [
      { key: 'chuan', label: '川菜示例' },
      { key: 'yue', label: '粤菜示例' },
      { key: 'huai', label: '淮扬示例' }
    ],
    generating: false,
    demoRunning: false,
    demoLabel: '30 秒一键演示',
    rawOut: '',            // 流式原始输出
    card: null,            // 解析后的档案 {name, age, cuisine, city, master, years, signature[], awards[], intent{}, bio, completeness, missing[]}
    parseError: ''
  },

  onLoad() {
    const app = getApp();
    this.setData({ statusBarHeight: app.globalData.statusBarHeight });
  },

  onShow() {
    const tab = this.getTabBar && this.getTabBar();
    if (tab) tab.setData({ selected: 3 });
  },

  onTextInput(e) { this.setData({ text: e.detail.value }); },

  // 示例填充
  fillExample(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ text: EXAMPLES[key] || '' });
  },

  // ============ 30 秒一键演示（平移 3408–3435：逐字填充 + 自动生成）============
  async quickDemo() {
    if (this.data.demoRunning || this.data.generating) return;
    this.setData({ demoRunning: true, demoLabel: '正在演示…', card: null, rawOut: '' });
    const keys = Object.keys(EXAMPLES);
    const txt = EXAMPLES[keys[Math.floor(Math.random() * keys.length)]];
    this.setData({ text: '' });
    for (let i = 0; i < txt.length; i++) {
      this.setData({ text: this.data.text + txt[i] });
      await new Promise(r => setTimeout(r, 14));
    }
    await new Promise(r => setTimeout(r, 350));
    this.setData({ demoLabel: 'AI 生成中…' });
    await this.generate();
    this.setData({ demoRunning: false, demoLabel: '30 秒一键演示' });
  },

  // ============ 生成档案 ============
  async generate() {
    const text = (this.data.text || '').trim();
    if (!text) {
      wx.showToast({ title: '请先描述您的经历', icon: 'none' });
      return;
    }
    if (this.data.generating) return;
    this.setData({ generating: true, rawOut: '', card: null, parseError: '' });
    try {
      const raw = await callAI(PROMPTS.profileGen(text), {
        onToken: (delta, full) => this.setData({ rawOut: full })
      });
      // 解析 JSON（容错：去 ```json 标记，正则提取 {...}）—— 平移 3471–3474
      const jsonStr = raw.replace(/```json|```/g, '').trim();
      const match = jsonStr.match(/\{[\s\S]*\}/);
      const card = JSON.parse(match ? match[0] : jsonStr);
      card.signature = Array.isArray(card.signature) ? card.signature : [];
      card.awards = Array.isArray(card.awards) ? card.awards : [];
      card.missing = Array.isArray(card.missing) ? card.missing : [];
      card.intent = card.intent || {};
      if (typeof card.completeness !== 'number') card.completeness = 100;
      this.setData({ card, rawOut: '' });
    } catch (e) {
      this.setData({ parseError: '生成结果解析失败，请重试（' + e.message + '）' });
    } finally {
      this.setData({ generating: false });
    }
  },

  // ============ 档案卡编辑（双向绑定）============
  onCardInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`card.${field}`]: e.detail.value });
  },

  // 补充缺失信息：把提示追加回输入框（平移 fillMissing 3517–3527）
  fillMissing() {
    const missing = (this.data.card && this.data.card.missing) || [];
    const prompt = missing.length ? `\n\n（请补充：${missing.join('、')}）` : '\n\n（请补充更详细的经历）';
    this.setData({ text: (this.data.text || '').trim() + prompt, card: null });
    wx.showToast({ title: '请补充后重新生成', icon: 'none' });
  },

  // 发布 / 保存（演示）
  publish() { wx.showToast({ title: '已发布到招聘广场（演示）', icon: 'none' }); },
  saveCard() { wx.showToast({ title: '已保存档案（演示）', icon: 'none' }); }
});
