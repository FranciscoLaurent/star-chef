// utils/format.js — 通用格式化与小工具

// 解析薪资区间 "25K-50K" / "8K-15K+分红" / "12K" → {min, max}（单位 K，修网页版只取下限的 bug）
function parseSalaryRange(str) {
  if (!str) return null;
  const m = String(str).match(/(\d+)\s*K?\s*[\-到至~]\s*(\d+)\s*K?/i);
  if (m) return { min: +m[1], max: +m[2] };
  const single = String(str).match(/(\d+)\s*K/i);
  if (single) return { min: +single[1], max: +single[1] };
  return null;
}

// 姓氏（取姓名首字，用于印章占位）
function surnameOf(name) {
  return (name || '厨').charAt(0);
}

// 生卒年展示："1932–2015" / "1978–" / ""
function lifeSpan(chef) {
  if (!chef.birth && !chef.death) return '';
  return `${chef.birth || '？'}–${chef.death || ''}`;
}

// 师承树构建：输入厨师数组，输出 { roots, childrenOf }
// roots = 无师傅或师傅不在集合内的人；childrenOf = { masterId: [child, ...] }
function buildTrees(chefs) {
  const ids = new Set(chefs.map(c => c.id));
  const childrenOf = {};
  const roots = [];
  chefs.forEach(c => {
    if (c.master && ids.has(c.master)) {
      (childrenOf[c.master] = childrenOf[c.master] || []).push(c);
    } else {
      roots.push(c);
    }
  });
  // 同门排序：有 gen 按 gen，再按出生年，再按姓名
  const byKey = (a, b) =>
    (a.gen || 99) - (b.gen || 99) ||
    (a.birth || 9999) - (b.birth || 9999) ||
    String(a.name).localeCompare(String(b.name), 'zh');
  roots.sort(byKey);
  Object.values(childrenOf).forEach(list => list.sort(byKey));
  return { roots, childrenOf };
}

// 向上回溯师承链（含自己）：[祖师, ..., 师傅, 自己]
function lineageChain(chef, byId, maxDepth = 10) {
  const chain = [chef];
  let cur = chef;
  while (cur && cur.master && byId[cur.master] && chain.length < maxDepth) {
    cur = byId[cur.master];
    chain.unshift(cur);
  }
  return chain;
}

module.exports = { parseSalaryRange, surnameOf, lifeSpan, buildTrees, lineageChain };
