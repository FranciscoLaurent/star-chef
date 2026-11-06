import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../lib/useData';
import { usePageReveal } from '../lib/motion';

export default function HomePage() {
  const { data, loading } = useData();
  usePageReveal();

  const meta = data?.meta;

  // 首页面孔墙：真实档案里带照片的 6 位，按代际与菜系间隔取样，保证视觉多样
  const faces = useMemo(() => {
    if (!data) return [];
    const withPhoto = data.chefs.filter(c => c.portrait && !c.derived && c.cuisine);
    if (withPhoto.length <= 6) return withPhoto;
    const step = Math.floor(withPhoto.length / 6);
    return Array.from({ length: 6 }, (_, i) => withPhoto[i * step]);
  }, [data]);

  return (
    <>
      <section className="hero" aria-label="Introduction">
        <div className="hero-meta">
          <div>平台愿景 <span>让手艺被看见</span></div>
          <div>核心能力 <span>师承网络 · 智能匹配 · 就业机会</span></div>
          <div>平台定位 <span>厨师专属职业平台</span></div>
          <div>数据底座 <span>{meta ? `${meta.total.toLocaleString()} 位厨师 · ${meta.cuisines} 菜系` : '加载中…'}</span></div>
        </div>

        <h1 aria-label="记录一门手艺，连接一份工作">
          <span className="line l1"><span>记录一门手艺</span></span>
          <span className="line l2"><span>连接一份工作</span></span>
          <span className="line l3">
            <span>以师承为信用<span className="amp">，</span><span className="punct" aria-hidden="true" /></span>
          </span>
        </h1>

        <div className="seal-tag" aria-hidden="true">
          <svg viewBox="0 0 200 200">
            <defs>
              <path id="circ" d="M 100,100 m -82,0 a 82,82 0 1,1 164,0 a 82,82 0 1,1 -164,0" />
            </defs>
            <text>
              <textPath href="#circ">星厨传承 · 师门为信 · 手艺有出路 · </textPath>
            </text>
          </svg>
          <div>
            <div className="y">师承<br />为信</div>
            <div className="t">Est · 2026</div>
          </div>
        </div>

        <div className="hero-grid">
          <p className="hero-lead reveal">
            星厨传承为两千万中国厨师建立一个<b>以师承关系为信任网络</b>的职业平台。
            <em>数字师承谱</em>记录手艺出处，<em>智能招聘匹配</em>创造真实就业机会。
          </p>
          <div className="hero-side reveal">
            <p>
              在餐饮行业，"你是谁带的"往往比"你在哪里干过"更重要。我们把这套流传百年的行业信任规则数字化，
              让每一份手艺都被看见，让每一位厨师都有出路。
            </p>
            <div>
              <div className="signature">手艺的尊严，<small>从被记录开始</small></div>
            </div>
          </div>
        </div>

        <div className="hero-cta-group" style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 32, flexWrap: 'wrap' }}>
          <Link className="cta" to="/lineage">进入师承谱 <span className="arrow">→</span></Link>
          <Link className="cta" to="/assistant">AI 帮我写简历 <span className="arrow">→</span></Link>
        </div>
      </section>

      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[0, 1].map(k => (
            <span key={k}>
              川菜 <span className="star">✺</span> 粤菜 <span className="star">✺</span> 鲁菜 <span className="star">✺</span>
              淮扬菜 <span className="star">✺</span> 湘菜 <span className="star">✺</span> 徽菜 <span className="star">✺</span>
              浙菜 <span className="star">✺</span> 闽菜 <span className="star">✺</span> 苏菜 <span className="star">✺</span>
              京菜 <span className="star">✺</span> 沪菜 <span className="star">✺</span>
            </span>
          ))}
        </div>
      </div>

      <section className="faces" aria-label="Archived chefs">
        <div className="section-head">
          <div className="num">§ 01</div>
          <h2>谱上的<br /><em>面孔</em>。</h2>
          <div className="right">来自真实公开档案<br />点开任一位，读出他的出处</div>
        </div>
        <div className="faces-grid reveal-stagger">
          {faces.map(c => (
            <Link key={c.id} to={`/chef/${c.id}`} className="face-card">
              <div className="face-photo">
                <img src={c.portrait!} alt="" loading="lazy"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                <span>{c.name.slice(0, 1)}</span>
              </div>
              <div className="face-name">{c.name}</div>
              <div className="face-meta">
                {[c.cuisine ? `${c.cuisine}菜` : null, c.city, c.gen != null ? `第 ${c.gen} 代` : null].filter(Boolean).join(' · ')}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="index" aria-label="Platform feature index">
        <div className="section-head">
          <div className="num">§ 02</div>
          <h2>平台能力<br /><em>索引</em>。</h2>
          <div className="right">六大模块 · 三条主线<br />传承 / 招聘 / 社区</div>
        </div>

        <ol className="index-list reveal-stagger" aria-label="Feature index">
          <FeatureRow ix="01 / 06" to="/lineage" name={<span>数字<em>师承谱</em> <span className="tag">核心</span></span>} meta="传承主线"
            desc="可视化师承谱，记录师从关系、门第归属、拿手菜系，追溯手艺源流。" />
          <FeatureRow ix="02 / 06" to="/jobs" name={<span>智能<em>招聘匹配</em> <span className="tag">核心</span></span>} meta="招聘主线"
            desc="基于师承、菜系、地域、薪资为厨师与雇主双向推荐最匹配的机会。" />
          <FeatureRow ix="03 / 06" to="/community" name={<span>厨师<em>交流社区</em></span>} meta="社交主线"
            desc="按菜系、地域、师门形成圈子，同行切磋、师傅招徒、学徒拜师。" />
          <FeatureRow ix="04 / 06" to="/assistant" name={<span>AI <em>求职助手</em></span>} meta="AI 能力"
            desc="厨师用大白话描述经历，AI 自动生成规范求职档案，降低表达门槛。" />
          <FeatureRow ix="05 / 06" to="/jobs" name={<span>师门<em>信用认证</em></span>} meta="信任机制"
            desc="师傅认证徒弟、同行交叉背书，AI 校验异常师承声明。" />
          <FeatureRow ix="06 / 06" to="/jobs" name={<span>雇主<em>人才库</em></span>} meta="B 端服务"
            desc="酒店与餐厅可按门第派系精准筛选，直接触达可信赖的厨师网络。" />
        </ol>
      </section>

      <section className="stats" aria-label="Data">
        <div className="section-head">
          <div className="num">§ 03</div>
          <h2>真实的<br /><em>数据底座</em>。</h2>
          <div className="right">数据来源：公开可溯源的行业资料<br />持续纠错补全中</div>
        </div>
        {loading ? (
          <div className="loading" style={{ color: 'rgba(237,232,219,.6)' }}>正在载入厨师档案…</div>
        ) : (
          <div className="stats-grid">
            <div className="stat-item">
              <div className="number">{meta?.total.toLocaleString()}</div>
              <span className="label">已收录厨师档案</span>
              <div className="note">去重后的真实人物条目，覆盖全国主要菜系。</div>
            </div>
            <div className="stat-item">
              <div className="number">{meta?.withMaster}</div>
              <span className="label">有师承记录</span>
              <div className="note">可追溯到具体师傅的师徒关系，构成谱系主干。</div>
            </div>
            <div className="stat-item">
              <div className="number">{meta?.cuisines}</div>
              <span className="label">覆盖菜系</span>
              <div className="note">从川粤鲁淮扬到清真、素菜、宫廷菜等细分门类。</div>
            </div>
            <div className="stat-item">
              <div className="number">{meta?.withPortrait}</div>
              <span className="label">有照片档案</span>
              <div className="note">可核查的公开照片，缺失时以姓氏钢印占位。</div>
            </div>
          </div>
        )}
      </section>

      <section className="cta-section">
        <div className="section-head">
          <div className="num">§ 04</div>
          <h2>现在，<br />去<em>看见</em>一张谱。</h2>
          <div className="right">{meta ? `${meta.total.toLocaleString()} 位厨师 · ${meta.schools} 个门第` : '真实档案'}<br />任选一位，读懂他的出处</div>
        </div>
        <div className="cta-actions" style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link className="btn-primary" to="/lineage">打开数字师承谱 <span className="arrow">→</span></Link>
          <Link className="cta" to="/jobs">看招聘匹配 <span className="arrow">→</span></Link>
        </div>
      </section>
    </>
  );
}

function FeatureRow({ ix, to, name, meta, desc }: {
  ix: string; to: string; name: React.ReactNode; meta: string; desc: string;
}) {
  return (
    <li>
      <Link to={to} className="ix-link">
        <span className="ix">{ix}</span>
        <span className="name">{name}</span>
        <span className="meta">{meta}</span>
        <span className="desc">{desc}</span>
        <span className="go" aria-hidden="true">→</span>
      </Link>
    </li>
  );
}
