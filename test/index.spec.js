import assert from 'assert';

import patchlogs from '../index.js';

describe('index.js', () => {
  describe('#getItemChanges', () => {
    it('should find patchlogs for Ash Prime', () => {
      const logs = patchlogs.getItemChanges({ name: 'Ash Prime', type: 'Warframe' });
      assert(logs.length);
    });
  });
});
