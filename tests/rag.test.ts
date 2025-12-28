/**
 * Tests for CortexFlow RAG (Retrieval-Augmented Generation) Module
 */

import { mkdtemp, rm, readdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

// Check if better-sqlite3 is available (native dependency)
let sqliteAvailable = true;
try {
  await import('better-sqlite3');
} catch {
  sqliteAvailable = false;
}

// We need to mock the data directory before importing RAG modules
const originalEnv = process.env.CORTEXFLOW_DATA_DIR;
let testDataDir: string;

// Separate imports for modules that don't need SQLite
async function getChunkingModule() {
  return import('../src/rag/chunking.js');
}

async function getEmbeddingsModule() {
  return import('../src/rag/embeddings.js');
}

// Dynamic imports for modules that depend on SQLite
async function getRAGModules() {
  const [storage, features, chunking, embeddings] = await Promise.all([
    import('../src/rag/rag-storage.js'),
    import('../src/rag/rag-features.js'),
    import('../src/rag/chunking.js'),
    import('../src/rag/embeddings.js'),
  ]);
  return { storage, features, chunking, embeddings };
}

// Conditionally run tests that require SQLite
const describeWithSqlite = sqliteAvailable ? describe : describe.skip;

describe('RAG Module', () => {
  beforeAll(async () => {
    testDataDir = await mkdtemp(join(tmpdir(), 'cortexflow-rag-test-'));
    process.env.CORTEXFLOW_DATA_DIR = testDataDir;
  });

  afterAll(async () => {
    if (originalEnv) {
      process.env.CORTEXFLOW_DATA_DIR = originalEnv;
    } else {
      delete process.env.CORTEXFLOW_DATA_DIR;
    }

    try {
      await rm(testDataDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    if (!sqliteAvailable) return;

    try {
      const files = await readdir(testDataDir);
      for (const file of files) {
        await rm(join(testDataDir, file), { recursive: true, force: true });
      }
    } catch {
      // Directory might not exist yet
    }

    // Reset singletons between tests
    const { storage, embeddings } = await getRAGModules();
    storage.resetRAGStorage();
    embeddings.resetEmbeddingProvider();
  });

  // ============================================================================
  // Chunking Tests
  // ============================================================================

  describe('Chunking', () => {
    it('should chunk text by paragraphs', async () => {
      const chunking = await getChunkingModule();

      const text = `First paragraph with some content.

Second paragraph with different content.

Third paragraph to complete the test.`;

      const config = {
        strategy: 'paragraph' as const,
        chunkSize: 1000,
        chunkOverlap: 100,
        minChunkSize: 10,
        maxChunkSize: 2000,
      };

      const chunks = chunking.chunkDocument(text, config);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].content).toBeTruthy();
      expect(chunks[0].index).toBe(0);
    });

    it('should chunk text by sentences', async () => {
      const chunking = await getChunkingModule();

      const text =
        'First sentence here. Second sentence follows. Third sentence ends it.';

      const config = {
        strategy: 'sentence' as const,
        chunkSize: 50,
        chunkOverlap: 10,
        minChunkSize: 10,
        maxChunkSize: 100,
      };

      const chunks = chunking.chunkDocument(text, config);

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should chunk text by fixed size', async () => {
      const chunking = await getChunkingModule();

      const text = 'A'.repeat(500);

      const config = {
        strategy: 'fixed' as const,
        chunkSize: 100,
        chunkOverlap: 20,
        minChunkSize: 10,
        maxChunkSize: 200,
      };

      const chunks = chunking.chunkDocument(text, config);

      expect(chunks.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle semantic chunking with markdown headers', async () => {
      const chunking = await getChunkingModule();

      const text = `# Introduction

Some introductory content here.

## Section One

Content for section one.

## Section Two

Content for section two.`;

      const config = {
        strategy: 'semantic' as const,
        chunkSize: 500,
        chunkOverlap: 50,
        minChunkSize: 10,
        maxChunkSize: 1000,
      };

      const chunks = chunking.chunkDocument(text, config);

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should return empty array for empty text', async () => {
      const chunking = await getChunkingModule();

      const config = {
        strategy: 'paragraph' as const,
        chunkSize: 100,
        chunkOverlap: 10,
        minChunkSize: 10,
        maxChunkSize: 200,
      };

      const chunks = chunking.chunkDocument('', config);

      expect(chunks).toEqual([]);
    });

    it('should estimate token count', async () => {
      const chunking = await getChunkingModule();

      const text = 'Hello world';
      const tokens = chunking.estimateTokenCount(text);

      // ~4 chars per token
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(text.length);
    });

    it('should get recommended chunk size for models', async () => {
      const chunking = await getChunkingModule();

      const size = chunking.getRecommendedChunkSize('text-embedding-3-small');

      expect(size).toBeGreaterThan(0);
      expect(size).toBeLessThan(50000);
    });

    it('should merge small chunks', async () => {
      const chunking = await getChunkingModule();

      const chunks = [
        { content: 'Small', startOffset: 0, endOffset: 5, index: 0 },
        { content: 'Tiny', startOffset: 6, endOffset: 10, index: 1 },
        { content: 'A much longer chunk that exceeds minimum', startOffset: 11, endOffset: 51, index: 2 },
      ];

      const merged = chunking.mergeSmallChunks(chunks, 20);

      expect(merged.length).toBeLessThanOrEqual(chunks.length);
    });
  });

  // ============================================================================
  // RAG Storage Tests (requires better-sqlite3)
  // ============================================================================

  describeWithSqlite('RAG Storage', () => {
    it('should create storage instance', async () => {
      const { storage } = await getRAGModules();
      const ragStorage = await storage.getRAGStorage();

      expect(ragStorage).toBeDefined();
      expect(typeof ragStorage.saveDocument).toBe('function');
      expect(typeof ragStorage.getDocument).toBe('function');
      expect(typeof ragStorage.deleteDocument).toBe('function');
      expect(typeof ragStorage.vectorSearch).toBe('function');
      expect(typeof ragStorage.keywordSearch).toBe('function');
      expect(typeof ragStorage.hybridSearch).toBe('function');
    });

    it('should save and retrieve a document', async () => {
      const { storage } = await getRAGModules();
      const ragStorage = await storage.getRAGStorage();

      // Import models for factory function
      const models = await import('../src/models.js');
      const doc = models.createRAGDocument('Test Document', 'Test content here', {
        sourceType: 'custom_document',
        metadata: { testKey: 'testValue' },
      });

      await ragStorage.saveDocument(doc);
      const retrieved = await ragStorage.getDocument(doc.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.title).toBe('Test Document');
      expect(retrieved?.content).toBe('Test content here');
      expect(retrieved?.metadata.testKey).toBe('testValue');
    });

    it('should list documents', async () => {
      const { storage } = await getRAGModules();
      const ragStorage = await storage.getRAGStorage();
      const models = await import('../src/models.js');

      const doc1 = models.createRAGDocument('Doc 1', 'Content 1');
      const doc2 = models.createRAGDocument('Doc 2', 'Content 2');

      await ragStorage.saveDocument(doc1);
      await ragStorage.saveDocument(doc2);

      const docs = await ragStorage.listDocuments({});

      expect(docs.length).toBe(2);
    });

    it('should delete a document', async () => {
      const { storage } = await getRAGModules();
      const ragStorage = await storage.getRAGStorage();
      const models = await import('../src/models.js');

      const doc = models.createRAGDocument('To Delete', 'Delete me');
      await ragStorage.saveDocument(doc);

      const deleted = await ragStorage.deleteDocument(doc.id);
      expect(deleted).toBe(true);

      const retrieved = await ragStorage.getDocument(doc.id);
      expect(retrieved).toBeNull();
    });

    it('should save and retrieve chunks', async () => {
      const { storage } = await getRAGModules();
      const ragStorage = await storage.getRAGStorage();
      const models = await import('../src/models.js');

      const doc = models.createRAGDocument('Test Doc', 'Test content');
      await ragStorage.saveDocument(doc);

      const chunk = models.createRAGChunk(doc.id, 'Chunk content', 0, {
        startOffset: 0,
        endOffset: 13,
      });

      await ragStorage.saveChunks([chunk]);
      const chunks = await ragStorage.getChunks(doc.id);

      expect(chunks.length).toBe(1);
      expect(chunks[0].content).toBe('Chunk content');
    });

    it('should perform keyword search', async () => {
      const { storage } = await getRAGModules();
      const ragStorage = await storage.getRAGStorage();
      const models = await import('../src/models.js');

      const doc = models.createRAGDocument('Searchable Doc', 'Contains unique keyword here');
      doc.chunkCount = 1;
      await ragStorage.saveDocument(doc);

      const chunk = models.createRAGChunk(doc.id, 'Contains unique keyword here', 0);
      await ragStorage.saveChunks([chunk]);
      await ragStorage.rebuildFTS();

      const results = await ragStorage.keywordSearch('unique keyword', { limit: 10 });

      expect(results.length).toBeGreaterThan(0);
    });

    it('should compute cosine similarity correctly', async () => {
      const { storage } = await getRAGModules();

      const vec1 = [1, 0, 0];
      const vec2 = [1, 0, 0];
      const vec3 = [0, 1, 0];

      expect(storage.cosineSimilarity(vec1, vec2)).toBeCloseTo(1, 5);
      expect(storage.cosineSimilarity(vec1, vec3)).toBeCloseTo(0, 5);
    });

    it('should get RAG statistics', async () => {
      const { storage } = await getRAGModules();
      const ragStorage = await storage.getRAGStorage();
      const models = await import('../src/models.js');

      const doc = models.createRAGDocument('Stats Test', 'Content for stats');
      await ragStorage.saveDocument(doc);

      const stats = await ragStorage.getStats();

      expect(stats.totalDocuments).toBe(1);
      expect(typeof stats.totalChunks).toBe('number');
    });

    it('should get and update config', async () => {
      const { storage } = await getRAGModules();
      const ragStorage = await storage.getRAGStorage();

      const config = await ragStorage.getConfig();

      expect(config.embedding).toBeDefined();
      expect(config.chunking).toBeDefined();
      expect(config.search).toBeDefined();

      await ragStorage.updateConfig({
        search: { topK: 10 },
      });

      const updated = await ragStorage.getConfig();
      expect(updated.search.topK).toBe(10);
    });
  });

  // ============================================================================
  // Embedding Provider Tests
  // ============================================================================

  describe('Embedding Providers', () => {
    it('should get available providers', async () => {
      const embeddings = await getEmbeddingsModule();

      const providers = await embeddings.getAvailableProviders();

      expect(Array.isArray(providers)).toBe(true);
      // Note: local provider may not be available without transformers.js
      // expect(providers.length).toBeGreaterThan(0);
    });

    it('should get provider dimensions', async () => {
      const embeddings = await getEmbeddingsModule();

      const localDims = embeddings.getProviderDimensions('local');
      expect(localDims).toBe(384);

      const openaiDims = embeddings.getProviderDimensions('openai');
      expect(openaiDims).toBe(1536);
    });

    it('should create embedding provider', async () => {
      const embeddings = await getEmbeddingsModule();

      const provider = await embeddings.createEmbeddingProvider({
        provider: 'local',
        model: 'Xenova/all-MiniLM-L6-v2',
        dimensions: 384,
        batchSize: 10,
      });

      expect(provider).toBeDefined();
      expect(provider.name).toBe('local');
      expect(provider.dimensions).toBe(384);
    });
  });

  // ============================================================================
  // RAG Features (Integration) Tests
  // ============================================================================

  describeWithSqlite('RAG Features', () => {
    it('should index a document', async () => {
      const { features } = await getRAGModules();

      const doc = await features.indexDocument('Test Document', 'This is test content for indexing', {
        sourceType: 'custom_document',
        skipEmbedding: true, // Skip for faster tests
      });

      expect(doc).toBeDefined();
      expect(doc.title).toBe('Test Document');
      expect(doc.chunkCount).toBeGreaterThan(0);
    });

    it('should list indexed documents', async () => {
      const { features } = await getRAGModules();

      await features.indexDocument('Doc 1', 'Content 1', { skipEmbedding: true });
      await features.indexDocument('Doc 2', 'Content 2', { skipEmbedding: true });

      const docs = await features.listDocuments();

      expect(docs.length).toBe(2);
    });

    it('should delete a document', async () => {
      const { features } = await getRAGModules();

      const doc = await features.indexDocument('To Delete', 'Delete content', {
        skipEmbedding: true,
      });

      const deleted = await features.deleteDocument(doc.id);
      expect(deleted).toBe(true);

      const retrieved = await features.getDocument(doc.id);
      expect(retrieved).toBeNull();
    });

    it('should perform search', async () => {
      const { features, storage } = await getRAGModules();

      await features.indexDocument('Searchable', 'Contains searchable content keyword', {
        skipEmbedding: true,
      });

      // Rebuild FTS for keyword search
      const ragStorage = await storage.getRAGStorage();
      await ragStorage.rebuildFTS();

      const result = await features.search('searchable content', {
        searchType: 'keyword',
      });

      expect(result).toBeDefined();
      expect(result.query).toBe('searchable content');
    });

    it('should get RAG stats', async () => {
      const { features } = await getRAGModules();

      await features.indexDocument('Stats Doc', 'Content for statistics', {
        skipEmbedding: true,
      });

      const stats = await features.getRAGStats();

      expect(stats.totalDocuments).toBe(1);
      expect(stats.embeddingProvider).toBeDefined();
    });

    it('should get and update RAG config', async () => {
      const { features } = await getRAGModules();

      const config = await features.getRAGConfig();

      expect(config).toBeDefined();
      expect(config.embedding).toBeDefined();

      await features.updateRAGConfig({
        search: { topK: 15 },
      });

      const updated = await features.getRAGConfig();
      expect(updated.search.topK).toBe(15);
    });

    it('should build context from search', async () => {
      const { features, storage } = await getRAGModules();

      await features.indexDocument('Context Doc', 'Important context information here', {
        skipEmbedding: true,
      });

      const ragStorage = await storage.getRAGStorage();
      await ragStorage.rebuildFTS();

      const result = await features.buildContextFromSearch('context information', {
        searchType: 'keyword',
      });

      expect(result).toBeDefined();
      expect(result.context).toBeDefined();
      expect(result.sources).toBeDefined();
    });
  });
});
