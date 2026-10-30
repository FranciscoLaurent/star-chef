// pages/community/community.js — 厨师社区
// 平移网页版 Community 模块（3566–3772）：分类 tabs / 双列瀑布流 / 点赞评论持久化 /
// 发帖弹层 + AI 整理回填。修复网页版发帖 author 'c01' 不存在的 bug（改用 'me'）
const MOCK = require('../../data/mock.js');
const { callAI, PROMPTS } = require('../../services/ai.js');
const store = require('../../services/store.js');
const { surnameOf } = require('../../utils/format.js');

const TYPE_NAMES = { recruit: '招徒', jobseek: '求职', skill: '切磋', help: '求助', news: '见闻', review: '点评' };
const TABS = [{ key: 'all', label: '全部' }].concat(
  Object.keys(TYPE_NAMES).map(k => ({ key: k, label: TYPE_NAMES[k] }))
);
const CUISINES = ['川', '粤', '鲁', '淮扬', '湘', '浙', '徽', '闽', '京', '沪'];

Page({
  data: {
    statusBarHeight: 20,
    tabs: TABS,
    activeType: 'all',
    columns: [[], []],        // 双列瀑布流
    // 详情
    detail: null, detailComments: [], commentText: '',
    // 发帖
    modalOpen: false,
    form: { type: 'skill', cuisine: '川', title: '', body: '', position: '', salary: '', city: '' },
    cuisineIndex: 0, cuisines: CUISINES,
    aiBusy: false
  },

  onLoad() {
    const app = getApp();
    this.chefById = {};
    MOCK.chefs.forEach(c => { this.chefById[c.id] = c; });
    this.setData({ statusBarHeight: app.globalData.statusBarHeight });
    this.render();
  },

  onShow() {
    const tab = this.getTabBar && this.getTabBar();
    if (tab) tab.setData({ selected: 4 });
    this.render(); // 从其他页返回时刷新点赞/新帖
  },

  // ============ 数据合成与渲染 ============
  getPosts() {
    const likes = store.getLikes();
    const comments = store.getComments();
    // 用户帖在前（平移 getPosts 3571–3574）
    return store.getUserPosts().concat(MOCK.posts).map(p => {
      const author = p.author === 'me'
        ? { name: '我', cuisine: p.cuisine }
        : this.chefById[p.author] || { name: '匿名厨师', cuisine: p.cuisine };
      const myComments = comments[p.id] || [];
      return {
        ...p,
        authorName: author.name,
        authorStamp: p.author === 'me' ? '我' : surnameOf(author.name),
        typeName: TYPE_NAMES[p.type] || '帖子',
        likeCount: p.likes + (likes[p.id] ? 1 : 0),
        liked: !!likes[p.id],
        commentCount: p.comments + myComments.length,
        isRecruitLike: p.type === 'recruit' || p.type === 'jobseek'
      };
    });
  },

  render() {
    const posts = this.data.activeType === 'all'
      ? this.getPosts()
      : this.getPosts().filter(p => p.type === this.data.activeType);
    // 双列分流（按序号交替，简单粗暴但稳定）
    const columns = [[], []];
    posts.forEach((p, i) => columns[i % 2].push(p));
    this.setData({ columns });
  },

  switchType(e) {
    this.setData({ activeType: e.currentTarget.dataset.type });
    this.render();
  },

  // ============ 点赞 ============
  toggleLike(e) {
    const id = e.currentTarget.dataset.id;
    store.toggleLike(id);
    this.render();
    // 详情开着的话同步
    if (this.data.detail && this.data.detail.id === id) this.openDetail({ currentTarget: { dataset: { id } } });
  },

  // ============ 详情与评论 ============
  openDetail(e) {
    const id = e.currentTarget.dataset.id;
    const post = this.getPosts().find(p => p.id === id);
    if (!post) return;
    const comments = store.getComments()[id] || [];
    this.setData({ detail: post, detailComments: comments, commentText: '' });
  },
  closeDetail() { this.setData({ detail: null }); },

  onCommentInput(e) { this.setData({ commentText: e.detail.value }); },
  addComment() {
    const text = (this.data.commentText || '').trim();
    if (!text || !this.data.detail) {
      if (!text) wx.showToast({ title: '先写点内容', icon: 'none' });
      return;
    }
    const list = store.addComment(this.data.detail.id, { author: '我', text });
    this.setData({ detailComments: list, commentText: '' });
    this.render();
    // 同步详情里的计数
    const post = this.getPosts().find(p => p.id === this.data.detail.id);
    if (post) this.setData({ detail: post });
  },

  // ============ 发帖 ============
  openModal() {
    this.setData({
      modalOpen: true,
      form: { type: 'skill', cuisine: '川', title: '', body: '', position: '', salary: '', city: '' },
      cuisineIndex: 0
    });
  },
  closeModal() {
    if (this.data.aiBusy) return;
    this.setData({ modalOpen: false });
  },

  pickType(e) {
    this.setData({ 'form.type': e.currentTarget.dataset.type });
  },
  pickCuisine(e) {
    const i = +e.detail.value;
    this.setData({ cuisineIndex: i, 'form.cuisine': CUISINES[i] });
  },
  onFormInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  // ✨ AI 整理（平移 aiOrganize 3739–3767：正文 → JSON → 回填表单）
  aiOrganize() {
    const body = (this.data.form.body || '').trim();
    if (!body) { wx.showToast({ title: '先写点正文，AI 才能整理', icon: 'none' }); return; }
    if (this.data.aiBusy) return;
    this.setData({ aiBusy: true });
    callAI(PROMPTS.postOrganize(body), {}).then(raw => {
      try {
        const jsonStr = raw.replace(/```json|```/g, '').trim();
        const match = jsonStr.match(/\{[\s\S]*\}/);
        const d = JSON.parse(match ? match[0] : jsonStr);
        const cuisine = CUISINES.includes(d.cuisine) ? d.cuisine : this.data.form.cuisine;
        this.setData({
          'form.type': TYPE_NAMES[d.type] ? d.type : this.data.form.type,
          'form.cuisine': cuisine,
          cuisineIndex: CUISINES.indexOf(cuisine),
          'form.title': d.title || this.data.form.title,
          'form.body': d.body || body,
          'form.position': d.position || '',
          'form.salary': d.salary || '',
          'form.city': d.city || ''
        });
        wx.showToast({ title: 'AI 已整理回填', icon: 'none' });
      } catch (e) {
        wx.showToast({ title: '整理失败，请手动完善', icon: 'none' });
      }
    }).finally(() => this.setData({ aiBusy: false }));
  },

  publish() {
    const f = this.data.form;
    if (!f.title.trim() || !f.body.trim()) {
      wx.showToast({ title: '标题和正文不能为空', icon: 'none' });
      return;
    }
    const post = {
      id: 'u' + Date.now(),
      author: 'me',                    // 修复：网页版写的是不存在的 'c01'
      type: f.type,
      cuisine: f.cuisine,
      title: f.title.trim(),
      body: f.body.trim(),
      likes: 0, comments: 0, time: '刚刚'
    };
    if (f.type === 'recruit' || f.type === 'jobseek') {
      if (f.position.trim()) post.position = f.position.trim();
      if (f.salary.trim()) post.salary = f.salary.trim();
      if (f.city.trim()) post.city = f.city.trim();
    }
    store.addUserPost(post);
    this.setData({ modalOpen: false, activeType: 'all' });
    this.render();
    wx.showToast({ title: '发布成功', icon: 'none' });
  }
});
