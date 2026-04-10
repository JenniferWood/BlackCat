import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getAIClient, getDeploymentName } from '../shared/ai-client';
import { getContainer } from '../shared/cosmos';
import { getMediaContainer } from '../shared/blob';
import { MediaItem, MediaAnalysis, AnalyzeResponse } from '../../../../shared/types';

async function handler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const body = (await request.json()) as { mediaId?: string };
    if (!body.mediaId) {
      return { status: 400, jsonBody: { error: 'mediaId is required' } };
    }

    const container = getContainer();

    // Look up MediaItem by id (partition key is /id)
    const { resource: item } = await container.item(body.mediaId, body.mediaId).read<MediaItem>();
    if (!item) {
      return { status: 404, jsonBody: { error: 'Media not found' } };
    }

    // Download image from Blob Storage and convert to base64 (private container)
    const blobName = item.blobUrl.split('/').pop()!;
    const mediaContainer = getMediaContainer();
    const blobClient = mediaContainer.getBlockBlobClient(blobName);
    const downloadResponse = await blobClient.downloadToBuffer();
    const base64Image = downloadResponse.toString('base64');
    const ext = blobName.split('.').pop()?.toLowerCase();
    const extToMime: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
    const mimeType = extToMime[ext || ''] || 'image/jpeg';

    // Call GPT-4o Vision to analyze the photo
    const client = getAIClient();
    const completion = await client.chat.completions.create({
      model: getDeploymentName(),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `分析这张黑猫照片。猫的名字叫皮蛋。请返回 JSON：
{
  "description": "简短描述猫在做什么、在哪里",
  "tags": ["标签1", "标签2"],
  "mood": "情绪关键词（如：慵懒、好奇、高冷、呆萌）",
  "quality": 8,
  "publishScore": 9
}
其中 quality 是图片质量评分 1-10（考虑清晰度、构图、光线），publishScore 是适合发小红书的程度 1-10。
tags 包含动作、场景、姿态、物体等开放式标签。`,
            },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64Image}` },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
    });

    const rawContent = completion.choices[0]?.message?.content;
    if (!rawContent) {
      return { status: 500, jsonBody: { error: 'AI returned empty response' } };
    }

    const analysis: MediaAnalysis = JSON.parse(rawContent);

    // Update the MediaItem in Cosmos DB
    await container.item(body.mediaId, body.mediaId).patch([
      { op: 'set', path: '/analysis', value: analysis },
      { op: 'set', path: '/status', value: 'analyzed' },
    ]);

    const response: AnalyzeResponse = { mediaId: body.mediaId, analysis };
    return { status: 200, jsonBody: response };
  } catch (err) {
    context.error('Analyze failed:', err);
    return { status: 500, jsonBody: { error: 'Internal server error' } };
  }
}

app.http('analyze', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'ai/analyze',
  handler,
});
