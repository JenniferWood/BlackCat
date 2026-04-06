# 皮蛋助手 - 小红书黑猫内容管理平台

## Context

用户是小红书黑猫博主（猫叫皮蛋），有约900张黑猫照片/视频。需要一个平台来：
1. 管理所有素材（智能分类、搜索、状态追踪、收藏）
2. AI 主动推荐发什么内容（上传时自动 + 手动触发）
3. 手动选图让 AI 生成文案（标题/正文/tags）

技术栈：微信小程序 + Azure Functions (TypeScript) + Azure AI Foundry + Azure Blob Storage + Azure Cosmos DB

## 整体架构

```
┌─────────────────┐     HTTPS      ┌──────────────────────┐     API      ┌────────────────┐
│  微信小程序       │ ─────────────> │  Azure Functions     │ ──────────> │ Azure AI       │
│  (前端)          │ <───────────── │  (TypeScript)        │ <────────── │ Foundry        │
└─────────────────┘                │                      │             │ (GPT-4o Vision)│
                                   │                      │             └────────────────┘
       │                           │  Media APIs:         │
       │ wx.chooseMedia            │  - /api/media/upload │
       │                           │  - /api/media/list   │
       ▼                           │  - /api/media/search │
  手机相册                          │                      │
                                   │  AI APIs:            │
                                   │  - /api/ai/analyze   │
                                   │  - /api/ai/recommend │
                                   │  - /api/ai/generate  │
                                   └──────┬───────────────┘
                                          │
                              ┌───────────┼───────────┐
                              ▼                       ▼
                       ┌──────────────┐     ┌──────────────┐
                       │ Azure Blob   │     │ Azure Cosmos │
                       │ Storage      │     │ DB (Free)    │
                       │ (照片/视频)   │     │ (元数据/标签) │
                       └──────────────┘     └──────────────┘
```

## 数据模型

### MediaItem（素材）
```typescript
interface MediaItem {
  id: string;
  blobUrl: string;              // Azure Blob 存储 URL
  thumbnailUrl: string;         // 缩略图 URL
  type: 'photo' | 'video';
  uploadedAt: string;           // ISO date
  
  // AI 分析结果（上传时自动生成）
  analysis: {
    description: string;        // AI 描述（皮蛋在做什么）
    tags: string[];             // 自动标签：["睡觉", "沙发", "侧躺"]
    mood: string;               // 情绪：慵懒/调皮/优雅/呆萌...
    quality: number;            // 图片质量评分 1-10
    publishScore: number;       // 适合发布评分 1-10
  };
  
  // 状态管理
  status: 'new' | 'recommended' | 'drafted' | 'published';
  isFavorite: boolean;
  
  // 预留字段
  publishedAt?: string;         // 发布时间（日历排期用）
  postId?: string;              // 关联的帖子ID
  metrics?: PostMetrics;        // 数据分析用
}

interface PostDraft {
  id: string;
  mediaIds: string[];           // 关联的素材
  title: string;
  content: string;
  tags: string[];
  style: ContentStyle;
  createdAt: string;
  status: 'draft' | 'published';
  scheduledAt?: string;         // 排期用
}

interface Recommendation {
  id: string;
  mediaIds: string[];           // 推荐的素材组合
  reason: string;               // 推荐理由
  suggestedTitle: string;
  suggestedStyle: ContentStyle;
  createdAt: string;
  dismissed: boolean;
}

type ContentStyle = 'cozy' | 'funny' | 'aesthetic' | 'auto';

// 预留
interface PostMetrics {
  likes: number;
  comments: number;
  favorites: number;
  views: number;
}
```

## 项目结构

