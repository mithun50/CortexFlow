/**
 * CortexFlow - Embedding Providers
 *
 * Configurable embedding system supporting:
 * - Local models via transformers.js (optional dependency)
 * - OpenAI API
 * - Voyage AI API
 * - Cohere API
 * - Custom endpoints
 */

import { EmbeddingConfig, EmbeddingProvider as EmbeddingProviderType } from '../models.js';

// ============================================================================
// Embedding Provider Interface
// ============================================================================

export interface EmbeddingProviderInstance {
  name: string;
  dimensions: number;
  maxBatchSize: number;

  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  isAvailable(): Promise<boolean>;
}

// ============================================================================
// Local Embedding Provider (transformers.js)
// ============================================================================

let localPipeline: unknown = null;

async function getLocalPipeline(model: string): Promise<unknown> {
  if (!localPipeline) {
    try {
      // Dynamic import to avoid loading if not used
      const transformers = await import('@xenova/transformers');
      localPipeline = await transformers.pipeline('feature-extraction', model, {
        quantized: true,
      });
    } catch (error) {
      throw new Error(
        `Failed to load local embedding model. Ensure @xenova/transformers is installed: ${error}`
      );
    }
  }
  return localPipeline;
}

export function createLocalEmbeddingProvider(config: EmbeddingConfig): EmbeddingProviderInstance {
  const model = config.model || 'Xenova/all-MiniLM-L6-v2';

  return {
    name: 'local',
    dimensions: config.dimensions || 384,
    maxBatchSize: config.batchSize || 32,

    async embed(text: string): Promise<number[]> {
      const pipe = (await getLocalPipeline(model)) as (
        text: string,
        opts: { pooling: string; normalize: boolean }
      ) => Promise<{ data: Float32Array }>;
      const output = await pipe(text, { pooling: 'mean', normalize: true });
      return Array.from(output.data);
    },

    async embedBatch(texts: string[]): Promise<number[][]> {
      const results: number[][] = [];

      for (let i = 0; i < texts.length; i += this.maxBatchSize) {
        const batch = texts.slice(i, i + this.maxBatchSize);
        for (const text of batch) {
          const embedding = await this.embed(text);
          results.push(embedding);
        }
      }

      return results;
    },

    async isAvailable(): Promise<boolean> {
      try {
        await getLocalPipeline(model);
        return true;
      } catch {
        return false;
      }
    },
  };
}

// ============================================================================
// OpenAI Embedding Provider
// ============================================================================

export function createOpenAIEmbeddingProvider(config: EmbeddingConfig): EmbeddingProviderInstance {
  const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
  const model = config.model || 'text-embedding-3-small';
  const endpoint = config.apiEndpoint || 'https://api.openai.com/v1/embeddings';

  async function callOpenAI(texts: string[]): Promise<number[][]> {
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: texts,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
    };
    return data.data.map((item) => item.embedding);
  }

  return {
    name: 'openai',
    dimensions: config.dimensions || 1536,
    maxBatchSize: config.batchSize || 100,

    async embed(text: string): Promise<number[]> {
      const results = await callOpenAI([text]);
      return results[0];
    },

    async embedBatch(texts: string[]): Promise<number[][]> {
      const results: number[][] = [];

      for (let i = 0; i < texts.length; i += this.maxBatchSize) {
        const batch = texts.slice(i, i + this.maxBatchSize);
        const batchResults = await callOpenAI(batch);
        results.push(...batchResults);
      }

      return results;
    },

    async isAvailable(): Promise<boolean> {
      return !!apiKey;
    },
  };
}

// ============================================================================
// Voyage AI Embedding Provider
// ============================================================================

export function createVoyageEmbeddingProvider(config: EmbeddingConfig): EmbeddingProviderInstance {
  const apiKey = config.apiKey || process.env.VOYAGE_API_KEY;
  const model = config.model || 'voyage-2';
  const endpoint = config.apiEndpoint || 'https://api.voyageai.com/v1/embeddings';

  async function callVoyage(texts: string[]): Promise<number[][]> {
    if (!apiKey) {
      throw new Error('Voyage API key not configured');
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: texts,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Voyage API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
    };
    return data.data.map((item) => item.embedding);
  }

  return {
    name: 'voyage',
    dimensions: config.dimensions || 1024,
    maxBatchSize: config.batchSize || 128,

    async embed(text: string): Promise<number[]> {
      const results = await callVoyage([text]);
      return results[0];
    },

    async embedBatch(texts: string[]): Promise<number[][]> {
      const results: number[][] = [];

      for (let i = 0; i < texts.length; i += this.maxBatchSize) {
        const batch = texts.slice(i, i + this.maxBatchSize);
        const batchResults = await callVoyage(batch);
        results.push(...batchResults);
      }

      return results;
    },

    async isAvailable(): Promise<boolean> {
      return !!apiKey;
    },
  };
}

// ============================================================================
// Cohere Embedding Provider
// ============================================================================

