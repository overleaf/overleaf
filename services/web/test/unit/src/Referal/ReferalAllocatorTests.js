const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Referal/ReferalAllocator.js'
)

describe('ReferalAllocator', function () {
  beforeEach(function () {
    this.ReferalAllocator = SandboxedModule.require(modulePath, {
      requires: {
        '../../models/User': {
          User: (this.User = {}),
        },
        '../Subscription/FeaturesUpdater': (this.FeaturesUpdater = {}),
        '@overleaf/settings': (this.Settings = {}),
      },
    })
    this.referal_id = 'referal-id-123'
    this.referal_medium = 'twitter'
    this.user_id = 'user-id-123'
    this.new_user_id = 'new-user-id-123'
    this.FeaturesUpdater.promises = {
      refreshFeatures: sinon.stub().resolves(),
    }
    this.User.updateOne = sinon.stub().returns({
      exec: sinon.stub().resolves(),
    })
    this.User.findOne = sinon.stub().returns({
      exec: sinon.stub().resolves({ _id: this.user_id }),
    })
  })

  describe('allocate', function () {
    describe('when the referal was a bonus referal', function () {
      beforeEach(async function () {
        this.referal_source = 'bonus'
        await this.ReferalAllocator.promises.allocate(
          this.referal_id,
          this.new_user_id,
          this.referal_source,
          this.referal_medium
        )
      })

      it('should update the referring user with the refered users id', function () {
        this.User.updateOne
          .calledWith(
            {
              referal_id: this.referal_id,
            },
            {
              $push: {
                refered_users: this.new_user_id,
              },
              $inc: {
                refered_user_count: 1,
              },
            }
          )
          .should.equal(true)
      })

      it('find the referring users id', function () {
        this.User.findOne
          .calledWith({ referal_id: this.referal_id })
          .should.equal(true)
      })

      it("should refresh the user's subscription", function () {
        this.FeaturesUpdater.promises.refreshFeatures
          .calledWith(this.user_id)
          .should.equal(true)
      })
    })

    describe('when there is no user for the referal id', function () {
      beforeEach(async function () {
        this.referal_source = 'bonus'
        this.referal_id = 'wombat'
        this.User.findOne = sinon.stub().returns({
          exec: sinon.stub().resolves(null),
        })
        await this.ReferalAllocator.promises.allocate(
          this.referal_id,
          this.new_user_id,
          this.referal_source,
          this.referal_medium
        )
      })

      it('should find the referring users id', function () {
        this.User.findOne
          .calledWith({ referal_id: this.referal_id })
          .should.equal(true)
      })

      it('should not update the referring user with the refered users id', function () {
        this.User.updateOne.called.should.equal(false)
      })

      it('should not assign the user a bonus', function () {
        this.FeaturesUpdater.promises.refreshFeatures.called.should.equal(false)
      })
    })

    describe('when the referal is not a bonus referal', function () {
      beforeEach(async function () {
        this.referal_source = 'public_share'
        await this.ReferalAllocator.promises.allocate(
          this.referal_id,
          this.new_user_id,
          this.referal_source,
          this.referal_medium
        )
      })

      it('should not update the referring user with the refered users id', function () {
        this.User.updateOne.called.should.equal(false)
      })

      it('find the referring users id', function () {
        this.User.findOne
          .calledWith({ referal_id: this.referal_id })
          .should.equal(true)
      })

      it('should not assign the user a bonus', function () {
        this.FeaturesUpdater.promises.refreshFeatures.called.should.equal(false)
      })
    })
  })
})
