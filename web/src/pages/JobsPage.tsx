import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useData } from '../lib/useData';
import {
  JOBS, JOB_CITIES, matchBreakdown, matchFreeProfile, topChefsForJob, topJobsForChef, topDim,
  CUISINE_OPTIONS, YEAR_OPTIONS, TARGET_OPTIONS, EMP_YEAR_BUCKETS, inYearBucket,
  yearsLabel, titleHit,
  EMPTY_FORM, type FreeForm, type Job, type MatchResult,
} from '../lib/jobs';
import { getApiKey, getMode, callDeepSeek, explainPrompt, demoExplain } from '../lib/ai';
import type { Chef } from '../lib/types';
import { usePageReveal, useStaggerIn, swapFade } from '../lib/motion';

type Role = 'chef' | 'employer';

export default function JobsPage() {
  const { data, loading } = useData();
  const [role, setRole] = useState<Role>('chef');
  // 厨师侧：自由填写档案（不需要是库中人）
  const [form, setForm] = useState<FreeForm>(EMPTY_FORM);
  // 雇主侧：筛选条件 + 对比岗位 + 选中厨师
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [city, setCity] = useState('');
  const [yearsFilter, setYearsFilter] = useState('');
  const [jobId, setJobId] = useState('j01');
  const [chefId, setChefId] = useState('');
  const [aiOut, setAiOut] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiDemo, setAiDemo] = useState(false);
  const [notice, setNotice] = useState('');
  const detailRef = useRef<HTMLDivElement>(null);
  usePageReveal();

  // 姓名联想候选（仅作建议，不强制选择）
  const nameOptions = useMemo(() => {
    if (!data) return [];
    return data.chefs
      .filter(c => !c.derived && c.cuisine && c.city)
      .map(c => c.name);
  }, [data]);

  const hasAnyInfo = !!(form.cuisine || form.city || form.years);

  // 厨师侧：岗位列表 = 全部岗位按自由档案匹配度排序（无任何信息时保持原序、不显示分数）
  const jobList = useMemo(() => {
    return JOBS
      .map(j => ({ job: j, m: hasAnyInfo ? matchFreeProfile(form, j) : null }))
      .sort((a, b) => {
        if (a.m && b.m) {
          const d = b.m.total - a.m.total;
          if (d !== 0) return d;
          return Number(titleHit(form, b.job)) - Number(titleHit(form, a.job));
        }
        if (a.m || b.m) return a.m ? -1 : 1;
        return 0;
      });
  }, [form, hasAnyInfo]);

  // 雇主侧：厨师列表（菜系/城市/年限筛库，按与对比岗位的匹配度排序）
  const chefList = useMemo(() => {
    if (!data) return [];
    return data.chefs
      .filter(c => !c.derived && c.name && c.cuisine
        && (!cuisines.length || cuisines.includes(c.cuisine))
        && (!city || c.city === city)
        && inYearBucket(c, yearsFilter))
      .map(c => ({ chef: c, score: matchBreakdown(c, JOBS.find(j => j.id === jobId) || JOBS[0]).total }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 80);
  }, [data, cuisines, city, yearsFilter, jobId]);

  const selectedJob = useMemo(() => jobList.find(x => x.job.id === jobId) || jobList[0] || null, [jobList, jobId]);
  const selectedChefRow = useMemo(() => chefList.find(x => x.chef.id === chefId) || chefList[0] || null, [chefList, chefId]);

  const activeJob: Job = role === 'chef' ? (selectedJob?.job || JOBS[0]) : (JOBS.find(j => j.id === jobId) || JOBS[0]);
  const activeChef: Chef | null = role === 'employer' ? (selectedChefRow?.chef || null) : null;

  // 厨师侧当前匹配（自由档案 × 选中岗位）
  const freeMatch = useMemo(
    () => (role === 'chef' && hasAnyInfo ? matchFreeProfile(form, activeJob) : null),
    [role, form, activeJob, hasAnyInfo]
  );
  // 雇主侧当前匹配（库中厨师 × 对比岗位）
  const empMatch: MatchResult | null = role === 'employer' && activeChef ? matchBreakdown(activeChef, activeJob) : null;

  const formKey = JSON.stringify(form);
  useStaggerIn('.jobs-list .job-card', [role, cuisines.join(','), city, yearsFilter, jobId, chefId, formKey]);

  // 切换岗位/厨师/表单时重播右栏动画 + 清空 AI 解释
  useEffect(() => {
    swapFade(detailRef.current);
    setAiOut('');
    setAiDemo(false);
  }, [role, jobId, chefId, formKey]);

  const toggleCuisine = (c: string) => {
    setCuisines(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  const switchRole = (r: Role) => {
    if (r === role) return;
    setRole(r);
    setAiOut('');
    setNotice('');
  };

  const setF = (patch: Partial<FreeForm>) => setForm(f => ({ ...f, ...patch }));

  // 姓名输入：纯自由文本；若恰好命中库中厨师则联想填充（可继续改）
  const onNameInput = (v: string) => {
    setF({ name: v });
    if (!data) return;
    const hit = data.chefs.find(c => !c.derived && c.name === v.trim());
    if (hit) {
      setForm(f => ({
        ...f,
        cuisine: hit.cuisine || f.cuisine,
        city: hit.city || f.city,
        signature: f.signature || hit.signatureDishes[0] || '',
      }));
    }
  };

  const fillDemo = () => setForm({
    name: '', cuisine: '川', years: '6-10', signature: '回锅肉、麻婆豆腐', target: '厨师长', city: '成都',
  });

  const runAiExplain = async () => {
    setAiBusy(true);
    setAiOut('');
    setAiDemo(false);

    // 厨师侧：基于自由填写内容；雇主侧：基于库中厨师档案
    let chefText = '';
    let score = 0;
    let top: { key: string; reason: string } = { key: '—', reason: '' };
    if (role === 'chef') {
      if (!freeMatch) { setAiBusy(false); return; }
      score = freeMatch.total;
      top = topDim(freeMatch);
      const parts = [
        `${form.name || '匿名厨师'}（库外自由档案）`,
        form.cuisine ? `${form.cuisine}菜` : '菜系未填',
        form.years ? `从业${yearsLabel(form.years)}` : '年限未填',
        form.signature ? `擅长${form.signature}` : '',
        form.target ? `目标岗位${form.target}` : '目标岗位不限',
        form.city ? `期望城市${form.city}` : '城市不限',
        freeMatch.missing.length ? `（未填：${freeMatch.missing.join('、')}，这些维度按 0 分计）` : '',
      ].filter(Boolean);
      chefText = parts.join('，');
    } else {
      if (!activeChef || !empMatch) { setAiBusy(false); return; }
      score = empMatch.total;
      top = topDim(empMatch);
      chefText = `${activeChef.name}，${activeChef.cuisine || ''}菜，师从${activeChef.master || '开派祖师'}，第 ${activeChef.gen ?? '?'} 代，现居${activeChef.city || '—'}，现任${activeChef.restaurant || '—'}${activeChef.position || ''}`;
    }
    const jobText = `${activeJob.restaurant}招${activeJob.cuisine}菜${activeJob.title}，薪资${activeJob.salary}，要求：${activeJob.requirements.join('、')}`;

    const key = getApiKey();
    if (!key) {
      setAiOut(demoExplain(top.key, top.reason, score));
      setAiDemo(true);
      setAiBusy(false);
      return;
    }

    try {
      const full = await callDeepSeek(explainPrompt(chefText, jobText, score), {
        apiKey: key,
        mode: getMode(),
        temperature: 0.5,
        stream: true,
        onToken: (_d, f) => setAiOut(f),
      });
      if (!full.trim()) throw new Error('空响应');
    } catch (e: any) {
      setAiOut(`AI 请求失败：${e?.message || e}。已切换为本地解释：${demoExplain(top.key, top.reason, score)}`);
      setAiDemo(true);
    } finally {
      setAiBusy(false);
    }
  };

  if (loading) return <div className="jobs-wrap"><div className="loading">载入中…</div></div>;

  const schoolName = (key?: string) => {
    if (!key || !data) return '';
    const s = data.schools.find(x => x.key === key);
    return s ? (s.subName || s.name) : '';
  };

  return (
    <div className="jobs-wrap page-enter">
      <div className="jobs-head">
        <div className="section-head">
          <div className="num">§ 03</div>
          <h2>智能<br /><em>招聘匹配</em>。</h2>
          <div className="right">菜系 40 · 师门 25 · 地域 20 · 薪资 15<br />岗位数据为演示数据</div>
        </div>
        <p className="hero-lead reveal" style={{ marginTop: 18 }}>
          基于师承、菜系、地域、薪资为<b>厨师与雇主双向推荐</b>最优匹配。厨师不必在库——随手填写，即刻匹配。
        </p>

        <div className="jobs-toggle">
          <button className={`jt-btn ${role === 'chef' ? 'active' : ''}`} onClick={() => switchRole('chef')}>我是厨师 · 找岗</button>
          <button className={`jt-btn ${role === 'employer' ? 'active' : ''}`} onClick={() => switchRole('employer')}>我是雇主 · 找人</button>
        </div>
      </div>

      <div className="jobs-grid">
        <aside className="jobs-filter">
          {role === 'chef' ? (
            <>
              <h5>你的信息<small className="jf-h5-sub">自由填写 · 不必在库</small></h5>
              <div className="jf-form">
                <label className="jf-field">
                  <span>姓名（可空）</span>
                  <input className="jf-input" list="chef-name-suggest" placeholder="匿名也可以"
                    value={form.name} onChange={e => onNameInput(e.target.value)} />
                  <datalist id="chef-name-suggest">
                    {nameOptions.map(n => <option key={n} value={n} />)}
                  </datalist>
                </label>
                <label className="jf-field">
                  <span>菜系</span>
                  <select className="jf-select" value={form.cuisine} onChange={e => setF({ cuisine: e.target.value })}>
                    <option value="">选择菜系</option>
                    {CUISINE_OPTIONS.map(c => <option key={c} value={c}>{c}菜</option>)}
                  </select>
                </label>
                <label className="jf-field">
                  <span>从业年限</span>
                  <select className="jf-select" value={form.years} onChange={e => setF({ years: e.target.value })}>
                    <option value="">选择年限</option>
                    {YEAR_OPTIONS.map(y => <option key={y} value={y}>{yearsLabel(y)}</option>)}
                  </select>
                </label>
                <label className="jf-field">
                  <span>擅长菜（可空）</span>
                  <input className="jf-input" placeholder="如：回锅肉" value={form.signature}
                    onChange={e => setF({ signature: e.target.value })} />
                </label>
                <label className="jf-field">
                  <span>目标岗位</span>
                  <select className="jf-select" value={form.target} onChange={e => setF({ target: e.target.value })}>
                    <option value="">不限岗位</option>
                    {TARGET_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label className="jf-field">
                  <span>期望城市</span>
                  <input className="jf-input" list="job-city-suggest" placeholder="如：成都"
                    value={form.city} onChange={e => setF({ city: e.target.value })} />
                  <datalist id="job-city-suggest">
                    {JOB_CITIES.map(c => <option key={c} value={c} />)}
                  </datalist>
                </label>
              </div>
              <button className="ex-btn jf-fill-demo" onClick={fillDemo}>填入示例，一键看效果</button>
              {!hasAnyInfo && (
                <div className="jf-missing">填任意一项（菜系 / 年限 / 城市）即开始计算匹配度</div>
              )}
            </>
          ) : (
            <>
              <h5>菜系</h5>
              <div>
                {CUISINE_OPTIONS.map(c => (
                  <span key={c} className={`jf-chip cuisine ${cuisines.includes(c) ? 'active' : ''}`}
                    onClick={() => toggleCuisine(c)}>{c}菜</span>
                ))}
              </div>

              <h5>地域</h5>
              <div>
                <span className={`jf-chip ${!city ? 'active' : ''}`} onClick={() => setCity('')}>全部</span>
                {JOB_CITIES.map(c => (
                  <span key={c} className={`jf-chip ${city === c ? 'active' : ''}`}
                    onClick={() => setCity(prev => prev === c ? '' : c)}>{c}</span>
                ))}
              </div>

              <h5>从业年限<small className="jf-h5-sub">按出生年估算</small></h5>
              <div>
                {EMP_YEAR_BUCKETS.map(b => (
                  <span key={b.key} className={`jf-chip ${yearsFilter === b.key ? 'active' : ''}`}
                    onClick={() => setYearsFilter(prev => prev === b.key && b.key ? '' : b.key)}>{b.label}</span>
                ))}
              </div>

              <h5>对比岗位</h5>
              <select className="jf-select" value={jobId} onChange={e => setJobId(e.target.value)}>
                {JOBS.map(j => (
                  <option key={j.id} value={j.id}>{j.city} · {j.restaurant} · {j.title}</option>
                ))}
              </select>
              <div className="jf-me">
                <div className="jf-me-name">{activeJob.restaurant}</div>
                <div className="jf-me-meta">{activeJob.cuisine}菜 · {activeJob.city} · {activeJob.salary}</div>
              </div>
            </>
          )}

          <div className="banner-warn" style={{ marginTop: 20, fontSize: 11.5 }}>
            岗位与薪资均为演示数据，用于展示匹配逻辑；厨师档案为真实公开资料。
          </div>
        </aside>

        <main>
          <div className="hint-line" style={{ marginBottom: 10 }}>
            {role === 'chef'
              ? (hasAnyInfo
                ? `${jobList.length} 个岗位 · 按与「${form.name || '匿名厨师'}」的匹配度排序`
                : `${jobList.length} 个岗位 · 填写左侧信息后开始匹配`)
              : `${chefList.length} 位厨师 · 按与「${activeJob.restaurant}」的匹配度排序${yearsFilter ? ' · 年限筛选已排除无出生年记录者' : ''}`}
          </div>
          <div className="jobs-list">
            {role === 'chef' && jobList.map(({ job: j, m }) => (
              <div key={j.id} className={`job-card ${activeJob.id === j.id ? 'active' : ''}`} onClick={() => setJobId(j.id)}>
                <div className="jc-top">
                  <div>
                    <div className="jc-title">{j.cuisine}菜 · {j.title}</div>
                    <div className="jc-meta">{j.restaurant} · {j.city} · {j.employerType}</div>
                  </div>
                  {m ? <div className="jc-match">{m.total}<span className="pct">%</span></div>
                     : <div className="jc-match jc-match-none">—</div>}
                </div>
                <div className="jc-salary">{j.salary}<span className="jc-tag tag-demo" style={{ marginLeft: 8 }}>演示岗位</span></div>
                <div className="jc-tags">
                  {titleHit(form, j) && <span className="jc-tag pref">正中目标岗位</span>}
                  {j.schoolPref && <span className="jc-tag pref">优先 {schoolName(j.schoolPref)}</span>}
                  {j.tags.map(t => <span key={t} className="jc-tag">{t}</span>)}
                </div>
              </div>
            ))}

            {role === 'employer' && chefList.length === 0 && <div className="loading" style={{ padding: '30px 0' }}>该筛选下暂无厨师</div>}
            {role === 'employer' && chefList.map(({ chef: c, score }) => (
              <div key={c.id} className={`job-card ${activeChef?.id === c.id ? 'active' : ''}`} onClick={() => setChefId(c.id)}>
                <div className="jc-top">
                  <div>
                    <div className="jc-title">{c.name} · {c.cuisine}菜</div>
                    <div className="jc-meta">{c.restaurant || '档案未录单位'} · {c.city || '—'} · {c.gen != null ? `第${c.gen}代` : '代际待考'}</div>
                  </div>
                  <div className="jc-match">{score}<span className="pct">%</span></div>
                </div>
                <div className="jc-salary">{c.position || '岗位未录'}</div>
                <div className="jc-tags">
                  {c.school && <span className="jc-tag">{schoolName(c.school)}</span>}
                  <span className="jc-tag">{c.verified === false ? '待认证' : '已收录'}</span>
                  {c.master && <span className="jc-tag">师从 {c.master}</span>}
                </div>
              </div>
            ))}
          </div>
        </main>

        <aside className="jobs-detail" ref={detailRef}>
          {role === 'chef' && (
            <>
              <div className="jd-h">{activeJob.cuisine}菜 · {activeJob.title}</div>
              <div className="jd-employer">{activeJob.restaurant} · {activeJob.city} · {activeJob.employerType}</div>
              <div className="jd-salary">{activeJob.salary}</div>
              {activeJob.schoolPref && (
                <div className="jd-pref">师门偏好：{schoolName(activeJob.schoolPref)} 优先</div>
              )}

              <div className="jd-section">
                <h6>匹配度拆解 · 与 {form.name || '匿名厨师'}</h6>
                {freeMatch ? (
                  <>
                    {freeMatch.missing.length > 0 && (
                      <div className="jf-missing" style={{ marginBottom: 12 }}>
                        缺 {freeMatch.missing.length} 项（{freeMatch.missing.join('、')}），这些维度按 0 分计，匹配精度会下降
                      </div>
                    )}
                    <MatchCard result={freeMatch} />
                  </>
                ) : (
                  <div className="jf-missing">尚未填写信息——左侧填任意一项，或点「填入示例，一键看效果」。</div>
                )}
              </div>

              <div className="jd-section">
                <h6>岗位描述</h6>
                <p className="jd-text">{activeJob.desc}</p>
              </div>

              <div className="jd-section">
                <h6>任职要求</h6>
                <ul className="jd-req">{activeJob.requirements.map(r => <li key={r}>{r}</li>)}</ul>
              </div>

              {data && (
                <div className="jd-section">
                  <h6>推荐匹配厨师</h6>
                  {topChefsForJob(activeJob, data.chefs, 3).map(({ chef: c, total }) => (
                    <div key={c.id} className="jd-match-row">
                      <div className="jdm-avatar">{c.name[0]}</div>
                      <div className="jdm-name">{c.name} · {c.position || `${c.cuisine}菜`}</div>
                      <div className="jdm-score">{total}%</div>
                    </div>
                  ))}
                  <AiExplain busy={aiBusy} out={aiOut} isDemo={aiDemo} onRun={runAiExplain}
                    disabled={!freeMatch} disabledHint="先填写左侧信息" />
                </div>
              )}

              <div className="jd-section">
                <button className="jd-primary" onClick={() => setNotice(`已以「${form.name || '匿名厨师'}」名义投递简历（演示）`)}>投递简历</button>
                {notice && <div className="jd-notice">{notice}</div>}
              </div>
            </>
          )}

          {role === 'employer' && activeChef && empMatch && (
            <>
              <div className="jd-h">{activeChef.name} · {activeChef.cuisine}菜</div>
              <div className="jd-employer">
                {activeChef.restaurant || '单位未录'} · {activeChef.city || '—'} · {activeChef.position || '岗位未录'}
                {activeChef.gen != null && <> · 第{activeChef.gen}代</>}
                {activeChef.school && <> · {schoolName(activeChef.school)}</>}
              </div>
              <div className="jd-salary">{activeChef.position || '厨师档案'}</div>

              <div className="jd-section">
                <h6>匹配度拆解 · 对应 {activeJob.restaurant}</h6>
                <MatchCard result={empMatch} />
              </div>

              <div className="jd-section">
                <h6>师承</h6>
                <p className="jd-text">{activeChef.master ? `师从 ${activeChef.master}` : '开派祖师 / 师承未录'}</p>
              </div>

              {activeChef.signatureDishes.length > 0 && (
                <div className="jd-section">
                  <h6>拿手菜</h6>
                  <div className="jd-dishes">
                    {activeChef.signatureDishes.map(d => <span key={d} className="ld-dish">{d}</span>)}
                  </div>
                </div>
              )}

              {activeChef.bio && (
                <div className="jd-section">
                  <h6>简介</h6>
                  <p className="jd-text">{activeChef.bio}</p>
                </div>
              )}

              <div className="jd-section">
                <h6>推荐匹配岗位</h6>
                {topJobsForChef(activeChef, 3).map(({ job: j, total }) => (
                  <div key={j.id} className="jd-match-row">
                    <div className="jdm-avatar">{j.cuisine[0]}</div>
                    <div className="jdm-name">{j.restaurant} · {j.title}</div>
                    <div className="jdm-score">{total}%</div>
                  </div>
                ))}
                <AiExplain busy={aiBusy} out={aiOut} isDemo={aiDemo} onRun={runAiExplain} />
              </div>

              <div className="jd-section">
                <button className="jd-primary" onClick={() => setNotice('已向厨师发出沟通请求（演示）')}>联系厨师</button>
                {notice && <div className="jd-notice">{notice}</div>}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function MatchCard({ result }: { result: MatchResult }) {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    setAnimate(false);
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, [result.total]);

  const top = topDim(result);

  return (
    <div className="match-bd">
      <div className="total">
        <div className="num">{result.total}<small>/100</small></div>
        <div><div className="lbl">综合匹配度</div></div>
        <div className="verdict">— {result.verdict}</div>
      </div>
      {result.dims.map(d => {
        const pct = d.max ? d.score / d.max : 0;
        return (
          <div key={d.key} className="dim">
            <div className="key">{d.key}<small>{d.en} · {d.max}</small></div>
            <div className={`bar ${d.score === 0 ? 'empty' : ''}`}>
              <i className={animate ? 'done' : ''} style={{ '--p': pct } as CSSProperties} />
            </div>
            <div className="v">{d.score}<em>/{d.max}</em></div>
          </div>
        );
      })}
      <div className="reason"><em>核心契合点：</em>{top.key} — {top.reason}</div>
    </div>
  );
}

function AiExplain({ busy, out, isDemo, onRun, disabled, disabledHint }: {
  busy: boolean; out: string; isDemo: boolean; onRun: () => void;
  disabled?: boolean; disabledHint?: string;
}) {
  return (
    <>
      <button className="jd-ai-btn" onClick={onRun} disabled={busy || disabled}
        title={disabled ? (disabledHint || '') : ''}>
        {busy ? 'AI 分析中…' : disabled ? `AI 解释（${disabledHint || '暂不可用'}）` : 'AI 解释为什么推荐 →'}
      </button>
      {(out || busy) && (
        <div className="jd-ai-out">
          {isDemo && <span className="jd-ai-tag">本地演示解释 · 未配置 Key</span>}
          {out}
          {busy && <span className="cursor">▍</span>}
        </div>
      )}
    </>
  );
}
