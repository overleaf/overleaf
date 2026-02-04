import { vi, expect, describe, beforeEach, it } from 'vitest'

const modulePath = '../../../app/js/SafeJsonParse'

describe('SafeJsonParse', function () {
  beforeEach(async function (ctx) {
    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.Settings = {
        maxUpdateSize: 16 * 1024,
      }),
    }))

    ctx.SafeJsonParse = (await import(modulePath)).default
  })

  describe('parse', function () {
    it('should parse documents correctly', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.SafeJsonParse.parse('{"foo": "bar"}', (error, parsed) => {
          if (error) return reject(error)
          expect(parsed).to.deep.equal({ foo: 'bar' })
          resolve()
        })
      })
    })

    it('should return an error on bad data', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.SafeJsonParse.parse('blah', (error, parsed) => {
          expect(error).to.exist
          resolve()
        })
      })
    })

    it('should return an error on oversized data', async function (ctx) {
      await new Promise((resolve, reject) => {
        // we have a 2k overhead on top of max size
        const bigBlob = Array(16 * 1024).join('A')
        const data = `{"foo": "${bigBlob}"}`
        ctx.Settings.maxUpdateSize = 2 * 1024
        ctx.SafeJsonParse.parse(data, (error, parsed) => {
          ctx.logger.error.called.should.equal(false)
          expect(error).to.exist
          resolve()
        })
      })
    })
  })
})
