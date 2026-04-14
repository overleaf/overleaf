import { vi, expect } from 'vitest'
import Path from 'node:path'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'

const { ObjectId } = mongodb

const MODULE_PATH = Path.join(
  import.meta.dirname,
  '../../../../app/src/Features/SplitTests/SplitTestSessionHandler'
)

describe('SplitTestSessionHandler', function () {
  beforeEach(async function (ctx) {
    ctx.SplitTestCache = {
      get: sinon.stub().resolves(),
    }
    ctx.SplitTestUserGetter = {}

    ctx.SplitTestCache.get = sinon.stub().resolves(
      new Map(
        Object.entries({
          'anon-test-1': {
            _id: '661f92a4669764bb03f73e37',
            name: 'anon-test-1',
            versions: [
              {
                versionNumber: 1,
                variants: [
                  {
                    name: 'enabled',
                  },
                ],
              },
            ],
          },
          'anon-test-2': {
            _id: '661f92a9d68ea711d6bf2df4',
            name: 'anon-test-2',
            versions: [
              {
                versionNumber: 1,
                variants: [
                  {
                    name: 'v-1',
                  },
                  {
                    name: 'v-2',
                  },
                ],
              },
            ],
          },
        })
      )
    )

    vi.doMock('../../../../app/src/Features/SplitTests/SplitTestCache', () => ({
      default: ctx.SplitTestCache,
    }))

    vi.doMock(
      '../../../../app/src/Features/SplitTests/SplitTestUserGetter',
      () => ({
        default: ctx.SplitTestUserGetter,
      })
    )

    vi.doMock('mongodb-legacy', () => ({
      default: { ObjectId },
    }))

    ctx.SplitTestSessionHandler = (await import(MODULE_PATH)).default
  })

  it('should read from the splitTests field', async function (ctx) {
    const session = {
      splitTests: {
        'anon-test-1': [
          {
            variantName: 'default',
            versionNumber: 1,
            phase: 'release',
            assignedAt: new Date(1712872800000), // 2024-04-11 22:00:00
          },
        ],
        'anon-test-2': [
          {
            variantName: 'default',
            versionNumber: 1,
            phase: 'release',
            assignedAt: new Date(1712307600000), // 2024-04-05 09:00:00
          },
          {
            variantName: 'v-2',
            versionNumber: 2,
            phase: 'release',
            assignedAt: new Date(1712581200000), // 2024-04-08 13:00:00
          },
        ],
      },
      sta: ``,
    }

    const assignments =
      await ctx.SplitTestSessionHandler.promises.getAssignments(session)
    expect(assignments).to.deep.equal({
      'anon-test-1': [
        {
          variantName: 'default',
          versionNumber: 1,
          phase: 'release',
          assignedAt: new Date(1712872800000),
        },
      ],
      'anon-test-2': [
        {
          variantName: 'default',
          versionNumber: 1,
          phase: 'release',
          assignedAt: new Date(1712307600000),
        },
        {
          variantName: 'v-2',
          versionNumber: 2,
          phase: 'release',
          assignedAt: new Date(1712581200000),
        },
      ],
    })
  })

  it('should read from the sta field', async function (ctx) {
    ctx.SplitTestCache.get = sinon.stub().resolves(
      new Map(
        Object.entries({
          'anon-test-1': {
            _id: '661f92a4669764bb03f73e37',
            name: 'anon-test-1',
            versions: [
              {
                versionNumber: 1,
                variants: [
                  {
                    name: 'enabled',
                  },
                ],
              },
            ],
          },
          'anon-test-2': {
            _id: '661f92a9d68ea711d6bf2df4',
            name: 'anon-test-2',
            versions: [
              {
                versionNumber: 1,
                variants: [
                  {
                    name: 'v-1',
                  },
                  {
                    name: 'v-2',
                  },
                ],
              },
            ],
          },
        })
      )
    )
    const session = {
      sta: `Zh+SpGaXZLsD9z43_1=d:sbrvs0;Zh+SqdaOpxHWvy30_1=d:sbtqg0;Zh+SqdaOpxHWvy30_2=1:sbsi00`,
    }

    const assignments =
      await ctx.SplitTestSessionHandler.promises.getAssignments(session)
    expect(assignments).to.deep.equal({
      'anon-test-1': [
        {
          variantName: 'default',
          versionNumber: 1,
          phase: 'release',
          assignedAt: new Date(1712829600000),
        },
      ],
      'anon-test-2': [
        {
          variantName: 'default',
          versionNumber: 1,
          phase: 'release',
          assignedAt: new Date(1712916000000),
        },
        {
          variantName: 'v-2',
          versionNumber: 2,
          phase: 'release',
          assignedAt: new Date(1712858400000),
        },
      ],
    })
  })

  it('should deduplicate entries from the sta field', async function (ctx) {
    ctx.SplitTestCache.get = sinon.stub().resolves(
      new Map(
        Object.entries({
          'anon-test-1': {
            _id: '661f92a4669764bb03f73e37',
            name: 'anon-test-1',
            versions: [
              {
                versionNumber: 1,
                variants: [
                  {
                    name: 'enabled',
                  },
                ],
              },
            ],
          },
          'anon-test-2': {
            _id: '661f92a9d68ea711d6bf2df4',
            name: 'anon-test-2',
            versions: [
              {
                versionNumber: 1,
                variants: [
                  {
                    name: 'v-1',
                  },
                  {
                    name: 'v-2',
                  },
                ],
              },
            ],
          },
        })
      )
    )
    const session = {
      sta: `Zh+SpGaXZLsD9z43_1=d:sbrvs0;Zh+SqdaOpxHWvy30_1=d:sbtqg0;Zh+SqdaOpxHWvy30_1=d:sbtqg0;Zh+SpGaXZLsD9z43_1=d:sbrvs0;Zh+SqdaOpxHWvy30_2=1:sbsi00;Zh+SqdaOpxHWvy30_1=d:sbtqg0`,
    }

    const assignments =
      await ctx.SplitTestSessionHandler.promises.getAssignments(session)
    expect(assignments).to.deep.equal({
      'anon-test-1': [
        {
          variantName: 'default',
          versionNumber: 1,
          phase: 'release',
          assignedAt: new Date(1712829600000),
        },
      ],
      'anon-test-2': [
        {
          variantName: 'default',
          versionNumber: 1,
          phase: 'release',
          assignedAt: new Date(1712916000000),
        },
        {
          variantName: 'v-2',
          versionNumber: 2,
          phase: 'release',
          assignedAt: new Date(1712858400000),
        },
      ],
    })
  })

  it('should merge assignments from both splitTests and sta fields', async function (ctx) {
    const session = {
      splitTests: {
        'anon-test-1': [
          {
            variantName: 'default',
            versionNumber: 1,
            phase: 'release',
            assignedAt: new Date(1712872800000),
          },
        ],
        'anon-test-2': [
          {
            variantName: 'default',
            versionNumber: 1,
            phase: 'release',
            assignedAt: new Date(1712307600000),
          },
        ],
      },
      sta: `Zh+SqdaOpxHWvy30_2=1:sbsi00`,
    }

    const assignments =
      await ctx.SplitTestSessionHandler.promises.getAssignments(session)
    expect(assignments).to.deep.equal({
      'anon-test-1': [
        {
          variantName: 'default',
          versionNumber: 1,
          phase: 'release',
          assignedAt: new Date(1712872800000),
        },
      ],
      'anon-test-2': [
        {
          variantName: 'v-2',
          versionNumber: 2,
          phase: 'release',
          assignedAt: new Date(1712858400000),
        },
        {
          variantName: 'default',
          versionNumber: 1,
          phase: 'release',
          assignedAt: new Date(1712307600000),
        },
      ],
    })
  })

  describe('clearCachedVariant', function () {
    it('should remove all cached entries for a given split test name', function (ctx) {
      const session = {
        cachedSplitTestAssignments: {
          'my-test-1': 'variant-1',
          'my-test-2': 'variant-2',
          'other-test-1': 'variant-1',
        },
      }
      ctx.SplitTestSessionHandler.clearCachedVariant(session, 'my-test')
      expect(session.cachedSplitTestAssignments).to.deep.equal({
        'other-test-1': 'variant-1',
      })
    })

    it('should handle split test names with hyphens correctly', function (ctx) {
      const session = {
        cachedSplitTestAssignments: {
          'monthly-texlive-1': 'enabled',
          'monthly-texlive-2': 'enabled',
          'monthly-1': 'variant-1',
        },
      }
      ctx.SplitTestSessionHandler.clearCachedVariant(session, 'monthly-texlive')
      expect(session.cachedSplitTestAssignments).to.deep.equal({
        'monthly-1': 'variant-1',
      })
    })

    it('should do nothing when session has no cached assignments', function (ctx) {
      const session = {}
      ctx.SplitTestSessionHandler.clearCachedVariant(session, 'my-test')
      expect(session.cachedSplitTestAssignments).to.be.undefined
    })

    it('should do nothing when there are no matching entries', function (ctx) {
      const session = {
        cachedSplitTestAssignments: {
          'other-test-1': 'variant-1',
        },
      }
      ctx.SplitTestSessionHandler.clearCachedVariant(session, 'my-test')
      expect(session.cachedSplitTestAssignments).to.deep.equal({
        'other-test-1': 'variant-1',
      })
    })
  })
})
