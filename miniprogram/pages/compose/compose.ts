import { request } from '../../utils/api';

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

interface MediaListResponse {
  items: MediaItem[];
  total: number;
  page: number;
  pageSize: number;
}

interface GenerateResponse {
  title: string;
  content: string;
  tags: string[];
}

type StyleType = 'cozy' | 'funny' | 'aesthetic' | 'auto';

Page({
  data: {
    mediaList: [] as MediaItem[],
    selectedIds: [] as string[],
    selectedStyle: 'auto' as StyleType,
    generating: false,
    maxSelect: 9,
    styles: [
      { key: 'cozy', emoji: '\u{1F3E1}', label: '温馨日常' },
      { key: 'funny', emoji: '\u{1F638}', label: '幽默撸猫' },
      { key: 'aesthetic', emoji: '\u{1F3A8}', label: '文艺美学' },
      { key: 'auto', emoji: '\u{2728}', label: '自动推荐' },
    ],
  },

  onLoad(options: Record<string, string | undefined>) {
    // Pre-select mediaIds passed from other pages (comma-separated)
    if (options.mediaIds) {
      const ids = options.mediaIds.split(',');
      this.setData({ selectedIds: ids });
    }
    this.loadMedia();
  },

  onShow() {
    // Refresh media list each time page is shown (e.g. returning from result)
    this.loadMedia();
  },

  async loadMedia() {
    try {
      const res = await request<MediaListResponse>({
        url: '/api/media/list?page=1&pageSize=100&status=analyzed',
      });
      this.setData({ mediaList: res.items || [] });
    } catch (err) {
      console.error('Failed to load media:', err);
      wx.showToast({ title: '加载素材失败', icon: 'none' });
    }
  },

  selectMedia(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    const { selectedIds, maxSelect } = this.data;
    const index = selectedIds.indexOf(id);

    if (index > -1) {
      // Deselect
      selectedIds.splice(index, 1);
      this.setData({ selectedIds: [...selectedIds] });
    } else {
      // Select (enforce max)
      if (selectedIds.length >= maxSelect) {
        wx.showToast({ title: `最多选择${maxSelect}张`, icon: 'none' });
        return;
      }
      this.setData({ selectedIds: [...selectedIds, id] });
    }
  },

  selectStyle(e: WechatMiniprogram.TouchEvent) {
    const style = e.currentTarget.dataset.style as StyleType;
    this.setData({ selectedStyle: style });
  },

  async generate() {
    const { selectedIds, selectedStyle, generating } = this.data;
    if (generating || selectedIds.length === 0) return;

    this.setData({ generating: true });

    try {
      const result = await request<GenerateResponse>({
        url: '/api/ai/generate',
        method: 'POST',
        data: {
          mediaIds: selectedIds,
          style: selectedStyle,
        },
      });

      // Navigate to result page and pass data via EventChannel
      wx.navigateTo({
        url: '/pages/result/result',
        success(res) {
          res.eventChannel.emit('generateResult', {
            title: result.title,
            content: result.content,
            tags: result.tags,
          });
        },
      });
    } catch (err) {
      console.error('Failed to generate:', err);
      wx.showToast({ title: '生成失败，请重试', icon: 'none' });
    } finally {
      this.setData({ generating: false });
    }
  },
});
