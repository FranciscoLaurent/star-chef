// 师承补全补丁：从简介文本抽取师傅提及，为库中缺失的师傅补「档案待补」实体
//
// 设计原则：
// 1. 绝不修改 data/ 下的原始合并产物；本模块只作用于 prepare-web-data 生成的中间数组。
// 2. 结构化 masters[] 优先（可信度更高），简介正则只用于 masters[] 为空的厨师。
// 3. 所有由本模块新增的实体/边都带 derived / verified:false 标记，前端可区分显示。

const NAME_RE = /^[\u4e00-\u9fa5·]{2,4}$/;

// 明显不是人名的词
const STOP = new Set([
  '体系', '之一', '节点', '关系', '传承', '文化', '名厨', '大师', '泰斗', '师傅',
  '老师', '先生', '弟子', '后辈', '源流', '代表', '传人', '中国', '四川', '湖南',
  '广东', '山东', '江苏', '浙江', '北京', '上海', '我们', '他们', '其', '该',
  '一代', '当代', '近代', '现代', '门下', '高徒', '流派', '菜系', '厨艺', '技艺',
  '手艺', '行业', '餐饮', '烹饪', '学徒', '徒弟', '学生', '晚辈', '前辈', '同行',
]);

// 出现的头衔 / 修饰词，先去噪再校验
const NOISE = /(著名|一代|老一辈|当代|近代|现代|我国|中国|川菜|湘菜|粤菜|鲁菜|淮扬菜|京菜|徽菜|浙菜|闽菜|苏菜|沪菜|东北菜|清真菜|泰斗|大师|名厨|先生|老师|师傅|门下|嫡传|亲传|高徒|传人|满人|汉人|回族|国家|特级|一级|高级|烹饪|厨艺|技艺|手艺)/g;

/** 从一段简介里抽取师傅人名候选 */
export function extractMastersFromBio(bio, selfName = '') {
  if (!bio) return [];
  const text = String(bio);
  const found = [];

  const push = (raw) => {
    if (!raw) return;
    let s = raw.replace(/[（(].*?[)）]/g, '').replace(NOISE, '').trim();
    s = s.replace(/^(拜|入|于|向|从|随|在|由|跟|同|是|为|系|曾|正式|早年|后来|先后|直接)/, '');
    s = s.replace(/(为师|门下|弟子|传人|之高徒|高徒|亲传弟子)$/, '');
    // 多个师傅：A、B、C
    for (const part of s.split(/[、,，和与及]/)) {
      const p = part.replace(NOISE, '').replace(/^[的了]/, '').trim();
      if (NAME_RE.test(p) && !STOP.has(p) && p !== selfName) found.push(p);
    }
  };

  const PATTERNS = [
    /拜(?:入|于|在)?([^，。；、\n]{2,18}?)为师/g,
    /师承([^，。；、\n]{2,16})/g,
    /师从([^，。；、\n]{2,16})/g,
    /师事([^，。；、\n]{2,12})/g,
    /([^，。；、\n]{2,12}?)的弟子/g,
  ];

  for (const re of PATTERNS) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const raw = (m[1] || '').trim();
      // 超过 6 字仍可能是"满人名厨关正兴"这类，先尝试去掉噪音词
      push(raw.length > 6 ? raw.replace(NOISE, '') : raw);
    }
  }

  // 去重，保序
  return [...new Set(found)];
}

/**
 * 对标准化后的厨师数组做师承补全。
 * @param {Array} chefs normalizeChef 产出的数组（含 id/name/masters/master）
 * @param {Map} rawById 原始 id → 原始记录（用于取 master 原文）
 */
export function applyBioLineage(chefs, idToName) {
  const byName = new Map();
  for (const c of chefs) if (c.name) byName.set(c.name, c);

  const created = new Map(); // name → 新实体
  const usedIds = new Set(chefs.map(c => c.id));

  const stats = {
    mentions: 0,          // 简介/结构化里出现的师傅人名提及（去重前）
    structuredMissing: 0, // 结构化 masters[] 里库中不存在的
    bioOnlyMissing: 0,    // 仅简介提到、库中不存在的
    createdEntities: 0,   // 新建「档案待补」实体
    edges: 0,             // 新建师徒边
  };

  const makeEntity = (name, fromChef, via) => {
    if (created.has(name)) return created.get(name);
    let id = `bio-${String(created.size + 1).padStart(3, '0')}`;
    while (usedIds.has(id)) id += 'x';
    usedIds.add(id);

    const gen = typeof fromChef.gen === 'number' ? Math.max(0, fromChef.gen - 1) : null;
    const entity = {
      id,
      name,
      cuisine: fromChef.cuisine || null,
      school: null,
      era: null,
      birthYear: null,
      deathYear: null,
      birthplace: null,
      city: fromChef.city || null,
      position: null,
      restaurant: null,
      bio: `据 ${fromChef.name} 的${via === 'bio' ? '简介' : '师承记录'}推断为师傅：${name}。档案待补，关系待核实。`,
      portrait: null,
      signatureDishes: [],
      master: null,
      masters: [],
      titles: [],
      gen,
      pinyin: null,
      source: 'bio-derived',
      derived: true,
      verified: false,
    };
    created.set(name, entity);
    stats.createdEntities++;
    return entity;
  };

  const link = (chef, masterName, via) => {
    if (!masterName || masterName === chef.name) return;
    const exists = byName.has(masterName);
    const entity = exists ? byName.get(masterName) : makeEntity(masterName, chef, via);

    if (!chef.masters.includes(masterName)) chef.masters.unshift(masterName);
    if (!chef.master) chef.master = masterName;
    chef.inferred = true; // 这条边来自文本推断，UI 需标注
    stats.edges++;
    return entity;
  };

  for (const chef of chefs) {
    // 1) 结构化 masters[]：库中缺失的补实体
    const structured = Array.isArray(chef.masters) ? [...chef.masters] : [];
    for (const mName of structured) {
      if (!mName) continue;
      stats.mentions++;
      if (byName.has(mName)) {
        // 库中存在：确保 master 指向名字，同时标记为"文本整理所得、待核实"
        if (!chef.master) chef.master = mName;
        chef.inferred = true;
        continue;
      }
      stats.structuredMissing++;
      link(chef, mName, 'structured');
    }

    // 2) 简介抽取（仅在没有任何结构化师傅时使用）
    if (structured.length === 0 && chef.bio) {
      const candidates = extractMastersFromBio(chef.bio, chef.name);
      if (candidates.length) {
        stats.mentions += candidates.length;
        const chosen = candidates[0];
        if (!byName.has(chosen)) stats.bioOnlyMissing++;
        link(chef, chosen, 'bio');
      }
    }
  }

  // 补出来的实体追加进主数组
  const augmented = [...chefs, ...created.values()];

  return {
    chefs: augmented,
    stats,
    createdNames: [...created.keys()],
  };
}
