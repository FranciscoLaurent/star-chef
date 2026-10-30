// 星厨传承 小程序入口
// 全局只做两件事：记录系统信息（自定义导航用）、尝试加载 Fraunces 字体（失败静默降级系统衬线）
App({
  globalData: {
    statusBarHeight: 20,   // 兜底值，onLaunch 里实测覆盖
    navBarHeight: 44,
    fontLoaded: false
  },

  onLaunch() {
    // 系统信息：自定义 navigationStyle 下各页需要自己留状态栏高度
    try {
      const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      this.globalData.statusBarHeight = win.statusBarHeight || 20;
    } catch (e) { /* 保留兜底值 */ }

    // Fraunces 用于英文/数字大标题；游客模式不校验域名可直接加载，失败则整站走系统衬线
    try {
      wx.loadFontFace({
        family: 'Fraunces',
        source: 'url("https://fonts.gstatic.com/s/fraunces/v31/6NU78FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0ixzyTaXkDZBccON1TmfW6YjHFP7_Q.woff2")',
        global: true,
        success: () => { this.globalData.fontLoaded = true; },
        fail: () => { /* 降级：WXSS 中 var(--serif) 已带 serif 兜底 */ }
      });
    } catch (e) { /* 低版本基础库无 loadFontFace，忽略 */ }
  }
});
