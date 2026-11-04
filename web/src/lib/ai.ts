// DeepSeek 调用封装 + 无 Key 时的本地演示解析
// 还原原站「AI 求职助手」：口语描述 → 严格 JSON 抽取 → 结构化求职档案

export const KEY_STORAGE = 'star-chef:deepseek-key';
export const MODE_STORAGE = 'star-chef:deepseek-mode';

export type AiMode = 'proxy' | 'direct';
export const DEFAULT_BASE = '/api/deepseek';
export const DIRECT_BASE = 'https://api.deepseek.com';

export function getApiKey(): string {
  try { return localStorage.getItem(KEY_STORAGE) || ''; } catch { return ''; }
}
export function setApiKey(k: string) {
  try {
    if (k) localStorage.setItem(KEY_STORAGE, k);
    else localStorage.removeItem(KEY_STORAGE);
  } catch { /* ignore */ }
}
export function getMode(): AiMode {
  try { return (localStorage.getItem(MODE_STORAGE) as AiMode) || 'proxy'; } catch { return 'proxy'; }
}
export function setMode(m: AiMode) {
  try { localStorage.setItem(MODE_STORAGE, m); } catch { /* ignore */ }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CallOptions {
  apiKey: string;
  mode?: AiMode;
  temperature?: number;
  stream?: boolean;
  signal?: AbortSignal;
  onToken?: (delta: string, full: string) => void;
}

/** 统一调用入口：SSE 流式。Key 为空时抛 MISSING_KEY，由页面降级到演示解析。 */
export async function callDeepSeek(messages: ChatMessage[], opts: CallOptions): Promise<string> {
  if (!opts.apiKey.trim()) throw new Error('MISSING_KEY');

  const base = opts.mode === 'direct' ? DIRECT_BASE : DEFAULT_BASE;
  const stream = opts.stream !== false;

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      stream,
      temperature: opts.temperature ?? 0.7,
      messages,
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let msg = text;
    try { msg = JSON.parse(text)?.error?.message || text; } catch { /* keep raw */ }
    throw new Error(`HTTP ${res.status} · ${msg.slice(0, 300) || res.statusText}`);
  }

  if (!stream) {
    const json = await res.json();
    const full = json?.choices?.[0]?.message?.content || '';
    opts.onToken?.(full, full);
    return full;
  }

  if (!res.body) throw new Error('响应无流式内容');

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let full = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';
    for (const part of parts) {
      for (const line of part.split('\n')) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const data = t.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          const delta = json?.choices?.[0]?.delta?.content;
          if (delta) {
            full += delta;
            opts.onToken?.(delta, full);
          }
        } catch { /* 忽略不完整帧 */ }
      }
    }
  }
  return full;
}

/* ============================================================
   求职档案：严格 JSON 抽取（prompt 与原站一致）
   ============================================================ */

export interface ResumeIntent {
  position: string | null;
  city: string | null;
  salary: string | null;
}

export interface ResumeProfile {
  name: string | null;
  age: number | null;
  cuisine: string | null;
  city: string | null;
  master: string | null;
  years: number | null;
  signature: string[];
  awards: string[];
  intent: ResumeIntent;
  bio: string | null;
  completeness: number;
  missing: string[];
}

export const EXTRACT_SYSTEM = `你是厨师求职档案生成助手。从厨师的口语化描述中【只提取他明确说出的信息】，严禁编造、推测或用行业默认值填充。未提及的字段：字符串/对象返回 null，数组返回 []。

严格返回 JSON，字段：
- name: 姓名或 null
- age: 年龄(数字)或 null
- cuisine: 菜系(必须是用户原话提到的，如 川/粤/鲁/淮扬/湘/浙/徽/闽/京/沪)或 null
- city: 所在或期望城市或 null
- master: 师傅姓名(用户明确说过才有)或 null
- years: 从业年限(数字)或 null
- signature: 拿手菜数组(仅限用户明确列举的，最多5道)，未提及返回 []
- awards: 获奖/资质数组(仅限用户明确说过的)，未提及返回 []
- intent: {position,city,salary}，用户没说的字段填 null
- bio: 3-4句自荐信，只能基于用户已提供的信息改写润色，用户没说的不得编造；信息很少时如实写成简短陈述即可，不得虚构菜系/年限/师承/拿手菜
- completeness: 0-100 整数，按 姓名/菜系/从业年限/求职意向 四项关键字段计，每缺一项扣 25
- missing: 数组，列出对求职重要但用户未提供的信息(中文短语，如"菜系专长""从业年限""期望城市""期望薪资""拿手菜""师承")

只返回 JSON，不要任何其他文字。`;

