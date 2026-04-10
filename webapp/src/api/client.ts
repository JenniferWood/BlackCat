import type { UploadResponse } from '@shared/types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export async function request<T>(url: string, options?: { method?: string; data?: unknown }): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    method: options?.method || 'GET',
    headers: options?.data ? { 'Content-Type': 'application/json' } : undefined,
    body: options?.data ? JSON.stringify(options.data) : undefined,
  });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return res.json();
}

export function uploadFile(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE_URL}/api/media/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Upload network error'));

    const formData = new FormData();
    formData.append('file', file);
    xhr.send(formData);
  });
}
