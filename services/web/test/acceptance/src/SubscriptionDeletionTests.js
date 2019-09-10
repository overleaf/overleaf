const { expect } = require('chai')
const async = require('async')
const request = require('./helpers/request')
const User = require('./helpers/User')
const RecurlySubscription = require('./helpers/RecurlySubscription')
const SubscriptionUpdater = require('../../../app/src/Features/Subscription/SubscriptionUpdater')
require('./helpers/MockV1Api')

describe('Subscriptions', function() {
  describe('deletion', function() {
    beforeEach(function(done) {
      this.adminUser = new User()
      this.memberUser = new User()
      async.series(
        [
          cb => this.adminUser.ensureUserExists(cb),
          cb => this.memberUser.ensureUserExists(cb),
          cb => {
            this.recurlySubscription = new RecurlySubscription({
              adminId: this.adminUser._id,
              memberIds: [this.memberUser._id],
              invitedEmails: ['foo@bar.com'],
              teamInvites: [{ email: 'foo@baz.com' }],
              groupPlan: true,
              state: 'expired',
              planCode: 'professional'
            })
            this.subscription = this.recurlySubscription.subscription
            this.recurlySubscription.ensureExists(cb)
          },
          cb => this.subscription.refreshUsersFeatures(cb)
        ],
        done
      )
    })

    it('deletes via Recurly callback', function(done) {
      let url = '/user/subscription/callback'
      let body = this.recurlySubscription.buildCallbackXml()

      request.post({ url, body }, (error, { statusCode }) => {
        if (error) {
          return done(error)
        }
        expect(statusCode).to.equal(200)
        this.subscription.expectDeleted({ ip: '127.0.0.1' }, done)
      })
    })

    it('refresh features', function(done) {
      let url = '/user/subscription/callback'
      let body = this.recurlySubscription.buildCallbackXml()

      request.post({ url, body }, (error, { statusCode }) => {
        if (error) {
          return done(error)
        }
        this.memberUser.getFeatures((error, features) => {
          expect(features.collaborators).to.equal(1)
          done(error)
        })
      })
    })

    it('allows deletion when deletedSubscription exists', function(done) {
      let url = '/user/subscription/callback'
      let body = this.recurlySubscription.buildCallbackXml()

      // create fake deletedSubscription
      SubscriptionUpdater._createDeletedSubscription(
        this.subscription,
        {},
        error => {
          if (error) {
            return done(error)
          }

          // try deleting the subscription
          request.post({ url, body }, (error, { statusCode }) => {
            if (error) {
              return done(error)
            }
            expect(statusCode).to.equal(200)
            this.subscription.expectDeleted({ ip: '127.0.0.1' }, done)
          })
        }
      )
    })
  })
})
