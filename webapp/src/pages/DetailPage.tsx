import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { request } from '../api/client';
import type { MediaItem, MediaListResponse } from '@shared/types';

export default function DetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [item, setItem] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await request<MediaListResponse>('/api/media/list?pageSize=100');
        if (cancelled) return;
        const found = data.items.find((m) => m.id === id) ?? null;
        setItem(found);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const toggleFavorite = async () => {
    if (!item) return;
    try {
      await request<MediaItem>(`/api/media/${item.id}`, {
        method: 'PUT',
        data: { isFavorite: !item.isFavorite },
      });
      setItem({ ...item, isFavorite: !item.isFavorite });
    } catch {
      // ignore
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    if (!window.confirm('确定要删除这张素材吗？')) return;
    try {
      await request(`/api/media/${item.id}`, { method: 'DELETE' });
      navigate('/gallery');
    } catch {
      // ignore
    }
  };

  const handleCompose = () => {
    if (!item) return;
    navigate('/compose', { state: { mediaIds: [item.id] } });
  };

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="page">
        <div className="empty-state">
          <p>素材不存在</p>
          <button className="btn-secondary" style={{ marginTop: 16 }} onClick={() => navigate('/gallery')}>
            返回素材库
          </button>
        </div>
      </div>
    );
  }

  const analysis = item.analysis;

  return (
    <div className="page">
      {/* Back */}
      <button
        className="btn-secondary"
        style={{ marginBottom: 12 }}
        onClick={() => navigate('/gallery')}
      >
        &larr; 返回
      </button>

      {/* Media */}
      {item.type === 'video' ? (
        <video
          className="detail-image"
          src={item.blobUrl}
          controls
          playsInline
          preload="metadata"
        />
      ) : (
        <img
          className="detail-image"
          src={item.blobUrl}
          alt=""
          onClick={() => setLightbox(true)}
        />
      )}

      {/* Action buttons */}
      <div className="detail-actions">
        <button className="btn-secondary" onClick={toggleFavorite}>
          {item.isFavorite ? '取消收藏' : '收藏'}
        </button>
        <button className="btn-primary" onClick={handleCompose}>
          去写文案
        </button>
        <button
          className="btn-secondary"
          style={{ color: 'var(--error)' }}
          onClick={handleDelete}
        >
          删除
        </button>
      </div>

      {/* Analysis */}
      {analysis && (
        <>
          <div className="analysis-section">
            <h3>AI 分析</h3>
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>{analysis.description}</p>
          </div>

          <div className="analysis-section">
            <h3>标签</h3>
            <div className="tag-list">
              {analysis.tags.map((tag) => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>
          </div>

          <div className="analysis-section">
            <h3>情绪</h3>
            <p style={{ fontSize: 14 }}>{analysis.mood}</p>
          </div>

          <div className="analysis-section">
            <h3>评分</h3>
            {analysis.duration != null && (
              <div className="score-bar">
                <label>视频时长</label>
                <span>{Math.floor(analysis.duration / 60)}:{String(Math.round(analysis.duration % 60)).padStart(2, '0')}</span>
              </div>
            )}
            <div className="score-bar">
              <label>素材质量</label>
              <div className="score-bar-track">
                <div
                  className="score-bar-fill"
                  style={{ width: `${analysis.quality * 10}%` }}
                />
              </div>
              <span>{analysis.quality}</span>
            </div>
            <div className="score-bar">
              <label>发布推荐</label>
              <div className="score-bar-track">
                <div
                  className="score-bar-fill"
                  style={{ width: `${analysis.publishScore * 10}%` }}
                />
              </div>
              <span>{analysis.publishScore}</span>
            </div>
          </div>
        </>
      )}

      {!analysis && (
        <div className="analysis-section">
          <h3>AI 分析</h3>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            分析尚未完成，请稍后刷新查看。
          </p>
        </div>
      )}

      {/* Lightbox (photos only) */}
      {lightbox && item.type !== 'video' && (
        <div className="lightbox" onClick={() => setLightbox(false)}>
          <img src={item.blobUrl} alt="" />
        </div>
      )}
    </div>
  );
}
