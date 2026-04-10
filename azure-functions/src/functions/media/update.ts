import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getContainer } from '../shared/cosmos';
import { MediaItem } from '../../../../shared/types';

interface UpdateMediaBody {
  isFavorite?: boolean;
  status?: MediaItem['status'];
}

async function handler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const id = request.params.id;
    if (!id) {
      return {
        status: 400,
        jsonBody: { error: 'Missing media id' },
      };
    }

    const body = (await request.json()) as UpdateMediaBody;
    if (body.isFavorite === undefined && body.status === undefined) {
      return {
        status: 400,
        jsonBody: { error: 'Request body must include at least one of: isFavorite, status' },
      };
    }

    const container = getContainer();

    // Read existing item (partition key is id)
    let existing: MediaItem;
    try {
      const { resource } = await container.item(id, id).read<MediaItem>();
      if (!resource) {
        return {
          status: 404,
          jsonBody: { error: 'Media item not found' },
        };
      }
      existing = resource;
    } catch (err: any) {
      if (err.code === 404) {
        return {
          status: 404,
          jsonBody: { error: 'Media item not found' },
        };
      }
      throw err;
    }

    // Merge update fields
    if (body.isFavorite !== undefined) {
      existing.isFavorite = body.isFavorite;
    }
    if (body.status !== undefined) {
      existing.status = body.status;
    }

    // Replace item in Cosmos DB
    const { resource: updated } = await container.item(id, id).replace<MediaItem>(existing);

    return {
      status: 200,
      jsonBody: updated,
    };
  } catch (error) {
    context.error('Failed to update media:', error);
    return {
      status: 500,
      jsonBody: { error: 'Failed to update media' },
    };
  }
}

app.http('mediaUpdate', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'media/{id}',
  handler,
});
