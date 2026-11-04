// 前端数据类型定义 —— 对齐 prepare-web-data.mjs 输出

export interface Pinyin {
  name: string;      // "huang shao man"
  initial: string;   // "hsm"
  compact: string;   // "huangshaoman"
  all: string;       // 扩展到称号/城市的完整拼音
}

export interface Chef {
  id: string;
  name: string;
  cuisine: string | null;      // 短码 "川"/"粤"/null
  school: string | null;       // 门派 key
  era: string | null;          // 当代/近代/null
  birthYear: number | null;
  deathYear: number | null;
  birthplace: string | null;
  city: string | null;
  position: string | null;
  restaurant: string | null;
  bio: string | null;
  portrait: string | null;
  signatureDishes: string[];
  master: string | null;        // 大弟子师傅名字
  masters: string[];            // 所有师傅名字
  titles: string[];
  gen: number | null;
  pinyin: Pinyin | null;
  source: string | null;
  /** 原始资料网页 URL（可点击「查看来源」） */
  sourceUrl?: string | null;
  /** 来源站点名：餐饮名厨文化平台 / 百度百科 … */
  sourceSite?: string | null;
  /** 站点名是从头像外链域名反推的（原始页面地址缺失） */
  sourceSiteFromPortrait?: boolean;
  /** 由简介/师承记录推断补出的「档案待补」实体 */
  derived?: boolean;
  /** 关系是否经过核实（false = 待核实） */
  verified?: boolean;
  /** 该厨师的师承边来自文本抽取，前端标注"据简介推断" */
  inferred?: boolean;
}

export interface School {
  key: string;
  name: string;
  subName: string;
  en: string;
  region: string;
  stamp: string;
  cuisine: string | null;
  desc: string;
  styles: string[];
  chefCount: number;
}

export interface WebData {
  generatedAt: string;
  meta: {
    total: number;
    withMaster: number;
    withPortrait: number;
    withSignature: number;
    cuisines: number;
    schools: number;
    /** 补丁新增的「档案待补」师傅数 */
    derivedChefs: number;
    /** 简介/记录中抽取的师傅提及条数 */
    bioMentions: number;
    /** 由文本推断建立的师徒边数 */
    inferredEdges: number;
    /** 有原始来源网页的厨师数 */
    sourceWithUrl: number;
    /** 只有来源站点、无具体页面 */
    sourceSiteOnly: number;
    /** 来源未知 */
    sourceUnknown: number;
  };
  cuisineCounts: Record<string, number>;
  eraCounts: Record<string, number>;
  apprenticeMap: Record<string, string[]>; // masterName → [chefId]
  schools: School[];
  chefs: Chef[];
}