/** 容错解析：去掉 ```json 围栏，正则截取 {...} */
export function parseLooseJson(raw: string): ResumeProfile {
  const cleaned = raw.replace(/```json|```/g, '').trim();
  const m = cleaned.match(/\{[\s\S]*\}/);
  const obj = JSON.parse(m ? m[0] : cleaned);
  return normalizeProfile(obj);
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s && s !== 'null' && s !== 'undefined' ? s : null;
}
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function arr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(x => str(x)).filter(Boolean).slice(0, 8) as string[];
}

/** 归一化模型输出，并本地复核完整度（防止模型多算） */
export function normalizeProfile(obj: any): ResumeProfile {
  const intentRaw = obj?.intent && typeof obj.intent === 'object' ? obj.intent : {};
  const profile: ResumeProfile = {
    name: str(obj?.name),
    age: num(obj?.age),
    cuisine: str(obj?.cuisine),
    city: str(obj?.city),
    master: str(obj?.master),
    years: num(obj?.years),
    signature: arr(obj?.signature),
    awards: arr(obj?.awards),
    intent: {
      position: str(intentRaw.position),
      city: str(intentRaw.city),
      salary: str(intentRaw.salary),
    },
    bio: str(obj?.bio),
    completeness: 0,
    missing: arr(obj?.missing),
  };
  const checked = computeCompleteness(profile);
  profile.completeness = checked.completeness;
  profile.missing = checked.missing;
  return profile;
}

/** 按原站口径：姓名 / 菜系 / 从业年限 / 求职意向，每缺一项扣 25 */
export function computeCompleteness(p: ResumeProfile): { completeness: number; missing: string[] } {
  const missing: string[] = [];
  if (!p.name) missing.push('姓名');
  if (!p.cuisine) missing.push('菜系专长');
  if (p.years == null) missing.push('从业年限');
  if (!p.intent?.position) missing.push('求职意向');
  if (!p.signature.length) missing.push('拿手菜');
  if (!p.master) missing.push('师承');
  if (!p.intent?.city && !p.city) missing.push('期望城市');
  if (!p.intent?.salary) missing.push('期望薪资');
  const keyMissing = [
    !p.name, !p.cuisine, p.years == null, !p.intent?.position,
  ].filter(Boolean).length;
  return { completeness: Math.max(0, 100 - keyMissing * 25), missing };
}

/** 调模型抽取；失败抛错，由页面决定降级 */
export async function extractResume(
  text: string,
  opts: CallOptions,
): Promise<{ profile: ResumeProfile; raw: string }> {
  const raw = await callDeepSeek(
    [
      { role: 'system', content: EXTRACT_SYSTEM },
      { role: 'user', content: text },
    ],
    { ...opts, temperature: 0.7, stream: true },
  );
  return { profile: parseLooseJson(raw), raw };
}

/* ============================================================
   无 Key 演示解析：规则抽取，保证页面上永远有完整档案
   ============================================================ */

const CUISINE_WORDS = [
  '淮扬菜', '东北菜', '清真菜', '川菜', '粤菜', '鲁菜', '湘菜', '浙菜',
  '徽菜', '闽菜', '京菜', '苏菜', '沪菜', '豫菜', '陕菜', '滇菜',
];
const CITIES = [
  '成都', '重庆', '广州', '深圳', '上海', '北京', '杭州', '苏州', '长沙', '扬州',
  '济南', '厦门', '南京', '西安', '武汉', '郑州', '天津', '青岛', '宁波', '佛山',
  '顺德', '东莞', '昆明', '贵阳', '合肥', '福州', '沈阳', '大连', '南宁', '海口',
];

function firstMatch(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m ? (m[1] || '').trim() : null;
}

