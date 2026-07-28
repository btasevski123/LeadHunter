import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addressSimilarity,
  distinctiveNameTokens,
  IDENTITY_THRESHOLDS,
  isDedupableWebsiteDomain,
  matchCompanyIdentity,
  normalizeAddress,
  significantTokenOverlap,
} from './company-identity';
import { canonicalizeCity } from './cities';

describe('generic website domains', () => {
  it('rejects domains shared by many businesses', () => {
    assert.equal(isDedupableWebsiteDomain('facebook.com'), false);
    assert.equal(isDedupableWebsiteDomain('www.facebook.com'), false);
    assert.equal(isDedupableWebsiteDomain('instagram.com'), false);
    assert.equal(isDedupableWebsiteDomain('linktr.ee'), false);
  });

  it('accepts real company domains', () => {
    assert.equal(isDedupableWebsiteDomain('abc.mk'), true);
    assert.equal(isDedupableWebsiteDomain('pecatnica-sonce.com.mk'), true);
  });

  it('rejects empty input', () => {
    assert.equal(isDedupableWebsiteDomain(null), false);
    assert.equal(isDedupableWebsiteDomain(undefined), false);
    assert.equal(isDedupableWebsiteDomain(''), false);
  });
});

describe('hard identifiers', () => {
  it('matches on registration number regardless of name', () => {
    const match = matchCompanyIdentity(
      { name: 'Печатница Сонце', registrationNumber: '4238923' },
      { name: 'Totally Different Name', registrationNumber: '4238923' },
    );
    assert.equal(match.matched, true);
    assert.equal(match.reason, 'registrationNumber');
  });

  it('matches on Google place id regardless of name', () => {
    const match = matchCompanyIdentity(
      { name: 'Sonce', googlePlaceId: 'places/xyz' },
      { name: 'Unrelated Business', googlePlaceId: 'places/xyz' },
    );
    assert.equal(match.matched, true);
    assert.equal(match.reason, 'googlePlaceId');
  });
});

describe('shared website domain', () => {
  it('does NOT merge two businesses that both list a Facebook page', () => {
    const match = matchCompanyIdentity(
      { name: 'Стоматологија Орхидеја', website: 'https://facebook.com/orhideja', city: 'Скопје' },
      { name: 'Печатница Гутенберг', website: 'https://facebook.com/gutenberg', city: 'Скопје' },
    );
    assert.equal(match.matched, false);
  });

  it('does NOT merge unrelated businesses sharing a web agency domain', () => {
    const match = matchCompanyIdentity(
      { name: 'Дентал Сјај', website: 'https://agency.mk', city: 'Скопје' },
      { name: 'Метал Инжинеринг', website: 'https://agency.mk', city: 'Скопје' },
    );
    assert.equal(match.matched, false);
  });

  it('does merge the same business when the domain and name both agree', () => {
    const match = matchCompanyIdentity(
      { name: 'ABC DOOEL', website: 'https://abc.mk' },
      { name: 'ABC DOO', website: 'https://www.abc.mk' },
    );
    assert.equal(match.matched, true);
    assert.equal(match.reason, 'websiteDomain');
  });
});

describe('shared phone and email', () => {
  it('does NOT merge unrelated businesses behind one switchboard', () => {
    const match = matchCompanyIdentity(
      { name: 'Адвокат Петровски', phone: '02/311-1111', city: 'Скопје' },
      { name: 'Ресторан Вардар', phone: '02/311-1111', city: 'Скопје' },
    );
    assert.equal(match.matched, false);
  });

  it('does merge the same business reported with one phone by two sources', () => {
    const match = matchCompanyIdentity(
      { name: 'Печатница Сонце DOOEL', phone: '02/311-1111' },
      { name: 'Печатница Сонце', phone: '+389 2 311 1111' },
    );
    assert.equal(match.matched, true);
  });

  it('does NOT merge unrelated businesses sharing a shared mailbox', () => {
    const match = matchCompanyIdentity(
      { name: 'Кафе Мока', email: 'info@centar.mk', city: 'Битола' },
      { name: 'Автосервис Турбо', email: 'info@centar.mk', city: 'Битола' },
    );
    assert.equal(match.matched, false);
  });
});

