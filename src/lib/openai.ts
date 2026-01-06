import OpenAI from 'openai';
import { getOpenAIKey, getSetting } from '../services/settingsService';

let openaiInstance: OpenAI | null = null;
let cachedApiKey: string | null = null;

export async function getOpenAI(): Promise<OpenAI> {
  const apiKey = await getOpenAIKey();

  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_openai_api_key_here') {
    const keySource = await getKeySource();
    throw new Error(
      `Chave OpenAI não configurada. ` +
      `Origem tentada: ${keySource}. ` +
      `Configure sua chave em Configurações.`
    );
  }

  if (openaiInstance && cachedApiKey === apiKey) {
    return openaiInstance;
  }

  openaiInstance = new OpenAI({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true
  });
  cachedApiKey = apiKey;

  return openaiInstance;
}

export async function resetOpenAI() {
  openaiInstance = null;
  cachedApiKey = null;
}

async function getKeySource(): Promise<string> {
  const sources: string[] = [];

  const userKey = await getSetting('openai_api_key');
  if (userKey && userKey.trim() !== '' && userKey !== 'your_openai_api_key_here') {
    sources.push('chave pessoal do usuário');
  }

  const envKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (envKey && envKey.trim() !== '' && envKey !== 'your_openai_api_key_here') {
    sources.push('chave global do sistema');
  }

  return sources.length > 0 ? sources.join(' ou ') : 'nenhuma';
}

export async function testOpenAIConnection(): Promise<{ success: boolean; error?: string; model?: string }> {
  try {
    const openai = await getOpenAI();
    const models = await getModels();

    const response = await openai.chat.completions.create({
      model: models.GPT4_TURBO,
      messages: [{ role: 'user', content: 'test' }],
      max_completion_tokens: 5
    });

    return {
      success: true,
      model: models.GPT4_TURBO
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Erro desconhecido ao testar conexão'
    };
  }
}

export async function getModels() {
  const gptModel = await getSetting('openai_model') || 'gpt-5-nano';
  const embeddingModel = await getSetting('openai_embedding_model') || 'text-embedding-3-small';

  return {
    GPT4_TURBO: gptModel,
    EMBEDDING: embeddingModel
  };
}

export const MODELS = {
  GPT4_TURBO: 'gpt-5-nano',
  EMBEDDING: 'text-embedding-3-small'
} as const;
