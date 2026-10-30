// services/store.js — 本地存储封装（平移网页版 5 个 localStorage key → wx.Storage）
// 所有读写带 try/catch，存储损坏时安静降级为空值，绝不让页面崩

const KEYS = {
  API_KEY: 'xc_deepseek_key',        // 预留：将来接真实 DeepSeek 时用户自填 key
  POSTS: 'xc_community_posts',       // 用户发布的帖子
  LIKES: 'xc_community_likes',       // { postId: true }
  COMMENTS: 'xc_community_comments', // { postId: [{author, text}] }
  AI_SEEN: 'xc_ai_seen'              // 首次引导标记
};

function get(key, fallback) {
  try {
    const v = wx.getStorageSync(key);
    return (v === '' || v === undefined || v === null) ? fallback : v;
  } catch (e) { return fallback; }
}

function set(key, value) {
  try { wx.setStorageSync(key, value); } catch (e) { /* 存储满等异常静默 */ }
}

module.exports = {
  KEYS,
  // 社区帖子
  getUserPosts: () => get(KEYS.POSTS, []),
  addUserPost(post) {
    const list = get(KEYS.POSTS, []);
    list.unshift(post);
    set(KEYS.POSTS, list);
    return list;
  },
  // 点赞
  getLikes: () => get(KEYS.LIKES, {}),
  toggleLike(postId) {
    const likes = get(KEYS.LIKES, {});
    if (likes[postId]) delete likes[postId]; else likes[postId] = true;
    set(KEYS.LIKES, likes);
    return likes;
  },
  // 评论
  getComments: () => get(KEYS.COMMENTS, {}),
  addComment(postId, comment) {
    const all = get(KEYS.COMMENTS, {});
    if (!all[postId]) all[postId] = [];
    all[postId].push(comment);
    set(KEYS.COMMENTS, all);
    return all[postId];
  },
  // 引导标记
  hasSeenGuide: () => !!get(KEYS.AI_SEEN, false),
  markGuideSeen: () => set(KEYS.AI_SEEN, true)
};
