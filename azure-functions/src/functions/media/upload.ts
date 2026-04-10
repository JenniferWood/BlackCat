import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { getMediaContainer, getThumbnailContainer, uploadBlob, getBlobSasUrl } from '../shared/blob';
import { getContainer } from '../shared/cosmos';
import { MediaItem, UploadResponse } from '../../../../shared/types';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

function getMediaType(contentType: string): 'photo' | 'video' {
  return contentType.startsWith('video/') ? 'video' : 'photo';
}

async function handler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return {
        status: 400,
        jsonBody: { error: 'Missing or invalid file in form data. Expected a "file" field.' },
      };
    }

    const contentType = file.type || 'application/octet-stream';
    const ext = MIME_TO_EXT[contentType];
    if (!ext) {
      return {
        status: 415,
        jsonBody: { error: `Unsupported media type: ${contentType}` },
      };
    }

    const id = uuidv4();
    const blobName = `${id}.${ext}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Upload original to media container
    const mediaContainer = getMediaContainer();
    const blobUrl = await uploadBlob(mediaContainer, blobName, fileBuffer, contentType);

    // TODO: Generate a real thumbnail (e.g. with sharp) instead of uploading a full-size copy.
    // For now, upload the same image as the thumbnail.
    const thumbnailContainer = getThumbnailContainer();
    const thumbnailUrl = await uploadBlob(thumbnailContainer, blobName, fileBuffer, contentType);

    // Create MediaItem in Cosmos DB
    const originalFileName = (file as File).name || undefined;
    const mediaItem: MediaItem = {
      id,
      blobUrl,
      thumbnailUrl,
      originalFileName,
      type: getMediaType(contentType),
      uploadedAt: new Date().toISOString(),
      status: 'new',
      isFavorite: false,
    };

    const cosmosContainer = getContainer();
    await cosmosContainer.items.create(mediaItem);

    const response: UploadResponse = {
      mediaId: id,
      blobUrl: getBlobSasUrl(mediaContainer, blobName),
      thumbnailUrl: getBlobSasUrl(thumbnailContainer, blobName),
    };

    return {
      status: 201,
      jsonBody: response,
    };
  } catch (error) {
    context.error('Upload failed:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error during file upload.' },
    };
  }
}

app.http('mediaUpload', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'media/upload',
  handler,
});
