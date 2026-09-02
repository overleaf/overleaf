import { describe, it, expect } from 'vitest'
import { compileRequestBodySchema } from '../../../app/js/schemas.js'

describe('schemas', function () {
  describe('compileRequestBodySchema', function () {
    it('accepts a compileGroup from the enum', function () {
      const result = compileRequestBodySchema.safeParse({
        compile: { options: { compileGroup: 'priority' } },
      })
      expect(result.success).to.equal(true)
    })

    it('accepts a missing compileGroup', function () {
      const result = compileRequestBodySchema.safeParse({
        compile: { options: {} },
      })
      expect(result.success).to.equal(true)
    })

    it('rejects a compileGroup outside the enum', function () {
      const result = compileRequestBodySchema.safeParse({
        compile: { options: { compileGroup: 'clsi-perf' } },
      })
      expect(result.success).to.equal(false)
    })
  })

  describe('compileRequestBodySchema globalBlobs', function () {
    it('accepts an array of valid blob hashes', function () {
      const result = compileRequestBodySchema.safeParse({
        compile: { globalBlobs: ['a'.repeat(40), 'b'.repeat(40)] },
      })
      expect(result.success).to.equal(true)
    })

    it('accepts a missing globalBlobs', function () {
      const result = compileRequestBodySchema.safeParse({
        compile: {},
      })
      expect(result.success).to.equal(true)
    })

    it('rejects a globalBlobs entry that is not a valid blob hash', function () {
      const result = compileRequestBodySchema.safeParse({
        compile: { globalBlobs: ['not-a-valid-hash'] },
      })
      expect(result.success).to.equal(false)
    })
  })

  describe('compileRequestBodySchema resources', function () {
    it('accepts a resource with a valid url and fallbackURL', function () {
      const result = compileRequestBodySchema.safeParse({
        compile: {
          resources: [
            {
              path: 'main.tex',
              url: 'http://example.com/main.tex',
              fallbackURL: 'http://fallback.example.com/main.tex',
            },
          ],
        },
      })
      expect(result.success).to.equal(true)
    })

    it('rejects a resource with a non-URL url', function () {
      const result = compileRequestBodySchema.safeParse({
        compile: {
          resources: [{ path: 'main.tex', url: 'not-a-url' }],
        },
      })
      expect(result.success).to.equal(false)
    })

    it('rejects a resource with a non-URL fallbackURL', function () {
      const result = compileRequestBodySchema.safeParse({
        compile: {
          resources: [
            {
              path: 'main.tex',
              url: 'http://example.com/main.tex',
              fallbackURL: 'not-a-url',
            },
          ],
        },
      })
      expect(result.success).to.equal(false)
    })
  })

  describe('compileRequestBodySchema clsiPerfVariant', function () {
    it('accepts a clsiPerfVariant from the enum', function () {
      const result = compileRequestBodySchema.safeParse({
        compile: { options: { clsiPerfVariant: 'minimal-gvisor' } },
      })
      expect(result.success).to.equal(true)
    })

    it('accepts a missing clsiPerfVariant', function () {
      const result = compileRequestBodySchema.safeParse({
        compile: { options: {} },
      })
      expect(result.success).to.equal(true)
    })

    it('rejects a clsiPerfVariant outside the enum', function () {
      const result = compileRequestBodySchema.safeParse({
        compile: { options: { clsiPerfVariant: '../../etc' } },
      })
      expect(result.success).to.equal(false)
    })
  })
})
