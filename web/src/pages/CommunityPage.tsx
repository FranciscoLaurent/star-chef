import { useEffect, useMemo, useState } from 'react';
import {
  loadPosts, savePosts, loadLiked, saveLiked, makeId, relativeTime, SEED_POSTS,
  type Post, type Comment,
} from '../lib/community';
import { usePageReveal, useStaggerIn } from '../lib/motion';

const CUISINES = ['全部', '川', '粤', '鲁', '淮扬', '湘', '苏', '浙', '闽', '京'];

export default function CommunityPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [liked, setLiked] = useState<string[]>([]);
  const [tab, setTab] = useState('全部');
  const [composing, setComposing] = useState(false);
  const [detail, setDetail] = useState<Post | null>(null);
  usePageReveal();

  useEffect(() => {
    setPosts(loadPosts());
    setLiked(loadLiked());
  }, []);

  const filtered = useMemo(
    () => tab === '全部' ? posts : posts.filter(p => p.cuisine === tab),
    [posts, tab]
  );

  useStaggerIn('.comm-grid .post-card', [tab, posts.length]);

  const toggleLike = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const next = liked.includes(id) ? liked.filter(x => x !== id) : [...liked, id];
    setLiked(next); saveLiked(next);
    const updated = posts.map(p => p.id === id ? { ...p, likes: p.likes + (liked.includes(id) ? -1 : 1) } : p);
    setPosts(updated); savePosts(updated);
    if (detail?.id === id) setDetail(updated.find(p => p.id === id) || null);
  };

  const publish = (draft: Omit<Post, 'id' | 'createdAt' | 'likes' | 'comments' | 'seed'>) => {
    const post: Post = {
      ...draft,
      id: makeId(),
      createdAt: new Date().toISOString(),
      likes: 0,
      comments: [],
    };
    const next = [post, ...posts];
    setPosts(next); savePosts(next);
    setComposing(false);
  };

  const addComment = (postId: string, body: string, author: string) => {
    const c: Comment = { id: makeId('c'), author, body, createdAt: new Date().toISOString() };
    const next = posts.map(p => p.id === postId ? { ...p, comments: [...p.comments, c] } : p);
    setPosts(next); savePosts(next);
    if (detail?.id === postId) setDetail(next.find(p => p.id === postId) || null);
  };

  return (
    <div className="comm-wrap page-enter">
      <div className="comm-head">
        <div className="section-head">
          <div className="num">§ 05</div>
          <h2>厨师<br /><em>交流社区</em>。</h2>
          <div className="right">按菜系形成圈子<br />内容存于本机 localStorage</div>
        </div>
        <p className="hero-lead reveal" style={{ marginTop: 18 }}>
          同行切磋、师傅招徒、学徒请教。这里不说空话——只聊灶台上的事。发帖、评论会保存在你的浏览器里。
        </p>

        <div className="comm-tabs" style={{ marginTop: 22 }}>
          {CUISINES.map(c => (
            <button key={c} className={`ct-btn ${tab === c ? 'active' : ''}`} onClick={() => setTab(c)}>{c}</button>
          ))}
        </div>
      </div>

      <div className="comm-grid">
        {filtered.map(p => (
          <article key={p.id} className="post-card" onClick={() => setDetail(p)}>
            <div className="post-head">
              <div className="post-avatar">{p.author.slice(0, 1)}</div>
              <div>
                <div className="post-author">{p.author}</div>
                <div className="post-role">{p.role}{p.city ? ` · ${p.city}` : ''}</div>
              </div>
              <span className="post-cuisine">{p.cuisine}菜</span>
            </div>
            <h3 className="post-title">{p.title}</h3>
            <p className="post-body">{p.body.length > 90 ? p.body.slice(0, 90) + '…' : p.body}</p>
            <div className="post-foot">
              <span>{relativeTime(p.createdAt)}</span>
              <span style={{ display: 'flex', gap: 14 }}>
                <span onClick={e => toggleLike(p.id, e)} style={{ cursor: 'pointer', color: liked.includes(p.id) ? 'var(--vermillion)' : undefined }}>
                  ♥ {p.likes}
                </span>
                <span>💬 {p.comments.length}</span>
              </span>
            </div>
          </article>
        ))}
        {filtered.length === 0 && (
          <div className="loading" style={{ padding: 30 }}>该菜系下还没有帖子，来发第一条。</div>
        )}
      </div>

      <button className="comm-fab" onClick={() => setComposing(true)} aria-label="发帖">＋</button>

      {composing && <ComposeModal onCancel={() => setComposing(false)} onSubmit={publish} />}

      {detail && (
        <div className="comm-detail">
          <div className="detail-bar">
            <button className="ex-btn" onClick={() => setDetail(null)}>← 返回社区</button>
            <span className="hint-line">{relativeTime(detail.createdAt)}</span>
          </div>
          <div className="detail-inner">
            <div className="post-head">
              <div className="post-avatar">{detail.author.slice(0, 1)}</div>
              <div>
                <div className="post-author">{detail.author}</div>
                <div className="post-role">{detail.role}{detail.city ? ` · ${detail.city}` : ''}</div>
              </div>
              <span className="post-cuisine">{detail.cuisine}菜</span>
            </div>
            <h1 className="detail-title">{detail.title}</h1>
            <div className="detail-body">{detail.body}</div>

            <div className="detail-actions">
              <button className="cta" onClick={e => toggleLike(detail.id, e as any)}>
                {liked.includes(detail.id) ? '已赞同' : '赞同'} · {detail.likes}
              </button>
              <span className="hint-line">评论 {detail.comments.length} 条</span>
            </div>

            <CommentList post={detail} onAdd={addComment} />
          </div>
        </div>
      )}
    </div>
  );
}