```
BlackCat/
├── miniprogram/                 # 微信小程序前端
│   ├── app.ts
│   ├── app.json
│   ├── app.wxss
│   ├── pages/
│   │   ├── home/                # 首页 - 素材库 + 推荐
│   │   ├── upload/              # 批量上传页
│   │   ├── gallery/             # 素材库浏览（分类/搜索/筛选）
│   │   ├── detail/              # 素材详情（AI分析结果）
│   │   ├── compose/             # 创作页 - 选图+生成文案
│   │   └── result/              # 文案结果页 - 编辑+复制
│   ├── components/
│   │   ├── media-card/          # 素材卡片（带状态角标）
│   │   ├── tag-pill/            # 标签组件
│   │   ├── recommend-card/      # 推荐卡片
│   │   └── style-picker/       # 风格选择器
│   ├── utils/
│   │   ├── api.ts               # API 请求封装
│   │   └── config.ts
│   └── typings/
│       └── index.d.ts
├── azure-functions/             # Azure Functions 后端
│   ├── package.json
│   ├── tsconfig.json
│   ├── host.json
│   ├── local.settings.json      # 本地环境变量（.gitignore）
│   └── src/
│       └── functions/
│           ├── media/
│           │   ├── upload.ts    # 批量上传 → Blob + 触发分析
│           │   ├── list.ts      # 列表/筛选/搜索
│           │   ├── update.ts    # 更新状态/收藏
│           │   └── delete.ts    # 删除素材
│           ├── ai/
│           │   ├── analyze.ts   # Azure AI Foundry 分析单张图
│           │   ├── recommend.ts # 从素材库推荐内容组合
│           │   └── generate.ts  # 生成小红书文案
│           └── shared/
│               ├── ai-client.ts # Azure AI Foundry 封装（OpenAI兼容SDK）
│               ├── cosmos.ts    # Cosmos DB 封装
│               └── blob.ts     # Blob Storage 封装
├── shared/                      # 前后端共享类型
│   └── types.ts
├── .gitignore
└── package.json
```

## 实现计划

### Phase 1: 项目骨架（基础设施）
1. 初始化微信小程序项目（TypeScript）
2. 初始化 Azure Functions 项目（TypeScript, Node 20）
3. 共享类型定义 (`shared/types.ts`)
4. `.gitignore` 配置
5. 后端基础封装：`ai-client.ts`（Azure AI Foundry，OpenAI兼容SDK）, `cosmos.ts`, `blob.ts`
- **验证**：`cd azure-functions && npm run build` 编译通过；微信开发者工具能打开小程序项目且无报错

### Phase 2: 素材管理后端
6. `upload.ts` — 接收图片 → 生成缩略图 → 存 Blob → 写 Cosmos DB
7. `list.ts` — 分页列表、按标签/状态/收藏筛选、搜索
8. `update.ts` — 更新收藏状态、发布状态
9. `delete.ts` — 删除素材
- **验证**：`func start` 本地启动后，用 curl 完成完整 CRUD 流程：上传一张图 → 列表能查到 → 更新收藏 → 删除 → 列表为空

### Phase 3: AI 能力后端
10. `analyze.ts` — Azure AI Foundry (GPT-4o Vision) 分析照片（描述、标签、情绪、质量评分、发布推荐分）
11. `recommend.ts` — 从素材库中选出适合发布的组合，给出推荐理由和建议标题
12. `generate.ts` — 根据选中的照片+风格偏好，生成完整小红书文案
- **验证**：上传 3 张皮蛋真实照片 → analyze 返回合理的描述和标签 → recommend 返回推荐组合 → generate 返回可直接发小红书的标题/正文/tags

### Phase 4: 小程序前端
13. **首页 (home)** — 顶部推荐卡片 + 最近上传的素材
14. **上传页 (upload)** — 批量选图上传，进度条，上传后自动触发 AI 分析
15. **素材库 (gallery)** — 瀑布流展示，支持按分类标签筛选、搜索、状态筛选（已发/未发/收藏）
16. **素材详情 (detail)** — 大图预览 + AI 分析结果 + 操作（收藏/删除/去创作）
17. **创作页 (compose)** — 从素材库选图 or 从推荐进入，选风格，一键生成文案
18. **结果页 (result)** — 展示标题/正文/tags，支持编辑、重新生成、一键复制全文
- **验证**：微信开发者工具中，连接本地后端（`func start`），走通完整流程：选图上传 → 浏览素材库 → 点击推荐 → 生成文案 → 复制文案内容

### Phase 5: 联调优化
19. 端到端串联测试
20. UI 美化（黑猫主题：深色调 + 猫爪元素）
21. 加载状态、错误处理、空态页面
- **验证**：在微信开发者工具的真机预览模式下，完整跑通所有页面，无白屏/无报错/加载状态正常显示

### Phase 6: Azure 后端部署上线
22. **创建 Azure 资源**
    - 在 Azure Portal 创建 Resource Group（如 `rg-pidan-assistant`）
    - 创建 Storage Account（Blob Storage 用于存图片）
    - 创建 Cosmos DB 账户（选免费层 Free Tier，1000 RU/s）
    - 在 Azure AI Foundry 部署 GPT-4o 模型，获取 endpoint 和 key
