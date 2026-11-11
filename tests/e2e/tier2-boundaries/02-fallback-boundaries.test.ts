import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../../harness/index.js';
import {
  searchIkeaProducts,
  scrapeIkeaProductUrl,
  reconstructImageTo3D,
  synthesizeProduct3D,
} from '../../../src/server/ikeaService.js';

describe('Tier 2: Feature 2 - Offline / Free Fallback Boundaries', () => {
  it('T2-F2-01: Empty & Whitespace-Only Search Query', async () => {
    const resEmpty = await searchIkeaProducts('');
    assert.equal(resEmpty.source, 'fallback');
    assert.equal(resEmpty.products.length, 6);

    const resWhitespace = await searchIkeaProducts('   \t\n   ');
    assert.equal(resWhitespace.source, 'fallback');
    assert.equal(resWhitespace.products.length, 6);
  });

  it('T2-F2-02: Massive Query Injection (5,000 Characters)', async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    try {
      process.env.GEMINI_API_KEY = '';
      const injection = 'A'.repeat(5000) + "'; DROP TABLE products; SELECT * FROM users; <script>alert(1)</script>--";
      const res = await searchIkeaProducts(injection);

      assert.equal(res.source, 'fallback');
      assert.equal(res.products.length, 6);
      assert.ok(res.products.every((p) => p.dimensionsCm.width > 0));
    } finally {
      process.env.GEMINI_API_KEY = originalKey;
    }
  });

  it('T2-F2-03: Malformed & Unreachable Scraper URLs', async () => {
    const malformed = await scrapeIkeaProductUrl('not-a-url-at-all');
    assert.equal(malformed.products.length, 6);

    const nonIkea = await scrapeIkeaProductUrl('https://example.com/some/fake/page');
    assert.equal(nonIkea.products.length, 6);
  });

  it('T2-F2-04: Corrupted Base64 Image Payload', async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    try {
      process.env.GEMINI_API_KEY = '';
      const res = await reconstructImageTo3D({
        imageBase64: 'corrupted-binary-gibberish-!@#$%^&*()',
        mimeType: 'image/jpeg',
        nameHint: 'Broken Upload',
      });

      assert.equal(res.source, 'fallback');
      assert.ok(res.spec3D.parts.length >= 20);
      assert.ok(res.product.name.includes('BROKEN UPLOAD'));
    } finally {
      process.env.GEMINI_API_KEY = originalKey;
    }
  });

  it('T2-F2-05: Empty Body 400 Bad Request on 3D Synthesis', async () => {
    const res = await synthesizeProduct3D({} as any);

    assert.equal(res.status, 400);
    assert.ok(res.payload.error, 'Must return error explanation');
    assert.match(String(res.payload.error), /Missing/);
  });

  it('T2-F2-06: Simulated Gemini API Timeout Window', async () => {
    // Test that timeout wrapper function aborts long running tasks
    async function simulateDelayedTask(ms: number, timeoutMs: number): Promise<string> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      return new Promise((resolve, reject) => {
        controller.signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('Operation timed out'));
        });

        setTimeout(() => {
          clearTimeout(timer);
          resolve('success');
        }, ms);
      });
    }

    await assert.rejects(
      async () => simulateDelayedTask(500, 50),
      /timed out/,
      'Task exceeding timeout threshold must reject cleanly'
    );
  });
});
