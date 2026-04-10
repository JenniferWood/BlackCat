import { BlobServiceClient, ContainerClient, generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential, SASProtocol } from '@azure/storage-blob';

let containerClient: ContainerClient | null = null;
let thumbnailContainerClient: ContainerClient | null = null;

function getBlobServiceClient(): BlobServiceClient {
  return BlobServiceClient.fromConnectionString(process.env.BLOB_CONNECTION_STRING!);
}

export function getMediaContainer(): ContainerClient {
  if (!containerClient) {
    const blobService = getBlobServiceClient();
    const containerName = process.env.BLOB_CONTAINER_NAME || 'media-files';
    containerClient = blobService.getContainerClient(containerName);
  }
  return containerClient;
}

export function getThumbnailContainer(): ContainerClient {
  if (!thumbnailContainerClient) {
    const blobService = getBlobServiceClient();
    thumbnailContainerClient = blobService.getContainerClient('thumbnails');
  }
  return thumbnailContainerClient;
}

// 初始化 Blob 容器（首次部署时调用一次）
export async function initBlobContainers(): Promise<void> {
  const mediaContainer = getMediaContainer();
  await mediaContainer.createIfNotExists();

  const thumbContainer = getThumbnailContainer();
  await thumbContainer.createIfNotExists();
}

export async function uploadBlob(
  containerClient: ContainerClient,
  blobName: string,
  data: Buffer,
  contentType: string,
): Promise<string> {
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.upload(data, data.length, {
    blobHTTPHeaders: { blobContentType: contentType },
  });
  return blockBlobClient.url;
}

export async function deleteBlob(containerClient: ContainerClient, blobName: string): Promise<void> {
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.deleteIfExists();
}

export function getBlobSasUrl(containerClient: ContainerClient, blobName: string, expiresInMinutes = 60): string {
  const connStr = process.env.BLOB_CONNECTION_STRING!;
  const accountName = connStr.match(/AccountName=([^;]+)/)?.[1]!;
  const accountKey = connStr.match(/AccountKey=([^;]+)/)?.[1]!;
  const credential = new StorageSharedKeyCredential(accountName, accountKey);

  const expiresOn = new Date();
  expiresOn.setMinutes(expiresOn.getMinutes() + expiresInMinutes);

  const sas = generateBlobSASQueryParameters({
    containerName: containerClient.containerName,
    blobName,
    permissions: BlobSASPermissions.parse('r'),
    expiresOn,
    protocol: SASProtocol.Https,
  }, credential).toString();

  return `${containerClient.getBlockBlobClient(blobName).url}?${sas}`;
}
