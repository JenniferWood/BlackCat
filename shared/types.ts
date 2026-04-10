// ==================== 素材 ====================

export interface MediaAnalysis {
  description: string;        // AI 描述（皮蛋在做什么）
  tags: string[];             // 开放式标签：动作、场景、姿态、情绪等
  mood: string;               // 情绪关键词：慵懒/调皮/优雅/呆萌...
  quality: number;            // 图片质量评分 1-10
  publishScore: number;       // 适合发布评分 1-10
}

export interface MediaItem {
  id: string;
  blobUrl: string;
  thumbnailUrl: string;
  originalFileName?: string;      // 上传时的原始文件名
  type: 'photo' | 'video';
  uploadedAt: string;           // ISO date

  analysis?: MediaAnalysis;     // AI 分析结果（上传后异步生成）

  status: 'new' | 'analyzed' | 'recommended' | 'drafted' | 'published';
  isFavorite: boolean;

  // 预留
  publishedAt?: string;
  postId?: string;
  metrics?: PostMetrics;
}

// ==================== 文案 ====================

export type ContentStyle = 'cozy' | 'funny' | 'aesthetic' | 'auto';

export interface PostDraft {
  id: string;
  mediaIds: string[];
  title: string;
  content: string;
  tags: string[];
  style: ContentStyle;
  createdAt: string;
  status: 'draft' | 'published';
  scheduledAt?: string;         // 预留：排期
}

// ==================== 推荐 ====================

export interface Recommendation {
  id: string;
  mediaIds: string[];
  reason: string;
  suggestedTitle: string;
  suggestedStyle: ContentStyle;
  createdAt: string;
  dismissed: boolean;
}

// ==================== 预留 ====================

export interface PostMetrics {
  likes: number;
  comments: number;
  favorites: number;
  views: number;
}

// ==================== API 请求/响应 ====================

export interface UploadResponse {
  mediaId: string;
  blobUrl: string;
  thumbnailUrl: string;
}

export interface AnalyzeResponse {
  mediaId: string;
  analysis: MediaAnalysis;
}

export interface GenerateRequest {
  mediaIds: string[];
  style: ContentStyle;
}

export interface GenerateResponse {
  title: string;
  content: string;
  tags: string[];
}

export interface RecommendResponse {
  recommendations: Recommendation[];
}

export interface MediaListRequest {
  page?: number;
  pageSize?: number;
  status?: MediaItem['status'];
  isFavorite?: boolean;
  search?: string;              // 按标签/描述搜索
  tags?: string[];              // 按标签筛选
}

export interface MediaListResponse {
  items: MediaItem[];
  total: number;
  page: number;
  pageSize: number;
}
