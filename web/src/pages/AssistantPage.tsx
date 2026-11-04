import { useEffect, useRef, useState } from 'react';
import {
  demoExtract, extractResume, getApiKey, getMode, setApiKey, setMode,
  type AiMode, type ResumeProfile,
} from '../lib/ai';
import { usePageReveal } from '../lib/motion';

const EXAMPLES: Record<string, { label: string; text: string }> = {
  chuan: {
    label: '川菜师傅',
    text: '我叫张德海，今年 42，川菜师傅，从 18 岁跟着成都锦江春的陈师傅学炒锅，干了 24 年，会 80 多道川菜，拿过四川省烹饪大赛金奖，现在想找成都或重庆的酒店炒锅或厨师长位置，工资期望 18-25K。',
  },
  yue: {
    label: '粤菜师傅',
    text: '我叫梁润根，38 岁，粤菜师傅，广州人，15 岁入行跟香港师傅学粤菜，会做白切鸡、烧鹅、各式点心，在深圳干了 10 年，想回广州找个厨师长岗位，薪资 20-30K。',
  },
  huai: {
    label: '淮扬师傅',
    text: '我叫周慕白，55 岁，淮扬菜老师傅，扬州人，30 年淮扬功夫，刀工见长，文思豆腐、大煮干丝是拿手绝活，带过 20 多个徒弟，现在想找个高级酒店的淮扬菜顾问或行政总厨岗位，地域不限，薪资 30K 以上。',
  },
};

const CUISINES = ['川', '粤', '鲁', '淮扬', '湘', '浙', '徽', '闽', '京', '沪'];

