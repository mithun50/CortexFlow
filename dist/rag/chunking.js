/**
 * CortexFlow - Document Chunking Strategies
 *
 * Provides different strategies for splitting documents into chunks
 * suitable for embedding and retrieval.
 */
// ============================================================================
// Paragraph Chunking
// ============================================================================
/**
 * Split text by paragraphs (double newlines)
 * Groups small paragraphs together to meet minimum chunk size
 */
function chunkByParagraph(text, config) {
    const paragraphs = text.split(/\n\s*\n/);
    const chunks = [];
    let currentChunk = '';
    let currentStart = 0;
    let chunkIndex = 0;
    for (const para of paragraphs) {
        const trimmed = para.trim();
        if (!trimmed)
            continue;
        // Find the actual position in original text
        const paraStart = text.indexOf(para, currentStart);
        if (currentChunk.length + trimmed.length > config.maxChunkSize && currentChunk.length > 0) {
            // Current chunk is full, save it
            if (currentChunk.length >= config.minChunkSize) {
                const chunkStart = text.indexOf(currentChunk.trim());
                chunks.push({
                    content: currentChunk.trim(),
                    startOffset: chunkStart >= 0 ? chunkStart : currentStart,
                    endOffset: chunkStart >= 0 ? chunkStart + currentChunk.trim().length : paraStart,
                    index: chunkIndex++,
                });
            }
            currentChunk = trimmed;
            currentStart = paraStart;
        }
        else {
            currentChunk += (currentChunk ? '\n\n' : '') + trimmed;
        }
    }
    // Don't forget the last chunk
    if (currentChunk.length >= config.minChunkSize) {
        const chunkStart = text.indexOf(currentChunk.trim(), currentStart);
        chunks.push({
            content: currentChunk.trim(),
            startOffset: chunkStart >= 0 ? chunkStart : currentStart,
            endOffset: chunkStart >= 0 ? chunkStart + currentChunk.trim().length : text.length,
            index: chunkIndex,
        });
    }
    return chunks;
}
// ============================================================================
// Sentence Chunking
// ============================================================================
/**
 * Split text by sentences
 * Groups sentences together until target chunk size
 */
function chunkBySentence(text, config) {
    // Match sentences (including ending punctuation)
    const sentenceRegex = /[^.!?]+[.!?]+\s*/g;
    const sentences = [];
    let match;
    while ((match = sentenceRegex.exec(text)) !== null) {
        sentences.push(match[0]);
    }
    // Handle text without sentence terminators
    if (sentences.length === 0) {
        sentences.push(text);
    }
    const chunks = [];
    let currentChunk = '';
    let currentStart = 0;
    let chunkIndex = 0;
    let offset = 0;
    for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (!trimmed) {
            offset += sentence.length;
            continue;
        }
        if (currentChunk.length + trimmed.length > config.chunkSize && currentChunk.length > 0) {
            // Current chunk is full
            if (currentChunk.length >= config.minChunkSize) {
                chunks.push({
                    content: currentChunk.trim(),
                    startOffset: currentStart,
                    endOffset: offset,
                    index: chunkIndex++,
                });
            }
            currentChunk = trimmed;
            currentStart = offset;
        }
        else {
            currentChunk += (currentChunk ? ' ' : '') + trimmed;
        }
        offset += sentence.length;
    }
    // Last chunk
    if (currentChunk.length >= config.minChunkSize) {
        chunks.push({
            content: currentChunk.trim(),
            startOffset: currentStart,
            endOffset: text.length,
            index: chunkIndex,
        });
    }
    return chunks;
}
// ============================================================================
// Fixed Size Chunking
// ============================================================================
/**
 * Split text into fixed-size chunks with overlap
 */
function chunkByFixed(text, config) {
    const chunks = [];
    let start = 0;
    let chunkIndex = 0;
    while (start < text.length) {
        let end = Math.min(start + config.chunkSize, text.length);
        // Try to break at word boundary
        if (end < text.length) {
            const lastSpace = text.lastIndexOf(' ', end);
            if (lastSpace > start + config.minChunkSize) {
                end = lastSpace;
            }
        }
        const chunk = text.slice(start, end).trim();
        if (chunk.length >= config.minChunkSize) {
            chunks.push({
                content: chunk,
                startOffset: start,
                endOffset: end,
                index: chunkIndex++,
            });
        }
        // Move start with overlap
        start = end - config.chunkOverlap;
        if (start >= text.length - config.minChunkSize) {
            break;
        }
    }
    return chunks;
}
// ============================================================================
// Semantic Chunking
// ============================================================================
/**
 * Split text by semantic boundaries (headers, sections)
 * Falls back to paragraph chunking for unstructured text
 */
