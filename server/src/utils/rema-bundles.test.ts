import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeBundleSizeLabel, parsePublicRemaBundlesPage } from './rema-bundles';

test('parses public Rema bundles from HTML for the requested network', () => {
  const html = `
    <html>
      <body>
        <div>mtn</div>
        <div>1GB</div>
        <div>₵4.30</div>
        <div>2GB</div>
        <div>₵8.60</div>
        <div>telecel</div>
        <div>3GB</div>
        <div>₵12.70</div>
      </body>
    </html>
  `;

  assert.deepEqual(parsePublicRemaBundlesPage(html, 'MTN'), [
    {
      id: 'mtn-1gb',
      name: '1GB',
      volume: '1GB',
      price: 4.3,
      currency: 'GHS',
      network: 'mtn',
      reference: 'mtn-1gb',
      description: '',
    },
    {
      id: 'mtn-2gb',
      name: '2GB',
      volume: '2GB',
      price: 8.6,
      currency: 'GHS',
      network: 'mtn',
      reference: 'mtn-2gb',
      description: '',
    },
    {
      id: 'mtn-3gb',
      name: '3GB',
      volume: '3GB',
      price: 12.7,
      currency: 'GHS',
      network: 'mtn',
      reference: 'mtn-3gb',
      description: '',
    },
  ]);
});

test('normalizes bundle sizes without duplicate decimals in the label', () => {
  assert.equal(normalizeBundleSizeLabel('1.00GB'), '1GB');
  assert.equal(normalizeBundleSizeLabel('2.50GB'), '2.5GB');
  assert.equal(normalizeBundleSizeLabel('3.00MB'), '3MB');
});

test('does not show placeholder bundles when the live page has no matching network block', () => {
  const html = `
    <html>
      <body>
        <h1>Rema Data</h1>
        <p>Welcome to the bundles page.</p>
      </body>
    </html>
  `;

  assert.deepEqual(parsePublicRemaBundlesPage(html, 'Telecel'), []);
});
