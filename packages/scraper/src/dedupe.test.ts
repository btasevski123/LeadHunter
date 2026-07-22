import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { COMPANY_SOURCES } from '@leadhunter/shared';
import { companyDedupeKey, dedupeRawCompanies, normalizeRawCompany } from './dedupe';

describe('duplicate detection', () => {
  it('prefers registration number for dedupe key', () => {
    const key = companyDedupeKey({
      name: 'A',
      registrationNumber: '4238923',
      website: 'https://example.mk',
      phone: '02/123456',
    });
    assert.equal(key, 'reg:4238923');
  });

  it('merges CompanyWall and Yellow Pages variants', () => {
    const { companies, duplicatesRemoved } = dedupeRawCompanies([
      {
        name: 'DOOEL ABC',
        city: 'Скопје',
        phone: '02/311-1111',
        sourceName: COMPANY_SOURCES.COMPANY_WALL,
      },
      {
        name: 'ABC DOO',
        city: 'Скопје',
        email: 'info@abc.mk',
        website: 'https://abc.mk',
        sourceName: COMPANY_SOURCES.YELLOW_PAGES,
      },
    ]);
    assert.equal(companies.length, 1);
    assert.ok(duplicatesRemoved >= 1);
    assert.equal(companies[0]!.email, 'info@abc.mk');
    assert.equal(companies[0]!.website, 'https://abc.mk');
  });

  it('normalizes website urls', () => {
    const n = normalizeRawCompany({ name: 'Test', website: 'www.test.mk' });
    assert.equal(n.website, 'https://www.test.mk');
  });
});
