import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getAIClient, getDeploymentName } from '../shared/ai-client';
import { getContainer } from '../shared/cosmos';
import { MediaItem, GenerateRequest, GenerateResponse, ContentStyle } from '../../../../shared/types';

const styleMap: Record<ContentStyle, string> = {
  cozy: '温馨日常',
  funny: '幽默撸猫',
  aesthetic: '文艺美学',
  auto: '自动选择最合适的风格',
};

async function handler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const body = (await request.json()) as GenerateRequest;

    if (!body.mediaIds || body.mediaIds.length === 0) {
      return { status: 400, jsonBody: { error: 'mediaIds is required and must not be empty' } };
    }
    if (!body.style) {
      return { status: 400, jsonBody: { error: 'style is required' } };
    }

    const container = getContainer();

    // Look up all MediaItems
    const items: MediaItem[] = [];
    const notFound: string[] = [];

    for (const mediaId of body.mediaIds) {
      const { resource } = await container.item(mediaId, mediaId).read<MediaItem>();
      if (resource) {
        items.push(resource);
      } else {
        notFound.push(mediaId);
      }
    }

    if (notFound.length > 0) {
      return {
        status: 400,
        jsonBody: { error: `Media not found: ${notFound.join(', ')}` },
      };
    }

    // Build analysis summaries
    const hasVideo = items.some((item) => item.type === 'video');
    const analysisSummaries = items.map((item, index) => ({
      index: index + 1,
      id: item.id,
      type: item.type,
      fileName: item.originalFileName || `素材${index + 1}`,
      description: item.analysis?.description,
      tags: item.analysis?.tags,
      mood: item.analysis?.mood,
      quality: item.analysis?.quality,
      publishScore: item.analysis?.publishScore,
      duration: item.analysis?.duration,
    }));

    const styleName = styleMap[body.style] ?? styleMap.auto;

    const editingPromptInstruction = hasVideo
      ? `

这组素材中包含视频。请额外生成一个 editingPrompt 字段，用于指导剪映（CapCut）视频剪辑：
- 建议素材排列顺序（用"素材1""素材2"等编号引用）
- 转场方式（如淡入淡出、滑动、闪白等）
- 文字叠加建议（标题卡、字幕内容和出现时机）
- 背景音乐风格/节奏建议
- 整体节奏把控（快剪/慢节奏/混合）
- 如何将照片和视频素材组合成连贯的短视频
editingPrompt 应该是一段完整的、可以直接粘贴到剪映的剪辑指导文字。`
      : '';

    const jsonFormat = hasVideo
      ? `{
  "title": "标题",
  "content": "正文",
  "tags": ["黑猫", "猫咪日常", ...],
  "editingPrompt": "剪辑指导..."
}`
      : `{
  "title": "标题",
  "content": "正文",
  "tags": ["黑猫", "猫咪日常", ...]
}`;

    const client = getAIClient();
    const completion = await client.chat.completions.create({
      model: getDeploymentName(),
      messages: [
        {
          role: 'user',
          content: `你是小红书黑猫博主"皮蛋"的文案写手。
风格：${styleName}

参考这组素材的分析：
${JSON.stringify(analysisSummaries, null, 2)}

生成一篇小红书帖子。写作要求：
- 标题：15字以内，要有网感，可用emoji，参考爆款标题格式（如"救命！皮蛋又…"、"被黑猫统治的第N天"）
- 正文：80-150字，短句为主，口语化，像在跟朋友聊天。不要写成作文。可以用emoji点缀但别堆砌。要有一句能引发互动的话（提问/征集/共鸣）
- 标签：5-8个，混合热门大标签(#黑猫 #猫咪日常)和具体小标签

禁止：
- 不要用"岁月静好""毛绒绒的小可爱"等烂梗
- 不要用连续排比句
- 不要写超过150字的正文
${editingPromptInstruction}

返回 JSON：
${jsonFormat}`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const rawContent = completion.choices[0]?.message?.content;
    if (!rawContent) {
      return { status: 500, jsonBody: { error: 'AI returned empty response' } };
    }

    const generated: GenerateResponse = JSON.parse(rawContent);

    return { status: 200, jsonBody: generated };
  } catch (err) {
    context.error('Generate failed:', err);
    return { status: 500, jsonBody: { error: 'Internal server error' } };
  }
}

app.http('generate', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'ai/generate',
  handler,
});
