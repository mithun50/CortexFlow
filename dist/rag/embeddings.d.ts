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
export interface EmbeddingProviderInstance {
    name: string;
    dimensions: number;
    maxBatchSize: number;
    embed(text: string): Promise<number[]>;
    embedBatch(texts: string[]): Promise<number[][]>;
    isAvailable(): Promise<boolean>;
}
export declare function createLocalEmbeddingProvider(config: EmbeddingConfig): EmbeddingProviderInstance;
export declare function createOpenAIEmbeddingProvider(config: EmbeddingConfig): EmbeddingProviderInstance;
export declare function createVoyageEmbeddingProvider(config: EmbeddingConfig): EmbeddingProviderInstance;
export declare function createCohereEmbeddingProvider(config: EmbeddingConfig): EmbeddingProviderInstance;
export declare function createCustomEmbeddingProvider(config: EmbeddingConfig): EmbeddingProviderInstance;
export declare function createEmbeddingProvider(config: EmbeddingConfig): EmbeddingProviderInstance;
export declare function getEmbeddingProvider(config?: EmbeddingConfig): Promise<EmbeddingProviderInstance>;
export declare function resetEmbeddingProvider(): void;
/**
 * Get available embedding providers based on environment
 */
export declare function getAvailableProviders(): Promise<EmbeddingProviderType[]>;
/**
 * Get default dimensions for a provider
 */
export declare function getProviderDimensions(provider: EmbeddingProviderType, model?: string): number;
//# sourceMappingURL=embeddings.d.ts.map