import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { COMPANY_SOURCES } from '@leadhunter/shared';
import { companyNormalizer } from './normalizer';
import { computeSourceQualityScore } from './quality-score';

describe('company normalizer', () => {
  it('merges CompanyWall legal name with Google short name', () => {
    const { companies, duplicatesRemoved } = companyNormalizer.dedupe([
      {
        name: 'ABC DOOEL',
        city: 'Скопје',
        phone: '02/311-1111',
        sourceName: COMPANY_SOURCES.COMPANY_WALL,
      },
      {
        name: 'ABC Printing',
        city: 'Скопје',
        website: 'https://abc.mk',
        googlePlaceId: 'places/abc',
        sourceName: COMPANY_SOURCES.GOOGLE_MAPS,
      },
    ]);
    assert.equal(companies.length, 1);
    assert.ok(duplicatesRemoved >= 1);
    assert.match(companies[0]!.name, /ABC DOOEL/i);
    assert.equal(companies[0]!.website, 'https://abc.mk');
    assert.equal(companies[0]!.googlePlaceId, 'places/abc');
  });

  it('matches by address similarity', () => {
    const match = companyNormalizer.match(
      { name: 'Печатница Сонце', address: 'Partizanski Odredi 15, Skopje', city: 'Skopje' },
      { name: 'Сонце Print', address: 'Partizanski Odredi br 15 Skopje', city: 'Skopje' },
    );
    assert.ok(match.matched || match.score > 0.4);
  });
});

describe('source quality score', () => {
  it('scores multi-source companies higher', () => {
    const score = computeSourceQualityScore({
      sourceReferences: [COMPANY_SOURCES.CENTRAL_REGISTRY, COMPANY_SOURCES.GOOGLE_MAPS],
      hasWebsite: true,
      email: 'info@abc.mk',
      phone: '070123456',
    });
    assert.ok(score >= 70);
  });
});
