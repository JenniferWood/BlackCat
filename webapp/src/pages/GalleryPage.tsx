import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MediaGrid } from '../components/MediaGrid';
import { useDataCache } from '../contexts/DataCache';
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
  const cache = useDataCache();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [status, setStatus] = useState<StatusFilter>('all');
  const [favOnly, setFavOnly] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Debounce search input (500ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 500);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Reset when filters change
  useEffect(() => {
    const cacheKey = `gallery-${status}-${favOnly}-${debouncedSearch}`;
    const cached = cache.get<{ items: MediaItem[]; total: number; page: number }>(cacheKey);
    if (cached && cache.isFresh(cacheKey)) {
      setItems(cached.items);
      setTotal(cached.total);
      setPage(cached.page);
      setLoading(false);
      return;
    }
    setItems([]);
    setPage(1);
    setTotal(0);
    setLoading(true);
  }, [status, favOnly, debouncedSearch, cache]);

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
    const cacheKey = `gallery-${status}-${favOnly}-${debouncedSearch}`;
    if (cache.isFresh(cacheKey)) return;

    let cancelled = false;

    (async () => {
      try {
        const data = await fetchPage(1);
        if (cancelled) return;
        setItems(data.items);
        setTotal(data.total);
        setPage(1);
        cache.set(cacheKey, { items: data.items, total: data.total, page: 1 });
      } catch {
        // silently ignore — could add error state later
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchPage, cache, status, favOnly, debouncedSearch]);

  // Load next page
  const loadMore = useCallback(async () => {
    if (loadingMore) return;

    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const data = await fetchPage(nextPage);
      setItems((prev) => {
        const merged = [...prev, ...data.items];
        const cacheKey = `gallery-${status}-${favOnly}-${debouncedSearch}`;
        cache.set(cacheKey, { items: merged, total: data.total, page: nextPage });
        return merged;
      });
      setPage(nextPage);
      setTotal(data.total);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }, [page, loadingMore, fetchPage, cache, status, favOnly, debouncedSearch]);

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

  const refreshGallery = useCallback(() => {
    const cacheKey = `gallery-${status}-${favOnly}-${debouncedSearch}`;
    cache.invalidate(cacheKey);
    setItems([]);
    setPage(1);
    setTotal(0);
    setLoading(true);
  }, [cache, status, favOnly, debouncedSearch]);

  const toggleDeleteMode = () => {
    setDeleteMode((v) => !v);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定删除选中的 ${selectedIds.size} 个素材？`)) return;

    setDeleting(true);
    const ids = [...selectedIds];
    const failed: string[] = [];
    for (const id of ids) {
      try {
        await request(`/api/media/${id}`, { method: 'DELETE' });
      } catch {
        failed.push(id);
      }
    }

    setItems((prev) => prev.filter((i) => !selectedIds.has(i.id) || failed.includes(i.id)));
    setTotal((prev) => prev - (ids.length - failed.length));

    const cacheKey = `gallery-${status}-${favOnly}-${debouncedSearch}`;
    cache.invalidate(cacheKey);

    setDeleteMode(false);
    setSelectedIds(new Set());
    setDeleting(false);

    if (failed.length > 0) {
      alert(`${failed.length} 个素材删除失败`);
    }
  };

  return (
    <div className="page">
      <div className="page-title-row">
        <h1 className="page-title">素材库</h1>
        <button className="refresh-btn" onClick={refreshGallery} title="刷新">↻</button>
        <button
          className={`chip manage-btn${deleteMode ? ' active' : ''}`}
          style={{ marginLeft: 'auto' }}
          onClick={toggleDeleteMode}
        >
          {deleteMode ? '取消' : '管理'}
        </button>
      </div>

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
          <MediaGrid
            items={items}
            selectMode={deleteMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
          />

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

      {/* Batch delete action bar */}
      {deleteMode && (
        <div className="batch-bar">
          <span>已选 {selectedIds.size} 个</span>
          <button
            className="btn-batch-delete"
            disabled={selectedIds.size === 0 || deleting}
            onClick={handleBatchDelete}
          >
            {deleting ? '删除中...' : '删除'}
          </button>
        </div>
      )}

      {!deleteMode && (
        <button className="fab" onClick={() => fileInputRef.current?.click()}>+</button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/mp4,video/quicktime"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          const fileList = e.target.files;
          if (fileList && fileList.length > 0) {
            navigate('/upload', { state: { files: Array.from(fileList) } });
          }
          e.target.value = '';
        }}
      />
    </div>
  );
}
