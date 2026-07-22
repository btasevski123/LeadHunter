import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  nameSimilarity,
  normalizeName,
  normalizeRegistrationNumber,
} from './normalize';

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
});
