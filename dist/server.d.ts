/**
 * CortexFlow - MCP Server Implementation
 *
 * Model Context Protocol server for AI-to-AI task continuation.
 * Provides tools for reading/writing shared project context.
 *
 * Transport: stdio (Claude Desktop compatible)
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
export declare function createServer(): Promise<Server>;
export declare function runServer(): Promise<void>;
//# sourceMappingURL=server.d.ts.map