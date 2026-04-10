import { useNavigate } from 'react-router-dom';
import type { MediaItem } from '@shared/types';

interface Props {
  items: MediaItem[];
}

export function MediaGrid({ items }: Props) {
  const navigate = useNavigate();

  if (items.length === 0) {
    return <div className="empty-state"><p>暂无素材</p></div>;
  }

  return (
    <div className="media-grid">
      {items.map((item) => (
        <div key={item.id} className="media-card" onClick={() => navigate(`/detail/${item.id}`)}>
          <img src={item.thumbnailUrl} alt="" loading="lazy" />
          {item.isFavorite && <span className="favorite-badge">&#9733;</span>}
          {item.analysis?.mood && <span className="mood-badge">{item.analysis.mood}</span>}
          {item.analysis?.publishScore != null && (
            <span className="score-badge" title="发布推荐评分">荐 {item.analysis.publishScore}</span>
          )}
        </div>
      ))}
    </div>
  );
}
