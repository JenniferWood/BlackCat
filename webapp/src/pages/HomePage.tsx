import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MediaGrid } from '../components/MediaGrid';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { request } from '../api/client';
import type {
  MediaListResponse,
  MediaItem,
  Recommendation,
  RecommendResponse,
  GenerateResponse,
} from '@shared/types';

export default function HomePage() {
  const navigate = useNavigate();

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recentItems, setRecentItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [recError, setRecError] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleRecClick = async (rec: Recommendation) => {
    setGenerating(true);
    try {
      const [result, mediaRes] = await Promise.all([
        request<GenerateResponse>('/api/ai/generate', {
          method: 'POST',
          data: { mediaIds: rec.mediaIds, style: rec.suggestedStyle },
        }),
        request<MediaListResponse>('/api/media/list?status=analyzed&pageSize=100'),
      ]);
      const selectedMedia = mediaRes.items.filter((m) => rec.mediaIds.includes(m.id));
      navigate('/result', { state: { ...result, media: selectedMedia } });
    } catch {
      alert('生成失败，请重试');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const results = await Promise.allSettled([
        request<RecommendResponse>('/api/ai/recommend', {
          method: 'POST',
          data: { limit: 5 },
        }),
        request<MediaListResponse>('/api/media/list?pageSize=10'),
      ]);

      if (cancelled) return;

      if (results[0].status === 'fulfilled') {
        setRecommendations(results[0].value.recommendations);
      } else {
        setRecError(true);
      }

      if (results[1].status === 'fulfilled') {
        setRecentItems(results[1].value.items);
      } else {
        setMediaError(true);
      }

      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  if (generating) {
    return <LoadingSpinner text="正在生成文案..." />;
  }

  if (loading) {
    return (
      <div className="page">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 60 }}>
          <div className="spinner" />
          <div className="spinner-text">加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Header */}
      <div className="home-header">
        <div className="home-header-row">
          <span className="home-header-icon">🐾</span>
          <span className="home-header-title">皮蛋助手</span>
        </div>
        <span className="home-header-subtitle">小红书内容管理</span>
      </div>

      {/* Recommendations */}
      <section className="section">
        <div className="section-header">
          <h2 className="section-title">今日推荐</h2>
          {recommendations.length > 0 && (
            <span className="section-badge">{recommendations.length}</span>
          )}
        </div>
        {recError ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>推荐加载失败</p>
        ) : recommendations.length === 0 ? (
          <div className="empty-hint">
            <p>上传素材后，AI 将为你生成推荐</p>
          </div>
        ) : (
          <div className="rec-scroll">
            {recommendations.map((rec) => (
              <div
                key={rec.id}
                className="rec-card"
                onClick={() => handleRecClick(rec)}
              >
                <div className="rec-title">{rec.suggestedTitle}</div>
                <div className="rec-reason">{rec.reason}</div>
                <div className="rec-footer">
                  {rec.suggestedStyle && (
                    <span className="rec-style">{rec.suggestedStyle}</span>
                  )}
                  <span className="rec-btn">去创作</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent uploads */}
      <section className="section">
        <div className="section-header">
          <h2 className="section-title">最近上传</h2>
          {recentItems.length > 0 && (
            <span className="section-count">{recentItems.length} 张</span>
          )}
        </div>
        {mediaError ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>素材加载失败</p>
        ) : recentItems.length === 0 ? (
          <div className="empty-hint">
            <p>还没有上传过素材</p>
            <button className="empty-action" onClick={() => navigate('/upload')}>
              去上传
            </button>
          </div>
        ) : (
          <MediaGrid items={recentItems} />
        )}
      </section>

      {/* FAB */}
      <button className="fab" onClick={() => navigate('/upload')}>+</button>
    </div>
  );
}
