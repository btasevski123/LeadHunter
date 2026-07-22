import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.API_KEY;
    if (!expected) return true;

    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; path?: string; url?: string }>();
    const path = req.path || req.url || '';
    if (path.includes('/health')) return true;

    const header = req.headers['x-api-key'] || req.headers['authorization']?.replace(/^Bearer\s+/i, '');
    if (header !== expected) {
      throw new UnauthorizedException('Invalid API key');
    }
    return true;
  }
}
