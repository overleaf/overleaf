const { expect } = require('chai')
const async = require('async')
const User = require('./helpers/User')
const UserHelper = require('./helpers/UserHelper')
const { db, ObjectId } = require('../../../app/src/infrastructure/mongojs')
const MockV1Api = require('./helpers/MockV1Api')
const expectErrorResponse = require('./helpers/expectErrorResponse')

describe('UserEmails', function() {
  beforeEach(function(done) {
    this.timeout(20000)
    this.user = new User()
    this.user.login(done)
  })

  describe('confirming an email', function() {
    it('should confirm the email', function(done) {
      let token = null
      async.series(
        [
          cb => {
            this.user.request(
              {
                method: 'POST',
                url: '/user/emails',
                json: {
                  email: 'newly-added-email@example.com'
                }
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
                expect(body[1].confirmedAt).to.not.exist
                cb()
              }
            )
          },
          cb => {
            db.tokens.find(
              {
                use: 'email_confirmation',
                'data.user_id': this.user._id,
                usedAt: { $exists: false }
              },
              (error, tokens) => {
                expect(error).to.not.exist
                // There should only be one confirmation token at the moment
                expect(tokens.length).to.equal(1)
                expect(tokens[0].data.email).to.equal(
                  'newly-added-email@example.com'
                )
                expect(tokens[0].data.user_id).to.equal(this.user._id)
                ;({ token } = tokens[0])
                cb()
              }
            )
          },
          cb => {
            this.user.request(
              {
                method: 'POST',
                url: '/user/emails/confirm',
                json: {
                  token
                }
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
                expect(body[1].confirmedAt).to.exist
                cb()
              }
            )
          },
          cb => {
            db.tokens.find(
              {
                use: 'email_confirmation',
                'data.user_id': this.user._id,
                usedAt: { $exists: false }
              },
              (error, tokens) => {
                expect(error).to.not.exist
                // Token should be deleted after use
                expect(tokens.length).to.equal(0)
                cb()
              }
            )
          }
        ],
        done
      )
    })

    it('should not allow confirmation of the email if the user has changed', function(done) {
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
                json: { email: this.email }
              },
              cb
            )
          },
          cb => {
            db.tokens.find(
              {
                use: 'email_confirmation',
                'data.user_id': this.user._id,
                usedAt: { $exists: false }
              },
              (error, tokens) => {
                expect(error).to.not.exist
                // There should only be one confirmation token at the moment
                expect(tokens.length).to.equal(1)
                expect(tokens[0].data.email).to.equal(this.email)
                expect(tokens[0].data.user_id).to.equal(this.user._id)
                token1 = tokens[0].token
                cb()
              }
            )
          },
          cb => {
            // Delete the email from the first user
            this.user.request(
              {
                method: 'POST',
                url: '/user/emails/delete',
                json: { email: this.email }
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
                json: { email: this.email }
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
                  token: token1
                }
              },
              (error, response, body) => {
                expect(error).to.not.exist
                expect(response.statusCode).to.equal(404)
                cb()
              }
            )
          },
          cb => {
            db.tokens.find(
              {
                use: 'email_confirmation',
                'data.user_id': this.user2._id,
                usedAt: { $exists: false }
              },
              (error, tokens) => {
                expect(error).to.not.exist
                // The first token has been used, so this should be token2 now
                expect(tokens.length).to.equal(1)
                expect(tokens[0].data.email).to.equal(this.email)
                expect(tokens[0].data.user_id).to.equal(this.user2._id)
                token2 = tokens[0].token
                cb()
              }
            )
          },
          cb => {
            // Second user should be able to confirm the email
            this.user2.request(
              {
                method: 'POST',
                url: '/user/emails/confirm',
                json: {
                  token: token2
                }
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
          }
        ],
        done
      )
    })
  })

  describe('with an expired token', function() {
    it('should not confirm the email', function(done) {
      let token = null
      async.series(
        [
          cb => {
            this.user.request(
              {
                method: 'POST',
                url: '/user/emails',
                json: {
                  email: (this.email = 'expired-token-email@example.com')
                }
              },
              (error, response, body) => {
                expect(error).to.not.exist
                expect(response.statusCode).to.equal(204)
                cb()
              }
            )
          },
          cb => {
            db.tokens.find(
              {
                use: 'email_confirmation',
                'data.user_id': this.user._id,
                usedAt: { $exists: false }
              },
              (error, tokens) => {
                expect(error).to.not.exist
                // There should only be one confirmation token at the moment
                expect(tokens.length).to.equal(1)
                expect(tokens[0].data.email).to.equal(this.email)
                expect(tokens[0].data.user_id).to.equal(this.user._id)
                ;({ token } = tokens[0])
                cb()
              }
            )
          },
          cb => {
            db.tokens.update(
              {
                token
              },
              {
                $set: {
                  expiresAt: new Date(Date.now() - 1000000)
                }
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
                  token
                }
              },
              (error, response, body) => {
                expect(error).to.not.exist
                expect(response.statusCode).to.equal(404)
                cb()
              }
            )
          }
        ],
        done
      )
    })
  })

  describe('resending the confirmation', function() {
    it('should generate a new token', function(done) {
      async.series(
        [
          cb => {
            this.user.request(
              {
                method: 'POST',
                url: '/user/emails',
                json: {
                  email: 'reconfirmation-email@example.com'
                }
              },
              (error, response, body) => {
                expect(error).to.not.exist
                expect(response.statusCode).to.equal(204)
                cb()
              }
            )
          },
          cb => {
            db.tokens.find(
              {
                use: 'email_confirmation',
                'data.user_id': this.user._id,
                usedAt: { $exists: false }
              },
              (error, tokens) => {
                expect(error).to.not.exist
                // There should only be one confirmation token at the moment
                expect(tokens.length).to.equal(1)
                expect(tokens[0].data.email).to.equal(
                  'reconfirmation-email@example.com'
                )
                expect(tokens[0].data.user_id).to.equal(this.user._id)
                cb()
              }
            )
          },
          cb => {
            this.user.request(
              {
                method: 'POST',
                url: '/user/emails/resend_confirmation',
                json: {
                  email: 'reconfirmation-email@example.com'
                }
              },
              (error, response, body) => {
                expect(error).to.not.exist
                expect(response.statusCode).to.equal(200)
                cb()
              }
            )
          },
          cb => {
            db.tokens.find(
              {
                use: 'email_confirmation',
                'data.user_id': this.user._id,
                usedAt: { $exists: false }
              },
              (error, tokens) => {
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
              }
            )
          }
        ],
        done
      )
    })

    it('should create a new token if none exists', function(done) {
      // This should only be for users that have sign up with their main
      // emails before the confirmation system existed
      async.series(
        [
          cb => {
            db.tokens.remove(
              {
                use: 'email_confirmation',
                'data.user_id': this.user._id,
                usedAt: { $exists: false }
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
                  email: this.user.email
                }
              },
              (error, response, body) => {
                expect(error).to.not.exist
                expect(response.statusCode).to.equal(200)
                cb()
              }
            )
          },
          cb => {
            db.tokens.find(
              {
                use: 'email_confirmation',
                'data.user_id': this.user._id,
                usedAt: { $exists: false }
              },
              (error, tokens) => {
                expect(error).to.not.exist
                // There should still only be one confirmation token
                expect(tokens.length).to.equal(1)
                expect(tokens[0].data.email).to.equal(this.user.email)
                expect(tokens[0].data.user_id).to.equal(this.user._id)
                cb()
              }
            )
          }
        ],
        done
      )
    })

    it("should not allow reconfirmation if the email doesn't match the user", function(done) {
      async.series(
        [
          cb => {
            this.user.request(
              {
                method: 'POST',
                url: '/user/emails/resend_confirmation',
                json: {
                  email: 'non-matching-email@example.com'
                }
              },
              (error, response, body) => {
                expect(error).to.not.exist
                expect(response.statusCode).to.equal(422)
                cb()
              }
            )
          },
          cb => {
            db.tokens.find(
              {
                use: 'email_confirmation',
                'data.user_id': this.user._id,
                usedAt: { $exists: false }
              },
              (error, tokens) => {
                expect(error).to.not.exist
                expect(tokens.length).to.equal(0)
                cb()
              }
            )
          }
        ],
        done
      )
    })
  })

  describe('setting a default email', function() {
    it('should update confirmed emails for users not in v1', function(done) {
      async.series(
        [
          cb => {
            this.user.request(
              {
                method: 'POST',
                url: '/user/emails',
                json: {
                  email: 'new-confirmed-default@example.com'
                }
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
            db.users.update(
              {
                'emails.email': 'new-confirmed-default@example.com'
              },
              {
                $set: {
                  'emails.$.confirmedAt': new Date()
                }
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
                  email: 'new-confirmed-default@example.com'
                }
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
          }
        ],
        done
      )
    })

    it('should not allow changing unconfirmed emails in v1', function(done) {
      async.series(
        [
          cb => {
            db.users.update(
              {
                _id: ObjectId(this.user._id)
              },
              {
                $set: {
                  'overleaf.id': 42
                }
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
                  email: 'new-unconfirmed-default@example.com'
                }
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
                  email: 'new-unconfirmed-default@example.com'
                }
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
          }
        ],
        done
      )
    })

    it('should not update the email in v1', function(done) {
      async.series(
        [
          cb => {
            db.users.update(
              {
                _id: ObjectId(this.user._id)
              },
              {
                $set: {
                  'overleaf.id': 42
                }
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
                  email: 'new-confirmed-default-in-v1@example.com'
                }
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
            db.users.update(
              {
                'emails.email': 'new-confirmed-default-in-v1@example.com'
              },
              {
                $set: {
                  'emails.$.confirmedAt': new Date()
                }
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
                  email: 'new-confirmed-default-in-v1@example.com'
                }
              },
              (error, response, body) => {
                expect(error).to.not.exist
                expect(response.statusCode).to.equal(200)
                cb()
              }
            )
          }
        ],
        error => {
          expect(error).to.not.exist
          expect(MockV1Api.updateEmail.callCount).to.equal(0)
          done()
        }
      )
    })

    it('should not return an error if the email exists in v1', function(done) {
      MockV1Api.existingEmails.push('exists-in-v1@example.com')
      async.series(
        [
          cb => {
            db.users.update(
              {
                _id: ObjectId(this.user._id)
              },
              {
                $set: {
                  'overleaf.id': 42
                }
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
                  email: 'exists-in-v1@example.com'
                }
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
            db.users.update(
              {
                'emails.email': 'exists-in-v1@example.com'
              },
              {
                $set: {
                  'emails.$.confirmedAt': new Date()
                }
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
                  email: 'exists-in-v1@example.com'
                }
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
          }
        ],
        done
      )
    })
  })

  describe('when not logged in', function() {
    beforeEach(function(done) {
      this.anonymous = new User()
      this.anonymous.getCsrfToken(done)
    })
    it('should return a plain 403 when setting the email', function(done) {
      this.anonymous.request(
        {
          method: 'POST',
          url: '/user/emails',
          json: {
            email: 'newly-added-email@example.com'
          }
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

  describe('secondary email', function() {
    let newEmail, userHelper, userId, user
    beforeEach(async function() {
      newEmail = 'a-new-email@overleaf.com'
      userHelper = new UserHelper()
      userHelper = await UserHelper.createUser()
      userHelper = await UserHelper.loginUser({
        email: userHelper.getDefaultEmail(),
        password: userHelper.getDefaultPassword()
      })
      userId = userHelper.user._id
      await userHelper.request.post({
        form: {
          email: newEmail
        },
        simple: false,
        uri: '/user/emails'
      })
      userHelper = await UserHelper.getUser(userId)
      user = userHelper.user
    })
    it('should add the email', async function() {
      expect(user.emails[1].email).to.equal(newEmail)
    })
    it('should add to the user audit log', async function() {
      expect(typeof user.auditLog[0].initiatorId).to.equal('object')
      expect(user.auditLog[0].initiatorId).to.deep.equal(user._id)
      expect(user.auditLog[0].info.newSecondaryEmail).to.equal(newEmail)
      expect(user.auditLog[0].ip).to.equal(this.user.request.ip)
    })
  })
})
