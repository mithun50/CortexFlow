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
import { getEmbeddingProvider } from './embeddings.js';
import { chunkDocument } from './chunking.js';
import { createRAGDocument, createRAGChunk, } from '../models.js';
/**
 * Index a single document
 */
export async function indexDocument(title, content, options = {}) {
    const storage = await getRAGStorage();
    const config = await storage.getConfig();
    // Create document
    const doc = createRAGDocument(title, content, {
        projectId: options.projectId ?? null,
        sourceType: options.sourceType ?? 'custom_document',
        sourceId: options.sourceId ?? null,
        metadata: options.metadata ?? {},
    });
    // Chunk content
    const chunkResults = chunkDocument(content, config.chunking);
    doc.chunkCount = chunkResults.length;
    // Save document
    await storage.saveDocument(doc);
    // Create chunks
    const chunks = chunkResults.map((result) => createRAGChunk(doc.id, result.content, result.index, {
        startOffset: result.startOffset,
        endOffset: result.endOffset,
        metadata: { documentTitle: title },
    }));
    // Save chunks
    if (chunks.length > 0) {
        await storage.saveChunks(chunks);
    }
    // Generate embeddings (if not skipped)
    if (!options.skipEmbedding && chunks.length > 0) {
        try {
            const embedder = await getEmbeddingProvider();
            const texts = chunks.map((c) => c.content);
            const embeddings = await embedder.embedBatch(texts);
            for (let i = 0; i < chunks.length; i++) {
                await storage.updateChunkEmbedding(chunks[i].id, embeddings[i]);
            }
        }
        catch (error) {
            // Embedding failed, document is still indexed without vectors
            console.warn(`Embedding generation failed: ${error}`);
        }
    }
    return doc;
}
/**
 * Index an entire project context
 */
export async function indexProjectContext(project) {
    const documents = [];
    let totalChunks = 0;
    // Index project description
    const projectContent = [
        `# Project: ${project.name}`,
        '',
        project.description,
        '',
        `Phase: ${project.phase}`,
        `Tags: ${project.tags.join(', ') || 'none'}`,
        `Version: ${project.version}`,
    ].join('\n');
    const projectDoc = await indexDocument(`Project: ${project.name}`, projectContent, {
        projectId: project.id,
        sourceType: 'project_context',
        sourceId: project.id,
        metadata: {
            phase: project.phase,
            tags: project.tags,
            version: project.version,
        },
    });
    documents.push(projectDoc);
    totalChunks += projectDoc.chunkCount;
    // Index each task
    for (const task of project.tasks) {
        const taskContent = [
            `# Task: ${task.title}`,
            '',
            task.description,
            '',
            `Status: ${task.status}`,
            `Priority: ${task.priority}`,
            task.assignedTo ? `Assigned to: ${task.assignedTo}` : '',
            task.dependencies.length > 0 ? `Dependencies: ${task.dependencies.join(', ')}` : '',
            '',
            task.notes.length > 0 ? '## Notes\n' + task.notes.map((n) => `- ${n}`).join('\n') : '',
        ]
            .filter((line) => line !== '')
            .join('\n');
        const taskDoc = await indexDocument(`Task: ${task.title}`, taskContent, {
            projectId: project.id,
            sourceType: 'task',
            sourceId: task.id,
            metadata: {
                status: task.status,
                priority: task.priority,
                assignedTo: task.assignedTo,
            },
        });
        documents.push(taskDoc);
        totalChunks += taskDoc.chunkCount;
    }
    // Index significant notes (longer than 50 chars)
    for (const note of project.notes) {
        if (note.content.length > 50) {
            const noteContent = [
                `# Note by ${note.agent}`,
                '',
                `Category: ${note.category}`,
                `Timestamp: ${note.timestamp}`,
                '',
                note.content,
            ].join('\n');
            const noteDoc = await indexDocument(`Note: ${note.category} by ${note.agent}`, noteContent, {
                projectId: project.id,
                sourceType: 'note',
                sourceId: note.id,
                metadata: {
                    agent: note.agent,
                    category: note.category,
                },
            });
            documents.push(noteDoc);
            totalChunks += noteDoc.chunkCount;
        }
    }
    return { documents, totalChunks };
}
/**
 * Search indexed documents
 */
export async function search(query, options = {}) {
    const startTime = Date.now();
    const storage = await getRAGStorage();
    const config = await storage.getConfig();
    const searchType = options.searchType ?? 'hybrid';
    const topK = options.topK ?? config.search.topK;
    const minScore = options.minScore ?? config.search.minScore;
    let results;
    let embeddingProvider = 'none';
    if (searchType === 'keyword') {
        results = await storage.keywordSearch(query, {
            projectId: options.projectId,
            limit: topK,
        });
    }
    else {
        // Generate query embedding
        const embedder = await getEmbeddingProvider();
        embeddingProvider = embedder.name;
        const queryEmbedding = await embedder.embed(query);
        if (searchType === 'vector') {
            results = await storage.vectorSearch(queryEmbedding, {
                projectId: options.projectId,
                topK,
                minScore,
            });
        }
        else {
            // Hybrid search
            results = await storage.hybridSearch(query, queryEmbedding, {
                projectId: options.projectId,
                topK,
                minScore,
                vectorWeight: options.vectorWeight,
            });
        }
    }
    return {
        query,
        results,
        totalFound: results.length,
        searchTimeMs: Date.now() - startTime,
        embeddingProvider,
    };
}
/**
 * Build context string from search results
 */
