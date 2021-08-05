const SandboxedModule = require('sandboxed-module')
const { expect } = require('chai')
const sinon = require('sinon')
const modulePath =
  '../../../../app/src/Features/Subscription/UserFeaturesUpdater'

describe('UserFeaturesUpdater', function () {
  beforeEach(function () {
    this.User = { updateOne: sinon.stub().callsArgWith(2) }
    this.UserFeaturesUpdater = SandboxedModule.require(modulePath, {
      requires: {
        '../../models/User': {
          User: this.User,
        },
      },
    })
  })

  describe('updateFeatures', function () {
    it('should send the users features', function (done) {
      const userId = '5208dd34438842e2db000005'
      this.features = { versioning: true, collaborators: 10 }
      this.UserFeaturesUpdater.updateFeatures(
        userId,
        this.features,
        (err, features) => {
          const update = {
            'features.versioning': true,
            'features.collaborators': 10,
          }
          const updateArgs = this.User.updateOne.lastCall.args
          expect(updateArgs[0]).to.deep.equal({ _id: userId })
          expect(Object.keys(updateArgs[1]).length).to.equal(3)
          expect(updateArgs[1]['features.versioning']).to.equal(
            update['features.versioning']
          )
          expect(updateArgs[1]['features.collaborators']).to.equal(
            update['features.collaborators']
          )
          expect(updateArgs[1].featuresUpdatedAt instanceof Date).to.be.true
          features.should.deep.equal(this.features)
          done()
        }
      )
    })
  })

  describe('overrideFeatures', function () {
    it('should send the users features', function (done) {
      const userId = '5208dd34438842e2db000005'
      this.features = { versioning: true, collaborators: 10 }
      this.UserFeaturesUpdater.updateFeatures(
        userId,
        this.features,
        (err, features) => {
          const update = {
            'features.versioning': true,
            'features.collaborators': 10,
          }
          const updateArgs = this.User.updateOne.lastCall.args
          expect(updateArgs[0]).to.deep.equal({ _id: userId })
          expect(Object.keys(updateArgs[1]).length).to.equal(3)
          expect(updateArgs[1]['features.versioning']).to.equal(
            update['features.versioning']
          )
          expect(updateArgs[1]['features.collaborators']).to.equal(
            update['features.collaborators']
          )
          expect(updateArgs[1].featuresUpdatedAt instanceof Date).to.be.true
          features.should.deep.equal(this.features)
          done()
        }
      )
    })
  })
})
