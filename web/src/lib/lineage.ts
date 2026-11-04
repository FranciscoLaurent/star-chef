// 师承计算 —— 基于 WebData 派生辅助数据结构

import type { WebData, Chef } from './types';

export interface FamilyGroup {
  // 门派/菜系分组
  key: string;          // 作为唯一标识：school key 或 cuisine
  label: string;        // 显示名称
  subtitle?: string;    // 副标题（菜系 / 地域）
  cuisine: string | null;
  stamp?: string;       // 门派钢印字
  chefCount: number;
  masterCount: number;  // 有徒弟的厨师数
  topMasters: { name: string; disciples: number }[];
}

export interface GenGroup {
  gen: number | null; // null = 代际待考（无师承链可推算）
  chefs: Chef[];
}

/**
 * 家派目录：以「菜系」为一级分类（同一菜系不再被门派切碎），
 * 门派（school）作为菜系内部的分组标签。这样"湘菜 0 徒"这类口径错误不会再出现。
 */
export function buildFamilies(data: WebData): FamilyGroup[] {
  const groups = new Map<string, FamilyGroup>();
  const OTHERS_KEY = '__others__';

  for (const c of data.chefs) {
    const key = c.cuisine ? `cuisine:${c.cuisine}` : OTHERS_KEY;
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        label: c.cuisine ? `${c.cuisine}菜` : '其他',
        subtitle: undefined,
        cuisine: c.cuisine || null,
        stamp: c.cuisine ? c.cuisine.slice(0, 1) : '他',
        chefCount: 0,
        masterCount: 0,
        topMasters: [],
      };
      groups.set(key, g);
    }
    g.chefCount++;
  }

  // 每个菜系里的门派（school）分布
  for (const g of groups.values()) {
    const cuisines = g.cuisine;
    const schoolsInGroup = new Map<string, number>();
    for (const c of data.chefs) {
      const sameGroup = cuisines ? c.cuisine === cuisines : !c.cuisine;
      if (!sameGroup || !c.school) continue;
      schoolsInGroup.set(c.school, (schoolsInGroup.get(c.school) || 0) + 1);
    }
    const names = [...schoolsInGroup.entries()]
      .filter(([k]) => k)
      .map(([k, n]) => {
        const s = data.schools.find(x => x.key === k);
        return `${s ? (s.subName || s.name) : k} ${n}`;
      });
    g.subtitle = names.length ? names.join(' · ') : '未归门派';

    // 师傅（有徒弟的人）按菜系统计，不再要求"没有门派"
    const masters = new Map<string, number>();
    for (const [masterName, discipleIds] of Object.entries(data.apprenticeMap)) {
      if (!discipleIds.length) continue;
      const masterChef = data.chefs.find(cc => cc.name === masterName);
      if (!masterChef) continue;
      const sameGroup = cuisines ? masterChef.cuisine === cuisines : !masterChef.cuisine;
      if (sameGroup) masters.set(masterName, discipleIds.length);
    }
    g.masterCount = masters.size;
    g.topMasters = [...masters.entries()]
      .map(([name, disciples]) => ({ name, disciples }))
      .sort((a, b) => b.disciples - a.disciples)
      .slice(0, 5);
  }

  // 排序：真实菜系按人数降序，"其他"永远最后
  return [...groups.values()].sort((a, b) => {
    if (a.key === OTHERS_KEY) return 1;
    if (b.key === OTHERS_KEY) return -1;
    return b.chefCount - a.chefCount;
  });
}

/**
 * 按代际分组：代际在数据管线（prepare-web-data.mjs · computeGen）中已按新口径算好——
 * 只沿有记录的师徒链推算，基准代=有徒无师的可考起点；gen=null 即"代际待考"，排在最后。
 * 此处不再做任何运行时推断（旧逻辑"无师傅=第一代"已废弃）。
 */
export function groupByGen(chefs: Chef[]): GenGroup[] {
  const byGen = new Map<number | null, Chef[]>();
  for (const c of chefs) {
    const g = typeof c.gen === 'number' && !Number.isNaN(c.gen) ? c.gen : null;
    if (!byGen.has(g)) byGen.set(g, []);
    byGen.get(g)!.push(c);
  }
  return [...byGen.entries()]
    .sort((a, b) => {
      if (a[0] === null) return 1;
      if (b[0] === null) return -1;
      return a[0] - b[0];
    })
    .map(([gen, chefs]) => ({ gen, chefs: chefs.sort((a, b) => a.name.localeCompare(b.name, 'zh')) }));
}

/** 获取师傅详情 */
export function getMasterChef(chef: Chef, data: WebData): Chef | null {
  if (!chef.master) return null;
  return data.chefs.find(c => c.name === chef.master) || null;
}

/** 获取徒弟列表（apprenticeMap 以师傅名字为 key） */
export function getDisciples(chef: Chef, data: WebData): Chef[] {
  const ids = data.apprenticeMap[chef.name] || [];
  return ids.map(id => data.chefs.find(c => c.id === id)).filter(Boolean) as Chef[];
}

/** 获取完整师承链（向上） */
export function getLineage(chef: Chef, data: WebData): Chef[] {
  const chain: Chef[] = [];
  const visited = new Set<string>();
  let current: Chef | null = chef;
  let depth = 0;
  while (current && depth < 10 && !visited.has(current.id)) {
    visited.add(current.id);
    chain.unshift(current);
    const masterName: string | null = current.master;
    if (!masterName) break;
    current = data.chefs.find(c => c.name === masterName) || null;
    depth++;
  }
  return chain;
}
