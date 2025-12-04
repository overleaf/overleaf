import { beforeEach, describe, expect, it, vi } from 'vitest'

const modulePath = '../../../app/js/KeyBuilder.js'

describe('KeybuilderTests', function () {
  let KeyBuilder
  const key = 'wombat/potato'

  beforeEach(async function () {
    vi.doMock('@overleaf/settings', () => ({
      default: {},
    }))

    KeyBuilder = (await import(modulePath)).default
  })

  describe('cachedKey', function () {
    it('should add the format to the key', function () {
      const opts = { format: 'png' }
      const newKey = KeyBuilder.addCachingToKey(key, opts)
      expect(newKey).to.equal(`${key}-converted-cache/format-png`)
    })

    it('should add the style to the key', function () {
      const opts = { style: 'thumbnail' }
      const newKey = KeyBuilder.addCachingToKey(key, opts)
      expect(newKey).to.equal(`${key}-converted-cache/style-thumbnail`)
    })

    it('should add format first, then style', function () {
      const opts = {
        style: 'thumbnail',
        format: 'png',
      }
      const newKey = KeyBuilder.addCachingToKey(key, opts)
      expect(newKey).to.equal(
        `${key}-converted-cache/format-png-style-thumbnail`
      )
    })
  })
})
