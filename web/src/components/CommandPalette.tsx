import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../lib/useData';
import { buildSearchIndex, search } from '../lib/search';
import type { Chef } from '../lib/types';

interface Props {
  onClose: () => void;
  onSelect: (chefId: string) => void;
}

export default function CommandPalette({ onClose, onSelect }: Props) {
  const { data, loading } = useData();
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const index = useMemo(() => data ? buildSearchIndex(data) : null, [data]);
  const results = useMemo(() => index && query ? search(query, index) : [], [index, query]);

  useEffect(() => {
    inputRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter' && results[activeIdx]) { e.preventDefault(); onSelect(results[activeIdx].chef.id); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [results, activeIdx, onSelect]);

  useEffect(() => { setActiveIdx(0); }, [query]);

  return (
    <div className="palette-backdrop" onClick={onClose}>
      <div className="palette" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="输入姓名、拼音、菜系、拿手菜…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <div className="palette-results">
          {loading && <div className="palette-empty">加载中…</div>}
          {!loading && !query && <div className="palette-empty">开始打字搜索 · 按 ⬆⬇ 选择 · Enter 确认</div>}
          {!loading && query && results.length === 0 && <div className="palette-empty">未找到匹配结果</div>}
          {results.map((r, i) => (
            <div
              key={r.chef.id}
              className={`palette-item ${i === activeIdx ? 'active' : ''}`}
              onClick={() => onSelect(r.chef.id)}
              onMouseEnter={() => setActiveIdx(i)}
            >
              <AvatarMini chef={r.chef} />
              <div className="info">
                <div className="name">{r.chef.name}</div>
                <div className="sub">
                  {r.chef.position || r.chef.restaurant || r.chef.city || '—'}
                </div>
              </div>
              {r.chef.cuisine && <span className="cuisine-tag">{r.chef.cuisine}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AvatarMini({ chef }: { chef: Chef }) {
  if (chef.portrait) {
    return (
      <div className="avatar">
        <img src={chef.portrait} alt="" loading="lazy"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
      </div>
    );
  }
  return <div className="avatar"><div className="avatar-fallback">{chef.name.slice(0, 1)}</div></div>;
}
