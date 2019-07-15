/* eslint-disable
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const SandboxedModule = require('sandboxed-module')
const should = require('chai').should()
const { expect } = require('chai')
const sinon = require('sinon')
const modulePath = '../../../../app/src/Features/Subscription/FeaturesUpdater'
const { assert } = require('chai')
const { ObjectId } = require('mongoose').Types

describe('FeaturesUpdater', function() {
  beforeEach(function() {
    this.user_id = ObjectId().toString()

    return (this.FeaturesUpdater = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        './UserFeaturesUpdater': (this.UserFeaturesUpdater = {}),
        './SubscriptionLocator': (this.SubscriptionLocator = {}),
        './PlansLocator': (this.PlansLocator = {}),
        'logger-sharelatex': {
          log() {}
        },
        'settings-sharelatex': (this.Settings = {}),
        '../Referal/ReferalFeatures': (this.ReferalFeatures = {}),
        './V1SubscriptionManager': (this.V1SubscriptionManager = {}),
        '../Institutions/InstitutionsFeatures': (this.InstitutionsFeatures = {})
      }
    }))
  })

  describe('refreshFeatures', function() {
    beforeEach(function() {
      this.UserFeaturesUpdater.updateFeatures = sinon.stub().yields()
      this.FeaturesUpdater._getIndividualFeatures = sinon
        .stub()
        .yields(null, { individual: 'features' })
      this.FeaturesUpdater._getGroupFeatureSets = sinon
        .stub()
        .yields(null, [{ group: 'features' }, { group: 'features2' }])
      this.InstitutionsFeatures.getInstitutionsFeatures = sinon
        .stub()
        .yields(null, { institutions: 'features' })
      this.FeaturesUpdater._getV1Features = sinon
        .stub()
        .yields(null, { v1: 'features' })
      this.ReferalFeatures.getBonusFeatures = sinon
        .stub()
        .yields(null, { bonus: 'features' })
      this.FeaturesUpdater._mergeFeatures = sinon
        .stub()
        .returns({ merged: 'features' })
      return (this.callback = sinon.stub())
    })

    describe('normally', function() {
      beforeEach(function() {
        return this.FeaturesUpdater.refreshFeatures(this.user_id, this.callback)
      })

      it('should get the individual features', function() {
        return this.FeaturesUpdater._getIndividualFeatures
          .calledWith(this.user_id)
          .should.equal(true)
      })

      it('should get the group features', function() {
        return this.FeaturesUpdater._getGroupFeatureSets
          .calledWith(this.user_id)
          .should.equal(true)
      })

      it('should get the institution features', function() {
        return this.InstitutionsFeatures.getInstitutionsFeatures
          .calledWith(this.user_id)
          .should.equal(true)
      })

      it('should get the v1 features', function() {
        return this.FeaturesUpdater._getV1Features
          .calledWith(this.user_id)
          .should.equal(true)
      })

      it('should get the bonus features', function() {
        return this.ReferalFeatures.getBonusFeatures
          .calledWith(this.user_id)
          .should.equal(true)
      })

      it('should merge from the default features', function() {
        return this.FeaturesUpdater._mergeFeatures
          .calledWith(this.Settings.defaultFeatures)
          .should.equal(true)
      })

      it('should merge the individual features', function() {
        return this.FeaturesUpdater._mergeFeatures
          .calledWith(sinon.match.any, { individual: 'features' })
          .should.equal(true)
      })

      it('should merge the group features', function() {
        this.FeaturesUpdater._mergeFeatures
          .calledWith(sinon.match.any, { group: 'features' })
          .should.equal(true)
        return this.FeaturesUpdater._mergeFeatures
          .calledWith(sinon.match.any, { group: 'features2' })
          .should.equal(true)
      })

      it('should merge the institutions features', function() {
        return this.FeaturesUpdater._mergeFeatures
          .calledWith(sinon.match.any, { institutions: 'features' })
          .should.equal(true)
      })

      it('should merge the v1 features', function() {
        return this.FeaturesUpdater._mergeFeatures
          .calledWith(sinon.match.any, { v1: 'features' })
          .should.equal(true)
      })

      it('should merge the bonus features', function() {
        return this.FeaturesUpdater._mergeFeatures
          .calledWith(sinon.match.any, { bonus: 'features' })
          .should.equal(true)
      })

      it('should update the user with the merged features', function() {
        return this.UserFeaturesUpdater.updateFeatures
          .calledWith(this.user_id, { merged: 'features' })
          .should.equal(true)
      })
    })
  })

  describe('_mergeFeatures', function() {
    it('should prefer priority over standard for compileGroup', function() {
      expect(
        this.FeaturesUpdater._mergeFeatures(
          {
            compileGroup: 'priority'
          },
          {
            compileGroup: 'standard'
          }
        )
      ).to.deep.equal({
        compileGroup: 'priority'
      })
      expect(
        this.FeaturesUpdater._mergeFeatures(
          {
            compileGroup: 'standard'
          },
          {
            compileGroup: 'priority'
          }
        )
      ).to.deep.equal({
        compileGroup: 'priority'
      })
      expect(
        this.FeaturesUpdater._mergeFeatures(
          {
            compileGroup: 'priority'
          },
          {
            compileGroup: 'priority'
          }
        )
      ).to.deep.equal({
        compileGroup: 'priority'
      })
      return expect(
        this.FeaturesUpdater._mergeFeatures(
          {
            compileGroup: 'standard'
          },
          {
            compileGroup: 'standard'
          }
        )
      ).to.deep.equal({
        compileGroup: 'standard'
      })
    })

    it('should prefer -1 over any other for collaborators', function() {
      expect(
        this.FeaturesUpdater._mergeFeatures(
          {
            collaborators: -1
          },
          {
            collaborators: 10
          }
        )
      ).to.deep.equal({
        collaborators: -1
      })
      expect(
        this.FeaturesUpdater._mergeFeatures(
          {
            collaborators: 10
          },
          {
            collaborators: -1
          }
        )
      ).to.deep.equal({
        collaborators: -1
      })
      return expect(
        this.FeaturesUpdater._mergeFeatures(
          {
            collaborators: 4
          },
          {
            collaborators: 10
          }
        )
      ).to.deep.equal({
        collaborators: 10
      })
    })

    it('should prefer the higher of compileTimeout', function() {
      expect(
        this.FeaturesUpdater._mergeFeatures(
          {
            compileTimeout: 20
          },
          {
            compileTimeout: 10
          }
        )
      ).to.deep.equal({
        compileTimeout: 20
      })
      return expect(
        this.FeaturesUpdater._mergeFeatures(
          {
            compileTimeout: 10
          },
          {
            compileTimeout: 20
          }
        )
      ).to.deep.equal({
        compileTimeout: 20
      })
    })

    it('should prefer the true over false for other keys', function() {
      expect(
        this.FeaturesUpdater._mergeFeatures(
          {
            github: true
          },
          {
            github: false
          }
        )
      ).to.deep.equal({
        github: true
      })
      expect(
        this.FeaturesUpdater._mergeFeatures(
          {
            github: false
          },
          {
            github: true
          }
        )
      ).to.deep.equal({
        github: true
      })
      expect(
        this.FeaturesUpdater._mergeFeatures(
          {
            github: true
          },
          {
            github: true
          }
        )
      ).to.deep.equal({
        github: true
      })
      return expect(
        this.FeaturesUpdater._mergeFeatures(
          {
            github: false
          },
          {
            github: false
          }
        )
      ).to.deep.equal({
        github: false
      })
    })
  })
})
