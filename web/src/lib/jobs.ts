// 招聘匹配：算法迁自 miniprogram/utils/match.js + 原站 matchChefJob，字段对齐 web 真实数据
// 说明：岗位为演示数据；"期望薪资"由代际推算，仅用于演示匹配度计算

import type { Chef } from './types';

export type JobLevel = '学徒' | '炒锅' | '主管' | '厨师长' | '行政总厨';
export type EmployerType = '酒店' | '社会餐饮' | '私厨' | '院校' | '合伙人';

export interface Job {
  id: string;
  title: string;
  restaurant: string;
  city: string;
  cuisine: string;
  salary: string;
  level: JobLevel;
  employerType: EmployerType;
  schoolPref?: string; // 对应 data.schools.key
  tags: string[];
  desc: string;
  requirements: string[];
  postedAt: string;
  verified: boolean;
}

export const JOBS: Job[] = [
  {
    id: 'j01', title: '川菜厨师长', restaurant: '成都 · 松云泽', city: '成都', cuisine: '川', salary: '18-25K', level: '厨师长',
    employerType: '社会餐饮', schoolPref: 'rongpai', tags: ['包吃住', '五险一金', '年终奖'],
    desc: '负责后厨出品把控与团队管理，要求熟悉传统川菜二十四味型，有师承背景者优先，能带 8-12 人后厨团队。',
    requirements: ['8 年以上川菜灶台经验', '熟悉二十四味型与筵席菜', '有 5 人以上团队管理经历', '能接受晚市与周末排班'],
    postedAt: '2 天前', verified: true,
  },
  {
    id: 'j02', title: '粤菜炒锅', restaurant: '广州 · 炳胜', city: '广州', cuisine: '粤', salary: '10-15K', level: '炒锅',
    employerType: '社会餐饮', schoolPref: 'guangfu', tags: ['月休 6 天', '包住'],
    desc: '需 3 年以上粤菜镬气功底，熟悉小炒与蒸品，能配合砧板与打荷完成出品。',
    requirements: ['3 年以上粤菜炒锅经验', '掌握镬气小炒与蒸品', '熟悉砧板—打荷协作流程'],
    postedAt: '3 天前', verified: true,
  },
  {
    id: 'j03', title: '淮扬菜主厨', restaurant: '扬州 · 趣园茶社', city: '扬州', cuisine: '淮扬', salary: '15-22K', level: '厨师长',
    employerType: '社会餐饮', schoolPref: 'huaiyang', tags: ['双休', '包吃住', '技能补贴'],
    desc: '刀工扎实，熟悉文思豆腐、狮子头等经典淮扬菜，负责冷菜与热菜出品标准制定。',
    requirements: ['10 年以上淮扬菜经验', '刀工见长，能做文思豆腐', '有出品标准制定经验'],
    postedAt: '1 天前', verified: true,
  },
  {
    id: 'j04', title: '湘菜炒锅', restaurant: '长沙 · 费大厨', city: '长沙', cuisine: '湘', salary: '8-12K', level: '炒锅',
    employerType: '社会餐饮', schoolPref: 'xiangjiang', tags: ['包吃住', '绩效'],
    desc: '熟悉湘菜小炒与腊味处理，出餐速度快，能适应连锁门店标准化流程。',
    requirements: ['3 年以上湘菜小炒经验', '熟悉腊味与剁椒类菜品', '能适应标准化出餐节奏'],
    postedAt: '5 天前', verified: false,
  },
  {
    id: 'j05', title: '鲁菜砧板主管', restaurant: '济南 · 聚丰德', city: '济南', cuisine: '鲁', salary: '9-13K', level: '主管',
    employerType: '社会餐饮', schoolPref: 'jinan', tags: ['包吃', '节日福利'],
    desc: '负责原料验收、切配与成本控制，熟悉鲁菜吊汤与干货发制。',
    requirements: ['5 年以上砧板经验', '熟悉鲁菜吊汤与干货发制', '具备成本控制意识'],
    postedAt: '1 周前', verified: true,
  },
  {
    id: 'j06', title: '融合菜行政总厨', restaurant: '上海 · 外滩源', city: '上海', cuisine: '沪', salary: '25-35K', level: '行政总厨',
    employerType: '酒店', tags: ['五险一金', '房补', '股权激励'],
    desc: '负责整店菜单研发与供应链管理，需具备高端餐饮经验与团队搭建能力。',
    requirements: ['12 年以上高端餐饮经验', '有整店菜单研发案例', '具备供应链与团队搭建能力'],
    postedAt: '今天', verified: true,
  },
  {
    id: 'j07', title: '京菜面点师', restaurant: '北京 · 四世同堂', city: '北京', cuisine: '京', salary: '9-14K', level: '主管',
    employerType: '社会餐饮', schoolPref: 'jing', tags: ['包吃住', '月休 4 天'],
    desc: '精通京式面点与宫廷点心，能独立完成宴会点心台。',
    requirements: ['精通京式面点', '能独立完成宴会点心台', '有节令点心研发经验'],
    postedAt: '4 天前', verified: false,
  },
  {
    id: 'j08', title: '川菜学徒', restaurant: '成都 · 马旺子', city: '成都', cuisine: '川', salary: '4-6K', level: '学徒',
    employerType: '社会餐饮', schoolPref: 'rongpai', tags: ['带薪培训', '包吃住'],
    desc: '零基础可，愿意长期学习川菜基本功，师傅带教，从墩子与打荷做起。',
    requirements: ['能吃苦，愿意长期学艺', '服从师傅带教安排', '身体健康，能适应站灶'],
    postedAt: '今天', verified: true,
  },
  {
    id: 'j09', title: '粤菜烧腊主管', restaurant: '深圳 · 陶陶居', city: '深圳', cuisine: '粤', salary: '14-18K', level: '主管',
    employerType: '社会餐饮', schoolPref: 'guangfu', tags: ['包住', '年终双薪'],
    desc: '负责烧腊档口出品，熟悉叉烧、烧鹅全流程，能控损耗。',
    requirements: ['6 年以上烧腊经验', '熟悉叉烧、烧鹅全流程', '能控损耗与排产'],
    postedAt: '6 天前', verified: true,
  },
  {
    id: 'j10', title: '私房菜主厨', restaurant: '杭州 · 湖畔私宴', city: '杭州', cuisine: '浙', salary: '16-24K', level: '厨师长',
    employerType: '私厨', schoolPref: 'zhejiang', tags: ['弹性排班', '包吃'],
    desc: '小而精的私宴场景，需独立设计时令菜单，重视食材本味。',
    requirements: ['能独立设计时令菜单', '重视食材本味与呈现', '有私宴或会所经验'],
    postedAt: '2 天前', verified: false,
  },
  {
    id: 'j11', title: '中央厨房出品主管', restaurant: '苏州 · 连锁供应链', city: '苏州', cuisine: '苏', salary: '12-16K', level: '主管',
    employerType: '院校', tags: ['双休', '五险一金'],
    desc: '负责标准化菜品研发与 SOP 落地，具备连锁餐饮出品管理经验。',
    requirements: ['5 年以上连锁餐饮经验', '有 SOP 编写与落地经验', '熟悉中央厨房排产'],
    postedAt: '3 天前', verified: true,
  },
  {
    id: 'j12', title: '闽菜厨师长', restaurant: '厦门 · 临家', city: '厦门', cuisine: '闽', salary: '15-20K', level: '厨师长',
    employerType: '酒店', schoolPref: 'min', tags: ['包吃住', '带薪年假'],
    desc: '熟悉闽南菜与海鲜处理，负责后厨人效与毛利管理。',
    requirements: ['8 年以上闽菜经验', '熟悉海鲜处理', '有毛利与人效管理经验'],
    postedAt: '1 周前', verified: true,
  },
];

