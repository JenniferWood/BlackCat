import { request } from '../../utils/api';

interface Analysis {
  description: string;
  tags: string[];
  mood: string;
  quality: number;
  publishScore: number;
}

interface MediaItem {
  id: string;
  blobUrl: string;
  thumbnailUrl: string;
  type: string;
  uploadedAt: string;
  analysis?: Analysis;
  status: string;
  isFavorite: boolean;
}

interface ListResponse {
  items: MediaItem[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUS_FILTERS = [
  { key: '', label: '全部' },
  { key: 'uploaded', label: '新上传' },
  { key: 'analyzed', label: '已分析' },
  { key: 'recommended', label: '已推荐' },
  { key: 'published', label: '已发布' },
];

let searchTimer: number | null = null;

Page({
  data: {
    statusFilters: STATUS_FILTERS,
    activeStatus: '',
    favoriteOnly: false,
    searchText: '',
    mediaList: [] as MediaItem[],
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: true,
    loading: false,
    loadingMore: false,
    loadError: false,
  },

  onLoad() {
    this.loadMedia(true);
  },

  onShow() {
    // Refresh when returning from detail page (item may have been deleted/updated)
    if (this.data.mediaList.length > 0) {
      this.loadMedia(true);
    }
  },

  onPullDownRefresh() {
    this.loadMedia(true);
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore) {
      this.loadMore();
    }
  },

  /** Load media list (reset = start from page 1) */
  async loadMedia(reset: boolean) {
    if (reset) {
      this.setData({ page: 1, hasMore: true, loading: true, loadError: false });
    }

    const { activeStatus, favoriteOnly, searchText, page, pageSize } = this.data;

    let url = `/api/media/list?page=${page}&pageSize=${pageSize}`;
    if (activeStatus) url += `&status=${activeStatus}`;
    if (favoriteOnly) url += `&isFavorite=true`;
    if (searchText.trim()) url += `&search=${encodeURIComponent(searchText.trim())}`;

    try {
      const res = await request<ListResponse>({ url });
      const newItems = res.items || [];

      if (reset) {
        this.setData({
          mediaList: newItems,
          total: res.total,
          hasMore: newItems.length >= pageSize,
          loading: false,
        });
      } else {
        this.setData({
          mediaList: [...this.data.mediaList, ...newItems],
          total: res.total,
          hasMore: newItems.length >= pageSize,
          loadingMore: false,
        });
      }
    } catch (e) {
      console.error('Failed to load media', e);
      this.setData({ loading: false, loadingMore: false, loadError: true });
    }

    wx.stopPullDownRefresh();
  },

  /** Load next page */
  loadMore() {
    this.setData({
      page: this.data.page + 1,
      loadingMore: true,
    });
    this.loadMedia(false);
  },

  /** Tap a status filter chip */
  filterByStatus(e: WechatMiniprogram.TouchEvent) {
    const status = e.currentTarget.dataset.status as string;
    this.setData({ activeStatus: status });
    this.loadMedia(true);
  },

  /** Toggle favorite filter */
  toggleFavoriteFilter() {
    this.setData({ favoriteOnly: !this.data.favoriteOnly });
    this.loadMedia(true);
  },

  /** Search input with debounce */
  onSearchInput(e: WechatMiniprogram.Input) {
    const value = e.detail.value;
    this.setData({ searchText: value });

    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      this.loadMedia(true);
    }, 500) as unknown as number;
  },

  /** Clear search */
  clearSearch() {
    this.setData({ searchText: '' });
    this.loadMedia(true);
  },

  /** Tap a media item -> navigate to detail */
  tapMedia(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },

  /** Navigate to upload page */
  goUpload() {
    wx.navigateTo({ url: '/pages/upload/upload' });
  },
});
