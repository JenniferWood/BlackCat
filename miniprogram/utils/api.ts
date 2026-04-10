const BASE_URL = 'http://localhost:7071'; // 开发时连本地后端，部署后改为 Azure Functions URL

interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
}

export function request<T>(options: RequestOptions): Promise<T> {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}${options.url}`,
      method: options.method || 'GET',
      data: options.data,
      header: { 'content-type': 'application/json' },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as T);
        } else {
          reject(new Error(`Request failed: ${res.statusCode}`));
        }
      },
      fail(err) {
        reject(err);
      },
    });
  });
}

export function uploadFile(filePath: string): Promise<{ mediaId: string; blobUrl: string; thumbnailUrl: string }> {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${BASE_URL}/api/media/upload`,
      filePath,
      name: 'file',
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(res.data));
        } else {
          reject(new Error(`Upload failed: ${res.statusCode}`));
        }
      },
      fail(err) {
        reject(err);
      },
    });
  });
}
