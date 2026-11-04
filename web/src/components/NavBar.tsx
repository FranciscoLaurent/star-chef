import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import CommandPalette from './CommandPalette';
import { useData } from '../lib/useData';

const MENU = [
  { n: '01', to: '/', label: '首页', end: true },
  { n: '02', to: '/lineage', label: '师承谱' },
  { n: '03', to: '/jobs', label: '招聘匹配' },
  { n: '04', to: '/assistant', label: 'AI 求职助手' },
  { n: '05', to: '/community', label: '社区' },
];

export default function NavBar() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const nav = useNavigate();
  const { data } = useData();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if (e.key === 'Escape') { setPaletteOpen(false); setMenuOpen(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      <div className="statusbar">
        <div className="col">
          <span><span className="dot" />LIVE · 数据在线</span>
          <span>{data ? data.meta.total.toLocaleString() : '—'} 位厨师档案</span>
        </div>
        <div className="col center">星厨传承 · EDITION 01</div>
        <div className="col right">
          <span>{data ? data.meta.cuisines : '—'} 菜系</span>
          <span>{data ? data.meta.schools : '—'} 门派</span>
          <span>{data ? data.meta.withMaster : '—'} 有师承</span>
        </div>
      </div>

      <header>
        <nav className="nav">
          <Link to="/" className="wordmark">
            <span className="mark" aria-hidden="true" />
            <span>星厨<em>传承</em></span>
          </Link>

          <div className="menu">
            {MENU.map(m => (
              <NavLink key={m.to} to={m.to} end={m.end}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <span className="n">{m.n}</span>{m.label}
              </NavLink>
            ))}
          </div>

          <div className="nav-end">
            <button className="nav-search" onClick={() => setPaletteOpen(true)} aria-label="搜索">
              <span>搜索厨师 / 门派 / 拿手菜</span>
              <span className="nav-kbd">⌘K</span>
            </button>
            <button className="mobile-menu-btn" onClick={() => setMenuOpen(v => !v)} aria-label="菜单">
              <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{menuOpen ? '×' : '≡'}</span>
            </button>
          </div>
        </nav>
      </header>

      {menuOpen && (
        <div className="mobile-menu">
          <button className="close" onClick={() => setMenuOpen(false)} aria-label="关闭">×</button>
          {MENU.map(m => (
            <Link key={m.to} to={m.to} onClick={() => setMenuOpen(false)}>
              <span className="n">{m.n}</span>{m.label}
            </Link>
          ))}
        </div>
      )}

      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          onSelect={(chefId) => {
            setPaletteOpen(false);
            nav(`/chef/${chefId}`);
          }}
        />
      )}
    </>
  );
}
