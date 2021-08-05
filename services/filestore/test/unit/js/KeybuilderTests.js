const SandboxedModule = require('sandboxed-module')

const modulePath = '../../../app/js/KeyBuilder.js'

describe('KeybuilderTests', function () {
  let KeyBuilder
  const key = 'wombat/potato'

  beforeEach(function () {
    KeyBuilder = SandboxedModule.require(modulePath, {
      requires: { '@overleaf/settings': {} },
    })
  })

  describe('cachedKey', function () {
    it('should add the format to the key', function () {
      const opts = { format: 'png' }
      const newKey = KeyBuilder.addCachingToKey(key, opts)
      newKey.should.equal(`${key}-converted-cache/format-png`)
    })

    it('should add the style to the key', function () {
      const opts = { style: 'thumbnail' }
      const newKey = KeyBuilder.addCachingToKey(key, opts)
      newKey.should.equal(`${key}-converted-cache/style-thumbnail`)
    })

    it('should add format first, then style', function () {
      const opts = {
        style: 'thumbnail',
        format: 'png',
      }
      const newKey = KeyBuilder.addCachingToKey(key, opts)
      newKey.should.equal(`${key}-converted-cache/format-png-style-thumbnail`)
    })
  })
})
