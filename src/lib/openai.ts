import OpenAI from 'openai';

/**
 * OpenAI client and model defaults.
 *
 * Set OPENAI_API_KEY in `.env` (see `.env.example`). You are free to change the
 * models below or swap in another provider or a local embedding model.
 */

export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const CHAT_MODEL = 'gpt-4o-mini';

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes('REPLACE_ME')) {
    throw new Error('OPENAI_API_KEY is not set. Copy .env.example to .env and add your real key.');
  }
  client ??= new OpenAI({ apiKey });
  return client;
}

/** Embed one or more strings. Returns one vector per input, in order. */
export async function embed(input: string[]): Promise<number[][]> {
  if (input.length === 0) return [];
  const response = await getOpenAI().embeddings.create({ model: EMBEDDING_MODEL, input });
  return response.data.map((d) => d.embedding);
}
