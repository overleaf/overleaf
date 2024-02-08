const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Referal/ReferalFeatures.js'
)

describe('ReferalFeatures', function () {
  beforeEach(function () {
    this.ReferalFeatures = SandboxedModule.require(modulePath, {
      requires: {
        '../../models/User': {
          User: (this.User = {}),
        },
        '@overleaf/settings': (this.Settings = {}),
      },
    })
    this.referal_id = 'referal-id-123'
    this.referal_medium = 'twitter'
    this.user_id = 'user-id-123'
    this.new_user_id = 'new-user-id-123'
  })

  describe('getBonusFeatures', function () {
    beforeEach(async function () {
      this.refered_user_count = 3
      this.Settings.bonus_features = {
        3: {
          collaborators: 3,
          dropbox: false,
          versioning: false,
        },
      }
      const stubbedUser = {
        refered_user_count: this.refered_user_count,
        features: { collaborators: 1, dropbox: false, versioning: false },
      }

      this.User.findOne = sinon.stub().returns({
        exec: sinon.stub().resolves(stubbedUser),
      })
      this.features = await this.ReferalFeatures.promises.getBonusFeatures(
        this.user_id
      )
    })

    it('should get the users number of refered user', function () {
      this.User.findOne.calledWith({ _id: this.user_id }).should.equal(true)
    })

    it('should return the features', function () {
      expect(this.features).to.equal(this.Settings.bonus_features[3])
    })
  })

  describe('when the user is not at a bonus level', function () {
    beforeEach(async function () {
      this.refered_user_count = 0
      this.Settings.bonus_features = {
        1: {
          collaborators: 3,
          dropbox: false,
          versioning: false,
        },
      }
      this.User.findOne = sinon.stub().returns({
        exec: sinon
          .stub()
          .resolves({ refered_user_count: this.refered_user_count }),
      })

      this.features = await this.ReferalFeatures.promises.getBonusFeatures(
        this.user_id
      )
    })

    it('should get the users number of refered user', function () {
      this.User.findOne.calledWith({ _id: this.user_id }).should.equal(true)
    })

    it('should return an empty feature set', function () {
      expect(this.features).to.be.empty
    })
  })
})
