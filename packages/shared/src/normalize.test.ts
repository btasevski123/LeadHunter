import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  nameSimilarity,
  normalizeName,
  normalizeRegistrationNumber,
} from './normalize';
import { cyrillicToLatinMk, expandBilingualSearchTerms } from './mk-script';

describe('normalization', () => {
  it('strips legal suffixes so DOOEL ABC and ABC DOO match', () => {
    assert.equal(normalizeName('DOOEL ABC'), normalizeName('ABC DOO'));
    assert.equal(normalizeName('Печатница Сонце ДООЕЛ'), normalizeName('Печатница Сонце ДОО'));
  });

  it('normalizes registration numbers to digits', () => {
    assert.equal(normalizeRegistrationNumber('ЕМБС 4238923'), '4238923');
    assert.equal(normalizeRegistrationNumber('12'), null);
  });

  it('scores similar company names highly', () => {
    assert.ok(nameSimilarity('ABC Printing DOO', 'ABC Printing DOOEL') >= 0.85);
    assert.ok(nameSimilarity('ABC Printing', 'XYZ Dental') < 0.3);
  });

  it('matches Cyrillic and Latin company names', () => {
    assert.equal(normalizeName('Олимпија Фитнес Клуб'), normalizeName('Olimpija Fitnes Klub'));
    assert.ok(nameSimilarity('Прогресив Фитнес Центар', 'Progresiv Fitnes Centar') >= 0.9);
  });
});

describe('mk-script', () => {
  it('transliterates Macedonian Cyrillic', () => {
    assert.equal(cyrillicToLatinMk('теретана'), 'teretana');
    assert.equal(cyrillicToLatinMk('пзу'), 'pzu');
    assert.equal(cyrillicToLatinMk('фитнес центар'), 'fitnes centar');
  });

  it('expands search terms to both scripts', () => {
    const expanded = expandBilingualSearchTerms(['теретана', 'gym', 'фитнес']);
    assert.ok(expanded.includes('теретана'));
    assert.ok(expanded.includes('teretana'));
    assert.ok(expanded.includes('gym'));
    assert.ok(expanded.includes('фитнес'));
    assert.ok(expanded.includes('fitnes'));
  });
});
