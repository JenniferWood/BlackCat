import { CosmosClient, Container } from '@azure/cosmos';

let client: CosmosClient | null = null;
let container: Container | null = null;

export function getContainer(): Container {
  if (!container) {
    client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING!);
    const database = client.database(process.env.COSMOS_DATABASE_NAME || 'pidan-assistant');
    container = database.container(process.env.COSMOS_CONTAINER_NAME || 'media');
  }
  return container;
}

// 初始化数据库和容器（首次部署时调用一次）
export async function initDatabase(): Promise<void> {
  const cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING!);
  const dbName = process.env.COSMOS_DATABASE_NAME || 'pidan-assistant';
  const containerName = process.env.COSMOS_CONTAINER_NAME || 'media';

  await cosmosClient.databases.createIfNotExists({ id: dbName });
  await cosmosClient.database(dbName).containers.createIfNotExists({
    id: containerName,
    partitionKey: { paths: ['/id'] },
  });
}
