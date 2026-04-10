import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getContainer } from '../shared/cosmos';
import { getMediaContainer, getThumbnailContainer, getBlobSasUrl } from '../shared/blob';
import { MediaItem, MediaListResponse } from '../../../../shared/types';

async function handler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const page = Math.max(1, parseInt(request.query.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(request.query.get('pageSize') || '20', 10)));
    const status = request.query.get('status') || undefined;
    const isFavoriteParam = request.query.get('isFavorite');
    const search = request.query.get('search') || undefined;
    const tagsParam = request.query.get('tags') || undefined;

    const conditions: string[] = [];
    const parameters: { name: string; value: string | number | boolean }[] = [];

    if (status) {
      conditions.push('c.status = @status');
      parameters.push({ name: '@status', value: status });
    }

    if (isFavoriteParam !== null && isFavoriteParam !== undefined) {
      const isFavorite = isFavoriteParam === 'true';
      conditions.push('c.isFavorite = @isFavorite');
      parameters.push({ name: '@isFavorite', value: isFavorite });
    }

    if (search) {
      conditions.push('(CONTAINS(c.analysis.description, @search, true) OR ARRAY_CONTAINS(c.analysis.tags, @search))');
      parameters.push({ name: '@search', value: search });
    }

    if (tagsParam) {
      const tags = tagsParam.split(',').map(t => t.trim()).filter(Boolean);
      for (let i = 0; i < tags.length; i++) {
        conditions.push(`ARRAY_CONTAINS(c.analysis.tags, @tag${i})`);
        parameters.push({ name: `@tag${i}`, value: tags[i] });
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * pageSize;

    // Query items with pagination
    const querySpec = {
      query: `SELECT * FROM c ${whereClause} ORDER BY c.uploadedAt DESC OFFSET @offset LIMIT @limit`,
      parameters: [
        ...parameters,
        { name: '@offset', value: offset },
        { name: '@limit', value: pageSize },
      ],
    };

    // Query total count
    const countSpec = {
      query: `SELECT VALUE COUNT(1) FROM c ${whereClause}`,
      parameters,
    };

    const container = getContainer();
    const [itemsResult, countResult] = await Promise.all([
      container.items.query<MediaItem>(querySpec).fetchAll(),
      container.items.query<number>(countSpec).fetchAll(),
    ]);

    const items = itemsResult.resources;
    const total = countResult.resources[0] ?? 0;

    // Generate SAS URLs for private blob access
    const mediaContainer = getMediaContainer();
    const thumbContainer = getThumbnailContainer();
    const itemsWithSas = items.map(item => {
      const blobName = item.blobUrl.split('/').pop()!;
      return {
        ...item,
        blobUrl: getBlobSasUrl(mediaContainer, blobName),
        thumbnailUrl: getBlobSasUrl(thumbContainer, blobName),
      };
    });

    const body: MediaListResponse = { items: itemsWithSas, total, page, pageSize };

    return {
      status: 200,
      jsonBody: body,
    };
  } catch (error) {
    context.error('Failed to list media:', error);
    return {
      status: 500,
      jsonBody: { error: 'Failed to list media' },
    };
  }
}

app.http('mediaList', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'media/list',
  handler,
});
