import type { Chef, WebData } from '../lib/types';
import { getMasterChef, getDisciples, getLineage } from '../lib/lineage';
import { formatLifeYears } from '../lib/format';

interface Props {
  chef: Chef;
  data: WebData;
  onClose: () => void;
  onSelect: (chefId: string) => void;
}

export default function ChefDrawer({ chef, data, onClose, onSelect }: Props) {
  const master = getMasterChef(chef, data);
  const disciples = getDisciples(chef, data);
  const lineage = getLineage(chef, data);

  const onChefClick = (id: string) => onSelect(id);

  return (
    <>
      <div className="chef-drawer-backdrop" onClick={onClose} />
      <aside className="chef-drawer">
        <div className="chef-drawer-header">
          <span className="eyebrow">厨师档案</span>
          <button className="chef-drawer-close" onClick={onClose} aria-label="关闭">×</button>
        </div>
        <div className="chef-drawer-body">
          {/* Hero */}
          <div className="chef-drawer-hero">
            <div className="chef-drawer-avatar">
              {chef.portrait ? (
                <img src={chef.portrait} alt="" loading="lazy"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).parentElement!.innerHTML = `<div class="chef-drawer-avatar-fallback">${chef.name.slice(0,1)}</div>`; }} />
              ) : (
                <div className="chef-drawer-avatar-fallback">{chef.name.slice(0, 1)}</div>
              )}
            </div>
            <div className="chef-drawer-info">
              <div className="name">{chef.name}</div>
              <div className="title">
                {[chef.position, chef.restaurant, chef.city].filter(Boolean).join(' · ') || '—'}
              </div>
              <div className="tags">
                {chef.cuisine && <span className="chef-tag cuisine">{chef.cuisine}菜</span>}
                {chef.era && <span className="chef-tag era">{chef.era}</span>}
                {chef.master && <span className="chef-tag master">师承 {chef.master}</span>}
                {formatLifeYears(chef.birthYear, chef.deathYear) && (
                  <span className="chef-tag">{formatLifeYears(chef.birthYear, chef.deathYear)}</span>
                )}
              </div>
            </div>
          </div>

          {/* 简介 */}
          {chef.bio && (
            <div className="chef-section">
              <div className="chef-section-title">档案</div>
              <p className="chef-bio">{chef.bio}</p>
            </div>
          )}

          {/* 师承链 */}
          {lineage.length > 0 && (
            <div className="chef-section">
              <div className="chef-section-title">师承链 · {lineage.length} 代</div>
              <div className="chef-lineage">
                {lineage.map((c, i) => (
                  <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {i > 0 && <span className="arrow">→</span>}
                    {c.id === chef.id ? (
                      <span className="self">{c.name}</span>
                    ) : (
                      <a onClick={() => onChefClick(c.id)}>{c.name}</a>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 师傅 */}
          {master && (
            <div className="chef-section">
              <div className="chef-section-title">师傅</div>
              <div className="chef-lineage">
                <a onClick={() => onChefClick(master.id)}>{master.name}</a>
                {master.cuisine && <span className="chef-tag cuisine" style={{ marginLeft: 10 }}>{master.cuisine}</span>}
              </div>
            </div>
          )}

          {/* 徒弟 */}
          {disciples.length > 0 && (
            <div className="chef-section">
              <div className="chef-section-title">徒弟 · {disciples.length} 人</div>
              <div className="disciples-grid">
                {disciples.map(d => (
                  <div key={d.id} className="disciple-chip" onClick={() => onChefClick(d.id)}>
                    {d.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 拿手菜 */}
          {chef.signatureDishes.length > 0 && (
            <div className="chef-section">
              <div className="chef-section-title">拿手菜</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {chef.signatureDishes.map(d => (
                  <span key={d} className="chef-tag" style={{ color: 'var(--ink-soft)' }}>{d}</span>
                ))}
              </div>
            </div>
          )}

          {/* 来源 */}
          {chef.source && (
            <div className="chef-section" style={{ marginTop: 32, opacity: .6 }}>
              <div className="chef-section-title">来源</div>
              <a href={chef.source} target="_blank" rel="noreferrer"
                 style={{ fontSize: 12, color: 'var(--ink-faint)', wordBreak: 'break-all' }}>
                {chef.source}
              </a>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
