# CortexFlow Benchmark Results

![Performance](https://img.shields.io/badge/performance-56.78K%20ops%2Fsec-brightgreen)
![Token Savings](https://img.shields.io/badge/token%20savings-56%25-brightgreen)
![Compression](https://img.shields.io/badge/compression-5.2x-brightgreen)
![Memory](https://img.shields.io/badge/memory-86%20MB-green)

**Last Run:** 2025-12-28T07:42:50.890Z
**Version:** 2.0.0
**Platform:** android (Node v25.2.1)

## Summary

| Metric                | Value    |
| --------------------- | -------- |
| Total Benchmarks      | 23       |
| Total Operations      | 8.10K    |
| Avg Ops/Second        | 56.78K   |
| Avg Token Savings     | 56.2%    |
| Avg Compression Ratio | 5.24x    |
| Peak Memory           | 85.77 MB |

## Performance Results

### Storage

| Benchmark                      | Ops/sec | Avg      | P95      | P99      |
| ------------------------------ | ------- | -------- | -------- | -------- |
| Create Project                 | 509.97  | 1.96ms   | 3.66ms   | 5.97ms   |
| Read Project                   | 740.90  | 1.35ms   | 2.47ms   | 4.43ms   |
| List Projects                  | 1.58    | 631.79ms | 775.88ms | 816.55ms |
| Update Project                 | 402.29  | 2.49ms   | 5.50ms   | 6.64ms   |
| Read Large Project (200 tasks) | 361.45  | 2.77ms   | 5.96ms   | 8.03ms   |

### Intelligent

| Benchmark                | Ops/sec | Avg      | P95      | P99      |
| ------------------------ | ------- | -------- | -------- | -------- |
| Critical Path Analysis   | 2.63K   | 379.82μs | 583.92μs | 794.54μs |
| Smart Priority Queue     | 2.85K   | 350.66μs | 403.69μs | 608.23μs |
| Context Compression      | 80.09K  | 12.49μs  | 18.46μs  | 55.69μs  |
| Health Score Calculation | 9.07K   | 110.26μs | 155.61μs | 299.31μs |
| Generate Suggestions     | 2.33K   | 428.95μs | 508.08μs | 775.77μs |

### Token Efficiency

| Benchmark               | Ops/sec | Avg     | P95     | P99     |
| ----------------------- | ------- | ------- | ------- | ------- |
| Compress Small Project  | 451.00K | 2.22μs  | 2.38μs  | 3.69μs  |
| Compress Medium Project | 162.76K | 6.14μs  | 5.85μs  | 21.46μs |
| Compress Large Project  | 121.22K | 8.25μs  | 8.54μs  | 10.15μs |
| Compress XLarge Project | 54.44K  | 18.37μs | 15.62μs | 16.31μs |

### Context Handoff

| Benchmark                | Ops/sec | Avg      | P95      | P99      |
| ------------------------ | ------- | -------- | -------- | -------- |
| Export Small (minimal)   | 155.52K | 6.43μs   | 7.31μs   | 27.92μs  |
| Export Small (standard)  | 24.42K  | 40.94μs  | 47.69μs  | 135.08μs |
| Export Small (detailed)  | 16.64K  | 60.11μs  | 86.77μs  | 125.54μs |
| Export Medium (minimal)  | 117.65K | 8.50μs   | 8.23μs   | 9.62μs   |
| Export Medium (standard) | 17.20K  | 58.13μs  | 55.77μs  | 133.00μs |
| Export Medium (detailed) | 7.82K   | 127.93μs | 185.62μs | 752.62μs |
| Export Large (minimal)   | 66.61K  | 15.01μs  | 12.85μs  | 24.62μs  |
| Export Large (standard)  | 8.81K   | 113.48μs | 160.00μs | 458.54μs |
| Export Large (detailed)  | 2.73K   | 366.87μs | 504.69μs | 1.94ms   |

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

| Benchmark                 | Heap Delta  | RSS      |
| ------------------------- | ----------- | -------- |
| Load 50 Task Project      | 114.40 KB   | 85.36 MB |
| Compress 50 Task Project  | 5.59 KB     | 85.36 MB |
| Health Score 50 Tasks     | 17.88 KB    | 85.36 MB |
| Export 50 Tasks           | 142.68 KB   | 85.36 MB |
| Load 100 Task Project     | 63.29 KB    | 85.23 MB |
| Compress 100 Task Project | 9.14 KB     | 85.23 MB |
| Health Score 100 Tasks    | 33.34 KB    | 85.23 MB |
| Export 100 Tasks          | 286.26 KB   | 85.23 MB |
| Load 200 Task Project     | 448.90 KB   | 85.52 MB |
| Compress 200 Task Project | 17.78 KB    | 85.52 MB |
| Health Score 200 Tasks    | 64.43 KB    | 85.52 MB |
| Export 200 Tasks          | 574.92 KB   | 85.77 MB |
| Load 500 Task Project     | -11611080 B | 81.50 MB |
| Compress 500 Task Project | 41.87 KB    | 81.50 MB |
| Health Score 500 Tasks    | 139.65 KB   | 81.50 MB |
| Export 500 Tasks          | 1.44 MB     | 82.01 MB |
