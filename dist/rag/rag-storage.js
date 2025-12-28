/**
 * CortexFlow - RAG Vector Storage Layer
 *
 * SQLite-based vector storage using better-sqlite3.
 * Supports vector similarity search with pure JS cosine similarity.
 * Includes FTS5 for keyword search fallback.
 */
import { join } from 'path';
import { homedir } from 'os';
import { mkdir } from 'fs/promises';
import { getDefaultRAGConfig, } from '../models.js';
// Dynamic import for better-sqlite3 (native module that may not be available)
let Database = null;
let sqliteAvailable = false;
async function loadSqlite() {
    if (Database !== null)
        return sqliteAvailable;
    try {
        const module = await import('better-sqlite3');
        Database = module.default;
        sqliteAvailable = true;
    }
    catch {
        sqliteAvailable = false;
    }
    return sqliteAvailable;
}
// Export function to check availability
export function isSqliteAvailable() {
    return sqliteAvailable;
}
const DATA_DIR = process.env.CORTEXFLOW_DATA_DIR ?? join(homedir(), '.cortexflow', 'data');
const RAG_DB_PATH = join(DATA_DIR, 'rag.sqlite');
// ============================================================================
// Schema Definition
// ============================================================================
const SCHEMA = `
-- RAG Documents table
CREATE TABLE IF NOT EXISTS rag_documents (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  source_type TEXT NOT NULL DEFAULT 'custom_document',
  source_id TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT DEFAULT '{}',
  chunk_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- RAG Chunks table (stores vectors as JSON array of floats)
CREATE TABLE IF NOT EXISTS rag_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding TEXT,
  chunk_index INTEGER NOT NULL,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  metadata TEXT DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (document_id) REFERENCES rag_documents(id) ON DELETE CASCADE
);

-- RAG Configuration table
CREATE TABLE IF NOT EXISTS rag_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chunks_document ON rag_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_documents_project ON rag_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_source ON rag_documents(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_chunks_index ON rag_chunks(document_id, chunk_index);
`;
const FTS_SCHEMA = `
-- Full-text search (FTS5) for keyword fallback
CREATE VIRTUAL TABLE IF NOT EXISTS rag_chunks_fts USING fts5(
  content,
  content='rag_chunks',
  content_rowid='rowid'
);
`;
const FTS_TRIGGERS = `
-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS rag_chunks_ai AFTER INSERT ON rag_chunks BEGIN
  INSERT INTO rag_chunks_fts(rowid, content) VALUES (NEW.rowid, NEW.content);
END;

CREATE TRIGGER IF NOT EXISTS rag_chunks_ad AFTER DELETE ON rag_chunks BEGIN
  INSERT INTO rag_chunks_fts(rag_chunks_fts, rowid, content) VALUES('delete', OLD.rowid, OLD.content);
END;

CREATE TRIGGER IF NOT EXISTS rag_chunks_au AFTER UPDATE ON rag_chunks BEGIN
  INSERT INTO rag_chunks_fts(rag_chunks_fts, rowid, content) VALUES('delete', OLD.rowid, OLD.content);
  INSERT INTO rag_chunks_fts(rowid, content) VALUES (NEW.rowid, NEW.content);
END;
`;
// ============================================================================
// Vector Operations (Pure JS - no native extensions required)
// ============================================================================
/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a, b) {
    if (a.length !== b.length || a.length === 0)
        return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
}
/**
 * Brute-force vector search (optimized for small-medium datasets)
 * For larger datasets (>100K chunks), consider adding sqlite-vss extension
 */
