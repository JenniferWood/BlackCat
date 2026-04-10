import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getAIClient, getDeploymentName } from '../shared/ai-client';
import { getContainer } from '../shared/cosmos';
import { getMediaContainer } from '../shared/blob';
import { MediaItem, MediaAnalysis, AnalyzeResponse } from '../../../../shared/types';
import { extractFrames, MAX_VIDEO_SIZE_MB } from '../shared/video-frames';

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

    // Download from Blob Storage
    const blobName = item.blobUrl.split('/').pop()!;
    const mediaContainer = getMediaContainer();
    const blobClient = mediaContainer.getBlockBlobClient(blobName);
    const downloadResponse = await blobClient.downloadToBuffer();

    let analysis: MediaAnalysis;

    if (item.type === 'video') {
      // Video: check size limit
      if (downloadResponse.length > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
        return { status: 413, jsonBody: { error: `视频超过 ${MAX_VIDEO_SIZE_MB}MB 限制` } };
      }

      const ext = blobName.split('.').pop()?.toLowerCase() || 'mp4';
      const { duration, frames } = await extractFrames(downloadResponse, ext);

      if (frames.length === 0) {
        return { status: 500, jsonBody: { error: '视频帧提取失败' } };
      }

      // Build multi-frame GPT-4o Vision request
      const imageContents = frames.map((frame) => ({
        type: 'image_url' as const,
        image_url: { url: `data:image/jpeg;base64,${frame.toString('base64')}` },
      }));

      const client = getAIClient();
      const completion = await client.chat.completions.create({
        model: getDeploymentName(),
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `这是一段黑猫视频的关键帧截图（共${frames.length}帧，视频时长${Math.round(duration)}秒）。猫的名字叫皮蛋。
请根据所有帧综合分析视频内容。描述应涵盖视频中发生的动作/事件流程，而不只是单帧描述。
请返回 JSON：
{
  "description": "描述视频中猫在做什么（过程描述）",
  "tags": ["标签1", "标签2"],
  "mood": "情绪关键词（如：慵懒、好奇、高冷、呆萌）",
  "quality": 8,
  "publishScore": 9
}
quality 是视频质量评分 1-10（考虑清晰度、构图、稳定性、光线），publishScore 是适合发小红书的程度 1-10。
tags 包含动作、场景、姿态、物体等开放式标签。`,
              },
              ...imageContents,
            ],
          },
        ],
        response_format: { type: 'json_object' },
      });

      const rawContent = completion.choices[0]?.message?.content;
      if (!rawContent) {
        return { status: 500, jsonBody: { error: 'AI returned empty response' } };
      }

      analysis = JSON.parse(rawContent);
      // Use exact duration from ffmpeg, not AI's guess
      analysis.duration = Math.round(duration * 10) / 10;
    } else {
      // Photo: existing logic
      const base64Image = downloadResponse.toString('base64');
      const ext = blobName.split('.').pop()?.toLowerCase();
      const extToMime: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
      const mimeType = extToMime[ext || ''] || 'image/jpeg';

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

      analysis = JSON.parse(rawContent);
    }

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
