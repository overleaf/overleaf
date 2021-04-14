const { expect } = require('chai')
const async = require('async')
const User = require('./helpers/User')
const RecurlySubscription = require('./helpers/RecurlySubscription')

describe('Subscriptions', function () {
  describe('update', function () {
    beforeEach(function (done) {
      this.recurlyUser = new User()
      async.series(
        [
          cb => this.recurlyUser.ensureUserExists(cb),
          cb => {
            this.recurlySubscription = new RecurlySubscription({
              adminId: this.recurlyUser._id,
              account: {
                email: 'stale-recurly@email.com'
              }
            })
            this.recurlySubscription.ensureExists(cb)
          },
          cb => this.recurlyUser.login(cb)
        ],
        done
      )
    })

    it('updates the email address for the account', function (done) {
      let url = '/user/subscription/account/email'

      this.recurlyUser.request.post({ url }, (error, { statusCode }) => {
        if (error) {
          return done(error)
        }
        expect(statusCode).to.equal(200)
        expect(this.recurlyUser.email).to.equal(
          this.recurlySubscription.account.email
        )
        done()
      })
    })
  })
})
