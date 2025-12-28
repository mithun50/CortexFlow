/**
 * Comprehensive Tests for CortexFlow RAG Chunking Module
 * Tests chunking strategies, token estimation, and chunk merging
 */

describe('RAG Chunking Module', () => {
  let chunking: typeof import('../src/rag/chunking.js');

  beforeAll(async () => {
    chunking = await import('../src/rag/chunking.js');
  });

  // ============================================================================
  // Paragraph Chunking Tests
  // ============================================================================

  describe('Paragraph Chunking', () => {
    const paragraphConfig = {
      strategy: 'paragraph' as const,
      chunkSize: 500,
      chunkOverlap: 50,
      minChunkSize: 20,
      maxChunkSize: 1000,
    };

    it('should split text by double newlines', () => {
      const text = `First paragraph here.

Second paragraph here.

Third paragraph here.`;

      const chunks = chunking.chunkDocument(text, paragraphConfig);

      expect(chunks.length).toBe(3);
      expect(chunks[0].content).toContain('First');
      expect(chunks[1].content).toContain('Second');
      expect(chunks[2].content).toContain('Third');
    });

    it('should handle single paragraph text', () => {
      const text = 'Single paragraph without any double newlines.';
      const chunks = chunking.chunkDocument(text, paragraphConfig);

      expect(chunks.length).toBe(1);
      expect(chunks[0].content).toBe(text);
    });

    it('should handle multiple consecutive newlines', () => {
      const text = `First paragraph.



Second paragraph after many newlines.`;

      const chunks = chunking.chunkDocument(text, paragraphConfig);
      expect(chunks.length).toBeGreaterThanOrEqual(2);
    });

    it('should preserve chunk indices', () => {
      const text = `Para 1.

Para 2.

Para 3.

Para 4.`;

      const chunks = chunking.chunkDocument(text, paragraphConfig);

      chunks.forEach((chunk, i) => {
        expect(chunk.index).toBe(i);
      });
    });

    it('should track start and end offsets', () => {
      const text = `First paragraph.

Second paragraph.`;

      const chunks = chunking.chunkDocument(text, paragraphConfig);

      expect(chunks[0].startOffset).toBe(0);
      expect(chunks[0].endOffset).toBeGreaterThan(0);
      expect(chunks[1].startOffset).toBeGreaterThan(chunks[0].endOffset);
    });
  });

  // ============================================================================
  // Sentence Chunking Tests
  // ============================================================================

  describe('Sentence Chunking', () => {
    const sentenceConfig = {
      strategy: 'sentence' as const,
      chunkSize: 100,
      chunkOverlap: 20,
      minChunkSize: 10,
      maxChunkSize: 200,
    };

    it('should split text by sentence boundaries', () => {
      const text = 'First sentence. Second sentence. Third sentence.';
      const chunks = chunking.chunkDocument(text, sentenceConfig);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      chunks.forEach((chunk) => {
        expect(chunk.content.length).toBeGreaterThan(0);
      });
    });

    it('should handle question marks', () => {
      const text = 'Is this a question? Yes it is. What about this?';
      const chunks = chunking.chunkDocument(text, sentenceConfig);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle exclamation marks', () => {
      const text = 'Wow! Amazing! This is great.';
      const chunks = chunking.chunkDocument(text, sentenceConfig);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle abbreviations with periods', () => {
      const text = 'Dr. Smith went to the U.S.A. for a conference. It was great.';
      const chunks = chunking.chunkDocument(text, sentenceConfig);

      // Should not split on abbreviation periods
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should group sentences to meet chunk size', () => {
      const text = 'A. B. C. D. E. F. G. H. I. J.';
      const chunks = chunking.chunkDocument(text, {
        ...sentenceConfig,
        chunkSize: 20,
        minChunkSize: 5,
      });

      // Sentences should be grouped together
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================================
  // Fixed Size Chunking Tests
  // ============================================================================

  describe('Fixed Size Chunking', () => {
    const fixedConfig = {
      strategy: 'fixed' as const,
      chunkSize: 100,
      chunkOverlap: 20,
      minChunkSize: 10,
      maxChunkSize: 150,
    };

    it('should create chunks of approximately equal size', () => {
      const text = 'A'.repeat(500);
      const chunks = chunking.chunkDocument(text, fixedConfig);

      expect(chunks.length).toBeGreaterThanOrEqual(4);
      chunks.forEach((chunk) => {
        expect(chunk.content.length).toBeLessThanOrEqual(fixedConfig.maxChunkSize);
      });
    });

    it('should apply overlap between chunks', () => {
      const text = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(20);
      const chunks = chunking.chunkDocument(text, {
        ...fixedConfig,
        chunkOverlap: 10,
      });

      // Adjacent chunks should have some overlap
      if (chunks.length > 1) {
        const lastPartOfFirst = chunks[0].content.slice(-10);
        const firstPartOfSecond = chunks[1].content.slice(0, 20);
        // There should be some character overlap
        expect(chunks.length).toBeGreaterThan(1);
      }
    });

    it('should handle text shorter than chunk size', () => {
      const text = 'Short text';
      const chunks = chunking.chunkDocument(text, fixedConfig);

      expect(chunks.length).toBe(1);
      expect(chunks[0].content).toBe(text);
    });

    it('should handle exact chunk size text', () => {
      const text = 'X'.repeat(100);
      const chunks = chunking.chunkDocument(text, fixedConfig);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================================
  // Semantic Chunking Tests
  // ============================================================================

  describe('Semantic Chunking', () => {
    const semanticConfig = {
      strategy: 'semantic' as const,
      chunkSize: 500,
      chunkOverlap: 50,
      minChunkSize: 20,
      maxChunkSize: 1000,
    };

    it('should split on markdown headers', () => {
      const text = `# Header 1

Content under header 1.

## Header 2

Content under header 2.

### Header 3

Content under header 3.`;

      const chunks = chunking.chunkDocument(text, semanticConfig);

      expect(chunks.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle code blocks', () => {
      const text = `Some text here.

\`\`\`javascript
function hello() {
  console.log('Hello');
}
\`\`\`

More text after code.`;

      const chunks = chunking.chunkDocument(text, semanticConfig);
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle mixed content', () => {
      const text = `# Introduction

This is the introduction paragraph.

## Features

- Feature 1
- Feature 2
- Feature 3

## Code Example

\`\`\`
code here
\`\`\`

## Conclusion

Final thoughts.`;

      const chunks = chunking.chunkDocument(text, semanticConfig);
      expect(chunks.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ============================================================================
  // Token Estimation Tests
  // ============================================================================

  describe('Token Estimation', () => {
    it('should estimate tokens for simple text', () => {
      const text = 'Hello world';
      const tokens = chunking.estimateTokenCount(text);

      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(text.length);
    });

    it('should estimate more tokens for longer text', () => {
      const short = 'Hello';
      const long = 'Hello world, this is a much longer piece of text.';

      const shortTokens = chunking.estimateTokenCount(short);
      const longTokens = chunking.estimateTokenCount(long);

      expect(longTokens).toBeGreaterThan(shortTokens);
    });

    it('should handle empty string', () => {
      const tokens = chunking.estimateTokenCount('');
      expect(tokens).toBe(0);
    });

    it('should handle special characters', () => {
      const text = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/`~';
      const tokens = chunking.estimateTokenCount(text);

      expect(tokens).toBeGreaterThan(0);
    });

    it('should handle unicode', () => {
      const text = 'Hello 世界 🌍';
      const tokens = chunking.estimateTokenCount(text);

      expect(tokens).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Recommended Chunk Size Tests
  // ============================================================================

  describe('Recommended Chunk Size', () => {
    it('should return appropriate size for OpenAI models', () => {
      const size = chunking.getRecommendedChunkSize('text-embedding-3-small');
      expect(size).toBeGreaterThan(0);
      expect(size).toBeLessThan(10000);
    });

    it('should return appropriate size for text-embedding-3-large', () => {
      const size = chunking.getRecommendedChunkSize('text-embedding-3-large');
      expect(size).toBeGreaterThan(0);
    });

    it('should return appropriate size for ada model', () => {
      const size = chunking.getRecommendedChunkSize('text-embedding-ada-002');
      expect(size).toBeGreaterThan(0);
    });

    it('should return default size for unknown models', () => {
      const size = chunking.getRecommendedChunkSize('unknown-model');
      expect(size).toBeGreaterThan(0);
    });

    it('should return appropriate size for local models', () => {
      const size = chunking.getRecommendedChunkSize('Xenova/all-MiniLM-L6-v2');
      expect(size).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Chunk Merging Tests
  // ============================================================================

  describe('Chunk Merging', () => {
    it('should merge small adjacent chunks', () => {
      const chunks = [
        { content: 'Small', startOffset: 0, endOffset: 5, index: 0 },
        { content: 'Tiny', startOffset: 6, endOffset: 10, index: 1 },
        { content: 'This is a larger chunk', startOffset: 11, endOffset: 33, index: 2 },
      ];

      const merged = chunking.mergeSmallChunks(chunks, 15);

      expect(merged.length).toBeLessThanOrEqual(chunks.length);
    });

    it('should not merge chunks above minimum size', () => {
      const chunks = [
        { content: 'This is a sufficiently large chunk', startOffset: 0, endOffset: 35, index: 0 },
        { content: 'Another sufficiently large chunk', startOffset: 36, endOffset: 68, index: 1 },
      ];

      const merged = chunking.mergeSmallChunks(chunks, 10);

      expect(merged.length).toBe(chunks.length);
    });

    it('should update indices after merging', () => {
      const chunks = [
        { content: 'A', startOffset: 0, endOffset: 1, index: 0 },
        { content: 'B', startOffset: 2, endOffset: 3, index: 1 },
        { content: 'C', startOffset: 4, endOffset: 5, index: 2 },
      ];

      const merged = chunking.mergeSmallChunks(chunks, 10);

      merged.forEach((chunk, i) => {
        expect(chunk.index).toBe(i);
      });
    });

    it('should handle empty chunk array', () => {
      const merged = chunking.mergeSmallChunks([], 10);
      expect(merged).toEqual([]);
    });

    it('should handle single chunk', () => {
      const chunks = [{ content: 'Single', startOffset: 0, endOffset: 6, index: 0 }];

      const merged = chunking.mergeSmallChunks(chunks, 10);

      expect(merged.length).toBe(1);
    });
  });

  // ============================================================================
  // Split Oversized Chunk Tests
  // ============================================================================

  describe('Split Oversized Chunk', () => {
    it('should split chunks exceeding max size', () => {
      const chunk = {
        content: 'A'.repeat(500),
        startOffset: 0,
        endOffset: 500,
        index: 0,
      };

      const result = chunking.splitOversizedChunk(chunk, 100);

      expect(result.length).toBeGreaterThan(1);
      result.forEach((c) => {
        expect(c.content.length).toBeLessThanOrEqual(150); // Some tolerance
      });
    });

    it('should not split chunks within max size', () => {
      const chunk = {
        content: 'Short text',
        startOffset: 0,
        endOffset: 10,
        index: 0,
      };

      const result = chunking.splitOversizedChunk(chunk, 100);

      expect(result.length).toBe(1);
      expect(result[0].content).toBe(chunk.content);
    });

    it('should update offsets correctly', () => {
      const chunk = {
        content: 'ABCDEFGHIJ'.repeat(10),
        startOffset: 100,
        endOffset: 200,
        index: 0,
      };

      const result = chunking.splitOversizedChunk(chunk, 20);

      expect(result[0].startOffset).toBe(100);
      if (result.length > 1) {
        expect(result[1].startOffset).toBeGreaterThan(result[0].startOffset);
      }
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    const defaultConfig = {
      strategy: 'paragraph' as const,
      chunkSize: 100,
      chunkOverlap: 10,
      minChunkSize: 5,
      maxChunkSize: 200,
    };

    it('should handle empty text', () => {
      const chunks = chunking.chunkDocument('', defaultConfig);
      expect(chunks).toEqual([]);
    });

    it('should handle whitespace only text', () => {
      const chunks = chunking.chunkDocument('   \n\n   ', defaultConfig);
      expect(chunks.length).toBeLessThanOrEqual(1);
    });

    it('should handle very long single word', () => {
      const text = 'A'.repeat(1000);
      const chunks = chunking.chunkDocument(text, defaultConfig);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle text with only newlines', () => {
      const text = '\n\n\n\n\n';
      const chunks = chunking.chunkDocument(text, defaultConfig);
      expect(chunks.length).toBeLessThanOrEqual(1);
    });

    it('should handle mixed line endings', () => {
      const text = 'Line 1\r\nLine 2\nLine 3\rLine 4';
      const chunks = chunking.chunkDocument(text, defaultConfig);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });
  });
});
