import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { uploadFile, request } from '../api/client';
import type { AnalyzeResponse, UploadResponse } from '@shared/types';

type Phase = 'selecting' | 'uploading' | 'done';

interface FileEntry {
  file: File;
  previewUrl: string;
}

interface UploadItem {
  file: File;
  previewUrl: string;
  progress: number;
  status: 'pending' | 'uploading' | 'analyzing' | 'done' | 'skipped' | 'error';
  error?: string;
}

export default function UploadPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>('selecting');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);

  // Accept pre-selected files from HomePage navigation state
  useEffect(() => {
    const state = location.state as { files?: File[] } | null;
    if (state?.files && state.files.length > 0) {
      const entries: FileEntry[] = state.files.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      setFiles(entries);
      // Clear navigation state to avoid re-adding on remount
      window.history.replaceState({}, '');
    }
  }, []);

  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return;

    setFiles((prev) => {
      const added: FileEntry[] = [];
      for (let i = 0; i < incoming.length; i++) {
        const file = incoming[i];
        added.push({ file, previewUrl: URL.createObjectURL(file) });
      }
      return [...prev, ...added];
    });
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const startUpload = useCallback(async () => {
    if (files.length === 0) return;

    const items: UploadItem[] = files.map((f) => ({
      file: f.file,
      previewUrl: f.previewUrl,
      progress: 0,
      status: 'pending',
    }));

    setUploadItems(items);
    setPhase('uploading');

    let successCount = 0;

    for (let i = 0; i < items.length; i++) {
      // Mark uploading
      setUploadItems((prev) =>
        prev.map((item, idx) =>
          idx === i ? { ...item, status: 'uploading', progress: 0 } : item,
        ),
      );

      try {
        // Step 1: Upload file (0-70%)
        const uploadResult: UploadResponse = await uploadFile(items[i].file, (percent) => {
          const scaled = Math.round(percent * 0.7);
          setUploadItems((prev) =>
            prev.map((item, idx) =>
              idx === i ? { ...item, progress: scaled } : item,
            ),
          );
        });

        if (uploadResult.duplicate) {
          // Already uploaded — skip analyze
          setUploadItems((prev) =>
            prev.map((item, idx) =>
              idx === i
                ? { ...item, status: 'skipped', progress: 100 }
                : item,
            ),
          );
          successCount++;
          continue;
        }

        // Step 2: Analyze (70-100%)
        setUploadItems((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? { ...item, status: 'analyzing', progress: 70 }
              : item,
          ),
        );

        await request<AnalyzeResponse>('/api/ai/analyze', {
          method: 'POST',
          data: { mediaId: uploadResult.mediaId },
        });

        // Done
        setUploadItems((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? { ...item, status: 'done', progress: 100 }
              : item,
          ),
        );
        successCount++;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown error';
        setUploadItems((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? { ...item, status: 'error', error: message }
              : item,
          ),
        );
      }
    }

    setPhase('done');

    // Store success count for summary — use a ref-free approach via state
    // (successCount is already available in closure for the done phase render)
    void successCount;
  }, [files]);

  const reset = useCallback(() => {
    uploadItems.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setFiles([]);
    setUploadItems([]);
    setPhase('selecting');
  }, [uploadItems]);

  // --- Render: Selecting ---
  if (phase === 'selecting') {
    return (
      <div className="page">
        <div className="page-title-row">
          <button className="back-btn" onClick={() => navigate(-1)}>←</button>
          <h1 className="page-title">上传素材</h1>
        </div>

        <div
          className="upload-zone"
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <p>点击或拖拽图片/视频到这里</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            已选 {files.length} 个
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/mp4,video/quicktime"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        {files.length > 0 && (
          <>
            <div className="preview-grid">
              {files.map((entry, i) => (
                <div key={i} className="preview-item">
                  {entry.file.type.startsWith('video/') ? (
                    <video src={entry.previewUrl} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <img src={entry.previewUrl} alt="" />
                  )}
                  <button
                    className="remove-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(i);
                    }}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>

            <button className="btn-primary" onClick={startUpload}>
              开始上传（{files.length}）
            </button>
          </>
        )}
      </div>
    );
  }

  // --- Render: Uploading / Done ---
  const successCount = uploadItems.filter((i) => i.status === 'done').length;
  const skippedCount = uploadItems.filter((i) => i.status === 'skipped').length;
  const errorCount = uploadItems.filter((i) => i.status === 'error').length;

  return (
    <div className="page">
      <div className="page-title-row">
        <button className="back-btn" onClick={() => navigate('/')}>←</button>
        <h1 className="page-title">
          {phase === 'uploading' ? '上传中...' : '上传完成'}
        </h1>
      </div>

      {uploadItems.map((item, i) => (
        <div key={i} className="progress-item">
          {item.file.type.startsWith('video/') ? (
            <video
              src={item.previewUrl}
              muted
              playsInline
              preload="metadata"
              style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }}
            />
          ) : (
            <img
              src={item.previewUrl}
              alt=""
              style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }}
            />
          )}
          <div className="progress-info">
            <span style={{ fontSize: 13 }}>{item.file.name}</span>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${item.progress}%` }}
              />
            </div>
            <span className="progress-status">
              {item.status === 'pending' && '等待中'}
              {item.status === 'uploading' && `上传中 ${item.progress}%`}
              {item.status === 'analyzing' && '分析中...'}
              {item.status === 'done' && '完成'}
              {item.status === 'skipped' && '已存在，跳过'}
              {item.status === 'error' && `失败: ${item.error}`}
            </span>
          </div>
        </div>
      ))}

      {phase === 'done' && (
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <p style={{ marginBottom: 16 }}>
            成功 {successCount} 个
            {skippedCount > 0 && `，跳过 ${skippedCount} 个重复`}
            {errorCount > 0 && `，失败 ${errorCount} 个`}
          </p>
          <button
            className="btn-primary"
            onClick={() => navigate('/gallery')}
            style={{ marginRight: 12 }}
          >
            查看素材库
          </button>
          <button className="btn-secondary" onClick={reset}>
            继续上传
          </button>
        </div>
      )}
    </div>
  );
}
