import { expect } from 'vitest'

const MODULE_PATH = '../../../../app/src/Features/Subscription/FeaturesHelper'

describe('FeaturesHelper', function () {
  beforeEach(async function (ctx) {
    ctx.FeaturesHelper = (await import(MODULE_PATH)).default
  })

  describe('mergeFeatures', function () {
    it('should prefer priority over standard for compileGroup', function (ctx) {
      expect(
        ctx.FeaturesHelper.mergeFeatures(
          { compileGroup: 'priority' },
          { compileGroup: 'standard' }
        )
      ).to.deep.equal({ compileGroup: 'priority' })
      expect(
        ctx.FeaturesHelper.mergeFeatures(
          { compileGroup: 'standard' },
          { compileGroup: 'priority' }
        )
      ).to.deep.equal({ compileGroup: 'priority' })
      expect(
        ctx.FeaturesHelper.mergeFeatures(
          { compileGroup: 'priority' },
          { compileGroup: 'priority' }
        )
      ).to.deep.equal({ compileGroup: 'priority' })
      expect(
        ctx.FeaturesHelper.mergeFeatures(
          { compileGroup: 'standard' },
          { compileGroup: 'standard' }
        )
      ).to.deep.equal({ compileGroup: 'standard' })
    })

    it('should prefer -1 over any other for collaborators', function (ctx) {
      expect(
        ctx.FeaturesHelper.mergeFeatures(
          { collaborators: -1 },
          { collaborators: 10 }
        )
      ).to.deep.equal({ collaborators: -1 })
      expect(
        ctx.FeaturesHelper.mergeFeatures(
          { collaborators: 10 },
          { collaborators: -1 }
        )
      ).to.deep.equal({ collaborators: -1 })
      expect(
        ctx.FeaturesHelper.mergeFeatures(
          { collaborators: 4 },
          { collaborators: 10 }
        )
      ).to.deep.equal({ collaborators: 10 })
    })

    it('should prefer the higher of compileTimeout', function (ctx) {
      expect(
        ctx.FeaturesHelper.mergeFeatures(
          { compileTimeout: 20 },
          { compileTimeout: 10 }
        )
      ).to.deep.equal({ compileTimeout: 20 })
      expect(
        ctx.FeaturesHelper.mergeFeatures(
          { compileTimeout: 10 },
          { compileTimeout: 20 }
        )
      ).to.deep.equal({ compileTimeout: 20 })
    })

    it('should prefer the true over false for other keys', function (ctx) {
      expect(
        ctx.FeaturesHelper.mergeFeatures({ github: true }, { github: false })
      ).to.deep.equal({ github: true })
      expect(
        ctx.FeaturesHelper.mergeFeatures({ github: false }, { github: true })
      ).to.deep.equal({ github: true })
      expect(
        ctx.FeaturesHelper.mergeFeatures({ github: true }, { github: true })
      ).to.deep.equal({ github: true })
      expect(
        ctx.FeaturesHelper.mergeFeatures({ github: false }, { github: false })
      ).to.deep.equal({ github: false })
    })
  })

  describe('computeFeatureSet', function () {
    it('should handle only one featureSet', function (ctx) {
      expect(
        ctx.FeaturesHelper.computeFeatureSet([
          { github: true, feat1: true, feat2: false },
        ])
      ).to.deep.equal({ github: true, feat1: true, feat2: false })
    })
    it('should handle an empty array of featureSets', function (ctx) {
      expect(ctx.FeaturesHelper.computeFeatureSet([])).to.deep.equal({})
    })

    it('should handle 3+ featureSets', function (ctx) {
      const featureSets = [
        { github: true, feat1: false, feat2: false },
        { github: false, feat1: true, feat2: false, feat3: false },
        { github: false, feat1: false, feat2: true, feat4: true },
      ]
      expect(ctx.FeaturesHelper.computeFeatureSet(featureSets)).to.deep.equal({
        github: true,
        feat1: true,
        feat2: true,
        feat3: false,
        feat4: true,
      })
    })
  })

  describe('isFeatureSetBetter', function () {
    it('simple comparisons', function (ctx) {
      const result1 = ctx.FeaturesHelper.isFeatureSetBetter(
        { dropbox: true },
        { dropbox: false }
      )
      expect(result1).to.be.true

      const result2 = ctx.FeaturesHelper.isFeatureSetBetter(
        { dropbox: false },
        { dropbox: true }
      )
      expect(result2).to.be.false
    })

    it('compound comparisons with same features', function (ctx) {
      const result1 = ctx.FeaturesHelper.isFeatureSetBetter(
        { collaborators: 9, dropbox: true },
        { collaborators: 10, dropbox: true }
      )
      expect(result1).to.be.false

      const result2 = ctx.FeaturesHelper.isFeatureSetBetter(
        { collaborators: -1, dropbox: true },
        { collaborators: 10, dropbox: true }
      )
      expect(result2).to.be.true

      const result3 = ctx.FeaturesHelper.isFeatureSetBetter(
        { collaborators: -1, compileTimeout: 60, dropbox: true },
        { collaborators: 10, compileTimeout: 60, dropbox: true }
      )
      expect(result3).to.be.true
    })
  })
})
