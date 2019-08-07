/* eslint-disable
    handle-callback-err,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { expect } = require('chai')
const async = require('async')
const User = require('./helpers/User')
const request = require('./helpers/request')
const settings = require('settings-sharelatex')
const { db, ObjectId } = require('../../../app/src/infrastructure/mongojs')
const MockV1Api = require('./helpers/MockV1Api')

describe('UserEmails', function() {
  beforeEach(function(done) {
    this.timeout(20000)
    this.user = new User()
    return this.user.login(done)
  })

  describe('confirming an email', function() {
    it('should confirm the email', function(done) {
      let token = null
      return async.series(
        [
          cb => {
            return this.user.request(
              {
                method: 'POST',
                url: '/user/emails',
                json: {
                  email: 'newly-added-email@example.com'
                }
              },
              (error, response, body) => {
                if (error != null) {
                  return done(error)
                }
                expect(response.statusCode).to.equal(204)
                return cb()
              }
            )
          },
          cb => {
            return this.user.request(
              { url: '/user/emails', json: true },
              (error, response, body) => {
                expect(response.statusCode).to.equal(200)
                expect(body[0].confirmedAt).to.not.exist
                expect(body[1].confirmedAt).to.not.exist
                return cb()
              }
            )
          },
          cb => {
            return db.tokens.find(
              {
                use: 'email_confirmation',
                'data.user_id': this.user._id,
                usedAt: { $exists: false }
              },
              (error, tokens) => {
                // There should only be one confirmation token at the moment
                expect(tokens.length).to.equal(1)
                expect(tokens[0].data.email).to.equal(
                  'newly-added-email@example.com'
                )
                expect(tokens[0].data.user_id).to.equal(this.user._id)
                ;({ token } = tokens[0])
                return cb()
              }
            )
          },
          cb => {
            return this.user.request(
              {
                method: 'POST',
                url: '/user/emails/confirm',
                json: {
                  token
                }
              },
              (error, response, body) => {
                if (error != null) {
                  return done(error)
                }
                expect(response.statusCode).to.equal(200)
                return cb()
              }
            )
          },
          cb => {
            return this.user.request(
              { url: '/user/emails', json: true },
              (error, response, body) => {
                expect(response.statusCode).to.equal(200)
                expect(body[0].confirmedAt).to.not.exist
                expect(body[1].confirmedAt).to.exist
                return cb()
              }
            )
          },
          cb => {
            return db.tokens.find(
              {
                use: 'email_confirmation',
                'data.user_id': this.user._id,
                usedAt: { $exists: false }
              },
              (error, tokens) => {
                // Token should be deleted after use
                expect(tokens.length).to.equal(0)
                return cb()
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
      return async.series(
        [
          cb => this.user2.login(cb),
          cb => {
            // Create email for first user
            return this.user.request(
              {
                method: 'POST',
                url: '/user/emails',
                json: { email: this.email }
              },
              cb
            )
          },
          cb => {
            return db.tokens.find(
              {
                use: 'email_confirmation',
                'data.user_id': this.user._id,
                usedAt: { $exists: false }
              },
              (error, tokens) => {
                // There should only be one confirmation token at the moment
                expect(tokens.length).to.equal(1)
                expect(tokens[0].data.email).to.equal(this.email)
                expect(tokens[0].data.user_id).to.equal(this.user._id)
                token1 = tokens[0].token
                return cb()
              }
            )
          },
          cb => {
            // Delete the email from the first user
            return this.user.request(
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
            return this.user2.request(
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
            return this.user.request(
              {
                method: 'POST',
                url: '/user/emails/confirm',
                json: {
                  token: token1
                }
              },
              (error, response, body) => {
                if (error != null) {
                  return done(error)
                }
                expect(response.statusCode).to.equal(404)
                return cb()
              }
            )
          },
          cb => {
            return db.tokens.find(
              {
                use: 'email_confirmation',
                'data.user_id': this.user2._id,
                usedAt: { $exists: false }
              },
              (error, tokens) => {
                // The first token has been used, so this should be token2 now
                expect(tokens.length).to.equal(1)
                expect(tokens[0].data.email).to.equal(this.email)
                expect(tokens[0].data.user_id).to.equal(this.user2._id)
                token2 = tokens[0].token
                return cb()
              }
            )
          },
          cb => {
            // Second user should be able to confirm the email
            return this.user2.request(
              {
                method: 'POST',
                url: '/user/emails/confirm',
                json: {
                  token: token2
                }
              },
              (error, response, body) => {
                if (error != null) {
                  return done(error)
                }
                expect(response.statusCode).to.equal(200)
                return cb()
              }
            )
          },
          cb => {
            return this.user2.request(
              { url: '/user/emails', json: true },
              (error, response, body) => {
                expect(response.statusCode).to.equal(200)
                expect(body[0].confirmedAt).to.not.exist
                expect(body[1].confirmedAt).to.exist
                return cb()
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
      return async.series(
        [
          cb => {
            return this.user.request(
              {
                method: 'POST',
                url: '/user/emails',
                json: {
                  email: (this.email = 'expired-token-email@example.com')
                }
              },
              (error, response, body) => {
                if (error != null) {
                  return done(error)
                }
                expect(response.statusCode).to.equal(204)
                return cb()
              }
            )
          },
          cb => {
            return db.tokens.find(
              {
                use: 'email_confirmation',
                'data.user_id': this.user._id,
                usedAt: { $exists: false }
              },
              (error, tokens) => {
                // There should only be one confirmation token at the moment
                expect(tokens.length).to.equal(1)
                expect(tokens[0].data.email).to.equal(this.email)
                expect(tokens[0].data.user_id).to.equal(this.user._id)
                ;({ token } = tokens[0])
                return cb()
              }
            )
          },
          cb => {
            return db.tokens.update(
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
            return this.user.request(
              {
                method: 'POST',
                url: '/user/emails/confirm',
                json: {
                  token
                }
              },
              (error, response, body) => {
                if (error != null) {
                  return done(error)
                }
                expect(response.statusCode).to.equal(404)
                return cb()
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
      return async.series(
        [
          cb => {
            return this.user.request(
              {
                method: 'POST',
                url: '/user/emails',
                json: {
                  email: 'reconfirmation-email@example.com'
                }
              },
              (error, response, body) => {
                if (error != null) {
                  return done(error)
                }
                expect(response.statusCode).to.equal(204)
                return cb()
              }
            )
          },
          cb => {
            return db.tokens.find(
              {
                use: 'email_confirmation',
                'data.user_id': this.user._id,
                usedAt: { $exists: false }
              },
              (error, tokens) => {
                // There should only be one confirmation token at the moment
                expect(tokens.length).to.equal(1)
                expect(tokens[0].data.email).to.equal(
                  'reconfirmation-email@example.com'
                )
                expect(tokens[0].data.user_id).to.equal(this.user._id)
                return cb()
              }
            )
          },
          cb => {
            return this.user.request(
              {
                method: 'POST',
                url: '/user/emails/resend_confirmation',
                json: {
                  email: 'reconfirmation-email@example.com'
                }
              },
              (error, response, body) => {
                if (error != null) {
                  return done(error)
                }
                expect(response.statusCode).to.equal(200)
                return cb()
              }
            )
          },
          cb => {
            return db.tokens.find(
              {
                use: 'email_confirmation',
                'data.user_id': this.user._id,
                usedAt: { $exists: false }
              },
              (error, tokens) => {
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
                return cb()
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
      return async.series(
        [
          cb => {
            return db.tokens.remove(
              {
                use: 'email_confirmation',
                'data.user_id': this.user._id,
                usedAt: { $exists: false }
              },
              cb
            )
          },
          cb => {
            return this.user.request(
              {
                method: 'POST',
                url: '/user/emails/resend_confirmation',
                json: {
                  email: this.user.email
                }
              },
              (error, response, body) => {
                if (error != null) {
                  return done(error)
                }
                expect(response.statusCode).to.equal(200)
                return cb()
              }
            )
          },
          cb => {
            return db.tokens.find(
              {
                use: 'email_confirmation',
                'data.user_id': this.user._id,
                usedAt: { $exists: false }
              },
              (error, tokens) => {
                // There should still only be one confirmation token
                expect(tokens.length).to.equal(1)
                expect(tokens[0].data.email).to.equal(this.user.email)
                expect(tokens[0].data.user_id).to.equal(this.user._id)
                return cb()
              }
            )
          }
        ],
        done
      )
    })

    it("should not allow reconfirmation if the email doesn't match the user", function(done) {
      return async.series(
        [
          cb => {
            return this.user.request(
              {
                method: 'POST',
                url: '/user/emails/resend_confirmation',
                json: {
                  email: 'non-matching-email@example.com'
                }
              },
              (error, response, body) => {
                if (error != null) {
                  return done(error)
                }
                expect(response.statusCode).to.equal(422)
                return cb()
              }
            )
          },
          cb => {
            return db.tokens.find(
              {
                use: 'email_confirmation',
                'data.user_id': this.user._id,
                usedAt: { $exists: false }
              },
              (error, tokens) => {
                expect(tokens.length).to.equal(0)
                return cb()
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
      const token = null
      return async.series(
        [
          cb => {
            return this.user.request(
              {
                method: 'POST',
                url: '/user/emails',
                json: {
                  email: 'new-confirmed-default@example.com'
                }
              },
              (error, response, body) => {
                if (error != null) {
                  return done(error)
                }
                expect(response.statusCode).to.equal(204)
                return cb()
              }
            )
          },
          cb => {
            // Mark the email as confirmed
            return db.users.update(
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
            return this.user.request(
              {
                method: 'POST',
                url: '/user/emails/default',
                json: {
                  email: 'new-confirmed-default@example.com'
                }
              },
              (error, response, body) => {
                if (error != null) {
                  return done(error)
                }
                expect(response.statusCode).to.equal(200)
                return cb()
              }
            )
          },
          cb => {
            return this.user.request(
              { url: '/user/emails', json: true },
              (error, response, body) => {
                expect(response.statusCode).to.equal(200)
                expect(body[0].confirmedAt).to.not.exist
                expect(body[0].default).to.equal(false)
                expect(body[1].confirmedAt).to.exist
                expect(body[1].default).to.equal(true)
                return cb()
              }
            )
          }
        ],
        done
      )
    })

    it('should not allow changing unconfirmed emails in v1', function(done) {
      const token = null
      return async.series(
        [
          cb => {
            return db.users.update(
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
            return this.user.request(
              {
                method: 'POST',
                url: '/user/emails',
                json: {
                  email: 'new-unconfirmed-default@example.com'
                }
              },
              (error, response, body) => {
                if (error != null) {
                  return done(error)
                }
                expect(response.statusCode).to.equal(204)
                return cb()
              }
            )
          },
          cb => {
            return this.user.request(
              {
                method: 'POST',
                url: '/user/emails/default',
                json: {
                  email: 'new-unconfirmed-default@example.com'
                }
              },
              (error, response, body) => {
                if (error != null) {
                  return done(error)
                }
                expect(response.statusCode).to.equal(409)
                return cb()
              }
            )
          },
          cb => {
            return this.user.request(
              { url: '/user/emails', json: true },
              (error, response, body) => {
                expect(body[0].default).to.equal(true)
                expect(body[1].default).to.equal(false)
                return cb()
              }
            )
          }
        ],
        done
      )
    })

    it('should not update the email in v1', function(done) {
      const token = null
      return async.series(
        [
          cb => {
            return db.users.update(
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
            return this.user.request(
              {
                method: 'POST',
                url: '/user/emails',
                json: {
                  email: 'new-confirmed-default-in-v1@example.com'
                }
              },
              (error, response, body) => {
                if (error != null) {
                  return done(error)
                }
                expect(response.statusCode).to.equal(204)
                return cb()
              }
            )
          },
          cb => {
            // Mark the email as confirmed
            return db.users.update(
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
            return this.user.request(
              {
                method: 'POST',
                url: '/user/emails/default',
                json: {
                  email: 'new-confirmed-default-in-v1@example.com'
                }
              },
              (error, response, body) => {
                if (error != null) {
                  return done(error)
                }
                expect(response.statusCode).to.equal(200)
                return cb()
              }
            )
          }
        ],
        error => {
          if (error != null) {
            return done(error)
          }
          expect(MockV1Api.updateEmail.callCount).to.equal(0)
          done()
        }
      )
    })

    it('should not return an error if the email exists in v1', function(done) {
      MockV1Api.existingEmails.push('exists-in-v1@example.com')
      return async.series(
        [
          cb => {
            return db.users.update(
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
            return this.user.request(
              {
                method: 'POST',
                url: '/user/emails',
                json: {
                  email: 'exists-in-v1@example.com'
                }
              },
              (error, response, body) => {
                if (error != null) {
                  return done(error)
                }
                expect(response.statusCode).to.equal(204)
                return cb()
              }
            )
          },
          cb => {
            // Mark the email as confirmed
            return db.users.update(
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
            return this.user.request(
              {
                method: 'POST',
                url: '/user/emails/default',
                json: {
                  email: 'exists-in-v1@example.com'
                }
              },
              (error, response, body) => {
                if (error != null) {
                  return done(error)
                }
                expect(response.statusCode).to.equal(200)
                cb()
              }
            )
          },
          cb => {
            return this.user.request(
              { url: '/user/emails', json: true },
              (error, response, body) => {
                expect(body[0].default).to.equal(false)
                expect(body[1].default).to.equal(true)
                return cb()
              }
            )
          }
        ],
        done
      )
    })
  })
})
