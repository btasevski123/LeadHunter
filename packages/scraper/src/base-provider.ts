import type { RawCompany } from '@leadhunter/shared';
import { HttpClient } from './http';
import { Throttle } from './throttle';
import type { LeadProvider, ScrapeContext } from './types';

export abstract class BaseLeadProvider implements LeadProvider {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly industries: string[];

  protected http(ctx: ScrapeContext): HttpClient {
    return new HttpClient({
      timeoutMs: ctx.config.timeoutMs,
      maxRetries: ctx.config.maxRetries,
      userAgent: ctx.config.userAgent,
      logger: ctx.logger,
    });
  }

  protected throttle(ctx: ScrapeContext): Throttle {
    return new Throttle(ctx.config.requestDelayMs);
  }

  abstract scrape(ctx: ScrapeContext): Promise<RawCompany[]>;
}