23. **部署 Azure Functions**
    - 在 Azure Portal 创建 Function App（Node 20, Consumption Plan 按量计费）
    - 配置环境变量（Application Settings）：Cosmos DB 连接串、Blob 连接串、AI Foundry endpoint/key
    - 用 VS Code Azure Functions 扩展或 `func azure functionapp publish <app-name>` 一键部署
    - 配置 CORS：允许微信小程序域名
24. **配置自定义域名 + HTTPS**（可选）
    - Azure Functions 自带 `*.azurewebsites.net` 域名和 HTTPS，可直接用
    - 如需自定义域名，在 Function App → Custom domains 绑定
- **验证**：用 curl 请求线上 API `https://<app-name>.azurewebsites.net/api/media/list`，返回 200 且数据正确

### Phase 7: 微信小程序部署上线
25. **注册微信小程序**
    - 在 [mp.weixin.qq.com](https://mp.weixin.qq.com) 注册个人小程序账号
    - 完成实名认证
    - 获取 AppID
26. **配置服务器域名**
    - 在小程序管理后台 → 开发管理 → 开发设置 → 服务器域名
    - 添加 `request 合法域名`：你的 Azure Functions URL（如 `https://pidan-api.azurewebsites.net`）
    - 添加 `uploadFile 合法域名`：同上（用于上传图片）
27. **提交审核发布**
    - 在微信开发者工具中点击「上传」→ 填写版本号和备注
    - 登录小程序管理后台 → 版本管理 → 提交审核
    - 审核通过后点击「发布」
    - 注意：个人小程序有类目限制，选择「工具」类目即可
- **验证**：用手机微信搜索小程序名称，能打开并完成：上传照片 → AI 分析 → 生成文案 → 复制

### Phase 8: CI/CD（可选，后续优化）
28. **Azure Functions 自动部署**
    - GitHub Actions：push 到 main 分支时自动部署到 Azure Functions
    - 或用 Azure DevOps Pipeline
29. **小程序自动上传**
    - 使用 `miniprogram-ci` npm 包实现命令行上传
    - 可集成到 CI 流程中
- **验证**：push 一个小改动到 main 分支 → GitHub Actions 自动触发 → Azure Functions 更新成功

## 关键 Prompt 设计

### 分析 Prompt（analyze）
```
分析这张黑猫照片。请返回 JSON：
{
  "description": "简短描述猫在做什么、在哪里",
  "tags": ["标签1", "标签2", ...],  // 动作、场景、姿态、物体等
  "mood": "情绪关键词",  // 如：慵懒、好奇、高冷、呆萌
  "quality": 8,  // 图片质量 1-10（清晰度、构图、光线）
  "publishScore": 9  // 适合发小红书的程度 1-10
}
```

### 推荐 Prompt（recommend）
```
你是小红书黑猫博主的内容策划助手。猫的名字叫皮蛋。
以下是素材库中未发布的高分照片分析结果：
[素材列表]

请推荐 1-3 组适合发布的内容组合，每组 1-9 张图。考虑：
- 主题一致性（能讲一个小故事）
- 图片间的互补性/对比性
- 小红书的热门话题趋势
返回 JSON 数组...
```

### 生成 Prompt（generate）
```
你是小红书黑猫博主"皮蛋"的内容创作助手。
风格：{cozy: 温馨日常 | funny: 幽默撸猫 | aesthetic: 文艺美学}

基于这组照片的分析：[分析结果]

生成小红书帖子：
{
  "title": "标题（15字以内，吸睛）",
  "content": "正文（200-500字，适合小红书阅读）",
  "tags": ["#黑猫", "#猫咪日常", ...]  // 10-15个tags
}
```

## 验证方式

每个 Phase 都有明确的验证标准，详见各 Phase 末尾的 **验证** 行。总结：

| Phase | 验证方式 |
|---|---|
| 1 骨架 | `npm run build` 编译通过 + 微信开发者工具无报错 |
| 2 素材管理 | 本地 `func start` + curl 完成 CRUD 全流程 |
| 3 AI 能力 | 上传真实照片 → 分析/推荐/生成文案均返回合理结果 |
| 4 前端 | 开发者工具连本地后端，走通完整用户流程 |
| 5 联调优化 | 真机预览模式全流程无报错 |
| 6 Azure 部署 | curl 线上 API 返回 200 |
| 7 小程序上线 | 手机微信搜索打开，完整走通上传→生成→复制 |
| 8 CI/CD | push 触发自动部署成功 |
