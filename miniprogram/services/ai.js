// services/ai.js — AI 调用适配层
// 当前仅实现 mock 引擎（用户决策：体验版演示，无 AppID 游客可跑）。
// 移植自 星厨传承.html inferMockResponse(2282–2378) + streamMock(2381–2397)。
// 预留扩展：将来接入 DeepSeek 时，优先微信云函数代理（key 不出客户端）；
// 或游客模式下用户自填 key 直连（需在 project.config.json 关闭 urlCheck，已关）。

// ---- Mock 响应库：根据 messages 推断场景，返回最贴合的中文输出 ----
function inferMockResponse(messages) {
  const sys = ((messages[0] && messages[0].content) || '').toLowerCase();
  const usr = (messages[messages.length - 1] && messages[messages.length - 1].content) || '';

  // 场景1：帖子整理（社区）
  if (sys.includes('帖子整理') || sys.includes('recruit') || (sys.includes('type') && sys.includes('cuisine') && sys.includes('title'))) {
    const text = usr;
    let type = 'help';
    if (/招|要人|招聘|带徒|收徒/.test(text)) type = 'recruit';
    else if (/求职|找工作|找岗|想去/.test(text)) type = 'jobseek';
    else if (/切磋|讨论|怎么|火候|刀工/.test(text)) type = 'skill';
    else if (/通报|发布|新闻|大赛/.test(text)) type = 'news';
    else if (/品鉴|点评|味道|品尝/.test(text)) type = 'review';
    let cuisine = '川';
    const cm = text.match(/(川|粤|鲁|淮扬|湘|浙|徽|闽|京|沪)/);
    if (cm) cuisine = cm[1];
    const title = text.split(/[\s。.!?\n]/).find(s => s.length > 4 && s.length < 28) || (cuisine + '菜话题讨论');
    const body = text.slice(0, 200);
    const obj = { type, cuisine, title, body };
    if (type === 'recruit' || type === 'jobseek') {
      const sm = text.match(/(\d+)K[\s\-到至~]*(\d+)?K?/);
      if (sm) obj.salary = sm[0];
      const cm2 = text.match(/(成都|重庆|广州|深圳|上海|北京|南京|杭州|济南|青岛|长沙|福州|厦门|扬州|黄山|香港|绍兴|宁波|曲阜|湘潭|合肥)/);
      if (cm2) obj.city = cm2[1];
      const pm = text.match(/(炒锅|砧板|学徒|厨师长|总厨|点心|烤鸭|私厨|讲师)/);
      if (pm) obj.position = pm[1];
    }
    return JSON.stringify(obj, null, 2);
  }

  // 场景2：求职档案生成
  if (sys.includes('求职档案') || sys.includes('completeness') || sys.includes('signature')) {
    const text = usr;
    const nameMatch = text.match(/我叫([一-龥]{2,4})/);
    const ageMatch = text.match(/(\d{2})\s*岁/) || text.match(/今年\s*(\d{2})/);
    const yearsMatch = text.match(/(\d{1,2})\s*年/);
    const cuisineMatch = text.match(/(川|粤|鲁|淮扬|湘|浙|徽|闽|京|沪|本帮)/);
    const cityMatch = text.match(/(成都|重庆|广州|深圳|上海|北京|杭州|长沙|福州|扬州|济南)/);
    const masterMatch = text.match(/[跟随师从]+([一-龥]{2,4})师傅/) || text.match(/师傅([一-龥]{2,4})/);
    const salaryMatch = text.match(/(\d+)\s*[\-到至~]\s*(\d+)\s*K/) || text.match(/(\d+)K/);
    const dishes = [];
    const dishKws = ['麻婆豆腐', '水煮鱼', '回锅肉', '宫保鸡丁', '白切鸡', '烧鹅', '虾饺', '叉烧', '糖醋鲤鱼', '九转大肠', '文思豆腐', '大煮干丝', '狮子头', '松鼠桂鱼', '剁椒鱼头', '毛氏红烧肉', '西湖醋鱼', '龙井虾仁', '东坡肉', '臭鳜鱼', '佛跳墙', '北京烤鸭', '涮羊肉', '八宝鸭'];
    dishKws.forEach(d => { if (text.includes(d) && dishes.length < 5) dishes.push(d); });
    const awards = [];
    if (text.match(/金奖|银奖|大赛|获奖|冠军/)) awards.push((text.match(/[一-龥]{0,15}(金奖|银奖|大赛冠军|冠军)/) || [])[0] || '省级烹饪大赛获奖');

    const name = (nameMatch && nameMatch[1]) || null;
    const cuisine = cuisineMatch ? (cuisineMatch[1] === '本帮' ? '沪' : cuisineMatch[1]) : null;
    const years = yearsMatch ? parseInt(yearsMatch[1]) : null;
    const city = (cityMatch && cityMatch[1]) || null;
    const master = (masterMatch && masterMatch[1]) || null;
    const salary = (salaryMatch && salaryMatch[0]) || null;
    const positionMatch = text.match(/(炒锅|砧板|厨师长|总厨|主厨|私厨|讲师|学徒)/);
    const position = (positionMatch && positionMatch[1]) || null;

    let completeness = 0;
    if (name) completeness += 25;
    if (cuisine) completeness += 25;
    if (years) completeness += 25;
    if (position || salary || city) completeness += 25;
    const missing = [];
    if (!cuisine) missing.push('菜系专长');
    if (!years) missing.push('从业年限');
    if (!city) missing.push('期望城市');
    if (!salary) missing.push('期望薪资');
    if (dishes.length === 0) missing.push('拿手菜');
    if (!master) missing.push('师承');

    const bio = name && cuisine && years
      ? `${cuisine}菜师傅，${years} 年灶台功夫${master ? `，师从${master}` : ''}${dishes.length ? `，拿手${dishes.slice(0, 3).join('、')}` : ''}。${awards.length ? awards[0] + '。' : ''}希望在${city || '合适的城市'}找到下一段值得托付的厨房。`
      : `经验有限的描述。建议补充：${missing.join('、')}。`;

    return JSON.stringify({
      name, age: ageMatch ? parseInt(ageMatch[1]) : null,
      cuisine, city, master, years,
      signature: dishes,
      awards,
      intent: { position, city, salary },
      bio,
      completeness, missing
    }, null, 2);
  }

  // 场景3：师承补全
  if (sys.includes('师承') && sys.includes('推断')) {
    return '依据现有家族图谱推断，该厨师上溯第二代为同派系核心嫡传，与同辈师兄弟在拿手菜系/任职餐厅有高度重叠。师祖应为本派开派祖师，置信度【高】。同门兄弟若已认证，可作为交叉背书节点优先匹配。建议平台后续主动核验"在职餐厅—师傅"双重证据，将置信度由"中"提升至"高"。';
  }

  // 场景4：匹配解释
  if (sys.includes('匹配') || sys.includes('推荐理由')) {
    return '该厨师在菜系派别与目标岗位高度同源，且现职与目标城市同属一线主厨群落；师门偏好与岗位招募方向完全吻合，薪资区间存在明显交集。综合契合度优秀，建议雇主优先约面。';
  }

  // 兜底
  return '感谢您的提问。以师承网络为底层信任，以 AI 匹配为效率引擎——星厨传承希望让每一份手艺都能被记录、被看见、被连接。';
}