export const JOB_CITIES = [...new Set(JOBS.map(j => j.city))];
export const JOB_CUISINES = [...new Set(JOBS.map(j => j.cuisine))];

/** 解析 "8-12K" → {min, max} */
export function parseSalary(s: string | undefined | null): { min: number; max: number } {
  if (!s) return { min: 0, max: 0 };
  const nums = s.match(/(\d+(?:\.\d+)?)/g);
  if (!nums) return { min: 0, max: 0 };
  const min = Number(nums[0]);
  const max = nums.length > 1 ? Number(nums[1]) : min;
  return { min, max };
}

/** 由代际推算厨师期望薪资（演示用） */
export function expectedSalary(chef: Chef): { min: number; max: number } {
  const g = chef.gen ?? -1;
  if (g === 0) return { min: 20, max: 32 };
  if (g === 1) return { min: 14, max: 22 };
  if (g === 2) return { min: 10, max: 16 };
  if (g >= 3) return { min: 8, max: 14 };
  return { min: 10, max: 18 };
}

export interface MatchDim {
  key: string; en: string; max: number; score: number; reason: string;
}

export interface MatchResult {
  total: number;
  dims: MatchDim[];
  verdict: string;
}

/** 匹配度：菜系 40 + 师门 25 + 地域 20 + 薪资 15 = 100 */
export function matchBreakdown(chef: Chef, job: Job): MatchResult {
  const dims: MatchDim[] = [];

  // 菜系 40
  const cuisineHit = chef.cuisine && chef.cuisine === job.cuisine;
  dims.push({
    key: '菜系', en: 'CUISINE', max: 40,
    score: cuisineHit ? 40 : 0,
    reason: cuisineHit ? `同为${chef.cuisine}菜` : `${chef.cuisine || '未标注'}菜 vs ${job.cuisine}菜（不同）`,
  });

  // 师门 25
  let schoolScore = 12, schoolReason = '岗位无师门偏好 · 给中位数';
  if (job.schoolPref) {
    if (chef.school === job.schoolPref) {
      schoolScore = 25;
      schoolReason = '命中岗位师门偏好';
    } else {
      schoolScore = 0;
      schoolReason = '岗位有特定师门偏好，未命中';
    }
  }
  dims.push({ key: '师门', en: 'LINEAGE', max: 25, score: schoolScore, reason: schoolReason });

  // 地域 20
  let cityScore = 0, cityReason = `${chef.city || '未标注'} ↔ ${job.city}`;
  if (chef.city === job.city) { cityScore = 20; cityReason = `同城 ${job.city}`; }
  else if (chef.city && (chef.city.startsWith(job.city.slice(0, 1)) || job.city.startsWith(chef.city.slice(0, 1)))) {
    cityScore = 10; cityReason = `邻近城市 ${chef.city}/${job.city}`;
  }
  dims.push({ key: '地域', en: 'CITY', max: 20, score: cityScore, reason: cityReason });

  // 薪资 15
  const e = expectedSalary(chef);
  const j = parseSalary(job.salary);
  let salaryScore = 0, salaryReason = `期望 ${e.min}-${e.max}K vs 岗位 ${job.salary}`;
  if (j.min && e.min <= j.max && e.max >= j.min) { salaryScore = 15; salaryReason = '薪资区间重叠'; }
  else if (j.min && Math.abs(e.min - j.min) < 5) { salaryScore = 8; salaryReason = '接近（差 < 5K）'; }
  else if (j.min) { salaryReason = '区间差距较大'; }
  dims.push({ key: '薪资', en: 'SALARY', max: 15, score: salaryScore, reason: salaryReason });

  const total = Math.min(100, dims.reduce((s, d) => s + d.score, 0));
  const verdict = total >= 85 ? '高度契合' : total >= 70 ? '推荐尝试' : total >= 50 ? '可考察' : '匹配一般';
  return { total, dims, verdict };
}

