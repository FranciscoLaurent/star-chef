import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../lib/useData';
import ChefProfile from '../components/ChefProfile';

export default function ChefDetailPage() {
  const { id } = useParams();
  const { data, loading } = useData();
  const nav = useNavigate();
  const chef = useMemo(() => data && id ? data.chefs.find(c => c.id === id) : null, [data, id]);

  if (loading) return <div className="loading" style={{ padding: '80px var(--gutter)' }}>载入厨师档案…</div>;

  if (!chef) {
    return (
      <div style={{ padding: 120, textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 28, marginBottom: 12 }}>未找到这位厨师</h1>
        <p style={{ color: 'var(--dust)', fontFamily: 'var(--mono)', fontSize: 12, marginBottom: 24 }}>ID: {id}</p>
        <button className="btn-primary" onClick={() => nav('/lineage')}>返回师承谱</button>
      </div>
    );
  }

  return (
    <div className="lineage-wrap page-enter" style={{ paddingTop: 36 }}>
      <div className="lineage-head" style={{ justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}>
        <button className="ex-btn" onClick={() => nav('/lineage')}>← 返回师承谱</button>
        <span className="hint-line">CHEF · PROFILE · /chef/{chef.id}</span>
      </div>

      <div className="chef-page-shell">
        <ChefProfile
          variant="page"
          chef={chef}
          data={data!}
          onSelect={nextId => nav(`/chef/${nextId}`)}
        />
      </div>
    </div>
  );
}
