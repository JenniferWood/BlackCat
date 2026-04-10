Page({
  data: {
    title: '',
    content: '',
    tags: [] as string[],
    editingPrompt: '',
    loaded: false,
  },

  onLoad() {
    const eventChannel = this.getOpenerEventChannel();
    eventChannel.on('generateResult', (data: { title: string; content: string; tags: string[]; editingPrompt?: string }) => {
      this.setData({
        title: data.title || '',
        content: data.content || '',
        tags: data.tags || [],
        editingPrompt: data.editingPrompt || '',
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

  copyEditingPrompt() {
    wx.setClipboardData({
      data: this.data.editingPrompt,
      success() {
        wx.showToast({ title: '剪辑指导已复制', icon: 'success' });
      },
    });
  },

  copyAll() {
    const { title, content, tags, editingPrompt } = this.data;
    let text = `${title}\n\n${content}\n\n${tags.join(' ')}`;
    if (editingPrompt) {
      text += `\n\n--- 剪辑指导 ---\n${editingPrompt}`;
    }
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
