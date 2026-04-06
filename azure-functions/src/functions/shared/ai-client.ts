import { AzureOpenAI } from 'openai';

let client: AzureOpenAI | null = null;

export function getAIClient(): AzureOpenAI {
  if (!client) {
    client = new AzureOpenAI({
      endpoint: process.env.AI_ENDPOINT!,
      apiKey: process.env.AI_API_KEY!,
      apiVersion: '2024-12-01-preview',
    });
  }
  return client;
}

export function getDeploymentName(): string {
  return process.env.AI_DEPLOYMENT_NAME || 'gpt-4o';
}