describe('city scoping', () => {
  it('does NOT merge same-named companies in different cities', () => {
    const match = matchCompanyIdentity(
      { name: 'Печатница Сонце', city: 'Скопје' },
      { name: 'Печатница Сонце', city: 'Битола' },
    );
    assert.equal(match.matched, false);
  });

  it('merges same-named companies when one city is unknown', () => {
    const match = matchCompanyIdentity(
      { name: 'Печатница Сонце', city: 'Скопје' },
      { name: 'Печатница Сонце', city: null },
    );
    assert.equal(match.matched, true);
  });

  it('treats different spellings of one city as the same place', () => {
    // Sources disagree on script and language; a raw string compare used to read
    // these as different cities and blocked the merge outright.
    for (const alias of ['Skopje', 'Shkupi', 'SKOPJE']) {
      const match = matchCompanyIdentity(
        { name: 'Печатница Сонце', city: 'Скопје' },
        { name: 'Печатница Сонце', city: alias },
      );
      assert.equal(match.matched, true, `expected Скопје to match ${alias}`);
    }
  });

  it('ignores junk city values rather than letting them block a merge', () => {
    const match = matchCompanyIdentity(
      { name: 'Принт Студио Х', city: 'd' },
      { name: 'Принт Студио Х', city: 'Скопје' },
    );
    assert.equal(match.matched, true);
  });
});

describe('canonicalizeCity', () => {
  it('folds aliases to the canonical Cyrillic name', () => {
    assert.equal(canonicalizeCity('Shkupi'), 'Скопје');
    assert.equal(canonicalizeCity('Kumanovë'), 'Куманово');
    assert.equal(canonicalizeCity('Resen'), 'Ресен');
  });

  it('rejects values that cannot be a city name', () => {
    assert.equal(canonicalizeCity('d'), null);
    assert.equal(canonicalizeCity('1000'), null);
    assert.equal(canonicalizeCity('  '), null);
    assert.equal(canonicalizeCity(null), null);
  });

  it('keeps smaller towns that are absent from the alias table', () => {
    assert.equal(canonicalizeCity('Македонски Брод'), 'Македонски Брод');
  });
});

describe('name and address heuristics', () => {
  it('merges a legal name with a Google short name via a shared token', () => {
    const match = matchCompanyIdentity(
      { name: 'ABC DOOEL', city: 'Скопје' },
      { name: 'ABC Printing', city: 'Скопје' },
    );
    assert.equal(match.matched, true);
    assert.equal(match.reason, 'name');
  });

  it('merges records agreeing on street and number', () => {
    const match = matchCompanyIdentity(
      { name: 'Печатница Сонце', address: 'Partizanski Odredi 15, Skopje', city: 'Skopje' },
      { name: 'Сонце Print', address: 'Partizanski Odredi br 15 Skopje', city: 'Skopje' },
    );
    assert.equal(match.matched, true);
  });

  it('keeps genuinely different companies apart', () => {
    const match = matchCompanyIdentity(
      { name: 'Печатница Сонце', city: 'Скопје', address: 'Partizanski Odredi 15' },
      { name: 'Стоматологија Орхидеја', city: 'Скопје', address: 'Ilinden 42' },
    );
    assert.equal(match.matched, false);
  });
});

