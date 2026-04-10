import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getContainer } from '../shared/cosmos';
import { getMediaContainer, getThumbnailContainer, deleteBlob } from '../shared/blob';
import { MediaItem } from '../../../../shared/types';

function extractBlobName(blobUrl: string): string {
  const url = new URL(blobUrl);
  const segments = url.pathname.split('/');
  return segments[segments.length - 1];
}

async function handler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const id = request.params.id;
  if (!id) {
    return { status: 400, jsonBody: { error: 'Missing media id' } };
  }

  try {
    const container = getContainer();

    // Read item from Cosmos DB
    const { resource: item } = await container.item(id, id).read<MediaItem>();
    if (!item) {
      return { status: 404, jsonBody: { error: 'Media item not found' } };
    }

    // Delete blob from media container
    const mediaBlobName = extractBlobName(item.blobUrl);
    await deleteBlob(getMediaContainer(), mediaBlobName);

    // Delete thumbnail from thumbnail container
    const thumbnailBlobName = extractBlobName(item.thumbnailUrl);
    await deleteBlob(getThumbnailContainer(), thumbnailBlobName);

    // Delete item from Cosmos DB
    await container.item(id, id).delete();

    return { status: 204 };
  } catch (err: unknown) {
    const error = err as { code?: number };
    if (error.code === 404) {
      return { status: 404, jsonBody: { error: 'Media item not found' } };
    }
    context.error('Failed to delete media item:', err);
    return { status: 500, jsonBody: { error: 'Internal server error' } };
  }
}

app.http('deleteMedia', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'media/{id}',
  handler,
});
