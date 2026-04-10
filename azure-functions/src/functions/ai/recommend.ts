import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { getAIClient, getDeploymentName } from '../shared/ai-client';
import { getContainer } from '../shared/cosmos';
import { MediaItem, Recommendation, RecommendResponse } from '../../../../shared/types';

async function handler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const body = (await request.json()) as { limit?: number };
    const limit = body.limit ?? 3;

    const container = getContainer();

    // Query for analyzed items with publishScore >= 6, ordered by publishScore desc
    const { resources: items } = await container.items
      .query<MediaItem>({
        query:
          "SELECT TOP 50 * FROM c WHERE c.status = 'analyzed' AND c.analysis.publishScore >= 6 ORDER BY c.analysis.publishScore DESC",
      })
      .fetchAll();

    if (items.length === 0) {
      const response: RecommendResponse = { recommendations: [] };
      return { status: 200, jsonBody: response };
    }

    // Build summary for prompt
    const itemsSummary = items.map((item) => ({
      id: item.id,
      description: item.analysis?.description,
      tags: item.analysis?.tags,
      mood: item.analysis?.mood,
      publishScore: item.analysis?.publishScore,
    }));

    const client = getAIClient();
    const completion = await client.chat.completions.create({
      model: getDeploymentName(),
      messages: [
        {
          role: 'user',
          content: `你是小红书黑猫博主的内容策划助手。猫的名字叫皮蛋。
以下是素材库中未发布的高分照片分析结果：
${JSON.stringify(itemsSummary, null, 2)}

请推荐 ${limit} 组适合发布的内容组合，每组 1-9 张图。考虑：
- 主题一致性（能讲一个小故事）
- 图片间的互补性/对比性
- 小红书的热门话题趋势

返回 JSON：
{
  "recommendations": [
    {
      "mediaIds": ["id1", "id2"],
      "reason": "推荐理由",
      "suggestedTitle": "建议标题",
      "suggestedStyle": "cozy"
    }
  ]
}
suggestedStyle 只能是: cozy, funny, aesthetic, auto`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const rawContent = completion.choices[0]?.message?.content;
    if (!rawContent) {
      return { status: 500, jsonBody: { error: 'AI returned empty response' } };
    }

    const parsed = JSON.parse(rawContent) as {
      recommendations: Array<{
        mediaIds: string[];
        reason: string;
        suggestedTitle: string;
        suggestedStyle: string;
      }>;
    };

    // Enrich each recommendation with id, createdAt, dismissed
    const now = new Date().toISOString();
    const recommendations: Recommendation[] = parsed.recommendations.map((rec) => ({
      id: uuidv4(),
      mediaIds: rec.mediaIds,
      reason: rec.reason,
      suggestedTitle: rec.suggestedTitle,
      suggestedStyle: rec.suggestedStyle as Recommendation['suggestedStyle'],
      createdAt: now,
      dismissed: false,
    }));

    const response: RecommendResponse = { recommendations };
    return { status: 200, jsonBody: response };
  } catch (err) {
    context.error('Recommend failed:', err);
    return { status: 500, jsonBody: { error: 'Internal server error' } };
  }
}

app.http('recommend', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'ai/recommend',
  handler,
});
