const { expect } = require('chai')
const async = require('async')
const User = require('./helpers/User')
const Subscription = require('./helpers/Subscription')

describe('Subscriptions', function() {
  describe('features', function() {
    describe('individual subscriptions', function() {
      beforeEach(function(done) {
        this.adminUser = new User()
        async.series(
          [
            cb => this.adminUser.ensureUserExists(cb),
            cb => {
              this.subscription = new Subscription({
                adminId: this.adminUser._id,
                groupPlan: false,
                planCode: 'professional'
              })
              this.subscription.ensureExists(cb)
            },
            cb => this.subscription.refreshUsersFeatures(cb)
          ],
          done
        )
      })

      it('should give features to admin', function(done) {
        this.adminUser.getFeatures((error, features) => {
          expect(features.collaborators).to.equal(-1)
          done(error)
        })
      })
    })

    describe('group subscriptions', function() {
      beforeEach(function(done) {
        this.adminUser = new User()
        this.memberUser = new User()
        async.series(
          [
            cb => this.adminUser.ensureUserExists(cb),
            cb => this.memberUser.ensureUserExists(cb),
            cb => {
              this.subscription = new Subscription({
                adminId: this.adminUser._id,
                memberIds: [this.memberUser._id],
                groupPlan: true,
                planCode: 'professional'
              })
              this.subscription.ensureExists(cb)
            },
            cb => this.subscription.refreshUsersFeatures(cb)
          ],
          done
        )
      })

      it('should give features to member', function(done) {
        this.memberUser.getFeatures((error, features) => {
          expect(features.collaborators).to.equal(-1)
          done(error)
        })
      })

      it('should not give features to admin', function(done) {
        this.adminUser.getFeatures((error, features) => {
          expect(features.collaborators).to.equal(1)
          done(error)
        })
      })
    })
  })
})
