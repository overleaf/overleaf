const SandboxedModule = require('sandboxed-module')
const { expect } = require('chai')
const sinon = require('sinon')
const modulePath =
  '../../../../app/src/Features/Subscription/UserFeaturesUpdater'

describe('UserFeaturesUpdater', function () {
  beforeEach(function () {
    this.features = {
      collaborators: 6,
      dropbox: true,
      github: true,
      gitBridge: true,
      versioning: true,
      compileTimeout: 180,
      compileGroup: 'priority',
      references: true,
      templates: true,
      trackChanges: true,
      referencesSearch: true,
      zotero: true,
      mendeley: true,
      symbolPalette: true,
    }
    this.User = {
      findByIdAndUpdate: sinon.stub().returns({
        exec: sinon.stub().resolves({ features: this.features }),
      }),
    }
    this.UserFeaturesUpdater = SandboxedModule.require(modulePath, {
      requires: {
        '../../models/User': {
          User: this.User,
        },
        '@overleaf/settings': (this.Settings = {}),
      },
    })
  })

  describe('updateFeatures', function () {
    it('should send the users features', async function () {
      const userId = '5208dd34438842e2db000005'
      const update = {
        versioning: true,
        collaborators: 10,
      }

      const { features } =
        await this.UserFeaturesUpdater.promises.updateFeatures(userId, update)

      const updateArgs = this.User.findByIdAndUpdate.lastCall.args
      expect(updateArgs[0]).to.deep.equal(userId)
      expect(Object.keys(updateArgs[1]).length).to.equal(3)
      expect(updateArgs[1]['features.versioning']).to.equal(update.versioning)
      expect(updateArgs[1]['features.collaborators']).to.equal(
        update.collaborators
      )
      expect(updateArgs[1].featuresUpdatedAt instanceof Date).to.be.true
      features.should.deep.equal(update)
      expect(updateArgs[1].featuresEpoch).to.be.undefined
    })

    it('should set the featuresEpoch when present', async function () {
      const userId = '5208dd34438842e2db000005'
      const update = {
        versioning: true,
      }
      this.Settings.featuresEpoch = 'epoch-1'
      const { features } =
        await this.UserFeaturesUpdater.promises.updateFeatures(userId, update)

      const updateArgs = this.User.findByIdAndUpdate.lastCall.args
      expect(updateArgs[0]).to.deep.equal(userId)
      expect(Object.keys(updateArgs[1]).length).to.equal(3)
      expect(updateArgs[1]['features.versioning']).to.equal(update.versioning)
      expect(updateArgs[1].featuresUpdatedAt instanceof Date).to.be.true
      features.should.deep.equal(update)
      expect(updateArgs[1].featuresEpoch).to.equal('epoch-1')
    })
  })

  describe('overrideFeatures', function () {
    it('should send the users features', async function () {
      const userId = '5208dd34438842e2db000005'
      const update = Object.assign({}, { mendeley: !this.features.mendeley })
      const featuresChanged =
        await this.UserFeaturesUpdater.promises.overrideFeatures(userId, update)

      const updateArgs = this.User.findByIdAndUpdate.lastCall.args
      expect(updateArgs[0]).to.equal(userId)
      expect(Object.keys(updateArgs[1]).length).to.equal(2)
      expect(updateArgs[1].features).to.deep.equal(update)
      expect(updateArgs[1].featuresUpdatedAt instanceof Date).to.be.true
      featuresChanged.should.equal(true)
    })
  })
})