export async function buildContextFromSearch(query, options = {}) {
    const maxContextLength = options.maxContextLength ?? 4000;
    const includeMetadata = options.includeMetadata ?? true;
    const searchResult = await search(query, options);
    const contextParts = [];
    const sources = [];
    let currentLength = 0;
    for (const result of searchResult.results) {
        const chunkText = result.chunk.content;
        const docTitle = result.document.title;
        let contextEntry = `--- ${docTitle} ---\n${chunkText}\n`;
        if (includeMetadata && Object.keys(result.document.metadata).length > 0) {
            const metadataStr = Object.entries(result.document.metadata)
                .filter(([, v]) => v !== null && v !== undefined)
                .map(([k, v]) => `${k}: ${v}`)
                .join(', ');
            if (metadataStr) {
                contextEntry += `[${metadataStr}]\n`;
            }
        }
        if (currentLength + contextEntry.length > maxContextLength) {
            break;
        }
        contextParts.push(contextEntry);
        sources.push({
            title: docTitle,
            score: result.score,
            documentId: result.document.id,
        });
        currentLength += contextEntry.length;
    }
    return {
        context: contextParts.join('\n'),
        sources,
        searchResult,
    };
}
// ============================================================================
// Document Management
// ============================================================================
/**
 * Delete a document and its chunks
 */
export async function deleteDocument(documentId) {
    const storage = await getRAGStorage();
    return storage.deleteDocument(documentId);
}
/**
 * Delete all documents for a project
 */
export async function deleteProjectDocuments(projectId) {
    const storage = await getRAGStorage();
    const docs = await storage.listDocuments({ projectId });
    let deleted = 0;
    for (const doc of docs) {
        if (await storage.deleteDocument(doc.id)) {
            deleted++;
        }
    }
    return deleted;
}
/**
 * Reindex a document (regenerate chunks and embeddings)
 */
export async function reindexDocument(documentId) {
    const storage = await getRAGStorage();
    const doc = await storage.getDocument(documentId);
    if (!doc)
        return null;
    // Delete existing chunks
    await storage.deleteChunks(documentId);
    // Delete the document itself
    await storage.deleteDocument(documentId);
    // Reindex with same properties
    return indexDocument(doc.title, doc.content, {
        projectId: doc.projectId ?? undefined,
        sourceType: doc.sourceType,
        sourceId: doc.sourceId ?? undefined,
        metadata: doc.metadata,
    });
}
/**
 * Update embeddings for a document (without re-chunking)
 */
export async function updateDocumentEmbeddings(documentId) {
    const storage = await getRAGStorage();
    const chunks = await storage.getChunks(documentId);
    if (chunks.length === 0)
        return 0;
    const embedder = await getEmbeddingProvider();
    const texts = chunks.map((c) => c.content);
    const embeddings = await embedder.embedBatch(texts);
    for (let i = 0; i < chunks.length; i++) {
        await storage.updateChunkEmbedding(chunks[i].id, embeddings[i]);
    }
    return chunks.length;
}
// ============================================================================
// Statistics
// ============================================================================
/**
 * Get RAG system statistics
 */
export async function getRAGStats() {
    const storage = await getRAGStorage();
    const embedder = await getEmbeddingProvider();
    const stats = await storage.getStats();
    return {
        ...stats,
        embeddingProvider: embedder.name,
        embeddingDimensions: embedder.dimensions,
    };
}
/**
 * List all indexed documents
 */
export async function listDocuments(options) {
    const storage = await getRAGStorage();
    return storage.listDocuments(options);
}
/**
 * Get a single document by ID
 */
export async function getDocument(documentId) {
    const storage = await getRAGStorage();
    return storage.getDocument(documentId);
}
// ============================================================================
// Configuration
// ============================================================================
/**
 * Get current RAG configuration
 */
export async function getRAGConfig() {
    const storage = await getRAGStorage();
    return storage.getConfig();
}
/**
 * Update RAG configuration
 */
export async function updateRAGConfig(updates) {
    const storage = await getRAGStorage();
    await storage.updateConfig(updates);
}
// ============================================================================
// Maintenance
// ============================================================================
/**
 * Rebuild full-text search index
 */
export async function rebuildFTSIndex() {
    const storage = await getRAGStorage();
    await storage.rebuildFTS();
}
/**
 * Vacuum the database to reclaim space
 */
export async function vacuumDatabase() {
    const storage = await getRAGStorage();
    await storage.vacuum();
}
/**
 * Reindex all documents (regenerate embeddings)
 */
export async function reindexAll(options) {
    const storage = await getRAGStorage();
    const docs = await storage.listDocuments({
        projectId: options?.projectId,
        limit: 10000, // Process up to 10k documents
    });
    let chunksUpdated = 0;
    for (const doc of docs) {
        chunksUpdated += await updateDocumentEmbeddings(doc.id);
    }
    return {
        documentsProcessed: docs.length,
        chunksUpdated,
    };
}
//# sourceMappingURL=rag-features.js.map