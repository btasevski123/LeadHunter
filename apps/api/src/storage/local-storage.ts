import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { StorageService } from '@leadhunter/shared';

function sanitizeKey(key: string): string {
  const cleaned = key.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!cleaned || cleaned.includes('..')) {
    throw new Error(`Invalid storage key: ${key}`);
  }
  return cleaned;
}

/** Walk up from start until we find the monorepo root (workspaces package.json). */
export function findMonorepoRoot(start = __dirname): string {
  let dir = path.resolve(start);
  for (let i = 0; i < 10; i++) {
    const pkgPath = path.join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
          name?: string;
          workspaces?: unknown;
        };
        if (pkg.workspaces || pkg.name === 'leadhunter-mk') {
          return dir;
        }
      } catch {
        // continue walking
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

/**
 * Resolve STORAGE_ROOT so relative paths always land at `<monorepo>/storage`,
 * regardless of whether the API was started from repo root or `apps/api`.
 */
export function resolveStorageRoot(configured = process.env.STORAGE_ROOT): string {
  const raw = (configured?.trim() || './storage').replace(/\/+$/, '') || './storage';
  if (path.isAbsolute(raw)) return raw;
  return path.resolve(findMonorepoRoot(), raw);
}

export class LocalStorageService implements StorageService {
  constructor(private readonly root: string) {
    if (!existsSync(root)) {
      mkdirSync(root, { recursive: true });
    }
  }

  getRoot(): string {
    return this.root;
  }

  resolvePath(key: string): string {
    return path.join(this.root, sanitizeKey(key));
  }

  getPublicPath(key: string): string {
    return `/storage/${sanitizeKey(key)}`;
  }

  async put(key: string, data: Buffer | Readable): Promise<string> {
    const full = this.resolvePath(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    if (Buffer.isBuffer(data)) {
      await fs.writeFile(full, data);
    } else {
      await pipeline(data, createWriteStream(full));
    }
    return sanitizeKey(key);
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.resolvePath(key));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolvePath(key));
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.resolvePath(key));
    } catch {
      // ignore missing
    }
  }

  createReadStream(key: string) {
    return createReadStream(this.resolvePath(key));
  }
}

export function createStorage(root?: string): LocalStorageService {
  return new LocalStorageService(root ? path.resolve(root) : resolveStorageRoot());
}
