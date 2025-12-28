#!/usr/bin/env node
/**
 * CortexFlow Benchmark Suite
 * Comprehensive performance testing for HTTP API, MCP tools, storage operations,
 * token efficiency, context compression, and memory usage
 */

import { performance } from 'perf_hooks';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { IncomingMessage } from 'http';

// ============================================================================
// Types
// ============================================================================

interface BenchmarkResult {
  name: string;
  category: string;
  operations: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  opsPerSecond: number;
  p50: number;
  p95: number;
  p99: number;
  metadata?: Record<string, unknown>;
}

interface EfficiencyResult {
  name: string;
  category: string;
  originalSize: number;
  compressedSize: number;
  savings: number;
  savingsPercent: number;
  metadata?: Record<string, unknown>;
}

interface MemoryResult {
  name: string;
  category: string;
  heapUsedBefore: number;
  heapUsedAfter: number;
  heapUsedDelta: number;
  externalBefore: number;
  externalAfter: number;
  rss: number;
}

interface BenchmarkReport {
  timestamp: string;
  version: string;
  platform: string;
  nodeVersion: string;
  results: BenchmarkResult[];
  efficiencyResults: EfficiencyResult[];
  memoryResults: MemoryResult[];
  summary: {
    totalBenchmarks: number;
    totalOperations: number;
    totalTime: number;
    avgOpsPerSecond: number;
    avgTokenSavings: number;
    avgCompressionRatio: number;
    peakMemoryMB: number;
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
  return num.toFixed(2);
}

function formatTime(ms: number): string {
  if (ms < 0.001) return (ms * 1000000).toFixed(2) + 'ns';
  if (ms < 1) return (ms * 1000).toFixed(2) + 'μs';
  if (ms < 1000) return ms.toFixed(2) + 'ms';
  return (ms / 1000).toFixed(2) + 's';
}

function formatBytes(bytes: number): string {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return bytes + ' B';
}

function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token for English
  return Math.ceil(text.length / 4);
}

async function runBenchmark(
  name: string,
  category: string,
  fn: () => Promise<void> | void,
  iterations: number = 1000,
  metadata?: Record<string, unknown>
): Promise<BenchmarkResult> {
  const times: number[] = [];

  // Warmup
  for (let i = 0; i < Math.min(100, iterations / 10); i++) {
    await fn();
  }

  // Actual benchmark
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    times.push(end - start);
  }

  const totalTime = times.reduce((a, b) => a + b, 0);
  const avgTime = totalTime / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const opsPerSecond = 1000 / avgTime;

  return {
    name,
    category,
    operations: iterations,
    totalTime,
    avgTime,
    minTime,
    maxTime,
    opsPerSecond,
    p50: percentile(times, 50),
    p95: percentile(times, 95),
    p99: percentile(times, 99),
    metadata,
  };
}

function measureMemory(name: string, category: string, fn: () => void): MemoryResult {
  global.gc?.(); // Run GC if available
  const memBefore = process.memoryUsage();

  fn();

  global.gc?.();
  const memAfter = process.memoryUsage();

  return {
    name,
    category,
    heapUsedBefore: memBefore.heapUsed,
    heapUsedAfter: memAfter.heapUsed,
    heapUsedDelta: memAfter.heapUsed - memBefore.heapUsed,
    externalBefore: memBefore.external,
    externalAfter: memAfter.external,
    rss: memAfter.rss,
  };
}

// ============================================================================
// HTTP Client Helper
// ============================================================================

