const { expect } = require('chai')
const async = require('async')
const request = require('./helpers/request')
const User = require('./helpers/User')
const RecurlySubscription = require('./helpers/RecurlySubscription')
const SubscriptionUpdater = require('../../../app/src/Features/Subscription/SubscriptionUpdater')
const Settings = require('settings-sharelatex')

describe('Subscriptions', function () {
  describe('deletion', function () {
    beforeEach(function (done) {
      this.adminUser = new User()
      this.memberUser = new User()
      this.auth = {
        user: Settings.apis.recurly.webhookUser,
        pass: Settings.apis.recurly.webhookPass,
        sendImmediately: true,
      }

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
              planCode: 'professional',
            })
            this.subscription = this.recurlySubscription.subscription
            this.recurlySubscription.ensureExists(cb)
          },
          cb => this.subscription.refreshUsersFeatures(cb),
        ],
        done
      )
    })

    it('should not allow unauthorized access to the Recurly callback', function (done) {
      const url = '/user/subscription/callback'
      const body = this.recurlySubscription.buildCallbackXml()

      request.post({ url, body }, (error, { statusCode }) => {
        if (error) {
          return done(error)
        }
        expect(statusCode).to.equal(401)
        done()
      })
    })

    it('deletes via Recurly callback', function (done) {
      const url = '/user/subscription/callback'
      const body = this.recurlySubscription.buildCallbackXml()

      request.post({ url, body, auth: this.auth }, (error, { statusCode }) => {
        if (error) {
          return done(error)
        }
        expect(statusCode).to.equal(200)
        this.subscription.expectDeleted({ ip: '127.0.0.1' }, done)
      })
    })

    it('refresh features', function (done) {
      const url = '/user/subscription/callback'
      const body = this.recurlySubscription.buildCallbackXml()

      request.post({ url, body, auth: this.auth }, (error, { statusCode }) => {
        if (error) {
          return done(error)
        }
        this.memberUser.getFeatures((error, features) => {
          expect(features.collaborators).to.equal(1)
          done(error)
        })
      })
    })

    it('allows deletion when deletedSubscription exists', function (done) {
      const url = '/user/subscription/callback'
      const body = this.recurlySubscription.buildCallbackXml()

      // create fake deletedSubscription
      SubscriptionUpdater.createDeletedSubscription(
        this.subscription,
        {},
        error => {
          if (error) {
            return done(error)
          }

          // try deleting the subscription
          request.post(
            { url, body, auth: this.auth },
            (error, { statusCode }) => {
              if (error) {
                return done(error)
              }
              expect(statusCode).to.equal(200)
              this.subscription.expectDeleted({ ip: '127.0.0.1' }, done)
            }
          )
        }
      )
    })
  })
})
