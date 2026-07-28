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

  it('canonicalizes the city so sources using different scripts agree', () => {
    assert.equal(companyNormalizer.normalize({ name: 'A', city: 'Shkupi' }).city, 'Скопје');
    assert.equal(companyNormalizer.normalize({ name: 'A', city: 'Koçani' }).city, 'Кочани');
    assert.equal(companyNormalizer.normalize({ name: 'A', city: 'br:98' }).city, null);
  });

  it('merges one company reported under two spellings of the same city', () => {
    const { companies } = companyNormalizer.dedupe([
      { name: 'Печатница Европа 92', city: 'Koçani', sourceName: COMPANY_SOURCES.GOOGLE_MAPS },
      { name: 'Печатница Европа 92', city: 'Кочани', sourceName: COMPANY_SOURCES.YELLOW_PAGES },
    ]);
    assert.equal(companies.length, 1);
    assert.equal(companies[0]!.city, 'Кочани');
  });

  it('keeps two businesses that both list a Facebook page as separate companies', () => {
    const { companies, duplicatesRemoved } = companyNormalizer.dedupe([
      {
        name: 'Стоматологија Орхидеја',
        city: 'Скопје',
        website: 'https://facebook.com/orhideja',
        sourceName: COMPANY_SOURCES.YELLOW_PAGES,
      },
      {
        name: 'Печатница Гутенберг',
        city: 'Скопје',
        website: 'https://facebook.com/gutenberg',
        sourceName: COMPANY_SOURCES.YELLOW_PAGES,
      },
    ]);
    assert.equal(companies.length, 2);
    assert.equal(duplicatesRemoved, 0);
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
