const assert = require('assert');
const patchlogs = require('../index');

describe('index.js', () => {
  describe('#getItemChanges', () => {
    it('should find patchlogs for Ash Prime', () => {
      const logs = patchlogs.getItemChanges({ name: 'Ash Prime', type: 'Warframe' });
      assert(logs.length);
    });
  });
});
