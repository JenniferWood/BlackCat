import { request } from '../../utils/api';

interface Recommendation {
  id: string;
  mediaIds: string[];
  reason: string;
  suggestedTitle: string;
  suggestedStyle: string;
}

interface MediaItem {
  id: string;
  blobUrl: string;
  thumbnailUrl: string;
  type: string;
  uploadedAt: string;
  analysis?: {
    description: string;
    tags: string[];
    mood: string;
    quality: string;
    publishScore: number;
  };
  status: string;
  isFavorite: boolean;
}

Page({
  data: {
    recommendations: [] as Recommendation[],
    recentUploads: [] as MediaItem[],
    loading: true,
    loadError: false,
  },

  onShow() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadData() {
    this.setData({ loading: true, loadError: false });
    try {
      const [recResult, mediaResult] = await Promise.all([
        request<{ recommendations: Recommendation[] }>({
          url: '/api/ai/recommend',
          method: 'POST',
          data: { limit: 5 },
        }),
        request<{ items: MediaItem[]; total: number }>({
          url: '/api/media/list?pageSize=10',
          method: 'GET',
        }),
      ]);
      this.setData({
        recommendations: recResult.recommendations || [],
        recentUploads: mediaResult.items || [],
        loading: false,
      });
    } catch (err) {
      console.error('Failed to load home data:', err);
      this.setData({ loading: false, loadError: true });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  tapRecommendation(e: WechatMiniprogram.TouchEvent) {
    const rec = e.currentTarget.dataset.rec as Recommendation;
    const mediaIds = encodeURIComponent(JSON.stringify(rec.mediaIds));
    wx.navigateTo({
      url: `/pages/compose/compose?mediaIds=${mediaIds}&title=${encodeURIComponent(rec.suggestedTitle)}`,
    });
  },

  tapMedia(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`,
    });
  },

  tapUpload() {
    wx.navigateTo({
      url: '/pages/upload/upload',
    });
  },
});