function chunkBySemantic(text, config) {
    // Detect markdown headers
    const headerRegex = /^#{1,6}\s+.+$/gm;
    const headers = [];
    let match;
    while ((match = headerRegex.exec(text)) !== null) {
        headers.push({ match: match[0], index: match.index });
    }
    // If no headers, try detecting other section markers
    if (headers.length === 0) {
        // Try double-newline separated sections
        return chunkByParagraph(text, config);
    }
    // Split by headers
    const chunks = [];
    let chunkIndex = 0;
    for (let i = 0; i < headers.length; i++) {
        const start = headers[i].index;
        const end = i < headers.length - 1 ? headers[i + 1].index : text.length;
        const section = text.slice(start, end).trim();
        // If section is too large, sub-chunk it
        if (section.length > config.maxChunkSize) {
            const subChunks = chunkByParagraph(section, config);
            for (const subChunk of subChunks) {
                chunks.push({
                    content: subChunk.content,
                    startOffset: start + subChunk.startOffset,
                    endOffset: start + subChunk.endOffset,
                    index: chunkIndex++,
                });
            }
        }
        else if (section.length >= config.minChunkSize) {
            chunks.push({
                content: section,
                startOffset: start,
                endOffset: end,
                index: chunkIndex++,
            });
        }
    }
    // Handle text before first header
    if (headers.length > 0 && headers[0].index > config.minChunkSize) {
        const preamble = text.slice(0, headers[0].index).trim();
        if (preamble.length >= config.minChunkSize) {
            chunks.unshift({
                content: preamble,
                startOffset: 0,
                endOffset: headers[0].index,
                index: 0,
            });
            // Re-index all chunks
            for (let i = 1; i < chunks.length; i++) {
                chunks[i].index = i;
            }
        }
    }
    return chunks;
}
// ============================================================================
// Main Chunking Function
// ============================================================================
/**
 * Chunk document using specified strategy
 */
export function chunkDocument(text, config) {
    if (!text || text.trim().length === 0) {
        return [];
    }
    // Normalize whitespace
    const normalizedText = text.replace(/\r\n/g, '\n');
    switch (config.strategy) {
        case 'paragraph':
            return chunkByParagraph(normalizedText, config);
        case 'sentence':
            return chunkBySentence(normalizedText, config);
        case 'fixed':
            return chunkByFixed(normalizedText, config);
        case 'semantic':
            return chunkBySemantic(normalizedText, config);
        default:
            return chunkByParagraph(normalizedText, config);
    }
}
// ============================================================================
// Utility Functions
// ============================================================================
/**
 * Estimate token count (rough approximation: ~4 chars per token)
 */
export function estimateTokenCount(text) {
    return Math.ceil(text.length / 4);
}
/**
 * Get recommended chunk size for a given embedding model
 */
export function getRecommendedChunkSize(model) {
    // Most embedding models have max token limits
    const modelLimits = {
        'text-embedding-3-small': 8191,
        'text-embedding-3-large': 8191,
        'text-embedding-ada-002': 8191,
        'Xenova/all-MiniLM-L6-v2': 512,
        'voyage-2': 4000,
        'embed-english-v3.0': 512,
    };
    const maxTokens = modelLimits[model] || 512;
    // Use ~80% of max to leave room for special tokens
    return Math.floor(maxTokens * 0.8 * 4); // Convert tokens to chars
}
/**
 * Merge small consecutive chunks
 */
export function mergeSmallChunks(chunks, minSize) {
    const merged = [];
    let current = null;
    for (const chunk of chunks) {
        if (!current) {
            current = { ...chunk };
            continue;
        }
        if (current.content.length < minSize && current.content.length + chunk.content.length < minSize * 3) {
            // Merge chunks
            current = {
                content: current.content + '\n\n' + chunk.content,
                startOffset: current.startOffset,
                endOffset: chunk.endOffset,
                index: current.index,
            };
        }
        else {
            merged.push(current);
            current = { ...chunk, index: merged.length };
        }
    }
    if (current) {
        current.index = merged.length;
        merged.push(current);
    }
    return merged;
}
/**
 * Split oversized chunk into smaller pieces
 */
export function splitOversizedChunk(chunk, maxSize) {
    if (chunk.content.length <= maxSize) {
        return [chunk];
    }
    const pieces = [];
    let start = 0;
    let pieceIndex = 0;
    while (start < chunk.content.length) {
        let end = Math.min(start + maxSize, chunk.content.length);
        // Try to break at word boundary
        if (end < chunk.content.length) {
            const lastSpace = chunk.content.lastIndexOf(' ', end);
            if (lastSpace > start) {
                end = lastSpace;
            }
        }
        pieces.push({
            content: chunk.content.slice(start, end).trim(),
            startOffset: chunk.startOffset + start,
            endOffset: chunk.startOffset + end,
            index: pieceIndex++,
        });
        start = end;
    }
    return pieces;
}
//# sourceMappingURL=chunking.js.map