/** 最强的匹配维度（用于"核心契合点"）：先比绝对分，再比得分率 */
export function topDim(m: MatchResult): MatchDim {
  return [...m.dims].sort((a, b) => (b.score - a.score) || ((b.score / b.max) - (a.score / a.max)))[0];
}

/** 反向：为某岗位推荐最匹配的厨师 */
export function topChefsForJob(job: Job, chefs: Chef[], limit = 5): { chef: Chef; total: number }[] {
  return chefs
    .filter(c => !c.derived)
    .map(chef => ({ chef, total: matchBreakdown(chef, job).total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

/** 正向：为某厨师推荐最匹配的岗位 */
export function topJobsForChef(chef: Chef, limit = 4): { job: Job; total: number }[] {
  return JOBS
    .map(job => ({ job, total: matchBreakdown(chef, job).total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

/* ============================================================
 * 库外自由档案：用户随手填写即可匹配，不要求存在于厨师库
 * ============================================================ */

export interface FreeForm {
  name: string;      // 可空 → 匿名
  cuisine: string;   // '' = 未填
  years: string;     // '1-3' | '3-5' | '6-10' | '10+' | ''
  signature: string; // 擅长菜，可空（仅用于展示与 AI 文本）
  target: string;    // 目标岗位：学徒/炒锅/主管/厨师长/行政总厨/''
  city: string;      // 期望城市
}

export const EMPTY_FORM: FreeForm = { name: '', cuisine: '', years: '', signature: '', target: '', city: '' };

export const YEAR_OPTIONS = ['1-3', '3-5', '6-10', '10+'] as const;
export const TARGET_OPTIONS = ['学徒', '炒锅', '主管', '厨师长', '行政总厨'] as const;
export const CUISINE_OPTIONS = [...new Set([...JOB_CUISINES, '徽', '东北', '清真', '素食'])];

/** 年限档位 → 代表年数（演示估算） */
export function yearsNumber(y: string): number | null {
  switch (y) {
    case '1-3': return 2;
    case '3-5': return 4;
    case '6-10': return 8;
    case '10+': return 12;
    default: return null;
  }
}

export function yearsLabel(y: string): string {
  return y === '10+' ? '10 年以上' : y ? `${y} 年` : '';
}

/** 由从业年限估算期望薪资（演示用，库外档案无代际可推） */
export function freeExpectedSalary(yearsNum: number | null): { min: number; max: number } | null {
  if (yearsNum === null) return null;
  if (yearsNum <= 2) return { min: 4, max: 8 };
  if (yearsNum <= 5) return { min: 7, max: 13 };
  if (yearsNum <= 10) return { min: 12, max: 20 };
  return { min: 18, max: 30 };
}

export interface FreeMatch extends MatchResult {
  /** 未填写而按 0 分计的可填维度（师门不算——自由档案天然没有） */
  missing: string[];
}

/** 自由档案 × 岗位：与 matchBreakdown 同一套 100 分口径，缺项记 0 并列出 */
export function matchFreeProfile(form: FreeForm, job: Job): FreeMatch {
  const dims: MatchDim[] = [];
  const missing: string[] = [];

  // 菜系 40
  if (form.cuisine) {
    const hit = form.cuisine === job.cuisine;
    dims.push({
      key: '菜系', en: 'CUISINE', max: 40,
      score: hit ? 40 : 0,
      reason: hit ? `同为${form.cuisine}菜` : `${form.cuisine}菜 vs ${job.cuisine}菜（不同）`,
    });
  } else {
    missing.push('菜系');
    dims.push({ key: '菜系', en: 'CUISINE', max: 40, score: 0, reason: '未填写菜系，记 0 分' });
  }

  // 师门 25：自由档案无师承信息——岗位无偏好给中位数，有偏好则如实说明
  let schoolScore = 12, schoolReason = '岗位无师门偏好 · 给中位数';
  if (job.schoolPref) {
    schoolScore = 0;
    schoolReason = '岗位有师门偏好，自由档案未提供师承 · 记 0 分';
  }
  dims.push({ key: '师门', en: 'LINEAGE', max: 25, score: schoolScore, reason: schoolReason });

  // 地域 20
  if (form.city) {
    let cityScore = 0, cityReason = `${form.city} ↔ ${job.city}`;
    if (form.city === job.city) { cityScore = 20; cityReason = `同城 ${job.city}`; }
    else if (form.city.startsWith(job.city.slice(0, 1)) || job.city.startsWith(form.city.slice(0, 1))) {
      cityScore = 10; cityReason = `邻近城市 ${form.city}/${job.city}`;
    }
    dims.push({ key: '地域', en: 'CITY', max: 20, score: cityScore, reason: cityReason });
  } else {
    missing.push('期望城市');
    dims.push({ key: '地域', en: 'CITY', max: 20, score: 0, reason: '未填写期望城市，记 0 分' });
  }

  // 薪资 15：由从业年限估算期望区间
  const yn = yearsNumber(form.years);
  if (yn !== null) {
    const e = freeExpectedSalary(yn)!;
    const j = parseSalary(job.salary);
    let salaryScore = 0, salaryReason = `估期望 ${e.min}-${e.max}K vs 岗位 ${job.salary}`;
    if (j.min && e.min <= j.max && e.max >= j.min) { salaryScore = 15; salaryReason = '薪资区间重叠'; }
    else if (j.min && Math.abs(e.min - j.min) < 5) { salaryScore = 8; salaryReason = '接近（差 < 5K）'; }
    else if (j.min) { salaryReason = '区间差距较大'; }
    dims.push({ key: '薪资', en: 'SALARY', max: 15, score: salaryScore, reason: salaryReason });
  } else {
    missing.push('从业年限');
    dims.push({ key: '薪资', en: 'SALARY', max: 15, score: 0, reason: '未填写从业年限，无法估算薪资 · 记 0 分' });
  }

  const total = Math.min(100, dims.reduce((s, d) => s + d.score, 0));
  const verdict = total >= 85 ? '高度契合' : total >= 70 ? '推荐尝试' : total >= 50 ? '可考察' : '匹配一般';
  return { total, dims, verdict, missing };
}

/** 目标岗位是否命中该职位（用于排序加权与标记） */
export function titleHit(form: FreeForm, job: Job): boolean {
  return !!form.target && (job.level === form.target || job.title.includes(form.target));
}

/** 估算从业年限（雇主侧筛选用）：由出生年估，16 岁入行，封顶 45 年 */
export function estYears(chef: Chef): number | null {
  if (!chef.birthYear) return null;
  const y = new Date().getFullYear() - chef.birthYear - 16;
  return Math.max(0, Math.min(45, y));
}

export const EMP_YEAR_BUCKETS = [
  { key: '', label: '全部' },
  { key: '<10', label: '10 年以下' },
  { key: '10-20', label: '10–20 年' },
  { key: '20+', label: '20 年以上' },
] as const;

export function inYearBucket(chef: Chef, bucket: string): boolean {
  if (!bucket) return true;
  const y = estYears(chef);
  if (y === null) return false; // 选年限筛选时，无出生年者不纳入
  if (bucket === '<10') return y < 10;
  if (bucket === '10-20') return y >= 10 && y < 20;
  return y >= 20;
}
