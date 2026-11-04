// 模糊搜索 —— 姓名 / 拼音 / 菜系 / 拿手菜 / 称号

import type { Chef, WebData } from './types';

export interface SearchResult {
  chef: Chef;
  score: number;
  matchedFields: string[];
}

/**
 * 构造搜索索引（一次构建、多次查询）
 */
export interface SearchIndex {
  byName: Map<string, Chef>;           // 中文姓名 → chef（精确）
  byPinyin: Chef[];                    // 所有 chef（拼音已存在 pinyin 字段）
  byCuisine: Map<string, Chef[]>;       // 短码 → chefs
  signaturesFlat: { chef: Chef; dish: string; name: string; pinyinAll: string; position: string; titles: string }[];
}

export function buildSearchIndex(data: WebData): SearchIndex {
  const byName = new Map<string, Chef>();
  const byCuisine = new Map<string, Chef[]>();
  const signaturesFlat: SearchIndex['signaturesFlat'] = [];

  for (const c of data.chefs) {
    byName.set(c.name, c);
    if (c.cuisine) {
      if (!byCuisine.has(c.cuisine)) byCuisine.set(c.cuisine, []);
      byCuisine.get(c.cuisine)!.push(c);
    }
    signaturesFlat.push({
      chef: c,
      dish: c.signatureDishes.join(' '),
      name: c.name,
      pinyinAll: c.pinyin?.all || c.pinyin?.name || '',
      position: c.position || '',
      titles: (c.titles || []).join(' '),
    });
  }

  return { byName, byPinyin: data.chefs, byCuisine, signaturesFlat };
}

/**
 * 搜索
 */
export function search(query: string, index: SearchIndex, limit = 30): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: Map<string, SearchResult> = new Map();

  const add = (chef: Chef, score: number, field: string) => {
    const existing = results.get(chef.id);
    if (existing) {
      existing.score = Math.max(existing.score, score);
      if (!existing.matchedFields.includes(field)) existing.matchedFields.push(field);
    } else {
      results.set(chef.id, { chef, score, matchedFields: [field] });
    }
  };

  // 1. 精确姓名匹配（最高分）
  const exact = index.byName.get(query.trim());
  if (exact) add(exact, 100, 'name-exact');

  // 2. 姓名子串匹配
  for (const chef of index.byPinyin) {
    if (chef.name.includes(query.trim()) && chef.name !== query.trim()) {
      add(chef, 80, 'name');
    }
  }

  // 3. 拼音匹配（compact / initial / name）
  for (const chef of index.byPinyin) {
    if (!chef.pinyin) continue;
    const compact = chef.pinyin.compact.toLowerCase();
    const initial = chef.pinyin.initial.toLowerCase();
    const namePinyin = chef.pinyin.name.toLowerCase();
    if (compact.includes(q)) add(chef, 70, 'pinyin');
    else if (initial === q) add(chef, 65, 'pinyin-initial');
    else if (namePinyin.includes(q)) add(chef, 60, 'pinyin');
  }

  // 4. 菜系匹配
  for (const [cuisine, chefs] of index.byCuisine) {
    if (cuisine.toLowerCase().includes(q) || q.includes(cuisine.toLowerCase())) {
      for (const chef of chefs) add(chef, 50, 'cuisine');
    }
  }

  // 5. 拿手菜 / 称号 / position 匹配
  for (const entry of index.signaturesFlat) {
    const hay = (entry.dish + ' ' + entry.pinyinAll + ' ' + entry.position + ' ' + entry.titles).toLowerCase();
    if (hay.includes(q)) {
      add(entry.chef, 40, 'signature-or-title');
    }
  }

  return [...results.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}
