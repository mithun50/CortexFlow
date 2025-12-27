#!/usr/bin/env node
/**
 * CortexFlow - MCP Server Entry Point
 *
 * Universal MCP server for AI-to-AI task continuation.
 * Supports all MCP-compatible clients:
 * - Claude Desktop, Claude Code
 * - Cursor, VS Code + Continue
 * - Gemini CLI, Qwen CLI
 * - Any MCP-compatible agent
 *
 * Also provides HTTP API for non-MCP clients:
 * - ChatGPT (Actions/Plugins)
 * - Web-based AIs
 *
 * Usage:
 *   cortexflow           # MCP stdio server (default)
 *   cortexflow --http    # HTTP API server
 *   cortexflow --both    # Both servers
 */
import { runServer } from "./server.js";
import { runHttpServer } from "./http-server.js";
const args = process.argv.slice(2);
const mode = args[0];
async function main() {
    switch (mode) {
        case "--http":
        case "http":
            console.error("Starting CortexFlow HTTP API server...");
            runHttpServer();
            break;
        case "--both":
        case "both":
            console.error("Starting CortexFlow (MCP + HTTP)...");
            runHttpServer();
            await runServer();
            break;
        case "--help":
        case "-h":
            console.log(`
CortexFlow - MCP Server for AI-to-AI Task Continuation

Usage:
  cortexflow           Start MCP stdio server (for Claude Code, Cursor, etc.)
  cortexflow --http    Start HTTP API server (for ChatGPT, web clients)
  cortexflow --both    Start both MCP and HTTP servers

Environment:
  CORTEXFLOW_PORT      HTTP server port (default: 3210)
  CORTEXFLOW_DATA_DIR  Data directory (default: ~/.cortexflow/data)

MCP Tools:
  read_context         Read project state, tasks, notes
  write_context        Create new project with tasks
  add_task             Add task to project
  update_task          Update task status/notes
  mark_task_complete   Complete a task
  add_note             Add agent note
  set_phase            Update project phase
  list_projects        List all projects
  set_active_project   Switch active project
  delete_project       Delete a project
`);
            break;
        default:
            // Default: MCP stdio server
            await runServer();
    }
}
main().catch((err) => {
    console.error("Failed to start CortexFlow:", err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map