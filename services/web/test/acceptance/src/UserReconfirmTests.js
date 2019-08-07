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
const should = require('chai').should()
const async = require('async')
const User = require('./helpers/User')

describe('User Must Reconfirm', function() {
  beforeEach(function(done) {
    this.user = new User()
    return async.series(
      [
        this.user.ensureUserExists.bind(this.user),
        cb => this.user.mongoUpdate({ $set: { must_reconfirm: true } }, cb)
      ],
      done
    )
  })

  it('should not allow sign in', function(done) {
    return this.user.login(err => {
      expect(err != null).to.equal(false)
      return this.user.isLoggedIn((err, isLoggedIn) => {
        expect(isLoggedIn).to.equal(false)
        return done()
      })
    })
  })

  describe('Requesting reconfirmation email', function() {
    it('should return a success to client for existing account', function(done) {
      return this.user.reconfirmAccountRequest(
        this.user.email,
        (err, response) => {
          expect(err != null).to.equal(false)
          expect(response.statusCode).to.equal(200)
          return done()
        }
      )
    })

    it('should return a 404 to client for non-existent account', function(done) {
      return this.user.reconfirmAccountRequest(
        'fake@overleaf.com',
        (err, response) => {
          expect(err != null).to.equal(false)
          expect(response.statusCode).to.equal(404)
          return done()
        }
      )
    })
  })
})
