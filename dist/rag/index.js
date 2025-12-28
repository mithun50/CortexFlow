/**
 * CortexFlow - RAG Module
 *
 * Exports all RAG functionality for use by other modules.
 */
// Storage
export { getRAGStorage, resetRAGStorage, cosineSimilarity, isSqliteAvailable } from './rag-storage.js';
// Embeddings
export { getEmbeddingProvider, resetEmbeddingProvider, createEmbeddingProvider, getAvailableProviders, getProviderDimensions, } from './embeddings.js';
// Chunking
export { chunkDocument, estimateTokenCount, getRecommendedChunkSize, mergeSmallChunks, splitOversizedChunk, } from './chunking.js';
// Features (main API)
export { 
// Indexing
indexDocument, indexProjectContext, 
// Search
search, buildContextFromSearch, 
// Document management
deleteDocument, deleteProjectDocuments, reindexDocument, updateDocumentEmbeddings, listDocuments, getDocument, 
// Statistics
getRAGStats, 
// Configuration
getRAGConfig, updateRAGConfig, 
// Maintenance
rebuildFTSIndex, vacuumDatabase, reindexAll, } from './rag-features.js';
//# sourceMappingURL=index.js.map