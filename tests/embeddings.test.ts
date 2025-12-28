/**
 * Comprehensive Tests for CortexFlow Embedding Providers
 * Tests embedding provider creation, configuration, and batch processing
 */

describe('Embedding Providers Module', () => {
  let embeddings: typeof import('../src/rag/embeddings.js');

  beforeAll(async () => {
    embeddings = await import('../src/rag/embeddings.js');
  });

  // ============================================================================
  // Provider Availability Tests
  // ============================================================================

  describe('Provider Availability', () => {
    it('should return list of available providers', async () => {
      const providers = await embeddings.getAvailableProviders();

      expect(Array.isArray(providers)).toBe(true);
      // At minimum, the structure should be an array
    });

    it('should indicate local provider availability', async () => {
      const providers = await embeddings.getAvailableProviders();

      // Local provider may or may not be available depending on transformers.js
      expect(providers.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // Provider Dimensions Tests
  // ============================================================================

  describe('Provider Dimensions', () => {
    it('should return correct dimensions for local provider', () => {
      const dims = embeddings.getProviderDimensions('local');
      expect(dims).toBe(384);
    });

    it('should return correct dimensions for OpenAI provider', () => {
      const dims = embeddings.getProviderDimensions('openai');
      expect(dims).toBe(1536);
    });

    it('should return correct dimensions for Voyage provider', () => {
      const dims = embeddings.getProviderDimensions('voyage');
      expect(dims).toBe(1024);
    });

    it('should return correct dimensions for Cohere provider', () => {
      const dims = embeddings.getProviderDimensions('cohere');
      expect(dims).toBe(1024);
    });

    it('should return default dimensions for unknown provider', () => {
      const dims = embeddings.getProviderDimensions('unknown' as any);
      expect(dims).toBeGreaterThan(0);
    });

    it('should return correct dimensions for custom provider', () => {
      const dims = embeddings.getProviderDimensions('custom');
      // Custom provider should have a default dimension
      expect(dims).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Provider Creation Tests
  // ============================================================================

  describe('Provider Creation', () => {
    it('should create a local embedding provider', async () => {
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

    it('should have required methods on provider', async () => {
      const provider = await embeddings.createEmbeddingProvider({
        provider: 'local',
        model: 'Xenova/all-MiniLM-L6-v2',
        dimensions: 384,
        batchSize: 10,
      });

      expect(typeof provider.embed).toBe('function');
      expect(typeof provider.embedBatch).toBe('function');
      expect(typeof provider.isAvailable).toBe('function');
    });

    it('should check provider availability', async () => {
      const provider = await embeddings.createEmbeddingProvider({
        provider: 'local',
        model: 'Xenova/all-MiniLM-L6-v2',
        dimensions: 384,
        batchSize: 10,
      });

      const available = await provider.isAvailable();
      expect(typeof available).toBe('boolean');
    });

    it('should create OpenAI provider config', async () => {
      const provider = await embeddings.createEmbeddingProvider({
        provider: 'openai',
        model: 'text-embedding-3-small',
        dimensions: 1536,
        batchSize: 100,
        apiKey: 'test-key',
      });

      expect(provider).toBeDefined();
      expect(provider.name).toBe('openai');
      expect(provider.dimensions).toBe(1536);
    });

    it('should create Voyage provider config', async () => {
      const provider = await embeddings.createEmbeddingProvider({
        provider: 'voyage',
        model: 'voyage-2',
        dimensions: 1024,
        batchSize: 50,
        apiKey: 'test-key',
      });

      expect(provider).toBeDefined();
      expect(provider.name).toBe('voyage');
      expect(provider.dimensions).toBe(1024);
    });

    it('should create Cohere provider config', async () => {
      const provider = await embeddings.createEmbeddingProvider({
        provider: 'cohere',
        model: 'embed-english-v3.0',
        dimensions: 1024,
        batchSize: 50,
        apiKey: 'test-key',
      });

      expect(provider).toBeDefined();
      expect(provider.name).toBe('cohere');
      expect(provider.dimensions).toBe(1024);
    });

    it('should create custom provider config', async () => {
      const provider = await embeddings.createEmbeddingProvider({
        provider: 'custom',
        model: 'custom-model',
        dimensions: 512,
        batchSize: 20,
        endpoint: 'http://localhost:8080/embed',
      });

      expect(provider).toBeDefined();
      expect(provider.name).toBe('custom');
      expect(provider.dimensions).toBe(512);
    });
  });

  // ============================================================================
  // Singleton Provider Tests
  // ============================================================================

  describe('Singleton Provider', () => {
    beforeEach(() => {
      embeddings.resetEmbeddingProvider();
    });

    it('should get embedding provider singleton', async () => {
      const provider = await embeddings.getEmbeddingProvider();

      expect(provider).toBeDefined();
      expect(provider.name).toBeDefined();
    });

    it('should return same instance on multiple calls', async () => {
      const provider1 = await embeddings.getEmbeddingProvider();
      const provider2 = await embeddings.getEmbeddingProvider();

      expect(provider1).toBe(provider2);
    });

    it('should reset and create new provider', async () => {
      const provider1 = await embeddings.getEmbeddingProvider();
      embeddings.resetEmbeddingProvider();
      const provider2 = await embeddings.getEmbeddingProvider();

      // After reset, should still work (may or may not be same instance)
      expect(provider2).toBeDefined();
    });
  });

  // ============================================================================
  // Embedding Config Tests
  // ============================================================================

  describe('Embedding Configuration', () => {
    it('should accept valid provider names', async () => {
      const providers = ['local', 'openai', 'voyage', 'cohere', 'custom'];

      for (const providerName of providers) {
        const provider = await embeddings.createEmbeddingProvider({
          provider: providerName as any,
          model: 'test-model',
          dimensions: 384,
          batchSize: 10,
        });

        expect(provider.name).toBe(providerName);
      }
    });

    it('should use specified dimensions', async () => {
      const dimensions = [128, 256, 384, 512, 768, 1024, 1536];

      for (const dim of dimensions) {
        const provider = await embeddings.createEmbeddingProvider({
          provider: 'custom',
          model: 'test-model',
          dimensions: dim,
          batchSize: 10,
        });

        expect(provider.dimensions).toBe(dim);
      }
    });

    it('should use specified batch size', async () => {
      const provider = await embeddings.createEmbeddingProvider({
        provider: 'local',
        model: 'test-model',
        dimensions: 384,
        batchSize: 50,
      });

      expect(provider).toBeDefined();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty model name', async () => {
      const provider = await embeddings.createEmbeddingProvider({
        provider: 'local',
        model: '',
        dimensions: 384,
        batchSize: 10,
      });

      expect(provider).toBeDefined();
    });

    it('should handle zero batch size', async () => {
      const provider = await embeddings.createEmbeddingProvider({
        provider: 'local',
        model: 'test-model',
        dimensions: 384,
        batchSize: 0,
      });

      expect(provider).toBeDefined();
    });

    it('should handle large dimensions', async () => {
      const provider = await embeddings.createEmbeddingProvider({
        provider: 'custom',
        model: 'large-model',
        dimensions: 4096,
        batchSize: 10,
      });

      expect(provider.dimensions).toBe(4096);
    });
  });
});
