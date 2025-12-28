/**
 * Type declarations for external RAG dependencies
 */

// better-sqlite3 types
declare module 'better-sqlite3' {
  interface Statement {
    run(...params: unknown[]): Database.RunResult;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    iterate(...params: unknown[]): IterableIterator<unknown>;
    pluck(toggle?: boolean): this;
    expand(toggle?: boolean): this;
    raw(toggle?: boolean): this;
    bind(...params: unknown[]): this;
    columns(): Database.ColumnDefinition[];
    safeIntegers(toggle?: boolean): this;
  }

  interface RunResult {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  interface ColumnDefinition {
    name: string;
    column: string | null;
    table: string | null;
    database: string | null;
    type: string | null;
  }

  interface Database {
    prepare(sql: string): Statement;
    exec(sql: string): this;
    close(): void;
    pragma(str: string, options?: { simple?: boolean }): unknown;
    transaction<T extends (...args: unknown[]) => unknown>(fn: T): T;
    readonly name: string;
    readonly open: boolean;
    readonly inTransaction: boolean;
    readonly readonly: boolean;
    readonly memory: boolean;
  }

  interface DatabaseConstructor {
    new (filename: string, options?: DatabaseConstructorOptions): Database;
    (filename: string, options?: DatabaseConstructorOptions): Database;
  }

  interface DatabaseConstructorOptions {
    readonly?: boolean;
    fileMustExist?: boolean;
    timeout?: number;
    verbose?: (message?: unknown, ...additionalArgs: unknown[]) => void;
    nativeBinding?: string;
  }

  const Database: DatabaseConstructor;
  export default Database;
  export { Database, Statement, RunResult, ColumnDefinition, DatabaseConstructorOptions };
}

// @xenova/transformers types (minimal for our usage)
declare module '@xenova/transformers' {
  export class AutoTokenizer {
    static from_pretrained(modelId: string, options?: unknown): Promise<AutoTokenizer>;
    encode(text: string): { input_ids: number[] };
  }

  export class AutoModel {
    static from_pretrained(modelId: string, options?: unknown): Promise<AutoModel>;
  }

  export function pipeline(
    task: string,
    model?: string,
    options?: unknown
  ): Promise<FeatureExtractionPipeline>;

  export interface FeatureExtractionPipeline {
    (
      texts: string | string[],
      options?: { pooling?: string; normalize?: boolean }
    ): Promise<{
      tolist(): number[][];
      data: Float32Array;
      dims: number[];
    }>;
  }

  export const env: {
    allowLocalModels: boolean;
    useBrowserCache: boolean;
    cacheDir?: string;
  };
}