/** 本地演示解析：从口语描述里按规则抽字段（近似模型输出，绝不编造） */
export function demoExtract(text: string): ResumeProfile {
  const t = text.replace(/\s+/g, ' ').trim();

  const name = firstMatch(t, /我叫([\u4e00-\u9fa5]{2,4})/) || firstMatch(t, /我是([\u4e00-\u9fa5]{2,4})/);
  const age = Number(firstMatch(t, /(?:今年|年龄)?\s*(\d{2})\s*岁/) || '') || null;

  const cuisineWord = CUISINE_WORDS.find(w => t.includes(w));
  const cuisine = cuisineWord ? cuisineWord.replace('菜', '') : null;

  const city = CITIES.find(c => t.includes(c)) || null;

  const master = firstMatch(t, /(?:跟着|跟|随)([\u4e00-\u9fa5]{2,4})(?:师傅|师父|老师|学)/)
    || firstMatch(t, /师从([\u4e00-\u9fa5]{2,4})/)
    || firstMatch(t, /拜([\u4e00-\u9fa5]{2,4})为师/);

  const years = Number(
    firstMatch(t, /干了\s*(\d{1,2})\s*年/)
    || firstMatch(t, /(\d{1,2})\s*年(?:的)?(?:功夫|经验|从业|厨龄|手艺)/)
    || firstMatch(t, /从\s*\d{1,2}\s*岁.*?干了\s*(\d{1,2})\s*年/)
    || ''
  ) || null;

  const sigRaw = firstMatch(t, /会做([^。；]+)/) || firstMatch(t, /拿手(?:菜|绝活)是?([^。；]+)/)
    || firstMatch(t, /(?:会|做)([\u4e00-\u9fa5、，,]{6,40}?)(?:，|。|拿手|现在|想)/);
  const signature = sigRaw
    ? sigRaw.split(/[、，,和及]/).map(s => s.trim()).filter(s => s.length >= 2 && !/^(菜|饭|面)$/.test(s)).slice(0, 5)
    : [];

  const awardsRaw = firstMatch(t, /拿过([^。；]+)/) || firstMatch(t, /(?:获得|荣获|拿过|得过)([^。；]+)/);
  const awards = awardsRaw ? awardsRaw.split(/[、，,]/).map(s => s.trim()).filter(Boolean).slice(0, 3) : [];

  const salary = firstMatch(t, /(\d{1,2}\s*-\s*\d{1,2}\s*K)/i)
    || firstMatch(t, /(\d{1,2}\s*K\s*以上)/i)
    || firstMatch(t, /(?:工资|薪资|期望)\s*([^。；，]+)/);

  const intentPosRaw = firstMatch(t, /(?:想找|找个|想找个|找)(?:个|一个)?([^，。；]*(?:岗位|位置|职位|厨师长|总厨|顾问|炒锅|主管))/)
    || firstMatch(t, /(?:想找|找个|找)([^，。；]+)/);
  const position = intentPosRaw ? intentPosRaw.replace(/^个/, '').trim() : null;

  const profile: ResumeProfile = {
    name,
    age,
    cuisine,
    city,
    master,
    years,
    signature,
    awards,
    intent: {
      position,
      city,
      salary: salary ? salary.replace(/\s+/g, '') : null,
    },
    bio: null,
    completeness: 0,
    missing: [],
  };

  const bits: string[] = [];
  bits.push(`${name || '我'}${age ? `，今年 ${age} 岁` : ''}。`);
  if (cuisine) bits.push(`做的是${cuisine}菜${years ? `，前后 ${years} 年` : ''}。`);
  if (master) bits.push(`师从${master}，基本功是师傅一手带出来的。`);
  if (signature.length) bits.push(`拿手菜是${signature.slice(0, 3).join('、')}。`);
  if (awards.length) bits.push(`曾获${awards[0]}。`);
  if (position || profile.intent.city || profile.intent.salary) {
    bits.push(`希望${profile.intent.city ? `在${profile.intent.city}` : ''}找${position || '合适的岗位'}${profile.intent.salary ? `，期望薪资 ${profile.intent.salary}` : ''}。`);
  }
  profile.bio = bits.join('');

  const checked = computeCompleteness(profile);
  profile.completeness = checked.completeness;
  profile.missing = checked.missing;
  return profile;
}

/* ============================================================
   招聘匹配：一句话解释（无 Key 时本地生成）
   ============================================================ */

export function explainPrompt(chefText: string, jobText: string, score: number): ChatMessage[] {
  return [
    {
      role: 'system',
      content: '你是厨师招聘匹配顾问。用一句中文（不超过60字）解释为什么某厨师与某岗位匹配，点出最大契合点。语气专业简洁。',
    },
    {
      role: 'user',
      content: `厨师：${chefText}。岗位：${jobText}。匹配度${score}%。请解释推荐理由。`,
    },
  ];
}

/** 无 Key 时的本地解释：基于拆解维度里最强的一项 */
export function demoExplain(topKey: string, topReason: string, score: number): string {
  if (score === 0) {
    return `四个维度都没命中：${topReason}。综合匹配度 0 分，建议换一个同菜系、同城市的岗位再看。`;
  }
  return `${topKey}是这次匹配的主要依据：${topReason}。综合匹配度 ${score} 分，建议${score >= 80 ? '优先沟通' : score >= 60 ? '安排一次试菜' : '作为备选联系'}。`;
}
