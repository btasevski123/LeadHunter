import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { randomDelayMs, rotateUserAgent, sleep } from '@leadhunter/shared';
import type { Logger } from './types';

export interface HttpClientOptions {
  timeoutMs: number;
  maxRetries: number;
  userAgent: string;
  logger: Logger;
}

export class HttpClient {
  private readonly client: AxiosInstance;

  constructor(private readonly options: HttpClientOptions) {
    this.client = axios.create({
      timeout: options.timeoutMs,
      headers: {
        'User-Agent': options.userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'mk-MK,mk;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      validateStatus: (s) => s >= 200 && s < 400,
      maxRedirects: 5,
    });
  }

  async get<T = string>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>('get', url, undefined, config);
  }

  async post<T = string>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    return this.request<T>('post', url, data, config);
  }

  private async request<T>(
    method: 'get' | 'post',
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        const headers = {
          'User-Agent': rotateUserAgent(this.options.userAgent),
          ...(config?.headers || {}),
        };
        const res =
          method === 'get'
            ? await this.client.get<T>(url, { ...config, headers })
            : await this.client.post<T>(url, data, { ...config, headers });
        return res.data;
      } catch (err) {
        lastError = err;
        const delay = Math.min(2000 * 2 ** attempt, 15000) + randomDelayMs(250, 0.5);
        this.options.logger.warn(`HTTP ${method.toUpperCase()} failed, retrying`, {
          url,
          attempt,
          delay,
          error: err instanceof Error ? err.message : String(err),
        });
        await sleep(delay);
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
}
