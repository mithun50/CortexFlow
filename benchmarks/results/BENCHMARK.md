# CortexFlow Benchmark Results

![Performance](https://img.shields.io/badge/performance-95.35K%20ops%2Fsec-brightgreen)
![Token Savings](https://img.shields.io/badge/token%20savings-56%25-brightgreen)
![Compression](https://img.shields.io/badge/compression-5.2x-brightgreen)
![Memory](https://img.shields.io/badge/memory-116%20MB-yellow)

**Last Run:** 2025-12-28T08:29:58.274Z
**Version:** 2.0.0
**Platform:** linux (Node v20.19.6)

## Summary

| Metric                | Value     |
| --------------------- | --------- |
| Total Benchmarks      | 23        |
| Total Operations      | 8.10K     |
| Avg Ops/Second        | 95.35K    |
| Avg Token Savings     | 56.2%     |
| Avg Compression Ratio | 5.24x     |
| Peak Memory           | 116.41 MB |

## Performance Results

### Storage

| Benchmark                      | Ops/sec | Avg      | P95      | P99      |
| ------------------------------ | ------- | -------- | -------- | -------- |
| Create Project                 | 3.48K   | 287.56μs | 320.09μs | 366.81μs |
| Read Project                   | 4.42K   | 226.29μs | 286.25μs | 362.37μs |
| List Projects                  | 11.66   | 85.79ms  | 99.93ms  | 102.30ms |
| Update Project                 | 1.77K   | 565.93μs | 602.39μs | 1.10ms   |
| Read Large Project (200 tasks) | 1.39K   | 717.51μs | 766.90μs | 3.23ms   |

### Intelligent

| Benchmark                | Ops/sec | Avg      | P95      | P99      |
| ------------------------ | ------- | -------- | -------- | -------- |
| Critical Path Analysis   | 4.62K   | 216.65μs | 224.16μs | 239.14μs |
| Smart Priority Queue     | 4.46K   | 224.34μs | 235.85μs | 276.40μs |
| Context Compression      | 151.15K | 6.62μs   | 7.21μs   | 23.85μs  |
| Health Score Calculation | 14.68K  | 68.11μs  | 113.43μs | 156.66μs |
| Generate Suggestions     | 3.95K   | 253.31μs | 264.60μs | 301.09μs |

### Token Efficiency

| Benchmark               | Ops/sec | Avg     | P95     | P99     |
| ----------------------- | ------- | ------- | ------- | ------- |
| Compress Small Project  | 747.98K | 1.34μs  | 1.38μs  | 1.65μs  |
| Compress Medium Project | 299.01K | 3.34μs  | 3.36μs  | 5.87μs  |
| Compress Large Project  | 107.42K | 9.31μs  | 10.74μs | 30.11μs |
| Compress XLarge Project | 55.13K  | 18.14μs | 18.92μs | 33.00μs |

### Context Handoff

| Benchmark                | Ops/sec | Avg      | P95      | P99      |
| ------------------------ | ------- | -------- | -------- | -------- |
| Export Small (minimal)   | 272.43K | 3.67μs   | 4.73μs   | 18.49μs  |
| Export Small (standard)  | 62.77K  | 15.93μs  | 17.43μs  | 34.26μs  |
| Export Small (detailed)  | 23.60K  | 42.38μs  | 60.02μs  | 78.70μs  |
| Export Medium (minimal)  | 223.36K | 4.48μs   | 4.59μs   | 4.97μs   |
| Export Medium (standard) | 36.88K  | 27.11μs  | 40.22μs  | 65.33μs  |
| Export Medium (detailed) | 18.07K  | 55.35μs  | 67.82μs  | 192.22μs |
| Export Large (minimal)   | 131.46K | 7.61μs   | 7.99μs   | 9.09μs   |
| Export Large (standard)  | 20.05K  | 49.87μs  | 66.08μs  | 98.69μs  |
| Export Large (detailed)  | 5.06K   | 197.58μs | 206.70μs | 1.25ms   |

## Token Efficiency

| Benchmark                  | Original | Compressed | Savings | Ratio  |
| -------------------------- | -------- | ---------- | ------- | ------ |
| Small Project Compression  | 2.12K    | 446.00     | 78.9%   | 4.74x  |
| Medium Project Compression | 10.04K   | 1.62K      | 83.9%   | 6.21x  |
| Large Project Compression  | 20.07K   | 2.87K      | 85.7%   | 7.00x  |
| XLarge Project Compression | 40.39K   | 5.51K      | 86.4%   | 7.33x  |
| Small Export (minimal)     | 4.20K    | 383.00     | 90.9%   | 10.97x |
| Small Export (standard)    | 4.20K    | 2.30K      | 45.3%   | 1.83x  |
| Small Export (detailed)    | 4.20K    | 4.45K      | -5.9%   | 0.94x  |
| Medium Export (minimal)    | 10.48K   | 901.00     | 91.4%   | 11.63x |
| Medium Export (standard)   | 10.48K   | 5.75K      | 45.1%   | 1.82x  |
| Medium Export (detailed)   | 10.48K   | 10.91K     | -4.1%   | 0.96x  |
| Large Export (minimal)     | 20.93K   | 1.76K      | 91.6%   | 11.87x |
| Large Export (standard)    | 20.93K   | 11.40K     | 45.5%   | 1.84x  |
| Large Export (detailed)    | 20.93K   | 21.66K     | -3.5%   | 0.97x  |

## Memory Usage

| Benchmark                 | Heap Delta | RSS       |
| ------------------------- | ---------- | --------- |
| Load 50 Task Project      | 163.46 KB  | 113.91 MB |
| Compress 50 Task Project  | 5.33 KB    | 113.91 MB |
| Health Score 50 Tasks     | 17.53 KB   | 113.91 MB |
| Export 50 Tasks           | 141.72 KB  | 113.91 MB |
| Load 100 Task Project     | 303.39 KB  | 113.91 MB |
| Compress 100 Task Project | 9.03 KB    | 113.91 MB |
| Health Score 100 Tasks    | 33.22 KB   | 113.91 MB |
| Export 100 Tasks          | 295.93 KB  | 114.03 MB |
| Load 200 Task Project     | 623.50 KB  | 114.16 MB |
| Compress 200 Task Project | 18.01 KB   | 114.16 MB |
| Health Score 200 Tasks    | 64.34 KB   | 114.16 MB |
| Export 200 Tasks          | 571.85 KB  | 114.41 MB |
| Load 500 Task Project     | 1.51 MB    | 115.66 MB |
| Compress 500 Task Project | 41.87 KB   | 115.66 MB |
| Health Score 500 Tasks    | 142.16 KB  | 115.66 MB |
| Export 500 Tasks          | 1.43 MB    | 116.41 MB |
