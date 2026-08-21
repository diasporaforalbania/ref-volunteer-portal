import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { audienceFor, INTERNAL_ROLES } from '../../functions/api/send-push.js';

const QENDRA = ['admin', 'jurist', 'logjistike', 'burime_njerezore', 'pr_edukim', 'it'];
const FIELD = ['ndihmes', 'mbledhes'];

describe('Suite 10: Who gets notified', () => {
  it('treats qendra + koordinator as the internal audience, and nobody else', () => {
    for (const role of [...QENDRA, 'koordinator']) {
      assert.ok(INTERNAL_ROLES.includes(role), `${role} must count as internal`);
    }
    for (const role of FIELD) {
      assert.ok(!INTERNAL_ROLES.includes(role), `${role} must NOT count as internal`);
    }
    assert.equal(INTERNAL_ROLES.length, 7);
  });

  describe('Raportimet — anyone files, only the centre is alerted', () => {
    const aud = audienceFor('report', { id: 'r1' });

    it('targets qendra and koordinatorët', () => {
      assert.deepEqual([...aud.roles].sort(), [...INTERNAL_ROLES].sort());
      assert.equal(aud.onlyMe, false);
    });

    it('never reaches ndihmës or mbledhës devices', () => {
      for (const role of FIELD) assert.ok(!aud.roles.includes(role));
    });

    it('reaches every centre role, not just the three staff roles', () => {
      // The old behaviour used STAFF_ROLES, which silently skipped these four.
      for (const role of ['logjistike', 'burime_njerezore', 'pr_edukim', 'it']) {
        assert.ok(aud.roles.includes(role), `${role} was previously missed`);
      }
    });
  });

  describe('Njoftimet — written by the centre, delivered per audience', () => {
    it("audience 'all' notifies everyone, with no role filter", () => {
      const aud = audienceFor('announcement', { audience: 'all' });
      assert.equal(aud.roles, null, 'null means no role filter, i.e. all approved volunteers');
      assert.equal(aud.onlyMe, false);
      assert.equal(aud.label, 'të gjithë vullnetarët');
    });

    it('defaults to everyone when the audience column is absent', () => {
      assert.equal(audienceFor('announcement', {}).roles, null);
      assert.equal(audienceFor('announcement', null).roles, null);
    });

    it("audience 'staff' stays inside qendra + koordinatorët", () => {
      const aud = audienceFor('announcement', { audience: 'staff' });
      assert.deepEqual([...aud.roles].sort(), [...INTERNAL_ROLES].sort());
      for (const role of FIELD) assert.ok(!aud.roles.includes(role));
    });
  });

  it('keeps a test notification on the calling device only', () => {
    const aud = audienceFor('test');
    assert.equal(aud.onlyMe, true);
    assert.equal(aud.label, 'vetëm ju');
  });
});
