const { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Helpers/FeatureFlag'
)

describe('FeatureFlag', function () {
  beforeEach(function () {
    this.FeatureFlag = SandboxedModule.require(modulePath, {})
  })

  describe('shouldDisplayFeature', function () {
    describe('no req.query', function () {
      const req = {}
      it('should return false when variantFlag=false', function () {
        expect(this.FeatureFlag.shouldDisplayFeature(req, '', false)).to.be
          .false
      })
      it('should return true when variantFlag=true', function () {
        expect(this.FeatureFlag.shouldDisplayFeature(req, '', true)).to.be.true
      })
    })

    describe('req.query but no query param', function () {
      const req = { query: {} }
      it('should return false when variantFlag=false', function () {
        expect(this.FeatureFlag.shouldDisplayFeature(req, '', false)).to.be
          .false
      })
      it('should return true when variantFlag=true', function () {
        expect(this.FeatureFlag.shouldDisplayFeature(req, '', true)).to.be.true
      })
    })

    describe('req.query[name] exists', function () {
      const paramName = 'test'
      const req = { query: {} }

      it('should return false when value is not "true"', function () {
        req.query[paramName] = 'nope'
        expect(this.FeatureFlag.shouldDisplayFeature(req, paramName, false)).to
          .be.false
      })
      it('should return true when value is "true"', function () {
        req.query[paramName] = 'true'
        expect(this.FeatureFlag.shouldDisplayFeature(req, paramName, false)).to
          .be.true
      })
    })
  })
})
