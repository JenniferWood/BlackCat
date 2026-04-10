Page({
  data: {
    title: '',
    content: '',
    tags: [] as string[],
    loaded: false,
  },

  onLoad() {
    const eventChannel = this.getOpenerEventChannel();
    eventChannel.on('generateResult', (data: { title: string; content: string; tags: string[] }) => {
      this.setData({
        title: data.title || '',
        content: data.content || '',
        tags: data.tags || [],
        loaded: true,
      });
    });
  },

  copyTitle() {
    wx.setClipboardData({
      data: this.data.title,
      success() {
        wx.showToast({ title: '标题已复制', icon: 'success' });
      },
    });
  },

  copyContent() {
    wx.setClipboardData({
      data: this.data.content,
      success() {
        wx.showToast({ title: '正文已复制', icon: 'success' });
      },
    });
  },

  copyTags() {
    wx.setClipboardData({
      data: this.data.tags.join(' '),
      success() {
        wx.showToast({ title: '标签已复制', icon: 'success' });
      },
    });
  },

  copyAll() {
    const { title, content, tags } = this.data;
    const text = `${title}\n\n${content}\n\n${tags.join(' ')}`;
    wx.setClipboardData({
      data: text,
      success() {
        wx.showToast({ title: '全部已复制', icon: 'success' });
      },
    });
  },

  regenerate() {
    wx.navigateBack();
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' });
  },
});
