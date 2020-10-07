const { expect } = require('chai')
const async = require('async')
const User = require('./helpers/User')
const request = require('./helpers/request')
const { db, ObjectId } = require('../../../app/src/infrastructure/mongodb')
const _ = require('underscore')

describe('UserOnboardingTests', function() {
  beforeEach(function(done) {
    // 2 new users
    this.user1 = new User()
    this.user2 = new User()
    // 1 older
    this.user3 = new User()
    this.user3._id = ObjectId('5d15fca20000000000000000')
    async.series(
      [
        cb => db.users.insert(this.user3, cb),
        this.user1.ensureUserExists.bind(this.user1),
        this.user2.ensureUserExists.bind(this.user2)
      ],
      done
    )
  })

  it('should send emails to the new users only', function(done) {
    request(
      {
        method: 'POST',
        url: '/user/onboarding_emails',
        auth: {
          username: 'sharelatex',
          password: 'password',
          sendImmediately: true
        }
      },
      (error, response, body) => {
        if (error != null) {
          throw error
        }
        // should have sent two emails to new users
        expect(response.statusCode).to.equal(200)
        expect(response.body).to.include(this.user1._id)
        expect(response.body).to.include(this.user2._id)
        expect(response.body).to.not.include(this.user3._id)

        // user 3 should still not have had an email sent
        const user3 = this.user3
        db.users
          .find({
            onboardingEmailSentAt: null
          })
          .toArray((error, users) => {
            if (error != null) {
              throw error
            }
            const ids = _.map(users, user => user._id.toString())
            expect(ids.length).to.equal(1)
            expect(ids).to.include(user3._id.toString())
            done()
          })
      }
    )
  })
})
