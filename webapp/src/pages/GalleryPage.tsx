import { useState, useEffect, useRef, useCallback } from 'react';
import { MediaGrid } from '../components/MediaGrid';
import { request } from '../api/client';
import type { MediaListResponse, MediaItem } from '@shared/types';

type StatusFilter = 'all' | MediaItem['status'];

const STATUS_CHIPS: { label: string; value: StatusFilter }[] = [
  { label: '全部', value: 'all' },
  { label: '新上传', value: 'new' },
  { label: '已分析', value: 'analyzed' },
  { label: '已推荐', value: 'recommended' },
  { label: '已发布', value: 'published' },
];

const PAGE_SIZE = 20;

export default function GalleryPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [status, setStatus] = useState<StatusFilter>('all');
  const [favOnly, setFavOnly] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const sentinelRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Debounce search input (500ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 500);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Reset when filters change
  useEffect(() => {
    setItems([]);
    setPage(1);
    setTotal(0);
    setLoading(true);
  }, [status, favOnly, debouncedSearch]);

  // Fetch data
  const fetchPage = useCallback(
    async (p: number) => {
      const params = new URLSearchParams();
      params.set('page', String(p));
      params.set('pageSize', String(PAGE_SIZE));
      if (status !== 'all') params.set('status', status);
      if (favOnly) params.set('isFavorite', 'true');
      if (debouncedSearch) params.set('search', debouncedSearch);

      const data = await request<MediaListResponse>(
        `/api/media/list?${params.toString()}`,
      );
      return data;
    },
    [status, favOnly, debouncedSearch],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchPage(1);
        if (cancelled) return;
        setItems(data.items);
        setTotal(data.total);
        setPage(1);
      } catch {
        // silently ignore — could add error state later
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  // Load next page
  const loadMore = useCallback(async () => {
    if (loadingMore) return;

    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const data = await fetchPage(nextPage);
      setItems((prev) => [...prev, ...data.items]);
      setPage(nextPage);
      setTotal(data.total);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }, [page, loadingMore, fetchPage]);

  const hasMore = items.length < total;

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    if (!hasMore || loading) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '200px' },
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [hasMore, loading, loadMore]);

  return (
    <div className="page">
      <h1 className="page-title">素材库</h1>

      {/* Search */}
      <input
        className="search-input"
        placeholder="搜索标签、描述..."
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
      />

      {/* Status filter chips */}
      <div className="filter-bar">
        {STATUS_CHIPS.map((chip) => (
          <button
            key={chip.value}
            className={`chip${status === chip.value ? ' active' : ''}`}
            onClick={() => setStatus(chip.value)}
          >
            {chip.label}
          </button>
        ))}
        <button
          className={`chip${favOnly ? ' active' : ''}`}
          onClick={() => setFavOnly((v) => !v)}
        >
          收藏
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div className="spinner" />
        </div>
      ) : (
        <>
          <MediaGrid items={items} />

          {/* Sentinel for infinite scroll */}
          {hasMore && (
            <div ref={sentinelRef} style={{ padding: 20, textAlign: 'center' }}>
              {loadingMore && <div className="spinner" style={{ margin: '0 auto' }} />}
            </div>
          )}

          {!hasMore && items.length > 0 && (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 20, fontSize: 13 }}>
              已加载全部 {total} 张素材
            </p>
          )}
        </>
      )}
    </div>
  );
}
