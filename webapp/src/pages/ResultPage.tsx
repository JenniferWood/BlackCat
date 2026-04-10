import type { GenerateResponse, MediaItem } from '@shared/types';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface ResultState extends GenerateResponse {
  media?: MediaItem[];
}

function getDatePrefix() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

export default function ResultPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const data = location.state as ResultState | null;

  const [toast, setToast] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!data) {
      navigate('/compose', { replace: true });
    }
  }, [data, navigate]);

  if (!data) return null;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label}已复制`);
    } catch {
      showToast('复制失败');
    }
  };

  const copyAll = () => {
    const tagsStr = data.tags.map((t) => `#${t}`).join(' ');
    let full = `${data.title}\n\n${data.content}\n\n${tagsStr}`;
    if (data.editingPrompt) {
      full += `\n\n--- 剪辑指导 ---\n${data.editingPrompt}`;
    }
    copyText(full, '全部内容');
  };

  const downloadImage = async (item: MediaItem, index: number) => {
    const res = await fetch(item.blobUrl);
    const blob = await res.blob();
    const ext = item.blobUrl.split('.').find((s) => /^(jpg|png|gif|webp)/i.test(s))?.split('?')[0] || 'jpg';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pidan-${getDatePrefix()}-${index + 1}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAll = async () => {
    if (!data.media?.length) return;
    setDownloading(true);
    try {
      for (let i = 0; i < data.media.length; i++) {
        await downloadImage(data.media[i], i);
        // Small delay between downloads to avoid browser blocking
        if (i < data.media.length - 1) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
      showToast(`已下载 ${data.media.length} 张图片`);
    } catch {
      showToast('部分下载失败');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">生成结果</h1>

      {/* 素材图片 */}
      {data.media && data.media.length > 0 && (
        <div className="result-card">
          <h3>使用的素材</h3>
          <div className="result-media-grid">
            {data.media.map((item) => (
              <div key={item.id} className="result-media-thumb">
                <img src={item.thumbnailUrl} alt="" />
              </div>
            ))}
          </div>
          <button
            className="btn-download-all"
            onClick={downloadAll}
            disabled={downloading}
          >
            {downloading ? '下载中...' : `下载全部素材（${data.media.length} 个）`}
          </button>
          <p className="download-hint">
            文件名格式：pidan-{getDatePrefix()}-序号，搜索 "pidan" 即可找到
          </p>
        </div>
      )}

      <div className="result-card">
        <h3>标题</h3>
        <div className="content">{data.title}</div>
        <button className="copy-btn" onClick={() => copyText(data.title, '标题')}>
          复制
        </button>
      </div>

      <div className="result-card">
        <h3>正文</h3>
        <div className="content">{data.content}</div>
        <button className="copy-btn" onClick={() => copyText(data.content, '正文')}>
          复制
        </button>
      </div>

      <div className="result-card">
        <h3>标签</h3>
        <div className="tag-list">
          {data.tags.map((tag) => (
            <span key={tag} className="tag">
              #{tag}
            </span>
          ))}
        </div>
        <button
          className="copy-btn"
          onClick={() => copyText(data.tags.map((t) => `#${t}`).join(' '), '标签')}
        >
          复制
        </button>
      </div>

      {data.editingPrompt && (
        <div className="result-card">
          <h3>剪辑指导</h3>
          <div className="content" style={{ whiteSpace: 'pre-wrap' }}>{data.editingPrompt}</div>
          <button className="copy-btn" onClick={() => copyText(data.editingPrompt!, '剪辑指导')}>
            复制
          </button>
        </div>
      )}

      <button className="btn-primary" onClick={copyAll}>
        复制全部文案
      </button>

      <div className="result-actions">
        <button className="btn-secondary" onClick={() => navigate(-1)}>
          重新生成
        </button>
        <button className="btn-secondary" onClick={() => navigate('/')}>
          返回首页
        </button>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
