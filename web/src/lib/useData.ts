// 数据加载 hook —— fetch 一次 chefs.json，全局缓存

import { useEffect, useState } from 'react';
import type { WebData } from './types';

let _cache: WebData | null = null;
let _loading = false;
const _listeners = new Set<(data: WebData | null, err: Error | null) => void>();

async function load(): Promise<void> {
  if (_loading) return;
  _loading = true;
  try {
    // BASE_URL：部署在 /star-chef/ 子路径时为 '/star-chef/'，本地为 '/'
    const res = await fetch(`${import.meta.env.BASE_URL}data/chefs.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: WebData = await res.json();
    // chefs.json 里的头像是根绝对路径（/portraits/xxx.jpg），
    // 子路径部署时需要加上 BASE_URL 前缀，否则会 404
    const base = import.meta.env.BASE_URL;
    for (const c of json.chefs) {
      if (c.portrait && c.portrait.startsWith('/')) {
        c.portrait = base + c.portrait.slice(1);
      }
    }
    _cache = json;
    _listeners.forEach(fn => fn(_cache, null));
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    _listeners.forEach(fn => fn(null, err));
  } finally {
    _loading = false;
  }
}

export function useData(): { data: WebData | null; loading: boolean; error: Error | null } {
  const [data, setData] = useState<WebData | null>(_cache);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(!_cache);

  useEffect(() => {
    if (_cache) return;
    const fn = (d: WebData | null, err: Error | null) => {
      setData(d);
      setError(err);
      setLoading(false);
    };
    _listeners.add(fn);
    load();
    return () => { _listeners.delete(fn); };
  }, []);

  return { data, loading, error };
}

export function getData(): WebData | null {
  return _cache;
}
