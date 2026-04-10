import { request } from '../api/client';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useDataCache } from '../contexts/DataCache';
import type { MediaItem, MediaListResponse, GenerateResponse, ContentStyle } from '@shared/types';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const STYLE_OPTIONS: { value: ContentStyle; label: string; icon: string }[] = [
  { value: 'cozy', label: '温馨', icon: '🏠' },
  { value: 'funny', label: '搞笑', icon: '😂' },
  { value: 'aesthetic', label: '美学', icon: '🎨' },
  { value: 'auto', label: '自动', icon: '✨' },
];

const MAX_SELECTION = 9;

export default function ComposePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const cache = useDataCache();
  const preSelected = (location.state as { mediaIds?: string[] })?.mediaIds;

  const [media, setMedia] = useState<MediaItem[]>(
    () => cache.get<MediaItem[]>('compose-media') ?? [],
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(preSelected ?? []);
  const [style, setStyle] = useState<ContentStyle>('auto');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(
    () => !cache.isFresh('compose-media'),
  );

  useEffect(() => {
    if (cache.isFresh('compose-media')) return;
    request<MediaListResponse>('/api/media/list?status=analyzed&pageSize=100')
      .then((res) => {
        setMedia(res.items);
        cache.set('compose-media', res.items);
      })
      .catch(() => alert('加载媒体列表失败'))
      .finally(() => setFetching(false));
  }, [cache]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((i) => i !== id);
      if (prev.length >= MAX_SELECTION) return prev;
      return [...prev, id];
    });
  };

  const handleGenerate = async () => {
    if (selectedIds.length === 0) return;
    setLoading(true);
    try {
      const result = await request<GenerateResponse>('/api/ai/generate', {
        method: 'POST',
        data: { mediaIds: selectedIds, style },
      });
      const selectedMedia = media.filter((m) => selectedIds.includes(m.id));
      navigate('/result', { state: { ...result, media: selectedMedia } });
    } catch {
      alert('生成失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="正在生成文案..." />;
  }

  return (
    <div className="page">
      <h1 className="page-title">创作文案</h1>

      <h2>选择素材（最多 {MAX_SELECTION} 张）</h2>
      {fetching ? (
        <LoadingSpinner />
      ) : (
        <div className="select-grid">
          {media.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <div
                key={item.id}
                className={`select-card${isSelected ? ' selected' : ''}`}
                onClick={() => toggleSelect(item.id)}
              >
                <img src={item.thumbnailUrl} alt="" />
                {item.type === 'video' && <span className="video-badge">▶</span>}
                {isSelected && <span className="check">✓</span>}
              </div>
            );
          })}
        </div>
      )}

      <h2>选择风格</h2>
      <div className="style-grid">
        {STYLE_OPTIONS.map((opt) => (
          <div
            key={opt.value}
            className={`style-card${style === opt.value ? ' active' : ''}`}
            onClick={() => setStyle(opt.value)}
          >
            <span className="icon">{opt.icon}</span>
            <span className="label">{opt.label}</span>
          </div>
        ))}
      </div>

      <button
        className="btn-primary"
        disabled={selectedIds.length === 0}
        onClick={handleGenerate}
      >
        生成文案（已选 {selectedIds.length} 个素材）
      </button>
    </div>
  );
}
