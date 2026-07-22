import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  listProviders,
  resolveProviders,
  type CompanyProvider,
  CompanyWallProvider,
  BiznisMrezaProvider,
  YellowPagesProvider,
  GoogleBusinessProvider,
  IndustryDirectoryProvider,
  GoogleMapsProvider,
} from '../index';

describe('provider interface', () => {
  it('registers all real Macedonian providers', () => {
    const ids = listProviders().map((p) => p.id);
    for (const id of [
      'google-maps',
      'companywall',
      'central-registry',
      'yellow-pages',
      'business-directory',
      'biznismreza',
      'google-business',
      'industry-directory',
    ]) {
      assert.ok(ids.includes(id), `missing ${id}`);
    }
  });

  it('resolves real providers by default (not mocks)', () => {
    const resolved = resolveProviders();
    assert.ok(resolved.every((p) => !p.id.includes('mock')));
    assert.ok(resolved.some((p) => p.id === 'google-maps'));
  });

  it('implements CompanyProvider contract', () => {
    const providers: CompanyProvider[] = [
      new GoogleMapsProvider(),
      new CompanyWallProvider(),
      new BiznisMrezaProvider(),
      new YellowPagesProvider(),
      new GoogleBusinessProvider(),
      new IndustryDirectoryProvider(),
    ];
    for (const p of providers) {
      assert.equal(typeof p.id, 'string');
      assert.equal(typeof p.name, 'string');
      assert.ok(Array.isArray(p.industries));
      assert.equal(typeof p.scrape, 'function');
      assert.ok(typeof p.getCategories === 'function');
      assert.ok((p.getCategories?.() || []).length > 0);
    }
  });
});