function CommentList({ post, onAdd }: { post: Post; onAdd: (postId: string, body: string, author: string) => void }) {
  const [author, setAuthor] = useState('');
  const [body, setBody] = useState('');

  return (
    <div className="detail-comments">
      <h6 className="hint-line" style={{ marginBottom: 14 }}>评论</h6>
      {post.comments.length === 0 && (
        <div style={{ color: 'var(--dust)', fontSize: 13, marginBottom: 16 }}>还没有人说话，你可以抛个砖。</div>
      )}
      {post.comments.map(c => (
        <div key={c.id} className="comment-row">
          <div className="post-avatar small">{c.author.slice(0, 1)}</div>
          <div>
            <div className="post-author">{c.author} <span className="hint-line" style={{ marginLeft: 8 }}>{relativeTime(c.createdAt)}</span></div>
            <p style={{ margin: '4px 0 0', fontSize: 13.5, lineHeight: 1.7, color: 'var(--ink-soft)' }}>{c.body}</p>
          </div>
        </div>
      ))}

      <div className="comment-form">
        <input placeholder="你的名字" value={author} onChange={e => setAuthor(e.target.value)} style={{ maxWidth: 160 }} />
        <input placeholder="说点什么…" value={body} onChange={e => setBody(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && body.trim()) { onAdd(post.id, body.trim(), author.trim() || '匿名同行'); setBody(''); } }} />
        <button className="btn-primary" onClick={() => {
          if (!body.trim()) return;
          onAdd(post.id, body.trim(), author.trim() || '匿名同行');
          setBody('');
        }}>发送</button>
      </div>
    </div>
  );
}

function ComposeModal({ onCancel, onSubmit }: {
  onCancel: () => void;
  onSubmit: (p: Omit<Post, 'id' | 'createdAt' | 'likes' | 'comments' | 'seed'>) => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [author, setAuthor] = useState('');
  const [role, setRole] = useState('厨师');
  const [cuisine, setCuisine] = useState('川');
  const [city, setCity] = useState('');

  const canSubmit = title.trim() && body.trim();

  return (
    <div className="comm-modal" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="cm-card">
        <div className="cm-head">
          <div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 22 }}>发一条帖子</div>
            <div className="hint-line" style={{ marginTop: 6 }}>保存在本机浏览器 · 不会上传</div>
          </div>
          <button className="cm-cancel" onClick={onCancel}>×</button>
        </div>

        <div className="cm-field">
          <label className="hint-line">标题</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="一句话说清楚你要聊什么" />
        </div>
        <div className="cm-field">
          <label className="hint-line">正文</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={7}
            placeholder="灶台上的经验、困惑、招徒或拜师…" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="cm-field">
            <label className="hint-line">你的称呼</label>
            <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="如：老陈" />
          </div>
          <div className="cm-field">
            <label className="hint-line">身份</label>
            <input value={role} onChange={e => setRole(e.target.value)} placeholder="如：川菜厨师长" />
          </div>
        </div>
        <div className="cm-field">
          <label className="hint-line">菜系</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CUISINES.filter(c => c !== '全部').map(c => (
              <button key={c} className={`jf-chip ${cuisine === c ? 'active' : ''}`} onClick={() => setCuisine(c)}>{c}</button>
            ))}
          </div>
        </div>
        <div className="cm-field">
          <label className="hint-line">城市</label>
          <input value={city} onChange={e => setCity(e.target.value)} placeholder="如：成都" />
        </div>

        <div className="cm-foot">
          <span className="hint-line">{SEED_POSTS.length} 条预置内容 + 你的帖子</span>
          <button className="btn-primary" disabled={!canSubmit}
            onClick={() => canSubmit && onSubmit({
              title: title.trim(), body: body.trim(),
              author: author.trim() || '匿名同行',
              role: role.trim() || '厨师', cuisine, city: city.trim(),
            })}>
            发布
          </button>
        </div>
      </div>
    </div>
  );
}
