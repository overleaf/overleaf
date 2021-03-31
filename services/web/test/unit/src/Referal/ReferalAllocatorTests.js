const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Referal/ReferalAllocator.js'
)

describe('ReferalAllocator', function() {
  beforeEach(function() {
    this.ReferalAllocator = SandboxedModule.require(modulePath, {
      requires: {
        '../../models/User': {
          User: (this.User = {})
        },
        '../Subscription/FeaturesUpdater': (this.FeaturesUpdater = {}),
        'settings-sharelatex': (this.Settings = {})
      }
    })
    this.callback = sinon.stub()
    this.referal_id = 'referal-id-123'
    this.referal_medium = 'twitter'
    this.user_id = 'user-id-123'
    this.new_user_id = 'new-user-id-123'
    this.FeaturesUpdater.refreshFeatures = sinon.stub().yields()
    this.User.updateOne = sinon.stub().callsArgWith(3, null)
    this.User.findOne = sinon
      .stub()
      .callsArgWith(2, null, { _id: this.user_id })
  })

  describe('allocate', function() {
    describe('when the referal was a bonus referal', function() {
      beforeEach(function() {
        this.referal_source = 'bonus'
        this.ReferalAllocator.allocate(
          this.referal_id,
          this.new_user_id,
          this.referal_source,
          this.referal_medium,
          this.callback
        )
      })

      it('should update the referring user with the refered users id', function() {
        this.User.updateOne
          .calledWith(
            {
              referal_id: this.referal_id
            },
            {
              $push: {
                refered_users: this.new_user_id
              },
              $inc: {
                refered_user_count: 1
              }
            }
          )
          .should.equal(true)
      })

      it('find the referring users id', function() {
        this.User.findOne
          .calledWith({ referal_id: this.referal_id })
          .should.equal(true)
      })

      it("should refresh the user's subscription", function() {
        this.FeaturesUpdater.refreshFeatures
          .calledWith(this.user_id)
          .should.equal(true)
      })

      it('should call the callback', function() {
        this.callback.called.should.equal(true)
      })
    })

    describe('when there is no user for the referal id', function() {
      beforeEach(function() {
        this.referal_source = 'bonus'
        this.referal_id = 'wombat'
        this.User.findOne = sinon.stub().callsArgWith(2, null, null)
        this.ReferalAllocator.allocate(
          this.referal_id,
          this.new_user_id,
          this.referal_source,
          this.referal_medium,
          this.callback
        )
      })

      it('should find the referring users id', function() {
        this.User.findOne
          .calledWith({ referal_id: this.referal_id })
          .should.equal(true)
      })

      it('should not update the referring user with the refered users id', function() {
        this.User.updateOne.called.should.equal(false)
      })

      it('should not assign the user a bonus', function() {
        this.FeaturesUpdater.refreshFeatures.called.should.equal(false)
      })

      it('should call the callback', function() {
        this.callback.called.should.equal(true)
      })
    })

    describe('when the referal is not a bonus referal', function() {
      beforeEach(function() {
        this.referal_source = 'public_share'
        this.ReferalAllocator.allocate(
          this.referal_id,
          this.new_user_id,
          this.referal_source,
          this.referal_medium,
          this.callback
        )
      })

      it('should not update the referring user with the refered users id', function() {
        this.User.updateOne.called.should.equal(false)
      })

      it('find the referring users id', function() {
        this.User.findOne
          .calledWith({ referal_id: this.referal_id })
          .should.equal(true)
      })

      it('should not assign the user a bonus', function() {
        this.FeaturesUpdater.refreshFeatures.called.should.equal(false)
      })

      it('should call the callback', function() {
        this.callback.called.should.equal(true)
      })
    })
  })
})
