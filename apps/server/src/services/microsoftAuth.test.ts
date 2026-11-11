import { it } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedIssuer } from './microsoftAuth.js';

const ORG = '11111111-2222-3333-4444-555555555555';
const MSA = '9188040d-6c67-4c5b-b112-36a304b66dad';
const tok = (tid: string, iss = `https://login.microsoftonline.com/${tid}/v2.0`) => ({ tid, iss });

it('validates iss against tid and the configured tenant', () => {
  assert.ok(isAllowedIssuer(tok(ORG), 'common'));
  assert.ok(isAllowedIssuer(tok(MSA), 'common'));
  assert.ok(isAllowedIssuer(tok(ORG), 'organizations'));
  assert.ok(!isAllowedIssuer(tok(MSA), 'organizations'));
  assert.ok(isAllowedIssuer(tok(MSA), 'consumers'));
  assert.ok(!isAllowedIssuer(tok(ORG), 'consumers'));
  assert.ok(isAllowedIssuer(tok(ORG), ORG.toUpperCase()));
  assert.ok(!isAllowedIssuer(tok(MSA), ORG)); // other tenant
  assert.ok(!isAllowedIssuer(tok(ORG, `https://login.microsoftonline.com/${MSA}/v2.0`), 'common')); // iss/tid mismatch
  assert.ok(!isAllowedIssuer(tok(ORG, `https://sts.windows.net/${ORG}/`), 'common')); // v1 issuer
  assert.ok(!isAllowedIssuer({ iss: 'https://login.microsoftonline.com/x/v2.0' }, 'common')); // no tid
});