// 模拟流式打字（中文 1–2 字/组，英文标点合并，16–38ms/组）
async function streamMock(text, onToken) {
  let acc = '';
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    const len = /[一-龥]/.test(text[i]) ? (1 + (Math.random() < .4 ? 1 : 0)) : Math.min(4, text.length - i);
    chunks.push(text.slice(i, i + len));
    i += len;
  }
  for (const c of chunks) {
    acc += c;
    if (onToken) onToken(c, acc);
    await new Promise(r => setTimeout(r, 16 + Math.random() * 22));
  }
  return acc;
}

/**
 * AI 统一入口（当前走 mock；将来接真实模型的替换点只有这里）
 * @param {Array} messages [{role, content}]
 * @param {Object} opts { onToken?: (delta, full) => void }
 * @returns {Promise<string>} 完整文本
 */
async function callAI(messages, opts = {}) {
  const text = inferMockResponse(messages);
  return streamMock(text, opts.onToken);
}

// 4 个场景的标准 prompt（与网页版一致，集中管理便于将来接真模型）
const PROMPTS = {
  // 师承推断
  lineageInfer: (chef, masterName, peersSummary) => ([
    { role: 'system', content: '你是厨师师承关系研究助手。根据给出的厨师信息推断其师承脉络，给出师祖/同门/推断依据/置信度，120字内。' },
    { role: 'user', content: `厨师：${chef.name}，${chef.cuisine || ''}菜，${chef.position || ''}${chef.city ? '，' + chef.city : ''}。已知师傅：${masterName || '未知'}。同派前辈：${peersSummary || '无'}。请推断师承关系。` }
  ]),
  // 匹配解释
  matchExplain: (chef, job, score) => ([
    { role: 'system', content: '你是招聘匹配顾问。用一句中文（≤60字）点出该厨师与该岗位的最大契合点，给推荐理由。' },
    { role: 'user', content: `厨师：${JSON.stringify(chef)}。岗位：${JSON.stringify(job)}。匹配度 ${score}%。` }
  ]),
  // 求职档案
  profileGen: (text) => ([
    { role: 'system', content: '你是求职档案生成助手。从厨师口述中只提取明确说出的信息，严禁编造。严格返回 JSON：{"name":null,"age":null,"cuisine":null,"city":null,"master":null,"years":null,"signature":[],"awards":[],"intent":{"position":null,"city":null,"salary":null},"bio":"","completeness":0,"missing":[]}。completeness 按 姓名/菜系/年限/意向 各25分计；missing 列出缺失项中文名。' },
    { role: 'user', content: text }
  ]),
  // 帖子整理
  postOrganize: (text) => ([
    { role: 'system', content: '你是帖子整理助手。识别 type(recruit招徒/jobseek求职/skill切磋/help求助/news见闻/review点评) 与 cuisine，生成通顺标题与正文；招徒/求职类提取 position/salary/city。严格返回 JSON：{"type":"","cuisine":"","title":"","body":"","position":null,"salary":null,"city":null}。' },
    { role: 'user', content: text }
  ])
};

module.exports = { callAI, PROMPTS };
