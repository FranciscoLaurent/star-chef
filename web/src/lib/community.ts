// 社区：localStorage 持久化 + 预置种子内容

export interface Comment {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

export interface Post {
  id: string;
  title: string;
  body: string;
  author: string;
  role: string;
  cuisine: string;
  city: string;
  createdAt: string;
  likes: number;
  comments: Comment[];
  seed?: boolean;
}

const STORE_KEY = 'star-chef:posts:v1';
const LIKED_KEY = 'star-chef:liked:v1';

const now = Date.now();
const day = 86400000;

export const SEED_POSTS: Post[] = [
  {
    id: 'p01', title: '川菜师傅带徒，最看重哪一点？',
    body: '带了六个徒弟，最后能上灶的只有两个。我发现不是刀工问题，也不是记不住味型，而是"愿不愿意在下班后自己练"。\n\n手艺这东西，师傅只能给路径，练不练是自己的事。现在招学徒，我第一句就问：你能接受前三个月只做墩子吗？',
    author: '陈师傅', role: '川菜厨师长', cuisine: '川', city: '成都',
    createdAt: new Date(now - 1 * day).toISOString(), likes: 34, seed: true,
    comments: [
      { id: 'c01', author: '小李', body: '太真实了，我在墩子岗干了一年才摸到锅。', createdAt: new Date(now - day + 3600000).toISOString() },
    ],
  },
  {
    id: 'p02', title: '蓝光鉴一脉的"开水白菜"，到底难在哪',
    body: '很多人以为是汤的问题，其实是"清"的问题。扫汤要用鸡脯肉茸，分三次下，每次都要把浮沫撇干净。火大一点，汤就浑了，前面几小时全废。\n\n这也是为什么老师傅说：川菜不是只会麻辣，最高级的川菜是清汤。',
    author: '罗小川', role: '川菜研究者', cuisine: '川', city: '成都',
    createdAt: new Date(now - 2 * day).toISOString(), likes: 58, seed: true,
    comments: [],
  },
  {
    id: 'p03', title: '连锁中央厨房 vs 传统后厨，选哪个？',
    body: '28 岁，粤菜炒锅 6 年，现在有个连锁出品主管的 offer，薪资高 30%，但要写 SOP、管数据。\n\n有点怕离开灶台久了手艺会废。有过来人吗？',
    author: '阿豪', role: '粤菜炒锅', cuisine: '粤', city: '广州',
    createdAt: new Date(now - 3 * day).toISOString(), likes: 21, seed: true,
    comments: [
      { id: 'c02', author: '老周', body: '手艺不会废，但会变"标准化"。看你想要什么，想开店就值得去。', createdAt: new Date(now - 2 * day).toISOString() },
    ],
  },
  {
    id: 'p04', title: '淮扬菜的刀工，练多久才算入门',
    body: '文思豆腐切成细丝不断，我练了两年。师傅说：先切萝卜，切够一百斤再上豆腐。\n\n现在很多速成班三周就教文思豆腐，切出来是断的，端上桌就露馅。基本功骗不了人。',
    author: '扬州老张', role: '淮扬菜主厨', cuisine: '淮扬', city: '扬州',
    createdAt: new Date(now - 4 * day).toISOString(), likes: 41, seed: true,
    comments: [],
  },
  {
    id: 'p05', title: '拜师要送礼吗？行业里的规矩说说',
    body: '正式拜师一般是敬茶，不兴送钱。师傅收的是"人"，不是礼。\n\n但现在很多所谓"师承"是花钱挂名，这种在同行里一打听就知道。真正的手艺人，看的是你在他灶上干过多久。',
    author: '王建国', role: '鲁菜厨师长', cuisine: '鲁', city: '济南',
    createdAt: new Date(now - 5 * day).toISOString(), likes: 66, seed: true,
    comments: [],
  },
];

export function loadPosts(): Post[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return SEED_POSTS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed;
    return SEED_POSTS;
  } catch {
    return SEED_POSTS;
  }
}

export function savePosts(posts: Post[]) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(posts)); } catch { /* ignore */ }
}

export function loadLiked(): string[] {
  try { return JSON.parse(localStorage.getItem(LIKED_KEY) || '[]'); } catch { return []; }
}
export function saveLiked(ids: string[]) {
  try { localStorage.setItem(LIKED_KEY, JSON.stringify(ids)); } catch { /* ignore */ }
}

export function makeId(prefix = 'p') {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  return `${d} 天前`;
}
