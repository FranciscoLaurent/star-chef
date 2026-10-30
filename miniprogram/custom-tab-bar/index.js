// 自定义 tabBar 逻辑：selected 由各页 onShow 里同步
Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/home/home',      text: '首页',   num: '00' },
      { pagePath: '/pages/lineage/lineage', text: '师承谱', num: '01' },
      { pagePath: '/pages/jobs/jobs',       text: '招聘',   num: '02' },
      { pagePath: '/pages/assistant/assistant', text: 'AI助手', num: '03' },
      { pagePath: '/pages/community/community', text: '社区', num: '04' }
    ]
  },
  methods: {
    switchTab(e) {
      const { path, index } = e.currentTarget.dataset;
      if (index === this.data.selected) return;
      wx.switchTab({ url: path });
    }
  }
});
