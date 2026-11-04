/**
 * 生卒年份统一格式化（所有 UI 共用，禁止各自手写）：
 *  - 仅生年        → "生于 1948"
 *  - 生卒俱全      → "1948–2016"（纯年份区间，不加"生卒"标签）
 *  - 仅卒年        → "卒于 2016"
 *  - 两者都无      → null（调用方不渲染该字段，不留空占位）
 */
export function formatLifeYears(birthYear?: number | null, deathYear?: number | null): string | null {
  if (birthYear && deathYear) return `${birthYear}–${deathYear}`;
  if (birthYear) return `生于 ${birthYear}`;
  if (deathYear) return `卒于 ${deathYear}`;
  return null;
}