export default function AssistantPage() {
  usePageReveal();

  const [text, setText] = useState('');
  const [profile, setProfile] = useState<ResumeProfile | null>(null);
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [recording, setRecording] = useState(false);
  const [voiceHint, setVoiceHint] = useState('');
  const [quick, setQuick] = useState<'idle' | 'typing' | 'generating'>('idle');
  const [showSettings, setShowSettings] = useState(false);
  const [key, setKey] = useState('');
  const [mode, setModeState] = useState<AiMode>('proxy');

  const taRef = useRef<HTMLTextAreaElement>(null);
  const textRef = useRef('');
  const recRef = useRef<any>(null);
  const abortRef = useRef<AbortController | null>(null);
  const typeTimer = useRef<number | null>(null);
  const noticeTimer = useRef<number | null>(null);

  useEffect(() => { setKey(getApiKey()); setModeState(getMode()); }, []);
  useEffect(() => { textRef.current = text; }, [text]);
  useEffect(() => () => {
    if (typeTimer.current) window.clearInterval(typeTimer.current);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    recRef.current?.stop?.();
    abortRef.current?.abort();
  }, []);

  const flash = (msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(''), 2600);
  };

  const run = async (input?: string) => {
    const source = (input ?? textRef.current).trim();
    if (!source) { flash('请先用一句大白话描述您的经历'); return; }

    setErr(''); setNotice(''); setBusy(true); setRaw(''); setProfile(null); setIsDemo(false);

    const effectiveKey = getApiKey().trim();

    // 无 Key：本地规则解析，仍然是完整档案（验收时不会空白）
    if (!effectiveKey) {
      await new Promise(r => window.setTimeout(r, 320));
      setProfile(demoExtract(source));
      setIsDemo(true);
      setBusy(false);
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const { profile: p } = await extractResume(source, {
        apiKey: effectiveKey,
        mode: getMode(),
        signal: ctrl.signal,
        onToken: (_d, full) => setRaw(full),
      });
      setProfile(p);
      setRaw('');
    } catch (e: any) {
      const msg = String(e?.message || e);
      setErr(
        msg.includes('Failed to fetch') || msg.includes('NetworkError')
          ? `请求失败：${msg}。若为跨域问题，请通过 dev server（proxy 模式）访问；也可在设置里切换为「浏览器直连」。`
          : `调用失败：${msg}`
      );
      setProfile(demoExtract(source));
      setIsDemo(true);
      setRaw('');
    } finally {
      setBusy(false);
    }
  };

  const startQuickDemo = async () => {
    if (quick !== 'idle' || busy) return;
    const keys = Object.keys(EXAMPLES);
    const chosen = EXAMPLES[keys[Math.floor(Math.random() * keys.length)]];
    setQuick('typing');
    setText('');
    textRef.current = '';
    setProfile(null);
    setErr('');

    // 逐字渐进填充，模拟"用户口述完成"的过程
    let i = 0;
    await new Promise<void>(resolve => {
      if (typeTimer.current) window.clearInterval(typeTimer.current);
      typeTimer.current = window.setInterval(() => {
        i += 1;
        const next = chosen.text.slice(0, i);
        setText(next);
        textRef.current = next;
        if (i % 8 === 0 && taRef.current) taRef.current.scrollTop = taRef.current.scrollHeight;
        if (i >= chosen.text.length) {
          if (typeTimer.current) window.clearInterval(typeTimer.current);
          typeTimer.current = null;
          resolve();
        }
      }, 16);
    });

    setQuick('generating');
    await new Promise(r => window.setTimeout(r, 320));
    await run(chosen.text);
    setQuick('idle');
  };

  const toggleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setVoiceHint('当前浏览器不支持语音输入，可直接手动输入文字。建议使用 Chrome / Edge。');
      return;
    }
    if (recording) { recRef.current?.stop?.(); return; }

    const rec = new SR();
    rec.lang = 'zh-CN';
    rec.continuous = true;
    rec.interimResults = true;

    let base = textRef.current;
    rec.onstart = () => { setRecording(true); setVoiceHint('正在聆听… 说完后点「停止录音」，文字可继续编辑。'); };
    rec.onend = () => { setRecording(false); recRef.current = null; };
    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) base += r[0].transcript;
        else interim += r[0].transcript;
      }
      const next = base + interim;
      setText(next);
      textRef.current = next;
    };
    rec.onerror = (e: any) => {
      setRecording(false);
      const map: Record<string, string> = {
        'not-allowed': '麦克风权限被拒绝。请在浏览器地址栏允许麦克风，或直接手动输入。',
        'service-not-allowed': '浏览器禁止了语音服务，请手动输入。',
        'no-speech': '没有听到声音，请靠近麦克风再试一次，或手动输入。',
        'audio-capture': '未检测到麦克风设备，请检查设备后重试，或手动输入。',
        network: '语音识别网络异常，请稍后重试，或手动输入。',
      };
      setVoiceHint(map[e.error] || `语音识别出错（${e.error}），可手动输入。`);
    };

    recRef.current = rec;
    try { rec.start(); } catch { setVoiceHint('语音识别启动失败，请手动输入。'); }
  };

  const fillMissing = () => {
    if (!profile) return;
    const missing = profile.missing.filter(m => !['姓名'].includes(m));
    if (!missing.length) { flash('档案信息已经比较完整了'); return; }
    const prompt = `\n\n（请补充：${missing.join('、')}）`;
    const next = (textRef.current.trim() + prompt).trim();
    setText(next);
    textRef.current = next;
    taRef.current?.focus();
    requestAnimationFrame(() => {
      if (taRef.current) taRef.current.setSelectionRange(next.length, next.length);
    });
    flash('请在输入框补充信息后重新生成');
  };

  const saveKey = () => {
    setApiKey(key.trim());
    setMode(mode);
    setShowSettings(false);
    setErr('');
  };

  const edit = (k: 'bio' | 'awards' | 'intent', v: string) => {
    setProfile(p => {
      if (!p) return p;
      if (k === 'bio') return { ...p, bio: v };
      if (k === 'awards') return { ...p, awards: v ? v.split(/[、,，]/).map(s => s.trim()).filter(Boolean) : [] };
      const parts = v.split('·').map(s => s.trim()).filter(Boolean);
      return {
        ...p,
        intent: {
          position: parts[0] || null,
          city: parts[1] || (parts.length === 1 ? p.intent.city : null),
          salary: parts[2] || (parts.length <= 2 ? p.intent.salary : null),
        },
      };
    });
  };

  const intentText = profile
    ? [profile.intent.position, profile.intent.city, profile.intent.salary].filter(Boolean).join(' · ')
    : '';

  return (
    <div className="asst-wrap page-enter">
      <div className="asst-head">
        <div className="section-head">
          <div className="num">§ 04</div>
          <h2>AI <em>求职助手</em>。</h2>
          <div className="right">DeepSeek 流式 · 严格按口述抽取<br />Key 只存本机 localStorage</div>
        </div>
        <p className="hero-lead reveal" style={{ marginTop: 18 }}>
          用大白话描述您的经历，AI 自动生成规范求职档案。<b>不会写字、不会打字的老师傅也能用</b>——支持语音输入。
        </p>

        <button
          className={`asst-quick-demo ${quick !== 'idle' ? 'is-running' : ''}`}
          type="button"
          onClick={startQuickDemo}
          disabled={quick !== 'idle' || busy}>
          <span className="qd-icon" aria-hidden="true">▶</span>
          <span className="qd-text">
            <strong>{quick === 'typing' ? '正在口述演示…' : quick === 'generating' ? 'AI 生成中…' : '30 秒一键演示'}</strong>
            <span>无需自己写，自动填充并生成档案</span>
          </span>
          <span className="qd-time">30s</span>
        </button>
      </div>

      <div className="asst-grid">
        <div className="asst-input">
          <div className="asst-examples">
            <span className="hint-line">示例</span>
            {Object.entries(EXAMPLES).map(([k, ex]) => (
              <button key={k} className="ex-btn" onClick={() => { setText(ex.text); textRef.current = ex.text; }}>
                {ex.label}
              </button>
            ))}
          </div>

          <div className="asst-cuisine-row">
            <span className="hint-line">菜系快捷</span>
            {CUISINES.map(c => (
              <button key={c} className={`jf-chip ${text.includes(`${c}菜`) ? 'active' : ''}`}
                onClick={() => {
                  const next = textRef.current.trim() ? `${textRef.current}，我是${c}菜师傅。` : `我是${c}菜师傅，`;
                  setText(next); textRef.current = next;
                  taRef.current?.focus();
                }}>{c}</button>
            ))}
          </div>

          <textarea
            id="asstTextarea"
            ref={taRef}
            value={text}
            onChange={e => { setText(e.target.value); textRef.current = e.target.value; }}
            placeholder="我叫张德海，今年 42，川菜师傅，从 18 岁跟着成都锦江春的张师傅学炒锅，干了 24 年，会 80 多道川菜，拿过省赛金奖，现在想找个成都或重庆的酒店炒锅或厨师长位置，工资期望 18-25K..."
          />

          {voiceHint && <div className="asst-voice-hint">{voiceHint}</div>}

          <div className="asst-actions">
            <button
              className={`asst-voice ${recording ? 'recording' : ''}`}
              onClick={toggleVoice}
              type="button">
              {recording ? '● 停止录音' : '🎤 语音输入'}
            </button>
            <button
              className="asst-gen"
              onClick={() => run()}
              disabled={busy || quick !== 'idle'}>
              {busy ? 'AI 生成中…' : '生成求职档案 →'}
            </button>
          </div>

          <div className="asst-foot-row">
            <button className="ex-btn" onClick={() => setShowSettings(true)}>
              <span className="ai-status-dot" style={{ background: key ? 'var(--moss)' : 'var(--vermillion)' }} />
              {key ? '已配置 DeepSeek Key' : '配置 API Key（可选）'}
            </button>
            <span className="hint-line">未配置时使用本地演示解析，页面不会空白</span>
          </div>
        </div>

        <div className="asst-output">
          {err && <div className="banner-warn" style={{ marginBottom: 16 }}>{err}</div>}

          {!profile && !busy && !raw && (
            <div className="ao-empty">
              在左侧描述您的经历，点击「生成求职档案」<br />
              AI 会为您整理出规范档案
            </div>
          )}

          {busy && !raw && <div className="ao-loading">AI 正在梳理您的经历…</div>}

          {busy && raw && (
            <>
              <div className="hint-line" style={{ color: 'var(--vermillion)' }}>GENERATING · 流式输出</div>
              <div className="ao-stream">{raw}<span className="cursor">▍</span></div>
            </>
          )}

          {profile && (
            <div className="ao-card">
              {(isDemo || profile.completeness < 100) && (
                <div className="ao-missing">
                  <div className="ao-missing-head">
                    档案信息完整度 {profile.completeness}%，建议补充：{profile.missing.join('、') || '关键字段'}
                  </div>
                  <button onClick={fillMissing}>补充这些信息 →</button>
                </div>
              )}

              {isDemo && (
                <div className="ao-demo-tag">本地演示解析 · 未配置 API Key 时的兜底结果（可继续编辑）</div>
              )}

              <div className="ao-name" contentEditable suppressContentEditableWarning
                onBlur={e => setProfile(p => p ? { ...p, name: e.currentTarget.textContent || null } : p)}>
                {profile.name || '未命名'}
                {profile.age != null && ` · ${profile.age}岁`}
              </div>

              <div className="ao-tags">
                {profile.cuisine && <span className="ao-tag">{profile.cuisine}菜</span>}
                {profile.city && <span className="ao-tag">{profile.city}</span>}
                {profile.years != null && <span className="ao-tag">{profile.years}年从业</span>}
                {profile.master && <span className="ao-tag">师从 {profile.master}</span>}
                {!profile.cuisine && !profile.city && !profile.years && !profile.master && (
                  <span className="ao-tag ao-tag-empty">基本信息待补充</span>
                )}
              </div>

              <div className="ao-section">
                <h6>拿手菜</h6>
                <div className="ao-sig">
                  {profile.signature.length
                    ? profile.signature.map(s => <span key={s}>{s}</span>)
                    : <span className="ao-empty-field" contentEditable suppressContentEditableWarning
                        onBlur={e => {
                          const v = e.currentTarget.textContent?.trim() || '';
                          setProfile(p => p ? { ...p, signature: v ? [v] : [] } : p);
                        }}>未提供，可在此补充</span>}
                </div>
              </div>

              <div className="ao-section">
                <h6>获奖与资质</h6>
                <div className="ao-field" contentEditable suppressContentEditableWarning
                  onBlur={e => edit('awards', e.currentTarget.textContent || '')}>
                  {profile.awards.length
                    ? profile.awards.join('、')
                    : <span className="ao-empty-field">未提供，可在此补充</span>}
                </div>
              </div>

              <div className="ao-section">
                <h6>求职意向</h6>
                <div className="ao-field" contentEditable suppressContentEditableWarning
                  onBlur={e => edit('intent', e.currentTarget.textContent || '')}>
                  {intentText || <span className="ao-empty-field">未提供，可在此补充</span>}
                </div>
              </div>

              <div className="ao-section">
                <h6>自荐信</h6>
                <div className="ao-field" contentEditable suppressContentEditableWarning
                  onBlur={e => edit('bio', e.currentTarget.textContent || '')}>
                  {profile.bio || <span className="ao-empty-field">未提供，可在此补充</span>}
                </div>
              </div>

              <div className="ao-actions">
                <button className="primary" onClick={() => flash('已发布到招聘广场（演示）')}>发布到招聘广场</button>
                <button onClick={() => flash('已保存档案（演示）')}>保存为档案</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {notice && <div className="asst-toast">{notice}</div>}

      {showSettings && (
        <div className="ai-settings-panel" onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <div className="ai-sp-card">
            <div className="ai-sp-head">
              <div>
                <div className="ai-sp-title">DeepSeek 配置</div>
                <div className="ai-sp-sub">Key 只保存在这台设备的 localStorage，不会上传到任何服务器</div>
              </div>
              <button className="ai-sp-close" onClick={() => setShowSettings(false)}>×</button>
            </div>
            <div className="ai-sp-body">
              <div className="ai-mode-row">
                <button className={`ai-mode-btn ${mode === 'proxy' ? 'active' : ''}`} onClick={() => setModeState('proxy')}>
                  <div className="ai-mode-name">经 dev server 代理（推荐）</div>
                  <div className="ai-mode-desc">/api/deepseek → api.deepseek.com，规避浏览器 CORS</div>
                </button>
                <button className={`ai-mode-btn ${mode === 'direct' ? 'active' : ''}`} onClick={() => setModeState('direct')}>
                  <div className="ai-mode-name">浏览器直连</div>
                  <div className="ai-mode-desc">直接请求 api.deepseek.com，需要接口允许跨域</div>
                </button>
              </div>

              <div>
                <label className="hint-line">API Key</label>
                <div className="ai-key-input" style={{ marginTop: 8 }}>
                  <input className="ai-key-input-field" type="password" value={key}
                    onChange={e => setKey(e.target.value)} placeholder="sk-..." />
                  <button className="cta" onClick={saveKey}>保存</button>
                </div>
                <div className="hint-line" style={{ marginTop: 10 }}>
                  申请地址 platform.deepseek.com · 未配置时使用本地演示解析
                </div>
              </div>

              <div className="banner-warn" style={{ fontSize: 12 }}>
                提示：生产环境不应把 Key 放前端。此处的做法仅用于本地演示与评委体验。
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
