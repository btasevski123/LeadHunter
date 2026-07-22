/** Browser-safe storage contract (implementation lives in the API). */
export interface StorageService {
  put(key: string, data: Buffer | Uint8Array | NodeJS.ReadableStream, contentType?: string): Promise<string>;
  get(key: string): Promise<Buffer>;
  getPublicPath(key: string): string;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  resolvePath(key: string): string;
}