function vectorSearch(queryEmbedding, chunks, topK, minScore) {
    const scored = chunks
        .map((chunk) => ({
        id: chunk.id,
        score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
        .filter((result) => result.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
    return scored;
}
function rowToDocument(row) {
    return {
        id: row.id,
        projectId: row.project_id,
        sourceType: row.source_type,
        sourceId: row.source_id,
        title: row.title,
        content: row.content,
        metadata: JSON.parse(row.metadata || '{}'),
        chunkCount: row.chunk_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
function rowToChunk(row) {
    return {
        id: row.id,
        documentId: row.document_id,
        content: row.content,
        embedding: row.embedding ? JSON.parse(row.embedding) : null,
        chunkIndex: row.chunk_index,
        startOffset: row.start_offset,
        endOffset: row.end_offset,
        metadata: JSON.parse(row.metadata || '{}'),
        createdAt: row.created_at,
    };
}
// ============================================================================
// Storage Factory
// ============================================================================
export async function createRAGStorage() {
    // Ensure SQLite is available
    if (!Database) {
        throw new Error('SQLite not loaded. Call getRAGStorage() instead of createRAGStorage()');
    }
    // Ensure directory exists
    await mkdir(DATA_DIR, { recursive: true }).catch(() => { });
    // Initialize database
    const db = Database(RAG_DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(SCHEMA);
    // Try to create FTS tables (may fail in some SQLite builds)
    try {
        db.exec(FTS_SCHEMA);
        db.exec(FTS_TRIGGERS);
    }
    catch {
        // FTS5 not available, keyword search will use LIKE fallback
    }
    // Prepared statements for performance
    const stmts = {
        insertDoc: db.prepare(`
      INSERT OR REPLACE INTO rag_documents
      (id, project_id, source_type, source_id, title, content, metadata, chunk_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
        getDoc: db.prepare('SELECT * FROM rag_documents WHERE id = ?'),
        listDocs: db.prepare('SELECT * FROM rag_documents ORDER BY updated_at DESC LIMIT ?'),
        listDocsByProject: db.prepare('SELECT * FROM rag_documents WHERE project_id = ? ORDER BY updated_at DESC LIMIT ?'),
        listDocsByType: db.prepare('SELECT * FROM rag_documents WHERE source_type = ? ORDER BY updated_at DESC LIMIT ?'),
        listDocsByProjectAndType: db.prepare('SELECT * FROM rag_documents WHERE project_id = ? AND source_type = ? ORDER BY updated_at DESC LIMIT ?'),
        deleteDoc: db.prepare('DELETE FROM rag_documents WHERE id = ?'),
        updateDoc: db.prepare(`
      UPDATE rag_documents SET title = ?, content = ?, metadata = ?, updated_at = ?
      WHERE id = ?
    `),
        insertChunk: db.prepare(`
      INSERT INTO rag_chunks (id, document_id, content, embedding, chunk_index, start_offset, end_offset, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
        getChunks: db.prepare('SELECT * FROM rag_chunks WHERE document_id = ? ORDER BY chunk_index'),
        getChunkById: db.prepare('SELECT * FROM rag_chunks WHERE id = ?'),
        updateEmbedding: db.prepare('UPDATE rag_chunks SET embedding = ? WHERE id = ?'),
        deleteChunks: db.prepare('DELETE FROM rag_chunks WHERE document_id = ?'),
        getAllEmbeddings: db.prepare(`
      SELECT c.id, c.embedding, c.document_id, d.project_id
      FROM rag_chunks c
      JOIN rag_documents d ON c.document_id = d.id
      WHERE c.embedding IS NOT NULL
    `),
        getAllEmbeddingsByProject: db.prepare(`
      SELECT c.id, c.embedding, c.document_id, d.project_id
      FROM rag_chunks c
      JOIN rag_documents d ON c.document_id = d.id
      WHERE c.embedding IS NOT NULL AND d.project_id = ?
    `),
        getConfig: db.prepare('SELECT value FROM rag_config WHERE key = ?'),
        setConfig: db.prepare('INSERT OR REPLACE INTO rag_config (key, value, updated_at) VALUES (?, ?, ?)'),
        stats: db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM rag_documents) as total_documents,
        (SELECT COUNT(*) FROM rag_chunks) as total_chunks,
        (SELECT COUNT(*) FROM rag_chunks WHERE embedding IS NOT NULL) as indexed_chunks
    `),
        projectBreakdown: db.prepare(`
      SELECT project_id, COUNT(*) as count
      FROM rag_documents
      GROUP BY project_id
    `),
    };
    // Check if FTS is available
    let ftsAvailable = false;
    try {
        db.prepare("SELECT 1 FROM rag_chunks_fts LIMIT 1").get();
        ftsAvailable = true;
    }
    catch {
        ftsAvailable = false;
    }
    const storage = {
        async saveDocument(doc) {
            stmts.insertDoc.run(doc.id, doc.projectId, doc.sourceType, doc.sourceId, doc.title, doc.content, JSON.stringify(doc.metadata), doc.chunkCount, doc.createdAt, doc.updatedAt);
        },
        async getDocument(id) {
            const row = stmts.getDoc.get(id);
            return row ? rowToDocument(row) : null;
        },
        async listDocuments(options = {}) {
            const limit = options.limit ?? 100;
            let rows;
            if (options.projectId && options.sourceType) {
                rows = stmts.listDocsByProjectAndType.all(options.projectId, options.sourceType, limit);
            }
            else if (options.projectId) {
                rows = stmts.listDocsByProject.all(options.projectId, limit);
            }
            else if (options.sourceType) {
                rows = stmts.listDocsByType.all(options.sourceType, limit);
            }
            else {
                rows = stmts.listDocs.all(limit);
            }
            return rows.map(rowToDocument);
        },
        async deleteDocument(id) {
            const result = stmts.deleteDoc.run(id);
            return result.changes > 0;
        },
        async updateDocument(id, updates) {
            const doc = await storage.getDocument(id);
            if (!doc)
                return false;
            const newTitle = updates.title ?? doc.title;
            const newContent = updates.content ?? doc.content;
            const newMetadata = updates.metadata ?? doc.metadata;
            const result = stmts.updateDoc.run(newTitle, newContent, JSON.stringify(newMetadata), new Date().toISOString(), id);
            return result.changes > 0;
        },
        async saveChunks(chunks) {
            const insertMany = db.transaction((...args) => {
                const inputChunks = args[0];
                for (const chunk of inputChunks) {
                    stmts.insertChunk.run(chunk.id, chunk.documentId, chunk.content, chunk.embedding ? JSON.stringify(chunk.embedding) : null, chunk.chunkIndex, chunk.startOffset, chunk.endOffset, JSON.stringify(chunk.metadata), chunk.createdAt);
                }
            });
            insertMany(chunks);
        },
        async getChunks(documentId) {
            const rows = stmts.getChunks.all(documentId);
            return rows.map(rowToChunk);
        },
        async getChunkById(id) {
            const row = stmts.getChunkById.get(id);
            return row ? rowToChunk(row) : null;
        },
        async updateChunkEmbedding(chunkId, embedding) {
            stmts.updateEmbedding.run(JSON.stringify(embedding), chunkId);
        },
        async deleteChunks(documentId) {
            const result = stmts.deleteChunks.run(documentId);
            return result.changes;
        },
        async vectorSearch(embedding, options = {}) {
            const topK = options.topK ?? 10;
            const minScore = options.minScore ?? 0.5;
            // Get all embeddings (optionally filtered by project)
            const rows = options.projectId
                ? stmts.getAllEmbeddingsByProject.all(options.projectId)
                : stmts.getAllEmbeddings.all();
            const chunks = rows.map((row) => ({
                id: row.id,
                embedding: JSON.parse(row.embedding),
                documentId: row.document_id,
            }));
            // Perform vector search
            const results = vectorSearch(embedding, chunks, topK, minScore);
            // Enrich results with full data
            const enriched = [];
            for (const result of results) {
                const chunk = await storage.getChunkById(result.id);
                if (chunk) {
                    const doc = await storage.getDocument(chunk.documentId);
                    if (doc) {
                        enriched.push({
                            chunk,
                            document: doc,
                            score: result.score,
                            highlights: [chunk.content.substring(0, 200) + (chunk.content.length > 200 ? '...' : '')],
                        });
                    }
                }
            }
            return enriched;
        },
        async keywordSearch(query, options = {}) {
            const limit = options.limit ?? 10;
            try {
                let rows;
                if (ftsAvailable) {
                    // Use FTS5 search
                    const ftsQuery = query
                        .split(/\s+/)
                        .filter((w) => w.length > 0)
                        .map((w) => `"${w.replace(/"/g, '""')}"`)
                        .join(' OR ');
                    if (!ftsQuery)
                        return [];
                    const ftsStmt = options.projectId
                        ? db.prepare(`
                SELECT c.*, d.project_id
                FROM rag_chunks_fts fts
                JOIN rag_chunks c ON fts.rowid = c.rowid
                JOIN rag_documents d ON c.document_id = d.id
                WHERE rag_chunks_fts MATCH ? AND d.project_id = ?
                ORDER BY rank
                LIMIT ?
              `)
                        : db.prepare(`
                SELECT c.*
                FROM rag_chunks_fts fts
                JOIN rag_chunks c ON fts.rowid = c.rowid
                WHERE rag_chunks_fts MATCH ?
                ORDER BY rank
                LIMIT ?
              `);
                    rows = options.projectId
                        ? ftsStmt.all(ftsQuery, options.projectId, limit)
                        : ftsStmt.all(ftsQuery, limit);
                }
                else {
                    // Fallback to LIKE search
                    const likePattern = `%${query}%`;
                    const likeStmt = options.projectId
                        ? db.prepare(`
                SELECT c.*
                FROM rag_chunks c
                JOIN rag_documents d ON c.document_id = d.id
                WHERE c.content LIKE ? AND d.project_id = ?
                LIMIT ?
              `)
                        : db.prepare(`
                SELECT * FROM rag_chunks WHERE content LIKE ? LIMIT ?
              `);
                    rows = options.projectId
                        ? likeStmt.all(likePattern, options.projectId, limit)
                        : likeStmt.all(likePattern, limit);
                }
                const results = [];
                for (const row of rows) {
                    const chunk = rowToChunk(row);
                    const doc = await storage.getDocument(chunk.documentId);
                    if (doc) {
                        results.push({
                            chunk,
                            document: doc,
                            score: 0.5, // Fixed score for keyword search
                            highlights: [chunk.content.substring(0, 200) + (chunk.content.length > 200 ? '...' : '')],
                        });
                    }
                }
                return results;
            }
            catch {
                return []; // Query failed
            }
        },
        async hybridSearch(query, embedding, options = {}) {
            const vectorWeight = options.vectorWeight ?? 0.7;
            const topK = options.topK ?? 10;
            // Run both searches
            const [vectorResults, keywordResults] = await Promise.all([
                storage.vectorSearch(embedding, { ...options, topK: topK * 2 }),
                storage.keywordSearch(query, { ...options, limit: topK * 2 }),
            ]);
            // Combine and deduplicate by chunk ID
            const scoreMap = new Map();
            for (const result of vectorResults) {
                scoreMap.set(result.chunk.id, {
                    result,
                    vectorScore: result.score,
                    keywordScore: 0,
                });
            }
            for (const result of keywordResults) {
                const existing = scoreMap.get(result.chunk.id);
                if (existing) {
                    existing.keywordScore = result.score;
                }
                else {
                    scoreMap.set(result.chunk.id, {
                        result,
                        vectorScore: 0,
                        keywordScore: result.score,
                    });
                }
            }
            // Calculate hybrid scores
            const hybridResults = Array.from(scoreMap.values())
                .map(({ result, vectorScore, keywordScore }) => ({
                ...result,
                score: vectorWeight * vectorScore + (1 - vectorWeight) * keywordScore,
            }))
                .sort((a, b) => b.score - a.score)
                .slice(0, topK);
            return hybridResults;
        },
        async getStats() {
            const stats = stmts.stats.get();
            const breakdown = stmts.projectBreakdown.all();
            const projectBreakdown = {};
            for (const row of breakdown) {
                projectBreakdown[row.project_id || 'standalone'] = row.count;
            }
            return {
                totalDocuments: stats.total_documents,
                totalChunks: stats.total_chunks,
                indexedChunks: stats.indexed_chunks,
                projectBreakdown,
            };
        },
        async getConfig() {
            const configRow = stmts.getConfig.get('main');
            if (configRow) {
                return JSON.parse(configRow.value);
            }
            return getDefaultRAGConfig();
        },
        async updateConfig(config) {
            const current = await storage.getConfig();
            const merged = {
                ...current,
                ...config,
                embedding: { ...current.embedding, ...(config.embedding ?? {}) },
                chunking: { ...current.chunking, ...(config.chunking ?? {}) },
                search: { ...current.search, ...(config.search ?? {}) },
                indexing: { ...current.indexing, ...(config.indexing ?? {}) },
            };
            stmts.setConfig.run('main', JSON.stringify(merged), new Date().toISOString());
        },
        async vacuum() {
            db.exec('VACUUM');
        },
        async rebuildFTS() {
            if (ftsAvailable) {
                db.exec("INSERT INTO rag_chunks_fts(rag_chunks_fts) VALUES('rebuild')");
            }
        },
        close() {
            db.close();
        },
    };
    return storage;
}
// ============================================================================
// Singleton Instance
// ============================================================================
let ragStorageInstance = null;
export async function getRAGStorage() {
    // Ensure SQLite is loaded
    const available = await loadSqlite();
    if (!available) {
        throw new Error('RAG storage requires better-sqlite3. Install it with: npm install better-sqlite3');
    }
    if (!ragStorageInstance) {
        ragStorageInstance = await createRAGStorage();
    }
    return ragStorageInstance;
}
export function resetRAGStorage() {
    if (ragStorageInstance) {
        ragStorageInstance.close();
        ragStorageInstance = null;
    }
}
//# sourceMappingURL=rag-storage.js.map