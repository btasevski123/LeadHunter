import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  classifyCompany,
  computeDesignScore,
  computeSeoScore,
} from './index';

test('RULE 1: no website → NO_WEBSITE', () => {
  const result = classifyCompany({ website: null, industry: 'DENTAL' });
  assert.equal(result.classification, 'NO_WEBSITE');
  assert.equal(result.confidence, 100);
  assert.equal(result.recommendedService, 'Business Website');
  assert.deepEqual(result.reasons, ['Company does not have a website']);
});

test('RULE 2: low design score → WEBSITE_REDESIGN', () => {
  const result = classifyCompany({
    website: 'https://example.mk',
    audit: { designScore: 40, seoScore: 80, hasBooking: false, hasEcommerce: false },
  });
  assert.equal(result.classification, 'WEBSITE_REDESIGN');
  assert.equal(result.confidence, 90);
  assert.equal(result.recommendedService, 'Website Redesign');
});

test('RULE 3: low SEO score → SEO_IMPROVEMENT', () => {
  const result = classifyCompany({
    website: 'https://example.mk',
    audit: { designScore: 70, seoScore: 35, hasBooking: false, hasEcommerce: false },
  });
  assert.equal(result.classification, 'SEO_IMPROVEMENT');
  assert.equal(result.confidence, 85);
  assert.equal(result.recommendedService, 'SEO Optimization');
});

test('RULE 4: booking category without booking → BOOKING_SYSTEM', () => {
  const result = classifyCompany({
    website: 'https://dental.mk',
    industry: 'DENTAL',
    googleCategory: 'dentist',
    audit: { designScore: 70, seoScore: 80, hasBooking: false, hasEcommerce: false },
  });
  assert.equal(result.classification, 'BOOKING_SYSTEM');
  assert.equal(result.confidence, 90);
});

test('RULE 4 skipped when booking detected', () => {
  const result = classifyCompany({
    website: 'https://dental.mk',
    industry: 'DENTAL',
    audit: { designScore: 70, seoScore: 80, hasBooking: true, hasEcommerce: false },
  });
  assert.equal(result.classification, 'NO_ACTION');
});

test('RULE 5: retail without ecommerce → ECOMMERCE_OPPORTUNITY', () => {
  const result = classifyCompany({
    website: 'https://shop.mk',
    industry: 'RETAIL',
    googleCategory: 'clothing store',
    audit: { designScore: 70, seoScore: 80, hasBooking: false, hasEcommerce: false },
  });
  assert.equal(result.classification, 'ECOMMERCE_OPPORTUNITY');
  assert.equal(result.confidence, 80);
});

test('RULE 6: manufacturing → CUSTOM_SOFTWARE', () => {
  const result = classifyCompany({
    website: 'https://factory.mk',
    industry: 'MANUFACTURING',
    audit: { designScore: 70, seoScore: 80, hasBooking: false, hasEcommerce: false },
  });
  assert.equal(result.classification, 'CUSTOM_SOFTWARE');
  assert.equal(result.confidence, 75);
  assert.equal(result.recommendedService, 'Custom Software Development');
});

test('priority: NO_WEBSITE beats category rules', () => {
  const result = classifyCompany({
    website: null,
    industry: 'MANUFACTURING',
  });
  assert.equal(result.classification, 'NO_WEBSITE');
});

test('priority: redesign beats SEO', () => {
  const result = classifyCompany({
    website: 'https://old.mk',
    audit: { designScore: 20, seoScore: 10, hasBooking: false, hasEcommerce: false },
  });
  assert.equal(result.classification, 'WEBSITE_REDESIGN');
});

test('NO_ACTION when nothing matches', () => {
  const result = classifyCompany({
    website: 'https://good.mk',
    industry: 'LEGAL',
    audit: { designScore: 80, seoScore: 90, hasBooking: false, hasEcommerce: false },
  });
  assert.equal(result.classification, 'NO_ACTION');
  assert.equal(result.recommendedService, 'None');
});

test('computeDesignScore: outdated under 50', () => {
  assert.ok((computeDesignScore({ designAgeEstimate: 'outdated' }) ?? 100) < 50);
});

test('computeSeoScore passthrough', () => {
  assert.equal(computeSeoScore(42), 42);
  assert.equal(computeSeoScore(null), null);
});
