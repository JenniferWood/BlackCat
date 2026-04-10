import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import sharp from 'sharp';
import { getMediaContainer, getThumbnailContainer, uploadBlob, getBlobSasUrl } from '../shared/blob';
import { getContainer } from '../shared/cosmos';
import { MediaItem, UploadResponse } from '../../../../shared/types';

const execFileAsync = promisify(execFile);

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

    // Dedup: check if a file with the same hash already exists
    const fileHash = createHash('md5').update(fileBuffer).digest('hex');
    const cosmosContainer = getContainer();

    const { resources: existing } = await cosmosContainer.items
      .query({
        query: 'SELECT * FROM c WHERE c.fileHash = @hash',
        parameters: [{ name: '@hash', value: fileHash }],
      })
      .fetchAll();

    if (existing.length > 0) {
      const existingItem = existing[0] as MediaItem;
      const mediaContainer = getMediaContainer();
      const thumbnailContainer = getThumbnailContainer();
      const existingMediaBlobName = existingItem.blobUrl.split('/').pop()!;
      const existingThumbBlobName = existingItem.thumbnailUrl.split('/').pop()!;

      const response: UploadResponse = {
        mediaId: existingItem.id,
        blobUrl: getBlobSasUrl(mediaContainer, existingMediaBlobName),
        thumbnailUrl: getBlobSasUrl(thumbnailContainer, existingThumbBlobName),
        duplicate: true,
      };

      return { status: 200, jsonBody: response };
    }

    // Upload original to media container
    const mediaContainer = getMediaContainer();
    const blobUrl = await uploadBlob(mediaContainer, blobName, fileBuffer, contentType);

    // Generate thumbnail
    const thumbnailContainer = getThumbnailContainer();
    let thumbnailBuffer: Buffer;
    let thumbnailContentType: string;
    let thumbBlobName: string;

    if (getMediaType(contentType) === 'photo') {
      thumbnailBuffer = await sharp(fileBuffer)
        .resize(400, null, { withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      thumbnailContentType = 'image/jpeg';
      thumbBlobName = `${id}.jpg`;
    } else {
      // Video: extract first frame with ffmpeg as thumbnail
      const tempDir = await mkdtemp(join(tmpdir(), 'pidan-thumb-'));
      const videoPath = join(tempDir, `input.${ext}`);
      const framePath = join(tempDir, 'thumb.jpg');
      try {
        await writeFile(videoPath, fileBuffer);
        await execFileAsync('ffmpeg', [
          '-i', videoPath,
          '-ss', '1',
          '-frames:v', '1',
          '-vf', 'scale=400:-1',
          '-q:v', '2',
          '-y',
          framePath,
        ]);
        thumbnailBuffer = await readFile(framePath);
        thumbnailContentType = 'image/jpeg';
        thumbBlobName = `${id}.jpg`;
      } catch {
        // Fallback: no thumbnail for this video
        thumbnailBuffer = Buffer.alloc(0);
        thumbnailContentType = 'image/jpeg';
        thumbBlobName = `${id}.jpg`;
      } finally {
        await unlink(videoPath).catch(() => {});
        await unlink(framePath).catch(() => {});
      }
    }

    const thumbnailUrl = await uploadBlob(thumbnailContainer, thumbBlobName, thumbnailBuffer, thumbnailContentType);

    // Create MediaItem in Cosmos DB
    const originalFileName = (file as File).name || undefined;
    const mediaItem: MediaItem = {
      id,
      blobUrl,
      thumbnailUrl,
      originalFileName,
      fileHash,
      type: getMediaType(contentType),
      uploadedAt: new Date().toISOString(),
      status: 'new',
      isFavorite: false,
    };

    await cosmosContainer.items.create(mediaItem);

    const response: UploadResponse = {
      mediaId: id,
      blobUrl: getBlobSasUrl(mediaContainer, blobName),
      thumbnailUrl: getBlobSasUrl(thumbnailContainer, thumbBlobName),
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