async function httpRequest(
  method: string,
  path: string,
  body?: object,
  port: number = 3210
): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const http = require('http');
    const options = {
      hostname: 'localhost',
      port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res: IncomingMessage) => {
      let data = '';
      res.on('data', (chunk: Buffer) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode ?? 0, data: data ? JSON.parse(data) : null });
        } catch {
          resolve({ status: res.statusCode ?? 0, data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// ============================================================================
// Test Data Generators
// ============================================================================

function generateLargeProject(taskCount: number, noteCount: number) {
  return {
    id: 'large-project',
    name: 'Large Benchmark Project',
    description:
      'A comprehensive test project with many tasks and notes for benchmarking context compression and token efficiency',
    phase: 'execution' as const,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tasks: Array.from({ length: taskCount }, (_, i) => ({
      id: `task-${i}`,
      title: `Task ${i}: Implement feature ${i} with comprehensive functionality`,
      description: `This is a detailed description for task ${i}. It includes multiple sentences to simulate real-world task descriptions. The task involves implementing feature ${i} which requires careful planning and execution. Dependencies need to be managed properly.`,
      status: (['pending', 'in_progress', 'completed', 'blocked'] as const)[i % 4],
      priority: (i % 5) + 1,
      assignedTo: (['planner', 'executor', 'reviewer'] as const)[i % 3],
      notes: [
        `Implementation note 1 for task ${i}`,
        `Technical consideration for task ${i}`,
        `Progress update: Started work on task ${i}`,
      ],
      dependencies: i > 5 ? [`task-${i - 1}`, `task-${i - 2}`, `task-${i - 3}`] : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    notes: Array.from({ length: noteCount }, (_, i) => ({
      id: `note-${i}`,
      agent: (['planner', 'executor', 'reviewer'] as const)[i % 3],
      content: `This is note ${i} containing important information about the project. It includes decisions made during planning, blockers encountered, and insights discovered during implementation. The note is intentionally verbose to simulate real usage.`,
      category: (['general', 'decision', 'blocker', 'insight'] as const)[i % 4],
      timestamp: new Date().toISOString(),
    })),
    tags: ['benchmark', 'test', 'performance', 'large-scale'],
  };
}

// ============================================================================
// Storage Benchmarks
// ============================================================================

async function runStorageBenchmarks(): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  const testDir = join(tmpdir(), 'cortexflow-bench-' + Date.now());
  mkdirSync(testDir, { recursive: true });

  // Set environment variable for storage directory before importing
  process.env.CORTEXFLOW_DATA_DIR = testDir;

  // Import and create storage using the actual API
  const storageModule = await import('../dist/storage.js');
  const storage = await storageModule.createStorage();

  // Create project benchmark
  results.push(
    await runBenchmark(
      'Create Project',
      'Storage',
      async () => {
        const id = 'bench-' + Math.random().toString(36).slice(2);
        await storage.saveProject({
          id,
          name: 'Benchmark Project',
          description: 'Test project for benchmarking',
          phase: 'planning',
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tasks: [],
          notes: [],
          tags: ['benchmark'],
        });
      },
      500
    )
  );

  // Create test project for read benchmarks
  const testProjectId = 'bench-read-test';
  await storage.saveProject({
    id: testProjectId,
    name: 'Read Benchmark Project',
    description: 'Test project for read benchmarks',
    phase: 'execution',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tasks: Array.from({ length: 50 }, (_, i) => ({
      id: `task-${i}`,
      title: `Task ${i}`,
      description: `Description for task ${i}`,
      status: 'pending' as const,
      priority: (i % 5) + 1,
      assignedTo: null,
      notes: [],
      dependencies: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    notes: Array.from({ length: 10 }, (_, i) => ({
      id: `note-${i}`,
      agent: 'executor' as const,
      content: `Note content ${i}`,
      category: 'general' as const,
      timestamp: new Date().toISOString(),
    })),
    tags: ['benchmark', 'test'],
  });

  results.push(
    await runBenchmark(
      'Read Project',
      'Storage',
      async () => {
        await storage.loadProject(testProjectId);
      },
      1000
    )
  );

  results.push(
    await runBenchmark(
      'List Projects',
      'Storage',
      async () => {
        await storage.listProjects();
      },
      500
    )
  );

  results.push(
    await runBenchmark(
      'Update Project',
      'Storage',
      async () => {
        const project = await storage.loadProject(testProjectId);
        if (project) {
          project.version++;
          project.updatedAt = new Date().toISOString();
          await storage.saveProject(project);
        }
      },
      500
    )
  );

  // Large project benchmark
  const largeProject = generateLargeProject(200, 50);
  await storage.saveProject(largeProject);

  results.push(
    await runBenchmark(
      'Read Large Project (200 tasks)',
      'Storage',
      async () => {
        await storage.loadProject('large-project');
      },
      500,
      { taskCount: 200, noteCount: 50 }
    )
  );

  rmSync(testDir, { recursive: true, force: true });
  return results;
}

// ============================================================================
// Token Efficiency Benchmarks
// ============================================================================

async function runTokenEfficiencyBenchmarks(): Promise<{
  results: BenchmarkResult[];
  efficiency: EfficiencyResult[];
}> {
  const results: BenchmarkResult[] = [];
  const efficiency: EfficiencyResult[] = [];

  const { compressContext, getCompressionStats } = await import('../dist/intelligent-features.js');

  // Test different project sizes
  const sizes = [
    { tasks: 10, notes: 5, name: 'Small' },
    { tasks: 50, notes: 20, name: 'Medium' },
    { tasks: 100, notes: 40, name: 'Large' },
    { tasks: 200, notes: 80, name: 'XLarge' },
  ];

  for (const size of sizes) {
    const project = generateLargeProject(size.tasks, size.notes);
    const originalJson = JSON.stringify(project);
    const originalTokens = estimateTokens(originalJson);

    // Benchmark compression speed
    let compressed: ReturnType<typeof compressContext>;
    results.push(
      await runBenchmark(
        `Compress ${size.name} Project`,
        'Token Efficiency',
        () => {
          compressed = compressContext(project);
        },
        200,
        { tasks: size.tasks, notes: size.notes }
      )
    );

    // Measure efficiency - compressContext returns CompressedContext directly
    compressed = compressContext(project);
    const compressedJson = JSON.stringify(compressed);
    const compressedTokens = estimateTokens(compressedJson);
    const savings = originalTokens - compressedTokens;
    const savingsPercent = (savings / originalTokens) * 100;
    const stats = getCompressionStats(project, compressed);

    efficiency.push({
      name: `${size.name} Project Compression`,
      category: 'Token Efficiency',
      originalSize: originalTokens,
      compressedSize: compressedTokens,
      savings,
      savingsPercent,
      metadata: {
        tasks: size.tasks,
        notes: size.notes,
        originalBytes: originalJson.length,
        compressedBytes: compressedJson.length,
        compressionRatio: stats.compressionRatio,
      },
    });
  }

  return { results, efficiency };
}

// ============================================================================
// Context Handoff Benchmarks
// ============================================================================

async function runContextHandoffBenchmarks(): Promise<{
  results: BenchmarkResult[];
  efficiency: EfficiencyResult[];
}> {
  const results: BenchmarkResult[] = [];
  const efficiency: EfficiencyResult[] = [];

  const { generateClaudeMd } = await import('../dist/productivity-features.js');

  const sizes = [
    { tasks: 20, notes: 10, name: 'Small' },
    { tasks: 50, notes: 25, name: 'Medium' },
    { tasks: 100, notes: 50, name: 'Large' },
  ];

  for (const size of sizes) {
    const project = generateLargeProject(size.tasks, size.notes);
    const originalJson = JSON.stringify(project);

    // Benchmark export generation
    const formats: Array<'minimal' | 'standard' | 'detailed'> = ['minimal', 'standard', 'detailed'];

    for (const format of formats) {
      let exported: ReturnType<typeof generateClaudeMd>;

      results.push(
        await runBenchmark(
          `Export ${size.name} (${format})`,
          'Context Handoff',
          () => {
            exported = generateClaudeMd(project, format);
          },
          200,
          { tasks: size.tasks, format }
        )
      );

      exported = generateClaudeMd(project, format);
      const originalTokens = estimateTokens(originalJson);
      const exportedTokens = estimateTokens(exported.content);

      efficiency.push({
        name: `${size.name} Export (${format})`,
        category: 'Context Handoff',
        originalSize: originalTokens,
        compressedSize: exportedTokens,
        savings: originalTokens - exportedTokens,
        savingsPercent: ((originalTokens - exportedTokens) / originalTokens) * 100,
        metadata: { tasks: size.tasks, format },
      });
    }
  }

  return { results, efficiency };
}

// ============================================================================
// Intelligent Features Benchmarks
// ============================================================================

async function runIntelligentBenchmarks(): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  const {
    analyzeCriticalPath,
    getSmartPriorityQueue,
    compressContext,
    calculateHealthScore,
    generateTaskSuggestions,
  } = await import('../dist/intelligent-features.js');

  const testContext = generateLargeProject(100, 20);

  results.push(
    await runBenchmark(
      'Critical Path Analysis',
      'Intelligent',
      () => {
        analyzeCriticalPath(testContext);
      },
      500
    )
  );

  results.push(
    await runBenchmark(
      'Smart Priority Queue',
      'Intelligent',
      () => {
        getSmartPriorityQueue(testContext);
      },
      500
    )
  );

  results.push(
    await runBenchmark(
      'Context Compression',
      'Intelligent',
      () => {
        compressContext(testContext);
      },
      500
    )
  );

  results.push(
    await runBenchmark(
      'Health Score Calculation',
      'Intelligent',
      () => {
        calculateHealthScore(testContext);
      },
      500
    )
  );

  results.push(
    await runBenchmark(
      'Generate Suggestions',
      'Intelligent',
      () => {
        generateTaskSuggestions(testContext);
      },
      500
    )
  );

  return results;
}

// ============================================================================
// Memory Benchmarks
// ============================================================================

async function runMemoryBenchmarks(): Promise<MemoryResult[]> {
  const results: MemoryResult[] = [];

  const { compressContext, calculateHealthScore } = await import(
    '../dist/intelligent-features.js'
  );
  const { generateClaudeMd } = await import('../dist/productivity-features.js');

  // Memory usage for different project sizes
  const sizes = [50, 100, 200, 500];

  for (const taskCount of sizes) {
    const project = generateLargeProject(taskCount, Math.floor(taskCount / 4));

    results.push(
      measureMemory(`Load ${taskCount} Task Project`, 'Memory', () => {
        JSON.parse(JSON.stringify(project));
      })
    );

    results.push(
      measureMemory(`Compress ${taskCount} Task Project`, 'Memory', () => {
        compressContext(project);
      })
    );

    results.push(
      measureMemory(`Health Score ${taskCount} Tasks`, 'Memory', () => {
        calculateHealthScore(project);
      })
    );

    results.push(
      measureMemory(`Export ${taskCount} Tasks`, 'Memory', () => {
        generateClaudeMd(project, 'detailed');
      })
    );
  }

  return results;
}

// ============================================================================
// HTTP API Benchmarks
// ============================================================================

async function runHttpBenchmarks(port: number = 3210): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  results.push(
    await runBenchmark(
      'GET /health',
      'HTTP API',
      async () => {
        await httpRequest('GET', '/health', undefined, port);
      },
      1000
    )
  );

  await httpRequest(
    'POST',
    '/api/projects',
    {
      name: 'HTTP Benchmark Project',
      description: 'Test project for HTTP benchmarks',
    },
    port
  );

  results.push(
    await runBenchmark(
      'GET /api/context',
      'HTTP API',
      async () => {
        await httpRequest('GET', '/api/context', undefined, port);
      },
      1000
    )
  );

  results.push(
    await runBenchmark(
      'GET /api/projects',
      'HTTP API',
      async () => {
        await httpRequest('GET', '/api/projects', undefined, port);
      },
      500
    )
  );

  results.push(
    await runBenchmark(
      'POST /api/tasks',
      'HTTP API',
      async () => {
        await httpRequest(
          'POST',
          '/api/tasks',
          {
            title: 'Benchmark Task ' + Date.now(),
            description: 'Task created during benchmark',
          },
          port
        );
      },
      500
    )
  );

  results.push(
    await runBenchmark(
      'GET /api/smart-queue',
      'HTTP API',
      async () => {
        await httpRequest('GET', '/api/smart-queue', undefined, port);
      },
      500
    )
  );

  results.push(
    await runBenchmark(
      'GET /api/health-score',
      'HTTP API',
      async () => {
        await httpRequest('GET', '/api/health-score', undefined, port);
      },
      500
    )
  );

  results.push(
    await runBenchmark(
      'GET /api/compress',
      'HTTP API',
      async () => {
        await httpRequest('GET', '/api/compress', undefined, port);
      },
      500
    )
  );

  results.push(
    await runBenchmark(
      'GET /api/critical-path',
      'HTTP API',
      async () => {
        await httpRequest('GET', '/api/critical-path', undefined, port);
      },
      500
    )
  );

  return results;
}

// ============================================================================
// Report Generation
// ============================================================================

function generateReport(
  results: BenchmarkResult[],
  efficiencyResults: EfficiencyResult[],
  memoryResults: MemoryResult[]
): BenchmarkReport {
  const totalOperations = results.reduce((sum, r) => sum + r.operations, 0);
  const totalTime = results.reduce((sum, r) => sum + r.totalTime, 0);
  const avgOpsPerSecond = results.reduce((sum, r) => sum + r.opsPerSecond, 0) / results.length;

  const avgTokenSavings =
    efficiencyResults.length > 0
      ? efficiencyResults.reduce((sum, r) => sum + r.savingsPercent, 0) / efficiencyResults.length
      : 0;

  const avgCompressionRatio =
    efficiencyResults.length > 0
      ? efficiencyResults.reduce((sum, r) => sum + r.originalSize / r.compressedSize, 0) /
        efficiencyResults.length
      : 1;

  const peakMemoryMB = memoryResults.length > 0 ? Math.max(...memoryResults.map((r) => r.rss)) / 1048576 : 0;

  return {
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '2.0.0',
    platform: process.platform,
    nodeVersion: process.version,
    results,
    efficiencyResults,
    memoryResults,
    summary: {
      totalBenchmarks: results.length,
      totalOperations,
      totalTime,
      avgOpsPerSecond,
      avgTokenSavings,
      avgCompressionRatio,
      peakMemoryMB,
    },
  };
}

function printReport(report: BenchmarkReport): void {
  console.log('\n' + '='.repeat(90));
  console.log('                         CORTEXFLOW BENCHMARK REPORT');
  console.log('='.repeat(90));
  console.log(`Timestamp:    ${report.timestamp}`);
  console.log(`Version:      ${report.version}`);
  console.log(`Platform:     ${report.platform}`);
  console.log(`Node.js:      ${report.nodeVersion}`);
  console.log('='.repeat(90) + '\n');

  // Performance Results
  const categories = [...new Set(report.results.map((r) => r.category))];

  for (const category of categories) {
    console.log(`\n## ${category} Performance`);
    console.log('-'.repeat(90));
    console.log(
      '| Benchmark'.padEnd(35) +
        '| Ops/sec'.padEnd(12) +
        '| Avg'.padEnd(12) +
        '| P50'.padEnd(12) +
        '| P95'.padEnd(12) +
        '| P99'.padEnd(12) +
        '|'
    );
    console.log('|' + '-'.repeat(34) + '|' + ('-'.repeat(11) + '|').repeat(5));

    const categoryResults = report.results.filter((r) => r.category === category);
    for (const result of categoryResults) {
      console.log(
        `| ${result.name.padEnd(33)}` +
          `| ${formatNumber(result.opsPerSecond).padEnd(10)}` +
          `| ${formatTime(result.avgTime).padEnd(10)}` +
          `| ${formatTime(result.p50).padEnd(10)}` +
          `| ${formatTime(result.p95).padEnd(10)}` +
          `| ${formatTime(result.p99).padEnd(10)}` +
          '|'
      );
    }
  }

  // Token Efficiency Results
  if (report.efficiencyResults.length > 0) {
    console.log('\n\n## Token Efficiency & Compression');
    console.log('-'.repeat(90));
    console.log(
      '| Benchmark'.padEnd(35) +
        '| Original'.padEnd(12) +
        '| Compressed'.padEnd(12) +
        '| Savings'.padEnd(12) +
        '| Ratio'.padEnd(10) +
        '|'
    );
    console.log('|' + '-'.repeat(34) + '|' + ('-'.repeat(11) + '|').repeat(4));

    for (const result of report.efficiencyResults) {
      const ratio = (result.originalSize / result.compressedSize).toFixed(2) + 'x';
      console.log(
        `| ${result.name.padEnd(33)}` +
          `| ${formatNumber(result.originalSize).padEnd(10)}` +
          `| ${formatNumber(result.compressedSize).padEnd(10)}` +
          `| ${result.savingsPercent.toFixed(1).padStart(5)}%`.padEnd(12) +
          `| ${ratio.padEnd(8)}` +
          '|'
      );
    }
  }

  // Memory Results
  if (report.memoryResults.length > 0) {
    console.log('\n\n## Memory Usage');
    console.log('-'.repeat(90));
    console.log(
      '| Benchmark'.padEnd(40) + '| Heap Delta'.padEnd(15) + '| RSS'.padEnd(15) + '|'
    );
    console.log('|' + '-'.repeat(39) + '|' + ('-'.repeat(14) + '|').repeat(2));

    for (const result of report.memoryResults) {
      console.log(
        `| ${result.name.padEnd(38)}` +
          `| ${formatBytes(result.heapUsedDelta).padEnd(13)}` +
          `| ${formatBytes(result.rss).padEnd(13)}` +
          '|'
      );
    }
  }

  // Summary
  console.log('\n' + '='.repeat(90));
  console.log('                              SUMMARY');
  console.log('='.repeat(90));
  console.log(`Total Benchmarks:       ${report.summary.totalBenchmarks}`);
  console.log(`Total Operations:       ${formatNumber(report.summary.totalOperations)}`);
  console.log(`Total Time:             ${formatTime(report.summary.totalTime)}`);
  console.log(`Avg Ops/Second:         ${formatNumber(report.summary.avgOpsPerSecond)}`);
  console.log(`Avg Token Savings:      ${report.summary.avgTokenSavings.toFixed(1)}%`);
  console.log(`Avg Compression Ratio:  ${report.summary.avgCompressionRatio.toFixed(2)}x`);
  console.log(`Peak Memory:            ${report.summary.peakMemoryMB.toFixed(2)} MB`);
  console.log('='.repeat(90) + '\n');
}

function generateBadgeJson(report: BenchmarkReport): void {
  const outputDir = join(process.cwd(), 'benchmarks', 'results');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Performance badge
  const avgOps = report.summary.avgOpsPerSecond;
  let perfColor = 'red';
  if (avgOps > 10000) perfColor = 'brightgreen';
  else if (avgOps > 5000) perfColor = 'green';
  else if (avgOps > 1000) perfColor = 'yellow';
  else if (avgOps > 500) perfColor = 'orange';

  writeFileSync(
    join(outputDir, 'performance-badge.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        label: 'performance',
        message: `${formatNumber(avgOps)} ops/sec`,
        color: perfColor,
      },
      null,
      2
    )
  );

  // Token savings badge
  const savings = report.summary.avgTokenSavings;
  let savingsColor = 'red';
  if (savings > 50) savingsColor = 'brightgreen';
  else if (savings > 40) savingsColor = 'green';
  else if (savings > 30) savingsColor = 'yellow';
  else if (savings > 20) savingsColor = 'orange';

  writeFileSync(
    join(outputDir, 'token-savings-badge.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        label: 'token savings',
        message: `${savings.toFixed(0)}%`,
        color: savingsColor,
      },
      null,
      2
    )
  );

  // Compression ratio badge
  const ratio = report.summary.avgCompressionRatio;
  let ratioColor = 'yellow';
  if (ratio > 3) ratioColor = 'brightgreen';
  else if (ratio > 2) ratioColor = 'green';

  writeFileSync(
    join(outputDir, 'compression-badge.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        label: 'compression',
        message: `${ratio.toFixed(1)}x`,
        color: ratioColor,
      },
      null,
      2
    )
  );

  // Memory badge
  const memMB = report.summary.peakMemoryMB;
  let memColor = 'brightgreen';
  if (memMB > 500) memColor = 'red';
  else if (memMB > 200) memColor = 'orange';
  else if (memMB > 100) memColor = 'yellow';
  else if (memMB > 50) memColor = 'green';

  writeFileSync(
    join(outputDir, 'memory-badge.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        label: 'memory',
        message: `${memMB.toFixed(0)} MB`,
        color: memColor,
      },
      null,
      2
    )
  );

  // Full report
  writeFileSync(join(outputDir, 'report.json'), JSON.stringify(report, null, 2));

  // Markdown summary
  const categories = [...new Set(report.results.map((r) => r.category))];
  const markdown = `# CortexFlow Benchmark Results

![Performance](https://img.shields.io/badge/performance-${encodeURIComponent(formatNumber(avgOps))}%20ops%2Fsec-${perfColor})
![Token Savings](https://img.shields.io/badge/token%20savings-${savings.toFixed(0)}%25-${savingsColor})
![Compression](https://img.shields.io/badge/compression-${ratio.toFixed(1)}x-${ratioColor})
![Memory](https://img.shields.io/badge/memory-${memMB.toFixed(0)}%20MB-${memColor})

**Last Run:** ${report.timestamp}
**Version:** ${report.version}
**Platform:** ${report.platform} (Node ${report.nodeVersion})

## Summary

| Metric | Value |
|--------|-------|
| Total Benchmarks | ${report.summary.totalBenchmarks} |
| Total Operations | ${formatNumber(report.summary.totalOperations)} |
| Avg Ops/Second | ${formatNumber(report.summary.avgOpsPerSecond)} |
| Avg Token Savings | ${report.summary.avgTokenSavings.toFixed(1)}% |
| Avg Compression Ratio | ${report.summary.avgCompressionRatio.toFixed(2)}x |
| Peak Memory | ${report.summary.peakMemoryMB.toFixed(2)} MB |

## Performance Results

${categories
  .map(
    (cat) => `### ${cat}

| Benchmark | Ops/sec | Avg | P95 | P99 |
|-----------|---------|-----|-----|-----|
${report.results
  .filter((r) => r.category === cat)
  .map(
    (r) =>
      `| ${r.name} | ${formatNumber(r.opsPerSecond)} | ${formatTime(r.avgTime)} | ${formatTime(r.p95)} | ${formatTime(r.p99)} |`
  )
  .join('\n')}`
  )
  .join('\n\n')}

## Token Efficiency

| Benchmark | Original | Compressed | Savings | Ratio |
|-----------|----------|------------|---------|-------|
${report.efficiencyResults
  .map(
    (r) =>
      `| ${r.name} | ${formatNumber(r.originalSize)} | ${formatNumber(r.compressedSize)} | ${r.savingsPercent.toFixed(1)}% | ${(r.originalSize / r.compressedSize).toFixed(2)}x |`
  )
  .join('\n')}

## Memory Usage

| Benchmark | Heap Delta | RSS |
|-----------|------------|-----|
${report.memoryResults.map((r) => `| ${r.name} | ${formatBytes(r.heapUsedDelta)} | ${formatBytes(r.rss)} |`).join('\n')}
`;

  writeFileSync(join(outputDir, 'BENCHMARK.md'), markdown);
  console.log(`\nResults saved to: ${outputDir}/`);
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  console.log('🚀 Starting CortexFlow Comprehensive Benchmark Suite...\n');

  const allResults: BenchmarkResult[] = [];
  const allEfficiency: EfficiencyResult[] = [];
  const allMemory: MemoryResult[] = [];

  const args = process.argv.slice(2);
  const runAll = args.includes('--all') || args.length === 0;
  const runHttp = args.includes('--http') || runAll;
  const runStorage = args.includes('--storage') || runAll;
  const runIntelligent = args.includes('--intelligent') || runAll;
  const runTokens = args.includes('--tokens') || runAll;
  const runHandoff = args.includes('--handoff') || runAll;
  const runMemory = args.includes('--memory') || runAll;

  // Storage benchmarks
  if (runStorage) {
    console.log('📦 Running Storage Benchmarks...');
    const storageResults = await runStorageBenchmarks();
    allResults.push(...storageResults);
    console.log(`   ✓ Completed ${storageResults.length} storage benchmarks`);
  }

  // Intelligent features benchmarks
  if (runIntelligent) {
    console.log('🧠 Running Intelligent Features Benchmarks...');
    const intelligentResults = await runIntelligentBenchmarks();
    allResults.push(...intelligentResults);
    console.log(`   ✓ Completed ${intelligentResults.length} intelligent feature benchmarks`);
  }

  // Token efficiency benchmarks
  if (runTokens) {
    console.log('🎯 Running Token Efficiency Benchmarks...');
    const { results, efficiency } = await runTokenEfficiencyBenchmarks();
    allResults.push(...results);
    allEfficiency.push(...efficiency);
    console.log(`   ✓ Completed ${results.length} token efficiency benchmarks`);
  }

  // Context handoff benchmarks
  if (runHandoff) {
    console.log('🔄 Running Context Handoff Benchmarks...');
    const { results, efficiency } = await runContextHandoffBenchmarks();
    allResults.push(...results);
    allEfficiency.push(...efficiency);
    console.log(`   ✓ Completed ${results.length} context handoff benchmarks`);
  }

  // Memory benchmarks
  if (runMemory) {
    console.log('💾 Running Memory Benchmarks...');
    const memoryResults = await runMemoryBenchmarks();
    allMemory.push(...memoryResults);
    console.log(`   ✓ Completed ${memoryResults.length} memory benchmarks`);
  }

  // HTTP benchmarks
  if (runHttp) {
    console.log('🌐 Running HTTP API Benchmarks...');
    console.log('   (Make sure HTTP server is running: cortexflow --http)');
    try {
      const httpResults = await runHttpBenchmarks();
      allResults.push(...httpResults);
      console.log(`   ✓ Completed ${httpResults.length} HTTP benchmarks`);
    } catch {
      console.log('   ⚠ HTTP server not available, skipping HTTP benchmarks');
    }
  }

  // Generate and print report
  const report = generateReport(allResults, allEfficiency, allMemory);
  printReport(report);
  generateBadgeJson(report);

  console.log('✅ Benchmark suite completed!\n');
}

main().catch(console.error);
