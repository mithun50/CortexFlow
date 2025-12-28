/**
 * CortexFlow - Document Chunking Strategies
 *
 * Provides different strategies for splitting documents into chunks
 * suitable for embedding and retrieval.
 */
import { ChunkingConfig } from '../models.js';
export interface ChunkResult {
    content: string;
    startOffset: number;
    endOffset: number;
    index: number;
}
/**
 * Chunk document using specified strategy
 */
export declare function chunkDocument(text: string, config: ChunkingConfig): ChunkResult[];
/**
 * Estimate token count (rough approximation: ~4 chars per token)
 */
export declare function estimateTokenCount(text: string): number;
/**
 * Get recommended chunk size for a given embedding model
 */
export declare function getRecommendedChunkSize(model: string): number;
/**
 * Merge small consecutive chunks
 */
export declare function mergeSmallChunks(chunks: ChunkResult[], minSize: number): ChunkResult[];
/**
 * Split oversized chunk into smaller pieces
 */
export declare function splitOversizedChunk(chunk: ChunkResult, maxSize: number): ChunkResult[];
//# sourceMappingURL=chunking.d.ts.map