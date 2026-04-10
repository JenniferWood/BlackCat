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
    const analysisSummaries = items.map((item) => ({
      id: item.id,
      description: item.analysis?.description,
      tags: item.analysis?.tags,
      mood: item.analysis?.mood,
      quality: item.analysis?.quality,
      publishScore: item.analysis?.publishScore,
    }));

    const styleName = styleMap[body.style] ?? styleMap.auto;

    const client = getAIClient();
    const completion = await client.chat.completions.create({
      model: getDeploymentName(),
      messages: [
        {
          role: 'user',
          content: `你是小红书黑猫博主"皮蛋"的内容创作助手。
风格：${styleName}

基于这组照片的分析：
${JSON.stringify(analysisSummaries, null, 2)}

生成小红书帖子，返回 JSON：
{
  "title": "标题（15字以内，吸睛，可以用emoji）",
  "content": "正文（200-500字，适合小红书阅读，要有互动感）",
  "tags": ["#黑猫", "#猫咪日常", ...]
}
tags 要 10-15 个，包含通用热门标签和特定内容标签。`,
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
