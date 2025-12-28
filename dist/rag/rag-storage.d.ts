/**
 * CortexFlow - RAG Vector Storage Layer
 *
 * SQLite-based vector storage using better-sqlite3.
 * Supports vector similarity search with pure JS cosine similarity.
 * Includes FTS5 for keyword search fallback.
 */
import { RAGDocument, RAGChunk, RAGSearchResult, RAGConfig, RAGConfigUpdate } from '../models.js';
export declare function isSqliteAvailable(): boolean;
/**
 * Calculate cosine similarity between two vectors
 */
export declare function cosineSimilarity(a: number[], b: number[]): number;
export interface RAGStorage {
    saveDocument(doc: RAGDocument): Promise<void>;
    getDocument(id: string): Promise<RAGDocument | null>;
    listDocuments(options?: {
        projectId?: string;
        sourceType?: string;
        limit?: number;
    }): Promise<RAGDocument[]>;
    deleteDocument(id: string): Promise<boolean>;
    updateDocument(id: string, updates: Partial<Pick<RAGDocument, 'title' | 'content' | 'metadata'>>): Promise<boolean>;
    saveChunks(chunks: RAGChunk[]): Promise<void>;
    getChunks(documentId: string): Promise<RAGChunk[]>;
    getChunkById(id: string): Promise<RAGChunk | null>;
    updateChunkEmbedding(chunkId: string, embedding: number[]): Promise<void>;
    deleteChunks(documentId: string): Promise<number>;
    vectorSearch(embedding: number[], options?: {
        projectId?: string;
        topK?: number;
        minScore?: number;
    }): Promise<RAGSearchResult[]>;
    keywordSearch(query: string, options?: {
        projectId?: string;
        limit?: number;
    }): Promise<RAGSearchResult[]>;
    hybridSearch(query: string, embedding: number[], options?: {
        projectId?: string;
        topK?: number;
        minScore?: number;
        vectorWeight?: number;
    }): Promise<RAGSearchResult[]>;
    getStats(): Promise<{
        totalDocuments: number;
        totalChunks: number;
        indexedChunks: number;
        projectBreakdown: Record<string, number>;
    }>;
    getConfig(): Promise<RAGConfig>;
    updateConfig(config: RAGConfigUpdate): Promise<void>;
    vacuum(): Promise<void>;
    rebuildFTS(): Promise<void>;
    close(): void;
}
export declare function createRAGStorage(): Promise<RAGStorage>;
export declare function getRAGStorage(): Promise<RAGStorage>;
export declare function resetRAGStorage(): void;
//# sourceMappingURL=rag-storage.d.ts.map