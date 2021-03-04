const SandboxedModule = require('sandboxed-module')
const { expect } = require('chai')
const sinon = require('sinon')
const modulePath = '../../../../app/src/Features/Subscription/FeaturesUpdater'
const { ObjectId } = require('mongodb')

describe('FeaturesUpdater', function() {
  beforeEach(function() {
    this.user_id = ObjectId().toString()

    this.FeaturesUpdater = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        './UserFeaturesUpdater': (this.UserFeaturesUpdater = {}),
        './SubscriptionLocator': (this.SubscriptionLocator = {}),
        './PlansLocator': (this.PlansLocator = {}),
        'logger-sharelatex': {
          log() {},
          warn() {}
        },
        'settings-sharelatex': (this.Settings = {}),
        '../Referal/ReferalFeatures': (this.ReferalFeatures = {}),
        './V1SubscriptionManager': (this.V1SubscriptionManager = {}),
        '../Institutions/InstitutionsFeatures': (this.InstitutionsFeatures = {}),
        '../User/UserGetter': (this.UserGetter = {}),
        '../../infrastructure/Modules': (this.Modules = {
          hooks: { fire: sinon.stub() }
        })
      }
    })
  })

  describe('refreshFeatures', function() {
    beforeEach(function() {
      this.user = {
        _id: this.user_id,
        features: {}
      }
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
      this.UserGetter.getUser = sinon.stub().yields(null, this.user)
      this.callback = sinon.stub()
    })
    describe('normally', function() {
      beforeEach(function() {
        this.FeaturesUpdater.refreshFeatures(this.user_id, this.callback)
      })

      it('should get the individual features', function() {
        this.FeaturesUpdater._getIndividualFeatures
          .calledWith(this.user_id)
          .should.equal(true)
      })

      it('should get the group features', function() {
        this.FeaturesUpdater._getGroupFeatureSets
          .calledWith(this.user_id)
          .should.equal(true)
      })

      it('should get the institution features', function() {
        this.InstitutionsFeatures.getInstitutionsFeatures
          .calledWith(this.user_id)
          .should.equal(true)
      })

      it('should get the v1 features', function() {
        this.FeaturesUpdater._getV1Features
          .calledWith(this.user_id)
          .should.equal(true)
      })

      it('should get the bonus features', function() {
        this.ReferalFeatures.getBonusFeatures
          .calledWith(this.user_id)
          .should.equal(true)
      })

      it('should merge from the default features', function() {
        this.FeaturesUpdater._mergeFeatures
          .calledWith(this.Settings.defaultFeatures)
          .should.equal(true)
      })

      it('should merge the individual features', function() {
        this.FeaturesUpdater._mergeFeatures
          .calledWith(sinon.match.any, { individual: 'features' })
          .should.equal(true)
      })

      it('should merge the group features', function() {
        this.FeaturesUpdater._mergeFeatures
          .calledWith(sinon.match.any, { group: 'features' })
          .should.equal(true)
        this.FeaturesUpdater._mergeFeatures
          .calledWith(sinon.match.any, { group: 'features2' })
          .should.equal(true)
      })

      it('should merge the institutions features', function() {
        this.FeaturesUpdater._mergeFeatures
          .calledWith(sinon.match.any, { institutions: 'features' })
          .should.equal(true)
      })

      it('should merge the v1 features', function() {
        this.FeaturesUpdater._mergeFeatures
          .calledWith(sinon.match.any, { v1: 'features' })
          .should.equal(true)
      })

      it('should merge the bonus features', function() {
        this.FeaturesUpdater._mergeFeatures
          .calledWith(sinon.match.any, { bonus: 'features' })
          .should.equal(true)
      })

      it('should update the user with the merged features', function() {
        this.UserFeaturesUpdater.updateFeatures
          .calledWith(this.user_id, { merged: 'features' })
          .should.equal(true)
      })
    })
    describe('when losing dropbox feature', function() {
      beforeEach(function() {
        this.user = {
          _id: this.user_id,
          features: { dropbox: true }
        }
        this.UserGetter.getUser = sinon.stub().yields(null, this.user)
        this.FeaturesUpdater._mergeFeatures = sinon
          .stub()
          .returns({ dropbox: false })
        this.FeaturesUpdater.refreshFeatures(this.user_id, this.callback)
      })
      it('should fire module hook to unlink dropbox', function() {
        this.Modules.hooks.fire
          .calledWith('removeDropbox', this.user._id)
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
      expect(
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
      expect(
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
      expect(
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
      expect(
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

  describe('doSyncFromV1', function() {
    beforeEach(function() {
      this.v1UserId = 1
      this.user = {
        _id: this.user_id,
        email: 'user@example.com',
        overleaf: {
          id: this.v1UserId
        }
      }

      this.UserGetter.getUser = sinon.stub().callsArgWith(2, null, this.user)
      this.FeaturesUpdater.refreshFeatures = sinon.stub().yields(null)
      this.call = cb => {
        this.FeaturesUpdater.doSyncFromV1(this.v1UserId, cb)
      }
    })

    describe('when all goes well', function() {
      it('should call getUser', function(done) {
        this.call(() => {
          expect(this.UserGetter.getUser.callCount).to.equal(1)
          expect(
            this.UserGetter.getUser.calledWith({ 'overleaf.id': this.v1UserId })
          ).to.equal(true)
          done()
        })
      })

      it('should call refreshFeatures', function(done) {
        this.call(() => {
          expect(this.FeaturesUpdater.refreshFeatures.callCount).to.equal(1)
          expect(
            this.FeaturesUpdater.refreshFeatures.calledWith(this.user_id)
          ).to.equal(true)
          done()
        })
      })

      it('should not produce an error', function(done) {
        this.call(err => {
          expect(err).to.not.exist
          done()
        })
      })
    })

    describe('when getUser produces an error', function() {
      beforeEach(function() {
        this.UserGetter.getUser = sinon
          .stub()
          .callsArgWith(2, new Error('woops'))
      })

      it('should not call refreshFeatures', function() {
        expect(this.FeaturesUpdater.refreshFeatures.callCount).to.equal(0)
      })

      it('should produce an error', function(done) {
        this.call(err => {
          expect(err).to.exist
          done()
        })
      })
    })

    describe('when getUser does not find a user', function() {
      beforeEach(function() {
        this.UserGetter.getUser = sinon.stub().callsArgWith(2, null, null)
      })

      it('should not call refreshFeatures', function(done) {
        this.call(() => {
          expect(this.FeaturesUpdater.refreshFeatures.callCount).to.equal(0)
          done()
        })
      })

      it('should not produce an error', function(done) {
        this.call(err => {
          expect(err).to.not.exist
          done()
        })
      })
    })
  })
})
