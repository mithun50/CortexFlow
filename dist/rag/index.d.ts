/**
 * CortexFlow - RAG Module
 *
 * Exports all RAG functionality for use by other modules.
 */
export { getRAGStorage, resetRAGStorage, cosineSimilarity, isSqliteAvailable, } from './rag-storage.js';
export type { RAGStorage } from './rag-storage.js';
export { getEmbeddingProvider, resetEmbeddingProvider, createEmbeddingProvider, getAvailableProviders, getProviderDimensions, } from './embeddings.js';
export type { EmbeddingProviderInstance } from './embeddings.js';
export { chunkDocument, estimateTokenCount, getRecommendedChunkSize, mergeSmallChunks, splitOversizedChunk, } from './chunking.js';
export type { ChunkResult } from './chunking.js';
export { indexDocument, indexProjectContext, search, buildContextFromSearch, deleteDocument, deleteProjectDocuments, reindexDocument, updateDocumentEmbeddings, listDocuments, getDocument, getRAGStats, getRAGConfig, updateRAGConfig, rebuildFTSIndex, vacuumDatabase, reindexAll, } from './rag-features.js';
export type { IndexDocumentOptions, SearchOptions, QueryWithContextOptions, } from './rag-features.js';
//# sourceMappingURL=index.d.ts.map