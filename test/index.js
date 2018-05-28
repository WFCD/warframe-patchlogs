const assert = require('assert')

describe('index.js', function () {
  it('should find patchlogs for Ash Prime on getItemChanges()', function () {
    const patchlogs = require('../index.js')
    const logs = patchlogs.getItemChanges({ name: 'Ash Prime', type: 'Warframe' })
    assert(logs.length)
  })
})
