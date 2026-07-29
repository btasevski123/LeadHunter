import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  analyzeWebsiteForOutreach,
  pickOutreachEmailFacts,
} from './outreach-analysis';
import { buildOutreachBrief, generateOutreachEmail, scrubBannedPhrases } from './email-generator';

describe('outreach website analyzer', () => {
  it('returns the fixed vocabulary shape', () => {
    const analysis = analyzeWebsiteForOutreach({
      websiteExists: true,
      websiteAccessible: true,
      sslEnabled: false,
      mobileFriendly: false,
      hasContactForm: true,
      hasGoogleMaps: true,
      hasSocialLinks: false,
      designAgeEstimate: 'outdated',
      lighthousePerformance: 40,
      htmlSignals: { hasNav: true, serviceCopyLikely: true, imageCount: 6 },
    });

    assert.ok(analysis.positive_observations.includes('Contact information is easy to find'));
    assert.ok(analysis.positive_observations.includes('Simple navigation'));
    assert.ok(analysis.issues.includes('Not mobile friendly'));
    assert.ok(analysis.issues.includes('No HTTPS'));
    assert.ok(analysis.issues.includes('Outdated visual design'));
  });

  it('picks exactly one positive and one primary issue for email', () => {
    const analysis = analyzeWebsiteForOutreach({
      websiteExists: true,
      websiteAccessible: true,
      sslEnabled: false,
      mobileFriendly: false,
      hasContactForm: true,
      hasGoogleMaps: true,
      hasSocialLinks: true,
      designAgeEstimate: 'outdated',
      lighthousePerformance: 30,
      htmlSignals: { hasNav: true, serviceCopyLikely: true, imageCount: 8 },
    });
    const picked = pickOutreachEmailFacts(analysis);
    assert.equal(picked.positive !== null, true);
    assert.equal(picked.issues.length, 1);
    assert.equal(buildOutreachBrief({
      companyName: 'Test',
      website: 'https://example.com',
      outreachAnalysis: analysis,
    }).observations.length, 1);
  });
});

describe('template email generation', () => {
  it('fills the Macedonian human outreach template', async () => {
    const result = await generateOutreachEmail({
      companyName: 'Forming DOOEL',
      website: 'http://forming.mk',
      language: 'mk',
      kind: 'OUTREACH',
      outreachAnalysis: {
        positive_observations: ['Contact information is easy to find'],
        issues: ['Not mobile friendly', 'No HTTPS'],
      },
    });
    assert.equal(result.source, 'template');
    assert.match(result.content, /Го најдов Forming DOOEL додека разгледував локални бизниси/);
    assert.match(result.content, /Забележав дека контакт информациите лесно се наоѓаат/);
    assert.match(result.content, /Имаше една работа која мислам дека би можела да се подобри/);
    assert.match(result.content, /На телефон, приказот би можел да биде појасен/);
    assert.doesNotMatch(result.content, /HTTPS/);
    assert.doesNotMatch(result.content, /застарен|губат|одвраќа/i);
    assert.match(result.content, /без никаква обврска/);
    assert.match(result.content, /Поздрав,/);
  });

  it('omits positive and issue sections when missing', async () => {
    const result = await generateOutreachEmail({
      companyName: 'Test Co',
      website: 'https://example.com',
      language: 'en',
      kind: 'OUTREACH',
      outreachAnalysis: {
        positive_observations: [],
        issues: [],
      },
    });
    assert.doesNotMatch(result.content, /I noticed that/);
    assert.doesNotMatch(result.content, /one thing I thought could be improved/);
    assert.match(result.content, /no obligation/);
  });
});

describe('banned phrase scrub', () => {
  it('strips jargon the model must never send', () => {
    const cleaned = scrubBannedPhrases(
      'I ran a website audit and your lead score looks high. No AI involved.',
    );
    assert.ok(!/audit|lead score|\bAI\b/i.test(cleaned));
  });
});