describe('significantTokenOverlap', () => {
  it('ignores legal forms and city names as distinctive tokens', () => {
    assert.equal(significantTokenOverlap('Alpha DOO Skopje', 'Beta DOOEL Skopje'), false);
  });

  it('finds a genuinely shared token', () => {
    assert.equal(significantTokenOverlap('Sonce Print DOO', 'Pecatnica Sonce'), true);
  });

  it('treats an appended city name as non-distinctive', () => {
    // Google Maps often appends the city, which made every company in a town
    // look related to every other.
    assert.equal(significantTokenOverlap('Ingplast Dooel Ohrid', 'Frigo Plastika Ohrid'), false);
    assert.equal(significantTokenOverlap('Малешево Милк Берово', 'Bakery & Coffee 9 Berovo'), false);
  });

  it('treats generic industry descriptors as non-distinctive', () => {
    assert.equal(significantTokenOverlap('АВТО МОТО СЕРВИС XXX', 'АВТО ЦЕНТАР ХЕПИ'), false);
    assert.equal(significantTokenOverlap('Dr. Xhoni Dental Clinic', 'Family Dental'), false);
    assert.equal(significantTokenOverlap('Евро Мебел', 'Дома Мебел'), false);
    assert.equal(
      significantTokenOverlap('Министерство за култура', 'Министерство за надворешни работи'),
      false,
    );
  });

  it('still keeps a real brand token distinctive', () => {
    assert.ok(distinctiveNameTokens('Imprimo | Print Studio').has('imprimo'));
    assert.equal(distinctiveNameTokens('Print Studio Design').size, 0);
  });
});

describe('address normalization', () => {
  it('drops the postal code, which every address in a city shares', () => {
    const normalized = normalizeAddress('Булевар Партизански Одреди 117, Скопје 1000');
    assert.ok(normalized);
    assert.ok(!normalized!.includes('1000'));
    assert.ok(normalized!.includes('117'));
  });

  it('drops the city and country boilerplate', () => {
    const normalized = normalizeAddress('Улица 20, Сарај, Скопје 1060, Северна Македонија');
    assert.ok(normalized);
    assert.ok(!normalized!.includes('skopje'));
    assert.ok(!normalized!.includes('makedonija'));
  });

  it('compares Cyrillic and Latin addresses as equal', () => {
    assert.equal(
      normalizeAddress('Партизански Одреди 117'),
      normalizeAddress('Partizanski Odredi 117'),
    );
  });
});

describe('addressSimilarity', () => {
  it('scores identical street and number as a full match', () => {
    assert.equal(
      addressSimilarity('Partizanski Odredi 15, Skopje', 'Partizanski Odredi br 15 Skopje'),
      1,
    );
  });

  it('treats conflicting house numbers as different buildings', () => {
    // "Zhivko Chingo 43" and "Zhivko Chingo 4" are neighbours, not one company.
    const score = addressSimilarity('Живко Чинго 43, Охрид 6000', 'Живко Чинго 4, Охрид 6000');
    assert.ok(
      score < IDENTITY_THRESHOLDS.addressWithTokenOverlap,
      `expected below match threshold, got ${score}`,
    );
  });

  it('does not treat a shared street with no number as identity', () => {
    const score = addressSimilarity('Борис Трајковски бб', 'Борис Трајковски бб');
    assert.ok(score < IDENTITY_THRESHOLDS.addressWithTokenOverlap, `got ${score}`);
  });

  it('ignores Google plus codes', () => {
    const score = addressSimilarity('FJ3W+R6V Strumica', 'FJ3W+R6V Sever, Strumica 2400');
    assert.equal(score, 0);
  });

  it('does not merge two businesses that only share a city and postcode', () => {
    const match = matchCompanyIdentity(
      { name: 'Градско собрание на Општина Струмица', address: 'Братство Единство 61/3, Струмица 2400', city: 'Струмица' },
      { name: 'KFC Strumica DT', address: 'Братство Единство 63а, Струмица 2400', city: 'Струмица' },
    );
    assert.equal(match.matched, false);
  });
});

describe('threshold configuration', () => {
  it('gates email more loosely than phone and domain', () => {
    assert.ok(IDENTITY_THRESHOLDS.emailNameGate < IDENTITY_THRESHOLDS.phoneNameGate);
    assert.equal(IDENTITY_THRESHOLDS.domainNameGate, IDENTITY_THRESHOLDS.phoneNameGate);
  });
});
