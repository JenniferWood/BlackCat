import { useNavigate } from 'react-router-dom';
import type { MediaItem } from '@shared/types';

interface Props {
  items: MediaItem[];
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function MediaGrid({ items, selectMode, selectedIds, onToggleSelect }: Props) {
  const navigate = useNavigate();

  const handleClick = (item: MediaItem) => {
    if (selectMode && onToggleSelect) {
      onToggleSelect(item.id);
    } else {
      navigate(`/detail/${item.id}`);
    }
  };

  if (items.length === 0) {
    return <div className="empty-state"><p>暂无素材</p></div>;
  }

  return (
    <div className="media-grid">
      {items.map((item) => {
        const isSelected = selectedIds?.has(item.id);
        return (
          <div
            key={item.id}
            className={`media-card${isSelected ? ' selected' : ''}`}
            onClick={() => handleClick(item)}
          >
            <img src={item.thumbnailUrl} alt="" loading="lazy" />
            {item.type === 'video' && (
              <span className="video-badge">
                ▶{item.analysis?.duration != null ? ` ${formatDuration(item.analysis.duration)}` : ''}
              </span>
            )}
            {item.isFavorite && <span className="favorite-badge">&#9733;</span>}
            {item.analysis?.mood && <span className="mood-badge">{item.analysis.mood}</span>}
            {item.analysis?.publishScore != null && (
              <span className="score-badge" title="发布推荐评分">荐 {item.analysis.publishScore}</span>
            )}
            {selectMode && (
              <span className={`select-check${isSelected ? ' checked' : ''}`}>
                {isSelected ? '✓' : ''}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
