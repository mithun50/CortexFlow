/**
 * CortexFlow - RAG Features Module
 *
 * High-level RAG operations:
 * - Document indexing
 * - Semantic search
 * - Project context RAG
 * - Query with context
 */
import { getRAGStorage } from './rag-storage.js';
import { RAGDocument, RAGQueryResult, RAGStats, RAGSearchType, ProjectContext } from '../models.js';
export interface IndexDocumentOptions {
    projectId?: string;
    sourceType?: RAGDocument['sourceType'];
    sourceId?: string;
    metadata?: Record<string, unknown>;
    skipEmbedding?: boolean;
}
/**
 * Index a single document
 */
export declare function indexDocument(title: string, content: string, options?: IndexDocumentOptions): Promise<RAGDocument>;
/**
 * Index an entire project context
 */
export declare function indexProjectContext(project: ProjectContext): Promise<{
    documents: RAGDocument[];
    totalChunks: number;
}>;
export interface SearchOptions {
    projectId?: string;
    topK?: number;
    minScore?: number;
    searchType?: RAGSearchType;
    vectorWeight?: number;
}
/**
 * Search indexed documents
 */
export declare function search(query: string, options?: SearchOptions): Promise<RAGQueryResult>;
export interface QueryWithContextOptions extends SearchOptions {
    maxContextLength?: number;
    includeMetadata?: boolean;
}
/**
 * Build context string from search results
 */
export declare function buildContextFromSearch(query: string, options?: QueryWithContextOptions): Promise<{
    context: string;
    sources: Array<{
        title: string;
        score: number;
        documentId: string;
    }>;
    searchResult: RAGQueryResult;
}>;
/**
 * Delete a document and its chunks
 */
export declare function deleteDocument(documentId: string): Promise<boolean>;
/**
 * Delete all documents for a project
 */
export declare function deleteProjectDocuments(projectId: string): Promise<number>;
/**
 * Reindex a document (regenerate chunks and embeddings)
 */
export declare function reindexDocument(documentId: string): Promise<RAGDocument | null>;
/**
 * Update embeddings for a document (without re-chunking)
 */
export declare function updateDocumentEmbeddings(documentId: string): Promise<number>;
/**
 * Get RAG system statistics
 */
export declare function getRAGStats(): Promise<RAGStats>;
/**
 * List all indexed documents
 */
export declare function listDocuments(options?: {
    projectId?: string;
    sourceType?: string;
    limit?: number;
}): Promise<RAGDocument[]>;
/**
 * Get a single document by ID
 */
export declare function getDocument(documentId: string): Promise<RAGDocument | null>;
/**
 * Get current RAG configuration
 */
export declare function getRAGConfig(): Promise<import("../models.js").RAGConfig>;
/**
 * Update RAG configuration
 */
export declare function updateRAGConfig(updates: Parameters<Awaited<ReturnType<typeof getRAGStorage>>['updateConfig']>[0]): Promise<void>;
/**
 * Rebuild full-text search index
 */
export declare function rebuildFTSIndex(): Promise<void>;
/**
 * Vacuum the database to reclaim space
 */
export declare function vacuumDatabase(): Promise<void>;
/**
 * Reindex all documents (regenerate embeddings)
 */
export declare function reindexAll(options?: {
    projectId?: string;
}): Promise<{
    documentsProcessed: number;
    chunksUpdated: number;
}>;
//# sourceMappingURL=rag-features.d.ts.map