export function createCohereEmbeddingProvider(config: EmbeddingConfig): EmbeddingProviderInstance {
  const apiKey = config.apiKey || process.env.COHERE_API_KEY;
  const model = config.model || 'embed-english-v3.0';
  const endpoint = config.apiEndpoint || 'https://api.cohere.ai/v1/embed';

  async function callCohere(texts: string[]): Promise<number[][]> {
    if (!apiKey) {
      throw new Error('Cohere API key not configured');
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        texts,
        input_type: 'search_document',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cohere API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as {
      embeddings: number[][];
    };
    return data.embeddings;
  }

  return {
    name: 'cohere',
    dimensions: config.dimensions || 1024,
    maxBatchSize: config.batchSize || 96,

    async embed(text: string): Promise<number[]> {
      const results = await callCohere([text]);
      return results[0];
    },

    async embedBatch(texts: string[]): Promise<number[][]> {
      const results: number[][] = [];

      for (let i = 0; i < texts.length; i += this.maxBatchSize) {
        const batch = texts.slice(i, i + this.maxBatchSize);
        const batchResults = await callCohere(batch);
        results.push(...batchResults);
      }

      return results;
    },

    async isAvailable(): Promise<boolean> {
      return !!apiKey;
    },
  };
}

// ============================================================================
// Custom Endpoint Provider
// ============================================================================

export function createCustomEmbeddingProvider(config: EmbeddingConfig): EmbeddingProviderInstance {
  const configuredEndpoint = config.apiEndpoint;
  const apiKey = config.apiKey;

  if (!configuredEndpoint) {
    throw new Error('Custom provider requires apiEndpoint');
  }

  // Store in const after validation to satisfy TypeScript
  const endpoint: string = configuredEndpoint;

  async function callCustom(texts: string[]): Promise<number[][]> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ texts }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Custom API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as {
      embeddings: number[][];
    };
    return data.embeddings;
  }

  return {
    name: 'custom',
    dimensions: config.dimensions || 768,
    maxBatchSize: config.batchSize || 32,

    async embed(text: string): Promise<number[]> {
      const results = await callCustom([text]);
      return results[0];
    },

    async embedBatch(texts: string[]): Promise<number[][]> {
      const results: number[][] = [];

      for (let i = 0; i < texts.length; i += this.maxBatchSize) {
        const batch = texts.slice(i, i + this.maxBatchSize);
        const batchResults = await callCustom(batch);
        results.push(...batchResults);
      }

      return results;
    },

    async isAvailable(): Promise<boolean> {
      return !!endpoint;
    },
  };
}

// ============================================================================
// Provider Factory
// ============================================================================

export function createEmbeddingProvider(config: EmbeddingConfig): EmbeddingProviderInstance {
  switch (config.provider) {
    case 'local':
      return createLocalEmbeddingProvider(config);
    case 'openai':
      return createOpenAIEmbeddingProvider(config);
    case 'voyage':
      return createVoyageEmbeddingProvider(config);
    case 'cohere':
      return createCohereEmbeddingProvider(config);
    case 'custom':
      return createCustomEmbeddingProvider(config);
    default:
      throw new Error(`Unknown embedding provider: ${config.provider}`);
  }
}

// ============================================================================
// Singleton Instance (uses RAG config)
// ============================================================================

let embeddingProviderInstance: EmbeddingProviderInstance | null = null;
let currentProviderConfig: EmbeddingConfig | null = null;

export async function getEmbeddingProvider(
  config?: EmbeddingConfig
): Promise<EmbeddingProviderInstance> {
  // If config provided, check if we need to recreate the provider
  if (config) {
    const configChanged =
      !currentProviderConfig ||
      currentProviderConfig.provider !== config.provider ||
      currentProviderConfig.model !== config.model ||
      currentProviderConfig.apiKey !== config.apiKey ||
      currentProviderConfig.apiEndpoint !== config.apiEndpoint;

    if (configChanged) {
      embeddingProviderInstance = createEmbeddingProvider(config);
      currentProviderConfig = config;
    }
  }

  // If no instance, get config from RAG storage
  if (!embeddingProviderInstance) {
    const { getRAGStorage } = await import('./rag-storage.js');
    const storage = await getRAGStorage();
    const ragConfig = await storage.getConfig();
    embeddingProviderInstance = createEmbeddingProvider(ragConfig.embedding);
    currentProviderConfig = ragConfig.embedding;
  }

  return embeddingProviderInstance;
}

export function resetEmbeddingProvider(): void {
  embeddingProviderInstance = null;
  currentProviderConfig = null;
  localPipeline = null;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get available embedding providers based on environment
 */
export async function getAvailableProviders(): Promise<EmbeddingProviderType[]> {
  const available: EmbeddingProviderType[] = [];

  // Check local
  try {
    await import('@xenova/transformers');
    available.push('local');
  } catch {
    // transformers.js not installed
  }

  // Check API keys
  if (process.env.OPENAI_API_KEY) {
    available.push('openai');
  }
  if (process.env.VOYAGE_API_KEY) {
    available.push('voyage');
  }
  if (process.env.COHERE_API_KEY) {
    available.push('cohere');
  }

  return available;
}

/**
 * Get default dimensions for a provider
 */
export function getProviderDimensions(provider: EmbeddingProviderType, model?: string): number {
  switch (provider) {
    case 'local':
      // Most Xenova models use 384 dimensions
      return 384;
    case 'openai':
      if (model === 'text-embedding-3-large') return 3072;
      if (model === 'text-embedding-ada-002') return 1536;
      return 1536; // text-embedding-3-small default
    case 'voyage':
      return 1024;
    case 'cohere':
      return 1024;
    case 'custom':
      return 768;
    default:
      return 768;
  }
}
