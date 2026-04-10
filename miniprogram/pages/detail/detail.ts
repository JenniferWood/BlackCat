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

Page({
  data: {
    id: '',
    item: null as MediaItem | null,
    loading: true,
    loadError: false,
    statusLabels: {
      uploaded: '新上传',
      analyzed: '已分析',
      recommended: '已推荐',
      published: '已发布',
    } as Record<string, string>,
    typeLabels: {
      photo: '照片',
      video: '视频',
      image: '照片',
    } as Record<string, string>,
  },

  onLoad(options: Record<string, string>) {
    const id = options.id || '';
    if (!id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1000);
      return;
    }
    this.setData({ id });
    this.loadItem(id);
  },

  /** Fetch the media item by loading list and finding by id */
  async loadItem(id: string) {
    this.setData({ loading: true, loadError: false });
    try {
      const res = await request<ListResponse>({
        url: `/api/media/list?page=1&pageSize=100`,
      });
      const found = (res.items || []).find((item) => item.id === id);
      if (found) {
        this.setData({ item: found, loading: false });
      } else {
        this.setData({ loading: false, loadError: true });
        wx.showToast({ title: '素材未找到', icon: 'none' });
      }
    } catch (e) {
      console.error('Failed to load media item', e);
      this.setData({ loading: false, loadError: true });
    }
  },

  /** Preview full image */
  previewImage() {
    const item = this.data.item;
    if (!item) return;
    wx.previewImage({
      current: item.blobUrl,
      urls: [item.blobUrl],
    });
  },

  /** Toggle favorite */
  async toggleFavorite() {
    const item = this.data.item;
    if (!item) return;

    const newVal = !item.isFavorite;
    try {
      await request<MediaItem>({
        url: `/api/media/${item.id}`,
        method: 'PUT',
        data: { isFavorite: newVal },
      });
      this.setData({ 'item.isFavorite': newVal });
      wx.showToast({
        title: newVal ? '已收藏' : '已取消收藏',
        icon: 'none',
        duration: 1000,
      });
    } catch (e) {
      console.error('Failed to toggle favorite', e);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  /** Navigate to compose page (compose is a tab page, but we pass mediaId so use reLaunch) */
  goCompose() {
    const item = this.data.item;
    if (!item) return;
    // Tab pages cannot receive query params via switchTab, so use navigateTo
    // if compose supports it as a non-tab route, or reLaunch as fallback
    wx.navigateTo({
      url: `/pages/compose/compose?mediaId=${item.id}`,
      fail: () => {
        // If compose is a tab page, switchTab won't carry params.
        // Store mediaId for compose page to pick up.
        wx.setStorageSync('composeMediaId', item.id);
        wx.switchTab({ url: '/pages/compose/compose' });
      },
    });
  },

  /** Delete media with confirmation */
  deleteMedia() {
    const item = this.data.item;
    if (!item) return;

    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复，确定要删除这个素材吗？',
      confirmText: '删除',
      confirmColor: '#e74c3c',
      cancelText: '取消',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await request<void>({
            url: `/api/media/${item.id}`,
            method: 'DELETE',
          });
          wx.showToast({ title: '已删除', icon: 'success', duration: 1000 });
          setTimeout(() => wx.navigateBack(), 800);
        } catch (e) {
          console.error('Failed to delete media', e);
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      },
    });
  },

  /** Placeholder for triggering analysis */
  triggerAnalysis() {
    wx.showToast({ title: '分析功能开发中', icon: 'none' });
  },
});
