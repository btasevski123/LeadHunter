import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as cheerio from 'cheerio';
import { detectPlaceholderSite } from './placeholder-detection';

test('under construction text alone → placeholder', () => {
  const html = `
    <html><body>
      <h1>Stikeri MK</h1>
      <p>Сајтот е во изработка</p>
      <a href="https://facebook.com/stikeri">Facebook</a>
      <a href="https://instagram.com/stikeri">Instagram</a>
    </body></html>
  `;
  const $ = cheerio.load(html);
  const result = detectPlaceholderSite($, html, {
    hasContactForm: false,
    hasNav: false,
    serviceCopyLikely: false,
  });
  assert.equal(result.isPlaceholderSite, true);
  assert.ok(result.placeholderSignals.includes('under_construction_text'));
});

test('social-only + thin + no structure → placeholder', () => {
  const html = `
    <html><body>
      <h1>Print Shop</h1>
      <p>Follow us</p>
      <a href="https://facebook.com/print">FB</a>
      <a href="https://instagram.com/print">IG</a>
    </body></html>
  `;
  const $ = cheerio.load(html);
  const result = detectPlaceholderSite($, html, {
    hasContactForm: false,
    hasNav: false,
    serviceCopyLikely: false,
  });
  assert.equal(result.isPlaceholderSite, true);
  assert.ok(result.placeholderSignals.includes('social_only_links'));
  assert.ok(result.placeholderSignals.includes('thin_content'));
  assert.ok(result.placeholderSignals.includes('no_business_structure'));
});

test('real business site is not a placeholder', () => {
  const html = `
    <html><body>
      <header><nav>
        <a href="/">Home</a>
        <a href="/services">Services</a>
        <a href="/about">About</a>
        <a href="/contact">Contact</a>
      </nav></header>
      <main>
        <h1>Professional dental clinic in Bitola</h1>
        <p>We offer preventive care, implants, whitening and orthodontics for families across the region.</p>
        <p>Our team of specialists has been serving patients for more than fifteen years with modern equipment.</p>
        <section>
          <h2>Our services</h2>
          <p>From routine checkups to complex oral surgery, we provide clear treatment plans and flexible appointments.</p>
        </section>
        <form action="/contact"><input name="email" /><textarea name="message"></textarea></form>
        <a href="https://facebook.com/clinic">Facebook</a>
      </main>
    </body></html>
  `;
  const $ = cheerio.load(html);
  const result = detectPlaceholderSite($, html, {
    hasContactForm: true,
    hasNav: true,
    serviceCopyLikely: true,
  });
  assert.equal(result.isPlaceholderSite, false);
});

test('coming soon English text → placeholder', () => {
  const html = `<html><body><p>Coming soon</p></body></html>`;
  const $ = cheerio.load(html);
  const result = detectPlaceholderSite($, html);
  assert.equal(result.isPlaceholderSite, true);
  assert.ok(result.placeholderSignals.includes('under_construction_text'));
});
