import dotenv from 'dotenv';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

// Load .env.local first, then .env as fallback
dotenv.config({ path: '.env.local' });
dotenv.config();

/**
 * Shared ElevenLabs SDK client factory.
 * Reads ELEVENLABS_API_KEY from process.env.
 */
export function createElevenLabsClient(apiKey?: string): ElevenLabsClient {
  return new ElevenLabsClient({
    apiKey:
      apiKey ??
      process.env.ELEVENLABS_API_KEY?.trim() ??
      'offline-fallback-key',
  });
}
