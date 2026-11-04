import type { Chef, WebData } from '../lib/types';
import { getDisciples, getLineage, getMasterChef } from '../lib/lineage';
import { formatLifeYears } from '../lib/format';

interface Props {
  chef: Chef;
  data: WebData;
  onSelect: (chefId: string) => void;
  onClose?: () => void;
  /** drawer = 师承谱右栏 / page = /chef/:id 独立页 */
  variant?: 'drawer' | 'page';
}

/** 厨师档案面板 —— 头像作为视觉主体，师承 / 徒弟 / 拿手菜分区 */
export default function ChefProfile({ chef, data, onSelect, onClose, variant = 'drawer' }: Props) {
  const master = getMasterChef(chef, data);
  const disciples = getDisciples(chef, data);
  const chain = getLineage(chef, data);
  const school = data.schools.find(s => s.key === chef.school);

  // 师承链条渲染规则：
  // ① 无师傅且无徒弟 → 只给一句说明，不画任何节点（避免"自己给自己当师傅"）
  // ② 有徒弟但无师傅 → 以"开派"为根，再接本人与徒弟
  // ③ 有师傅 → 师傅链 → 本人 → 徒弟
  const hasMaster = !!chef.master;
  const hasDisciples = disciples.length > 0;
  const hasLineage = hasMaster || hasDisciples;

  const flow: { key: string; label: string; kind: 'root' | 'ancestor' | 'self' | 'disciple'; id?: string }[] = [];
  if (hasLineage) {
    if (!hasMaster && hasDisciples) flow.push({ key: '__root__', label: '开派', kind: 'root' });
    if (hasMaster && !master) flow.push({ key: 'master-missing', label: chef.master!, kind: 'ancestor' });
    for (const p of chain) {
      flow.push({ key: p.id, label: p.name, kind: p.id === chef.id ? 'self' : 'ancestor', id: p.id });
    }
    for (const d of disciples) flow.push({ key: d.id, label: d.name, kind: 'disciple', id: d.id });
  }

  const cuisineLine = [
    chef.cuisine ? `${chef.cuisine}菜` : '菜系未标注',
    chef.gen !== null && chef.gen !== undefined ? `第 ${chef.gen} 代` : null,
    school ? (school.subName || school.name) : null,
  ].filter(Boolean).join(' · ');

  const years = formatLifeYears(chef.birthYear, chef.deathYear);

  return (
    <div className={`chef-profile chef-profile-${variant}`} data-variant={variant}>
      {onClose && (
        <button className="drawer-close" onClick={onClose} aria-label="关闭">×</button>
      )}

      <div className="cp-hero">
        <div className="cp-avatar">
          {chef.portrait && (
            <img src={chef.portrait} alt="" loading="lazy"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          )}
          <span>{chef.name.slice(0, 1)}</span>
        </div>

        <div className="cp-ident">
          <div className="cp-kicker">
            {chef.school ? '门第档案' : '独立厨师档案'}
            {chef.derived ? ' · 档案待补' : ''}
          </div>
          <h1 className="cp-name">{chef.name}</h1>

          <div className="cp-lines">
            <div className="cp-line">{cuisineLine}</div>
            {(chef.position || chef.restaurant) && (
              <div className="cp-line">{[chef.position, chef.restaurant].filter(Boolean).join(' · ')}</div>
            )}
            {(chef.city || chef.birthplace) && (
              <div className="cp-line">{[chef.city, chef.birthplace].filter(Boolean).join(' · ')}</div>
            )}
            {years && <div className="cp-line">{years}</div>}
          </div>

          <div className="cp-badges">
            {chef.derived && <span className="ld-tag warn">据简介推断 · 待核实</span>}
            {chef.master && <span className="ld-tag">师承 {chef.master}</span>}
            {chef.gen == null && <span className="ld-tag">代际待考</span>}
          </div>
        </div>
      </div>

      <div className="cp-body">
        <div className="ld-section">
          <h6>
            师承脉络
            {chef.inferred && <span className="hint-line" style={{ marginLeft: 8, color: 'var(--vermillion)' }}>据简介推断 · 待核实</span>}
          </h6>

          {!hasLineage && (
            <div className="ld-main">暂无可考证的师承记录，既无师傅，也无徒弟。</div>
          )}

          {hasLineage && (
            <>
              <div className="ld-main">
                {!hasMaster
                  ? `开派 · 门下 ${disciples.length} 人；上游师承未见记载。`
                  : `师承 ${Math.max(chain.length - 1, 1)} 代，可上溯至 ${chain[0]?.name || chef.master}${disciples.length ? `；门下 ${disciples.length} 人。` : '。'}`}
              </div>
              <div className="ld-flow">
                {flow.map((n, i) => (
                  <span key={n.key} className="ld-flow-item">
                    {i > 0 && <span className="flow-arrow">→</span>}
                    {n.kind === 'root' ? (
                      <span className="ld-node root">开派<em>未见师承记载</em></span>
                    ) : n.kind === 'self' ? (
                      <span className="ld-node self">{n.label}</span>
                    ) : n.id ? (
                      <a className={`ld-node ${n.kind}`} onClick={() => onSelect(n.id!)}>{n.label}</a>
                    ) : (
                      <span className={`ld-node ${n.kind}`}>{n.label}<em>档案待补</em></span>
                    )}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {master && (
          <div className="ld-section">
            <h6>师傅</h6>
            <div className="ld-main">
              <a style={{ cursor: 'pointer' }} onClick={() => onSelect(master.id)}>{master.name}</a>
              {master.derived && <span className="hint-line" style={{ marginLeft: 8, color: 'var(--vermillion)' }}>档案待补 · 待核实</span>}
            </div>
            {master.position && <div className="ld-sub">{master.position}{master.city ? ` · ${master.city}` : ''}</div>}
          </div>
        )}

        {disciples.length > 0 && (
          <div className="ld-section">
            <h6>门下徒弟 · {disciples.length} 人</h6>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {disciples.map(d => (
                <span key={d.id} className="ld-dish" style={{ cursor: 'pointer' }} onClick={() => onSelect(d.id)}>
                  {d.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {chef.signatureDishes.length > 0 && (
          <div className="ld-section">
            <h6>拿手菜</h6>
            <div className="ld-dishes">
              {chef.signatureDishes.map(d => <span key={d} className="ld-dish">{d}</span>)}
            </div>
          </div>
        )}

        {chef.bio && (
          <div className="ld-section">
            <h6>档案</h6>
            <div className="ld-bio">{chef.bio}</div>
          </div>
        )}

        {chef.titles.length > 0 && (
          <div className="ld-section">
            <h6>称号</h6>
            <div className="ld-dishes">
              {chef.titles.map(t => <span key={t} className="ld-dish">{t}</span>)}
            </div>
          </div>
        )}

        <div className="ld-section">
          <h6>来源 · SOURCE</h6>
          {chef.sourceUrl ? (
            <a className="ld-src" href={chef.sourceUrl} target="_blank" rel="noopener noreferrer">
              查看来源 · {chef.sourceSite || '原始网页'} ↗
              <span className="ld-src-url">{chef.sourceUrl.replace(/^https?:\/\//, '')}</span>
            </a>
          ) : chef.sourceSite ? (
            <div className="ld-sub">{chef.sourceSite} · 原始页面未记录</div>
          ) : (
            <div className="ld-sub">来源未知</div>
          )}
        </div>
      </div>
    </div>
  );
}
