import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scoreLead } from './index';

test('no website + google + contacts scores hot lead', () => {
  const result = scoreLead({
    websiteExists: false,
    websiteAccessible: false,
    sslEnabled: false,
    mobileFriendly: false,
    lighthousePerformance: null,
    lighthouseSeo: null,
    lighthouseAccessibility: null,
    hasContactForm: false,
    hasGoogleMaps: false,
    hasSocialLinks: false,
    hasPrivacyPolicy: false,
    hasCookieNotice: false,
    designAgeEstimate: 'unknown',
    hasEmail: true,
    hasPhone: true,
    hasGooglePresence: true,
    industry: 'MANUFACTURING',
  });
  assert.ok(result.score >= 95, `expected >=95 got ${result.score}`);
  assert.ok(result.reasons.includes('No website'));
});

test('no website scores high', () => {
  const result = scoreLead({
    websiteExists: false,
    websiteAccessible: false,
    sslEnabled: false,
    mobileFriendly: false,
    lighthousePerformance: null,
    lighthouseSeo: null,
    lighthouseAccessibility: null,
    hasContactForm: false,
    hasGoogleMaps: false,
    hasSocialLinks: false,
    hasPrivacyPolicy: false,
    hasCookieNotice: false,
    designAgeEstimate: 'unknown',
    hasEmail: true,
  });
  assert.ok(result.score >= 88);
  assert.ok(result.reasons.includes('No website'));
});

test('modern site scores low', () => {
  const result = scoreLead({
    websiteExists: true,
    websiteAccessible: true,
    sslEnabled: true,
    mobileFriendly: true,
    lighthousePerformance: 85,
    lighthouseSeo: 90,
    lighthouseAccessibility: 90,
    hasContactForm: true,
    hasGoogleMaps: true,
    hasSocialLinks: true,
    hasPrivacyPolicy: true,
    hasCookieNotice: true,
    designAgeEstimate: 'modern',
    hasEmail: true,
  });
  assert.ok(result.score <= 40);
});

test('outdated no-ssl mobile-poor scores high', () => {
  const result = scoreLead({
    websiteExists: true,
    websiteAccessible: true,
    sslEnabled: false,
    mobileFriendly: false,
    lighthousePerformance: 30,
    lighthouseSeo: 40,
    lighthouseAccessibility: 50,
    hasContactForm: false,
    hasGoogleMaps: false,
    hasSocialLinks: false,
    hasPrivacyPolicy: false,
    hasCookieNotice: false,
    designAgeEstimate: 'outdated',
    hasEmail: true,
  });
  assert.ok(result.score >= 80);
  assert.ok(result.reasons.includes('No SSL'));
});
