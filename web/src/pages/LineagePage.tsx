import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../lib/useData';
import { buildFamilies, groupByGen } from '../lib/lineage';
import ChefProfile from '../components/ChefProfile';
import { swapFade, useStaggerIn } from '../lib/motion';

const GEN_LATIN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const GEN_CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

export default function LineagePage() {
  const { data, loading, error } = useData();
  const [familyKey, setFamilyKey] = useState<string | null>(
    () => { try { return sessionStorage.getItem('lineage:family'); } catch { return null; } }
  );
  const [schoolFilter, setSchoolFilter] = useState<string | null>(
    () => { try { return sessionStorage.getItem('lineage:school'); } catch { return null; } }
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  const families = useMemo(() => data ? buildFamilies(data) : [], [data]);

  // 默认选中人数最多的"真实门第"（跳过未分类）
  useEffect(() => {
    if (!familyKey && families.length) {
      const first = families.find(f => f.key !== '__others__') || families[0];
      setFamilyKey(first.key);
    }
  }, [families, familyKey]);

  const family = families.find(f => f.key === familyKey) || families[0];

  const familyChefs = useMemo(() => {
    if (!data || !family) return [];
    if (family.key === '__others__') return data.chefs.filter(c => !c.cuisine);
    if (family.key.startsWith('cuisine:')) {
      const cuisine = family.key.split(':')[1];
      // 同一菜系下的所有厨师（含已归门派的），避免"某个门派的人被排除在外"
      return data.chefs.filter(c => c.cuisine === cuisine);
    }
    return data.chefs.filter(c => c.school === family.key);
  }, [data, family]);

  // 菜系内部再按门派细分（作为筛选 chips）
  const schoolsInFamily = useMemo(() => {
    const m = new Map<string, number>();
    let unschooled = 0;
    familyChefs.forEach(c => {
      if (c.school) m.set(c.school, (m.get(c.school) || 0) + 1);
      else unschooled++;
    });
    const list = [...m.entries()]
      .map(([k, n]) => ({
        key: k,
        name: (data?.schools.find(s => s.key === k)?.subName) || (data?.schools.find(s => s.key === k)?.name) || k,
        count: n,
      }))
      .sort((a, b) => b.count - a.count);
    return { list, unschooled };
  }, [familyChefs, data]);

  const filtered = useMemo(() => {
    if (!schoolFilter) return familyChefs;
    if (schoolFilter === '__none__') return familyChefs.filter(c => !c.school);
    return familyChefs.filter(c => c.school === schoolFilter);
  }, [familyChefs, schoolFilter]);

  const genGroups = useMemo(
    () => data && filtered.length ? groupByGen(filtered) : [],
    [data, filtered]
  );

  // 切换家派时重置筛选
  useEffect(() => { setSelectedId(null); setSchoolFilter(null); }, [familyKey]);

  // 记住筛选状态：从 /chef/:id 返回师承谱时仍停在原家派
  useEffect(() => {
    try {
      if (familyKey) sessionStorage.setItem('lineage:family', familyKey);
      if (schoolFilter) sessionStorage.setItem('lineage:school', schoolFilter);
      else sessionStorage.removeItem('lineage:school');
    } catch { /* ignore */ }
  }, [familyKey, schoolFilter]);

  // 打开人物：面板切换 + 地址栏同步为 /chef/:id（可复制分享、刷新直达）
  const openChef = (id: string) => {
    setSelectedId(id);
    swapFade(document.querySelector('.ped-detail'));
    const path = `/chef/${id}`;
    if (window.location.pathname !== path) {
      window.history.pushState({ chefPreview: id }, '', path);
    }
  };

  // 浏览器后退：离开 /chef/:id 时收起人物聚焦
  useEffect(() => {
    const onPop = () => {
      if (!/^\/chef\//.test(window.location.pathname)) setSelectedId(null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const selected = useMemo(() => {
    if (!data) return null;
    const byId = selectedId ? data.chefs.find(c => c.id === selectedId) : null;
    return byId || (familyChefs[0] ?? null);
  }, [data, selectedId, familyChefs]);

  useStaggerIn('.gen-row .person-card', [filtered.length, familyKey]);

  if (loading) return <div className="lineage-wrap"><div className="loading" style={{ paddingTop: 80 }}>正在绘制宗谱…</div></div>;
  if (error || !data) return <div className="lineage-wrap"><div className="loading" style={{ paddingTop: 80 }}>数据加载失败：{error?.message || '未知错误'}</div></div>;

  const maxGen = Math.max(0, ...familyChefs.map(c => c.gen ?? 0));

  return (
    <div className="lineage-wrap page-enter">
      <div className="lineage-hero">
        <h2>数字<em>师承谱</em></h2>
        <p>以古籍宗谱的形式记录每一位厨师的师承代际。左栏选家派、中栏看谱系、右栏读人物——这是属于灶台的"族谱"。</p>
        <div className="seal">宗谱 · 师门 · 传承</div>
      </div>

      <div className="lineage-stats">
        <div className="ls-item">
          <span className="ls-num">{data.meta.total.toLocaleString()}</span>
          <span className="ls-label">已收录厨师</span>
          <span className="ls-desc">覆盖 {data.meta.cuisines} 个菜系门类</span>
        </div>
        <div className="ls-item">
          <span className="ls-num">{data.meta.withMaster.toLocaleString()}</span>
          <span className="ls-label">师承关系可追溯</span>
          <span className="ls-desc">占比 {Math.round(data.meta.withMaster / data.meta.total * 100)}%</span>
        </div>
        <div className="ls-item">
          <span className="ls-num">{data.meta.schools}</span>
          <span className="ls-label">成体系门第</span>
          <span className="ls-desc">另有 {data.meta.cuisines} 个菜系分组可浏览</span>
        </div>
      </div>

      <div className="lineage-head">
        <div className="lineage-filter">
          <span className="lf-label">门派：</span>
          <div className="lf-chips">
            <button className={`cu-chip ${schoolFilter === null ? 'active' : ''}`} onClick={() => setSchoolFilter(null)}>全部</button>
            {schoolsInFamily.list.map(s => (
              <button key={s.key} className={`cu-chip ${schoolFilter === s.key ? 'active' : ''}`} onClick={() => setSchoolFilter(s.key)}>
                {s.name} <span style={{ opacity: .55, marginLeft: 4 }}>{s.count}</span>
              </button>
            ))}
            {schoolsInFamily.unschooled > 0 && (
              <button className={`cu-chip ${schoolFilter === '__none__' ? 'active' : ''}`} onClick={() => setSchoolFilter('__none__')}>
                未归门派 <span style={{ opacity: .55, marginLeft: 4 }}>{schoolsInFamily.unschooled}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="lineage-3col">
        {/* 左栏：家派目录 */}
        <aside className="ped-families">
          <h6>家派目录 · FAMILIES</h6>
          {families.map(f => (
            <div key={f.key} className={`fam-row ${f.key === family?.key ? 'active' : ''}`} onClick={() => setFamilyKey(f.key)}>
              <div className="fam-stamp">{f.stamp || f.label.slice(0, 1)}</div>
              <div className="fam-name">
                {f.label}
                <span>{f.masterCount} 位师傅 · {f.chefCount} 人</span>
              </div>
              <div className="fam-meta"><strong>{f.topMasters[0]?.disciples ?? 0}</strong>徒</div>
            </div>
          ))}
          <div className="ped-fam-foot">点选家派切换中栏宗谱</div>
        </aside>

        {/* 中栏：宗谱 */}
        <main className="ped-main" ref={mainRef}>
          <div className="ped-title">
            <h3>{family?.label}<em>谱</em>
              <span className="hint-line" style={{ marginLeft: 12 }}>{family?.cuisine ? `${family.cuisine} CUISINE` : 'MIXED'}</span>
            </h3>
            <div className="ped-meta">
              <strong>{filtered.length}</strong>
              <span>{maxGen > 0 ? `共 ${maxGen} 代` : '代际待考'} · {family?.masterCount ?? 0} 位师傅</span>
            </div>
          </div>

          {filtered.length === 0 && (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--dust)', fontFamily: 'var(--serif)', fontStyle: 'italic' }}>
              当前筛选下无人物，请调整菜系。
            </div>
          )}

          {genGroups.map(g => (
            <div key={g.gen === null ? 'pending' : g.gen} className="gen-row">
              <div className="gen-label">
                {g.gen === null ? '?' : (GEN_LATIN[g.gen] || g.gen)}
                <small>{g.gen === null ? `代际待考 · ${g.chefs.length} 人` : `第${GEN_CN[g.gen] || g.gen}代 · GEN ${g.gen}`}</small>
              </div>
              <div className="gen-people">
                {g.chefs.map(c => (
                  <div key={c.id}
                    className={`person-card ${selected?.id === c.id ? 'active' : ''}`}
                    onClick={() => openChef(c.id)}>
                    <div className="pc-portrait">
                      {c.portrait && (
                        <img src={c.portrait} alt="" loading="lazy"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                      )}
                      <span>{c.name.slice(0, 1)}</span>
                    </div>
                    <div className="pc-info">
                      <strong>{c.name}</strong>
                      <span>{[c.position, c.city].filter(Boolean).join(' · ') || (c.cuisine ? `${c.cuisine}菜` : '—')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </main>

        {/* 右栏：人物详情 */}
        <aside className="ped-detail">
          {selected ? (
            <ChefProfile variant="drawer" chef={selected} data={data} onSelect={openChef} />
          ) : (
            <div className="pd-empty">
              <div className="hint-line" style={{ marginBottom: 14 }}>PERSON · DETAIL</div>
              <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--ink-soft)', lineHeight: 1.7 }}>
                点选中栏的任一厨师，<br />查看其师承链、招牌菜与履历。
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
