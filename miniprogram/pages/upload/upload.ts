import { uploadFile, request } from '../../utils/api';

interface SelectedFile {
  tempFilePath: string;
  size: number;
}

interface UploadStatus {
  fileName: string;
  state: 'waiting' | 'uploading' | 'analyzing' | 'done' | 'error';
  progress: number;
  mediaId?: string;
  error?: string;
}

Page({
  data: {
    selectedFiles: [] as SelectedFile[],
    uploadStatuses: [] as UploadStatus[],
    isUploading: false,
    allDone: false,
    completedCount: 0,
    totalCount: 0,
  },

  chooseMedia() {
    wx.chooseMedia({
      count: 9,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newFiles: SelectedFile[] = res.tempFiles.map((f) => ({
          tempFilePath: f.tempFilePath,
          size: f.size,
        }));
        this.setData({
          selectedFiles: [...this.data.selectedFiles, ...newFiles],
        });
      },
    });
  },

  removeFile(e: WechatMiniprogram.TouchEvent) {
    const index = e.currentTarget.dataset.index as number;
    const files = [...this.data.selectedFiles];
    files.splice(index, 1);
    this.setData({ selectedFiles: files });
  },

  async startUpload() {
    const files = this.data.selectedFiles;
    if (files.length === 0) {
      wx.showToast({ title: '请先选择素材', icon: 'none' });
      return;
    }

    const statuses: UploadStatus[] = files.map((f, i) => ({
      fileName: `素材 ${i + 1}`,
      state: 'waiting' as const,
      progress: 0,
    }));

    this.setData({
      isUploading: true,
      allDone: false,
      uploadStatuses: statuses,
      completedCount: 0,
      totalCount: files.length,
    });

    for (let i = 0; i < files.length; i++) {
      // Update state to uploading
      this.updateStatus(i, { state: 'uploading', progress: 30 });

      try {
        // Upload
        const result = await uploadFile(files[i].tempFilePath);
        this.updateStatus(i, { state: 'analyzing', progress: 70, mediaId: result.mediaId });

        // AI analyze
        await request({
          url: '/api/ai/analyze',
          method: 'POST',
          data: { mediaId: result.mediaId },
        });

        this.updateStatus(i, { state: 'done', progress: 100 });
        this.setData({ completedCount: this.data.completedCount + 1 });
      } catch (err: any) {
        console.error(`Upload failed for file ${i}:`, err);
        this.updateStatus(i, {
          state: 'error',
          progress: 0,
          error: err.message || '上传失败',
        });
      }
    }

    this.setData({ allDone: true, isUploading: false });
  },

  updateStatus(index: number, patch: Partial<UploadStatus>) {
    const key = `uploadStatuses[${index}]`;
    const current = this.data.uploadStatuses[index];
    this.setData({
      [key]: { ...current, ...patch },
    });
  },

  goToGallery() {
    wx.switchTab({
      url: '/pages/gallery/gallery',
    });
  },

  resetPage() {
    this.setData({
      selectedFiles: [],
      uploadStatuses: [],
      isUploading: false,
      allDone: false,
      completedCount: 0,
      totalCount: 0,
    });
  },
});
