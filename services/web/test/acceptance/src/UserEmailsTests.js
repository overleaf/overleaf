const { expect } = require('chai')
const async = require('async')
const moment = require('moment')
const Features = require('../../../app/src/infrastructure/Features')
const User = require('./helpers/User')
const UserHelper = require('./helpers/UserHelper')
const UserUpdater = require('../../../app/src/Features/User/UserUpdater')
const { db, ObjectId } = require('../../../app/src/infrastructure/mongodb')
const MockV1ApiClass = require('./mocks/MockV1Api')
const expectErrorResponse = require('./helpers/expectErrorResponse')

let MockV1Api

before(function () {
  MockV1Api = MockV1ApiClass.instance()
})

describe('UserEmails', function () {
  beforeEach(function (done) {
    this.timeout(20000)
    this.user = new User()
    this.user.login(done)
  })

  describe('confirming an email', function () {
    it('should confirm the email', function (done) {
      let token = null
      async.series(
        [
          cb => {
            this.user.request(
              {
                method: 'POST',
                url: '/user/emails',
                json: {
                  email: 'newly-added-email@example.com',
                },
              },
              (error, response, body) => {
                expect(error).to.not.exist
                expect(response.statusCode).to.equal(204)
                cb()
              }
            )
          },
          cb => {
            this.user.request(
              { url: '/user/emails', json: true },
              (error, response, body) => {
                expect(error).to.not.exist
                expect(response.statusCode).to.equal(200)
                expect(body[0].confirmedAt).to.not.exist
                expect(body[0].reconfirmedAt).to.not.exist
                expect(body[1].confirmedAt).to.not.exist
                expect(body[1].reconfirmedAt).to.not.exist
                cb()
              }
            )
          },
          cb => {
            db.tokens
              .find({
                use: 'email_confirmation',
                'data.user_id': this.user._id,
                usedAt: { $exists: false },
              })
              .toArray((error, tokens) => {
                expect(error).to.not.exist
                // There should only be one confirmation token at the moment
                expect(tokens.length).to.equal(1)
                expect(tokens[0].data.email).to.equal(
                  'newly-added-email@example.com'
                )
                expect(tokens[0].data.user_id).to.equal(this.user._id)
                ;({ token } = tokens[0])
                cb()
              })
          },
          cb => {
            this.user.request(
              {
                method: 'POST',
                url: '/user/emails/confirm',
                json: {
                  token,
                },
              },
              (error, response, body) => {
                expect(error).to.not.exist
                expect(response.statusCode).to.equal(200)
                cb()
              }
            )
          },
          cb => {
            this.user.request(
              { url: '/user/emails', json: true },
              (error, response, body) => {
                expect(error).to.not.exist
                expect(response.statusCode).to.equal(200)
                expect(body[0].confirmedAt).to.not.exist
                expect(body[0].reconfirmedAt).to.not.exist
                expect(body[1].confirmedAt).to.exist
                expect(body[1].reconfirmedAt).to.exist
                expect(body[1].reconfirmedAt).to.deep.equal(body[1].confirmedAt)
                cb()
              }
            )
          },
          cb => {
            db.tokens
              .find({
                use: 'email_confirmation',
                'data.user_id': this.user._id,
                usedAt: { $exists: false },
              })
              .toArray((error, tokens) => {
                expect(error).to.not.exist
                // Token should be deleted after use
                expect(tokens.length).to.equal(0)
                cb()
              })
          },
        ],
        done
      )
    })

    it('should not allow confirmation of the email if the user has changed', function (done) {
      let token1 = null
      let token2 = null
      this.user2 = new User()
      this.email = 'duplicate-email@example.com'
      async.series(
        [
          cb => this.user2.login(cb),
          cb => {
            // Create email for first user
            this.user.request(
              {
                method: 'POST',
                url: '/user/emails',
                json: { email: this.email },
              },
              cb
            )
          },
          cb => {
            db.tokens
              .find({
                use: 'email_confirmation',
                'data.user_id': this.user._id,
                usedAt: { $exists: false },
              })
              .toArray((error, tokens) => {
                expect(error).to.not.exist
                // There should only be one confirmation token at the moment
                expect(tokens.length).to.equal(1)
                expect(tokens[0].data.email).to.equal(this.email)
                expect(tokens[0].data.user_id).to.equal(this.user._id)
                token1 = tokens[0].token
                cb()
              })
          },
          cb => {
            // Delete the email from the first user
            this.user.request(
              {
                method: 'POST',
                url: '/user/emails/delete',
                json: { email: this.email },
              },
              cb
            )
          },
          cb => {
            // Create email for second user
            this.user2.request(
              {
                method: 'POST',
                url: '/user/emails',
                json: { email: this.email },
              },
              cb
            )
          },
          cb => {
            // Original confirmation token should no longer work
            this.user.request(
              {
                method: 'POST',
                url: '/user/emails/confirm',
                json: {
                  token: token1,
                },
              },
              (error, response, body) => {
                expect(error).to.not.exist
                expect(response.statusCode).to.equal(404)
                cb()
              }
            )
          },
          cb => {
            db.tokens
              .find({
                use: 'email_confirmation',
                'data.user_id': this.user2._id,
                usedAt: { $exists: false },
              })
              .toArray((error, tokens) => {
                expect(error).to.not.exist
                // The first token has been used, so this should be token2 now
                expect(tokens.length).to.equal(1)
                expect(tokens[0].data.email).to.equal(this.email)
                expect(tokens[0].data.user_id).to.equal(this.user2._id)
                token2 = tokens[0].token
                cb()
              })
          },
          cb => {
            // Second user should be able to confirm the email
            this.user2.request(
              {
                method: 'POST',
                url: '/user/emails/confirm',
                json: {
                  token: token2,
                },
              },
              (error, response, body) => {
                expect(error).to.not.exist
                expect(response.statusCode).to.equal(200)
                cb()
              }
            )
          },
          cb => {
            this.user2.request(
              { url: '/user/emails', json: true },
              (error, response, body) => {
                expect(error).to.not.exist
                expect(response.statusCode).to.equal(200)
                expect(body[0].confirmedAt).to.not.exist
                expect(body[1].confirmedAt).to.exist
                cb()
              }
            )
          },
        ],
        done
      )
    })
  })

  describe('reconfirm an email', function () {
    let email, userHelper, confirmedAtDate
    beforeEach(async function () {
      userHelper = new UserHelper()
      email = userHelper.getDefaultEmail()
      userHelper = await UserHelper.createUser({ email })
      userHelper = await UserHelper.loginUser({
        email,
        password: userHelper.getDefaultPassword(),
      })
      // original confirmation
      await userHelper.confirmEmail(userHelper.user._id, email)
      const user = (await UserHelper.getUser({ email })).user
      confirmedAtDate = user.emails[0].confirmedAt
      expect(user.emails[0].confirmedAt).to.exist
      expect(user.emails[0].reconfirmedAt).to.exist
    })
    it('should set reconfirmedAt and not reset confirmedAt', async function () {
      await userHelper.confirmEmail(userHelper.user._id, email)
      const user = (await UserHelper.getUser({ email })).user
      expect(user.emails[0].confirmedAt).to.exist
      expect(user.emails[0].reconfirmedAt).to.exist
      expect(user.emails[0].confirmedAt).to.deep.equal(confirmedAtDate)
      expect(user.emails[0].reconfirmedAt).to.not.deep.equal(
        user.emails[0].confirmedAt
      )
      expect(user.emails[0].reconfirmedAt > user.emails[0].confirmedAt).to.be
        .true
    })
  })

  describe('with an expired token', function () {
    it('should not confirm the email', function (done) {
      let token = null
      async.series(
        [
          cb => {
            this.user.request(
              {
                method: 'POST',
                url: '/user/emails',
                json: {
                  email: (this.email = 'expired-token-email@example.com'),
                },
              },
              (error, response, body) => {
                expect(error).to.not.exist
                expect(response.statusCode).to.equal(204)
                cb()
              }
            )
          },
          cb => {
            db.tokens
              .find({
                use: 'email_confirmation',
                'data.user_id': this.user._id,
                usedAt: { $exists: false },
              })
              .toArray((error, tokens) => {
                expect(error).to.not.exist
                // There should only be one confirmation token at the moment
                expect(tokens.length).to.equal(1)
                expect(tokens[0].data.email).to.equal(this.email)
                expect(tokens[0].data.user_id).to.equal(this.user._id)
                ;({ token } = tokens[0])
                cb()
              })
          },
          cb => {
            db.tokens.update(
              {
                token,
              },
              {
                $set: {
                  expiresAt: new Date(Date.now() - 1000000),
                },
              },
              cb
            )
          },
          cb => {
            this.user.request(
              {
                method: 'POST',
                url: '/user/emails/confirm',
                json: {
                  token,
                },
              },
              (error, response, body) => {
                expect(error).to.not.exist
                expect(response.statusCode).to.equal(404)
                cb()
              }
            )
          },
        ],
        done
      )
    })
  })

  describe('resending the confirmation', function () {
    it('should generate a new token', function (done) {
      async.series(
        [
          cb => {
            this.user.request(
              {
                method: 'POST',
                url: '/user/emails',
                json: {
                  email: 'reconfirmation-email@example.com',
                },
              },
              (error, response, body) => {
                expect(error).to.not.exist
                expect(response.statusCode).to.equal(204)
                cb()
              }
            )
          },
          cb => {
            db.tokens
              .find({
                use: 'email_confirmation',
                'data.user_id': this.user._id,
                usedAt: { $exists: false },
              })
              .toArray((error, tokens) => {
                expect(error).to.not.exist
                // There should only be one confirmation token at the moment
                expect(tokens.length).to.equal(1)
                expect(tokens[0].data.email).to.equal(
                  'reconfirmation-email@example.com'
                )
                expect(tokens[0].data.user_id).to.equal(this.user._id)
                cb()
              })
          },
          cb => {
            this.user.request(
              {
                method: 'POST',
                url: '/user/emails/resend_confirmation',
                json: {
                  email: 'reconfirmation-email@example.com',
                },
              },
              (error, response, body) => {
                expect(error).to.not.exist
                expect(response.statusCode).to.equal(200)
                cb()
              }
            )
          },
          cb => {
            db.tokens
              .find({
                use: 'email_confirmation',
                'data.user_id': this.user._id,
                usedAt: { $exists: false },
              })
              .toArray((error, tokens) => {
                expect(error).to.not.exist
                // There should be two tokens now
                expect(tokens.length).to.equal(2)
                expect(tokens[0].data.email).to.equal(
                  'reconfirmation-email@example.com'
                )
                expect(tokens[0].data.user_id).to.equal(this.user._id)
                expect(tokens[1].data.email).to.equal(
                  'reconfirmation-email@example.com'
                )
                expect(tokens[1].data.user_id).to.equal(this.user._id)
                cb()
              })
          },
        ],
        done
      )
    })

    it('should create a new token if none exists', function (done) {
      // This should only be for users that have sign up with their main
      // emails before the confirmation system existed
      async.series(
        [
          cb => {
            db.tokens.remove(
              {
                use: 'email_confirmation',
                'data.user_id': this.user._id,
                usedAt: { $exists: false },
              },
              cb
            )
          },
          cb => {
            this.user.request(
              {
                method: 'POST',
                url: '/user/emails/resend_confirmation',
                json: {
                  email: this.user.email,
                },
              },
              (error, response, body) => {
                expect(error).to.not.exist
                expect(response.statusCode).to.equal(200)
                cb()
              }
            )
          },
          cb => {
            db.tokens
              .find({
                use: 'email_confirmation',
                'data.user_id': this.user._id,
                usedAt: { $exists: false },
              })
              .toArray((error, tokens) => {
                expect(error).to.not.exist
                // There should still only be one confirmation token
                expect(tokens.length).to.equal(1)
                expect(tokens[0].data.email).to.equal(this.user.email)
                expect(tokens[0].data.user_id).to.equal(this.user._id)
                cb()
              })
          },
        ],
        done
      )
    })

    it("should not allow reconfirmation if the email doesn't match the user", function (done) {
      async.series(
        [
          cb => {
            this.user.request(
              {
                method: 'POST',
                url: '/user/emails/resend_confirmation',
                json: {
                  email: 'non-matching-email@example.com',
                },
              },
              (error, response, body) => {
                expect(error).to.not.exist
                expect(response.statusCode).to.equal(422)
                cb()
              }
            )
          },
          cb => {
            db.tokens
              .find({
                use: 'email_confirmation',
                'data.user_id': this.user._id,
                usedAt: { $exists: false },
              })
              .toArray((error, tokens) => {
                expect(error).to.not.exist
                expect(tokens.length).to.equal(0)
                cb()
              })
          },
        ],
        done
      )
    })
  })

  describe('setting a default email', function () {
    it('should update confirmed emails for users not in v1', function (done) {
      async.series(
        [
          cb => {
            this.user.request(
              {
                method: 'POST',
                url: '/user/emails',
                json: {
                  email: 'new-confirmed-default@example.com',
                },
              },
              (error, response, body) => {
                expect(error).to.not.exist
                expect(response.statusCode).to.equal(204)
                cb()
              }
            )
          },
          cb => {
            // Mark the email as confirmed
            db.users.updateOne(
              {
                'emails.email': 'new-confirmed-default@example.com',
              },
              {
                $set: {
                  'emails.$.confirmedAt': new Date(),
                },
              },
              cb
            )
          },
          cb => {
            this.user.request(
              {
                method: 'POST',
                url: '/user/emails/default',
                json: {
                  email: 'new-confirmed-default@example.com',
                },
              },
              (error, response, body) => {
                expect(error).to.not.exist
                expect(response.statusCode).to.equal(200)
                cb()
              }
            )
          },
          cb => {
            this.user.request(
              { url: '/user/emails', json: true },
              (error, response, body) => {
                expect(error).to.not.exist
                expect(response.statusCode).to.equal(200)
                expect(body[0].confirmedAt).to.not.exist
                expect(body[0].default).to.equal(false)
                expect(body[1].confirmedAt).to.exist
                expect(body[1].default).to.equal(true)
                cb()
              }
            )
          },
        ],
        done
      )
    })

    it('should not allow changing unconfirmed emails in v1', function (done) {
      async.series(
        [
          cb => {
            db.users.updateOne(
              {
                _id: ObjectId(this.user._id),
              },
              {
                $set: {
                  'overleaf.id': 42,
                },
              },
              cb
            )
          },
          cb => {
            this.user.request(
              {
                method: 'POST',
                url: '/user/emails',
                json: {
                  email: 'new-unconfirmed-default@example.com',
                },
              },
              (error, response, body) => {
                expect(error).to.not.exist
                expect(response.statusCode).to.equal(204)
                cb()
              }
            )
          },
          cb => {
            this.user.request(
              {
                method: 'POST',
                url: '/user/emails/default',
                json: {
                  email: 'new-unconfirmed-default@example.com',
                },
              },
              (error, response, body) => {
                expect(error).to.not.exist
                expect(response.statusCode).to.equal(409)
                cb()
              }
            )
          },
          cb => {
            this.user.request(
              { url: '/user/emails', json: true },
              (error, response, body) => {
                expect(error).to.not.exist
                expect(body[0].default).to.equal(true)
                expect(body[1].default).to.equal(false)
                cb()
              }
            )
          },
        ],
        done
      )
    })

    it('should not update the email in v1', function (done) {
      async.series(
        [
          cb => {
            db.users.updateOne(
              {
                _id: ObjectId(this.user._id),
              },
              {
                $set: {
                  'overleaf.id': 42,
                },
              },
              cb
            )
          },
          cb => {
            this.user.request(
              {
                method: 'POST',
                url: '/user/emails',
                json: {
                  email: 'new-confirmed-default-in-v1@example.com',
                },
              },
              (error, response, body) => {
                expect(error).to.not.exist
                expect(response.statusCode).to.equal(204)
                cb()
              }
            )
          },
          cb => {
            // Mark the email as confirmed
            db.users.updateOne(
              {
                'emails.email': 'new-confirmed-default-in-v1@example.com',
              },
              {
                $set: {
                  'emails.$.confirmedAt': new Date(),
                },
              },
              cb
            )
          },
          cb => {
            this.user.request(
              {
                method: 'POST',
                url: '/user/emails/default',
                json: {
                  email: 'new-confirmed-default-in-v1@example.com',
                },
              },
              (error, response, body) => {
                expect(error).to.not.exist
                expect(response.statusCode).to.equal(200)
                cb()
              }
            )
          },
        ],
        error => {
          expect(error).to.not.exist
          expect(MockV1Api.updateEmail.callCount).to.equal(0)
          done()
        }
      )
    })

    it('should not return an error if the email exists in v1', function (done) {
      MockV1Api.existingEmails.push('exists-in-v1@example.com')
      async.series(
        [
          cb => {
            db.users.updateOne(
              {
                _id: ObjectId(this.user._id),
              },
              {
                $set: {
                  'overleaf.id': 42,
                },
              },
              cb
            )
          },
          cb => {
            this.user.request(
              {
                method: 'POST',
                url: '/user/emails',
                json: {
                  email: 'exists-in-v1@example.com',
                },
              },
              (error, response, body) => {
                expect(error).to.not.exist
                expect(response.statusCode).to.equal(204)
                cb()
              }
            )
          },
          cb => {
            // Mark the email as confirmed
            db.users.updateOne(
              {
                'emails.email': 'exists-in-v1@example.com',
              },
              {
                $set: {
                  'emails.$.confirmedAt': new Date(),
                },
              },
              cb
            )
          },
          cb => {
            this.user.request(
              {
                method: 'POST',
                url: '/user/emails/default',
                json: {
                  email: 'exists-in-v1@example.com',
                },
              },
              (error, response, body) => {
                expect(error).to.not.exist
                expect(response.statusCode).to.equal(200)
                cb()
              }
            )
          },
          cb => {
            this.user.request(
              { url: '/user/emails', json: true },
              (error, response, body) => {
                expect(error).to.not.exist
                expect(body[0].default).to.equal(false)
                expect(body[1].default).to.equal(true)
                cb()
              }
            )
          },
        ],
        done
      )
    })

    describe('audit log', function () {
      const originalEmail = 'original@overleaf.com'
      let otherEmail, response, userHelper, user, userId
      beforeEach(async function () {
        otherEmail = 'other@overleaf.com'
        userHelper = new UserHelper()
        userHelper = await UserHelper.createUser({
          email: originalEmail,
        })
        userHelper = await UserHelper.loginUser({
          email: originalEmail,
          password: userHelper.getDefaultPassword(),
        })
        userId = userHelper.user._id
        response = await userHelper.request.post({
          form: {
            email: otherEmail,
          },
          simple: false,
          uri: '/user/emails',
        })
        expect(response.statusCode).to.equal(204)
        const token = (
          await db.tokens.findOne({
            'data.user_id': userId.toString(),
            'data.email': otherEmail,
          })
        ).token
        response = await userHelper.request.post(`/user/emails/confirm`, {
          form: {
            token,
          },
          simple: false,
        })
        expect(response.statusCode).to.equal(200)
        response = await userHelper.request.post('/user/emails/default', {
          form: {
            email: otherEmail,
          },
          simple: false,
        })
        expect(response.statusCode).to.equal(200)
        userHelper = await UserHelper.getUser(userId)
        user = userHelper.user
      })
      it('should be updated', function () {
        const auditLog = userHelper.getAuditLogWithoutNoise()
        const entry = auditLog[auditLog.length - 1]
        expect(typeof entry.initiatorId).to.equal('object')
        expect(entry.initiatorId).to.deep.equal(user._id)
        expect(entry.ipAddress).to.equal('127.0.0.1')
        expect(entry.info).to.deep.equal({
          newPrimaryEmail: otherEmail,
          oldPrimaryEmail: originalEmail,
        })
      })
    })

    describe('session cleanup', function () {
      beforeEach(function setupSecondSession(done) {
        this.userSession2 = new User()
        this.userSession2.email = this.user.email
        this.userSession2.emails = this.user.emails
        this.userSession2.password = this.user.password
        // login before adding the new email address
        // User.login() performs a mongo update and resets the .emails field.
        this.userSession2.login(done)
      })

      beforeEach(function checkSecondSessionLiveness(done) {
        this.userSession2.request(
          { method: 'GET', url: '/project', followRedirect: false },
          (error, response) => {
            expect(error).to.not.exist
            expect(response.statusCode).to.equal(200)
            done()
          }
        )
      })

      beforeEach(function addSecondaryEmail(done) {
        this.user.request(
          {
            method: 'POST',
            url: '/user/emails',
            json: { email: 'new-confirmed-default@example.com' },
          },
          (error, response) => {
            expect(error).to.not.exist
            expect(response.statusCode).to.equal(204)
            done()
          }
        )
      })

      beforeEach(function confirmSecondaryEmail(done) {
        db.users.updateOne(
          { 'emails.email': 'new-confirmed-default@example.com' },
          { $set: { 'emails.$.confirmedAt': new Date() } },
          done
        )
      })

      beforeEach(function setDefault(done) {
        this.user.request(
          {
            method: 'POST',
            url: '/user/emails/default',
            json: { email: 'new-confirmed-default@example.com' },
          },
          (error, response) => {
            expect(error).to.not.exist
            expect(response.statusCode).to.equal(200)
            done()
          }
        )
      })

      it('should logout the other sessions', function (done) {
        this.userSession2.request(
          { method: 'GET', url: '/project', followRedirect: false },
          (error, response) => {
            expect(error).to.not.exist
            expect(response.statusCode).to.equal(302)
            expect(response.headers)
              .to.have.property('location')
              .to.match(new RegExp('^/login'))
            done()
          }
        )
      })
    })
  })

  describe('when not logged in', function () {
    beforeEach(function (done) {
      this.anonymous = new User()
      this.anonymous.getCsrfToken(done)
    })
    it('should return a plain 403 when setting the email', function (done) {
      this.anonymous.request(
        {
          method: 'POST',
          url: '/user/emails',
          json: {
            email: 'newly-added-email@example.com',
          },
        },
        (error, response, body) => {
          if (error) {
            return done(error)
          }
          expectErrorResponse.requireLogin.json(response, body)
          done()
        }
      )
    })
  })

  describe('secondary email', function () {
    let newEmail, userHelper, userId, user
    beforeEach(async function () {
      newEmail = 'a-new-email@overleaf.com'
      userHelper = new UserHelper()
      userHelper = await UserHelper.createUser()
      userHelper = await UserHelper.loginUser({
        email: userHelper.getDefaultEmail(),
        password: userHelper.getDefaultPassword(),
      })
      userId = userHelper.user._id
      await userHelper.request.post({
        form: {
          email: newEmail,
        },
        simple: false,
        uri: '/user/emails',
      })
      userHelper = await UserHelper.getUser(userId)
      user = userHelper.user
    })
    it('should add the email', async function () {
      expect(user.emails[1].email).to.equal(newEmail)
    })
    it('should add to the user audit log', async function () {
      const auditLog = userHelper.getAuditLogWithoutNoise()
      expect(typeof auditLog[0].initiatorId).to.equal('object')
      expect(auditLog[0].initiatorId).to.deep.equal(user._id)
      expect(auditLog[0].info.newSecondaryEmail).to.equal(newEmail)
      expect(auditLog[0].ip).to.equal(this.user.request.ip)
    })
  })

  describe('notification period', function () {
    let defaultEmail, userHelper, email1, email2, email3
    const maxConfirmationMonths = 12
    const lastDayToReconfirm = moment()
      .subtract(maxConfirmationMonths, 'months')
      .toDate()
    const oneDayBeforeLastDayToReconfirm = moment(lastDayToReconfirm)
      .add(1, 'day')
      .toDate()
    const daysToBackdate = moment().diff(oneDayBeforeLastDayToReconfirm, 'day')
    const daysToBackdateForAfterDate = daysToBackdate + 1

    beforeEach(async function () {
      if (!Features.hasFeature('affiliations')) {
        this.skip()
      }
      userHelper = new UserHelper()
      defaultEmail = userHelper.getDefaultEmail()
      userHelper = await UserHelper.createUser({ email: defaultEmail })
      userHelper = await UserHelper.loginUser({
        email: defaultEmail,
        password: userHelper.getDefaultPassword(),
      })
      const institutionId = MockV1Api.createInstitution({
        commonsAccount: true,
        ssoEnabled: false,
        maxConfirmationMonths,
      })
      const domain = 'example-affiliation.com'
      MockV1Api.addInstitutionDomain(institutionId, domain, { confirmed: true })

      email1 = `leonard@${domain}`
      email2 = `mccoy@${domain}`
      email3 = `bones@${domain}`
    })

    describe('non SSO affiliations', function () {
      beforeEach(async function () {
        // create a user with 3 affiliations at the institution.
        // all are within in the notification period
        const userId = userHelper.user._id
        await userHelper.addEmailAndConfirm(userId, email1)
        await userHelper.addEmailAndConfirm(userId, email2)
        await userHelper.addEmailAndConfirm(userId, email3)
        await userHelper.backdateConfirmation(userId, email1, daysToBackdate)
        await userHelper.backdateConfirmation(userId, email2, daysToBackdate)
        await userHelper.backdateConfirmation(
          userId,
          email3,
          daysToBackdateForAfterDate
        )
      })

      describe('when all affiliations in notification period or past reconfirm date', function () {
        it('should flag inReconfirmNotificationPeriod for all affiliations in period', async function () {
          const response = await userHelper.request.get('/user/emails')
          expect(response.statusCode).to.equal(200)
          const fullEmails = JSON.parse(response.body)
          expect(fullEmails.length).to.equal(4)
          expect(fullEmails[0].affiliation).to.not.exist
          expect(
            fullEmails[1].affiliation.inReconfirmNotificationPeriod
          ).to.equal(true)
          expect(
            fullEmails[2].affiliation.inReconfirmNotificationPeriod
          ).to.equal(true)
          expect(
            fullEmails[3].affiliation.inReconfirmNotificationPeriod
          ).to.equal(true)
        })

        it('should set pastReconfirmDate and emailHasInstitutionLicence:false for lapsed confirmations', async function () {
          const response = await userHelper.request.get('/user/emails')
          expect(response.statusCode).to.equal(200)
          const fullEmails = JSON.parse(response.body)
          expect(fullEmails.length).to.equal(4)
          expect(fullEmails[0].affiliation).to.not.exist
          expect(fullEmails[1].affiliation.pastReconfirmDate).to.equal(false)
          expect(fullEmails[1].emailHasInstitutionLicence).to.equal(true)
          expect(fullEmails[2].affiliation.pastReconfirmDate).to.equal(false)
          expect(fullEmails[2].emailHasInstitutionLicence).to.equal(true)
          expect(fullEmails[3].affiliation.pastReconfirmDate).to.equal(true)
          expect(fullEmails[3].emailHasInstitutionLicence).to.equal(false)
        })
      })

      describe('should flag emails before their confirmation expires, but within the notification period', function () {
        beforeEach(async function () {
          const dateInPeriodButNotExpired = moment()
            .subtract(maxConfirmationMonths, 'months')
            .add(14, 'days')
            .toDate()
          const backdatedDays = moment().diff(dateInPeriodButNotExpired, 'days')
          await userHelper.backdateConfirmation(
            userHelper.user._id,
            email1,
            backdatedDays
          )
          await userHelper.backdateConfirmation(
            userHelper.user._id,
            email2,
            backdatedDays
          )
          await userHelper.backdateConfirmation(
            userHelper.user._id,
            email3,
            backdatedDays
          )
        })

        it('should flag the emails', async function () {
          const response = await userHelper.request.get('/user/emails')
          expect(response.statusCode).to.equal(200)
          const fullEmails = JSON.parse(response.body)
          expect(fullEmails.length).to.equal(4)
          expect(fullEmails[0].affiliation).to.not.exist
          expect(
            fullEmails[1].affiliation.inReconfirmNotificationPeriod
          ).to.equal(true)
          expect(
            fullEmails[2].affiliation.inReconfirmNotificationPeriod
          ).to.equal(true)
          expect(
            fullEmails[3].affiliation.inReconfirmNotificationPeriod
          ).to.equal(true)
          // ensure dates are not past reconfirmation period
          function _getLastDayToReconfirm(date) {
            return moment(date).add(maxConfirmationMonths, 'months')
          }

          expect(
            moment(fullEmails[1].reconfirmedAt).isAfter(
              _getLastDayToReconfirm(fullEmails[1].reconfirmedAt)
            )
          ).to.equal(false)

          expect(
            moment(fullEmails[2].reconfirmedAt).isAfter(
              _getLastDayToReconfirm(fullEmails[2].reconfirmedAt)
            )
          ).to.equal(false)
          expect(
            moment(fullEmails[3].reconfirmedAt).isAfter(
              _getLastDayToReconfirm(fullEmails[3].reconfirmedAt)
            )
          ).to.equal(false)
        })
      })

      describe('missing reconfirmedAt', function () {
        beforeEach(async function () {
          const userId = userHelper.user._id
          const query = {
            _id: userId,
            'emails.email': email2,
          }
          const update = {
            $unset: { 'emails.$.reconfirmedAt': true },
          }
          await UserUpdater.promises.updateUser(query, update)
        })

        it('should fallback to confirmedAt for date check', async function () {
          const response = await userHelper.request.get('/user/emails')
          expect(response.statusCode).to.equal(200)
          const fullEmails = JSON.parse(response.body)
          expect(fullEmails.length).to.equal(4)
          expect(fullEmails[0].affiliation).to.not.exist
          expect(fullEmails[2].reconfirmedAt).to.not.exist
          expect(
            fullEmails[1].affiliation.inReconfirmNotificationPeriod
          ).to.equal(true)
          expect(
            fullEmails[2].affiliation.inReconfirmNotificationPeriod
          ).to.equal(true)
          expect(
            fullEmails[3].affiliation.inReconfirmNotificationPeriod
          ).to.equal(true)
        })
      })
    })
  })
})
