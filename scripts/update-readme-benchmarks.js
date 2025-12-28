#!/usr/bin/env node
/**
 * Updates README.md with benchmark results from CI
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const reportPath = path.join(__dirname, '../benchmarks/results/report.json');
const readmePath = path.join(__dirname, '../README.md');

if (!fs.existsSync(reportPath)) {
  console.error('Benchmark report not found:', reportPath);
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const s = report.summary;

let readme = fs.readFileSync(readmePath, 'utf8');

const tokenSavings = Math.round(s.avgTokenSavings);
const compression = s.avgCompressionRatio.toFixed(1);
const memory = Math.round(s.peakMemoryMB);
const opsPerSecond = (s.avgOpsPerSecond / 1000).toFixed(1);

// Update Token Savings badge
readme = readme.replace(
  /\[!\[Token Savings\].*?\]\(benchmarks\/results\/BENCHMARK\.md\)/,
  `[![Token Savings](https://img.shields.io/badge/token%20savings-${tokenSavings}%25-brightgreen)](benchmarks/results/BENCHMARK.md)`
);

// Update Compression badge
readme = readme.replace(
  /\[!\[Compression\].*?\]\(benchmarks\/results\/BENCHMARK\.md\)/,
  `[![Compression](https://img.shields.io/badge/compression-${compression}x-green)](benchmarks/results/BENCHMARK.md)`
);

// Update Memory badge
readme = readme.replace(
  /\[!\[Memory\].*?\]\(benchmarks\/results\/BENCHMARK\.md\)/,
  `[![Memory](https://img.shields.io/badge/memory-${memory}MB-green)](benchmarks/results/BENCHMARK.md)`
);

// Update benchmark results section
const benchSection = `<!-- BENCHMARK_RESULTS_START -->
<details>
<summary><b>Performance Metrics</b> (click to expand)</summary>

> _Last updated: ${new Date().toISOString().split('T')[0]}_

### Summary

| Metric | Value |
|--------|-------|
| Avg Token Savings | **${tokenSavings}%** |
| Avg Compression Ratio | **${compression}x** |
| Peak Memory | **${memory} MB** |
| Avg Ops/Second | **${opsPerSecond}K** |

[View Full Benchmark Report](benchmarks/results/BENCHMARK.md)

</details>
<!-- BENCHMARK_RESULTS_END -->`;

readme = readme.replace(
  /<!-- BENCHMARK_RESULTS_START -->[\s\S]*?<!-- BENCHMARK_RESULTS_END -->/,
  benchSection
);

fs.writeFileSync(readmePath, readme);
console.log('README updated with benchmark results');
console.log(`  Token Savings: ${tokenSavings}%`);
console.log(`  Compression: ${compression}x`);
console.log(`  Memory: ${memory}MB`);
console.log(`  Ops/Second: ${opsPerSecond}K`);
