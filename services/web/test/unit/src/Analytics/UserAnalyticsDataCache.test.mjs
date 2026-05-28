import { vi } from 'vitest'
import sinon from 'sinon'
import path from 'node:path'

const MODULE_PATH = path.join(
  import.meta.dirname,
  '../../../../app/src/Features/Analytics/UserAnalyticsDataCache'
)

describe('UserAnalyticsDataCache', function () {
  beforeEach(async function (ctx) {
    ctx.userId = 'abc123def456abc123def456'
    ctx.analyticsId = 'ecdb935a-52f3-4f91-aebc-7a70d2ffbb55'
    ctx.cacheDeleteSpy = sinon.stub().resolves()

    ctx.UserGetter = {
      promises: {
        getUser: sinon.stub().resolves({
          _id: ctx.userId,
          analyticsId: ctx.analyticsId,
          labsProgram: false,
        }),
      },
    }

    vi.doMock('../../../../app/src/Features/User/UserGetter.mjs', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock('@overleaf/metrics', () => ({
      default: { inc: sinon.stub() },
    }))

    vi.doMock('cache-flow', () => ({
      CacheLoader: class {
        async delete(key) {
          return ctx.cacheDeleteSpy(key)
        }

        async getWithMetadata() {
          return { value: undefined, cached: false, time: 0 }
        }

        keyToString(key) {
          return key?.toString()
        }
      },
    }))

    ctx.UserAnalyticsDataCache = (await import(MODULE_PATH)).default
  })

  describe('invalidateCache', function () {
    it('should delete the cache entry for the userId', async function (ctx) {
      await ctx.UserAnalyticsDataCache.invalidateCache(ctx.userId)
      sinon.assert.calledOnce(ctx.cacheDeleteSpy)
      sinon.assert.calledWith(ctx.cacheDeleteSpy, ctx.userId)
    })
  })
})
