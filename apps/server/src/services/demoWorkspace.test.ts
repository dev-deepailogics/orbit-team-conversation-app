// Demo usernames are `<first name>_<slug>`, so a repeated first name would fail the seed transaction.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_REGIONS, NAMES, strongPassword } from './demoWorkspace.js';

describe('strongPassword', () => {
  it('is 8 chars with upper, lower, digit and symbol', () => {
    for (let i = 0; i < 200; i++) {
      const p = strongPassword();
      assert.equal(p.length, 8);
      for (const re of [/[A-Z]/, /[a-z]/, /[0-9]/, /[!@#$%&*?]/]) assert.match(p, re);
    }
  });
});

describe('demo workspace names', () => {
  for (const region of DEMO_REGIONS) {
    it(`${region}: at least 10 users with unique first names`, () => {
      const firsts = Object.values(NAMES[region]).map((n) => n.split(' ')[0].toLowerCase());
      assert.ok(firsts.length >= 10);
      assert.equal(new Set(firsts).size, firsts.length);
    });
  }
});
