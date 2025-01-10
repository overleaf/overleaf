import OError from '@overleaf/o-error'
import { expect } from 'chai'
import async from 'async'
import User from './helpers/User.mjs'

describe('AdminEmails', function () {
  beforeEach(function (done) {
    this.timeout(5000)
    done()
  })

  describe('an admin with an invalid email address', function () {
    before(function (done) {
      this.badUser = new User({ email: 'alice@evil.com' })
      async.series(
        [
          cb => this.badUser.ensureUserExists(cb),
          cb => this.badUser.ensureAdmin(cb),
        ],
        done
      )
    })

    it('should block the user', function (done) {
      this.badUser.login(err => {
        // User.login refreshes the csrf token after login.
        // Seeing the csrf token request fail "after login" indicates a successful login.
        expect(OError.getFullStack(err)).to.match(/TaggedError: after login/)
        expect(OError.getFullStack(err)).to.match(
          /get csrf token failed: status=500 /
        )
        this.badUser.getProjectListPage((err, statusCode) => {
          expect(err).to.not.exist
          expect(statusCode).to.equal(500)
          done()
        })
      })
    })
  })

  describe('an admin with a valid email address', function () {
    before(function (done) {
      this.goodUser = new User({ email: 'alice@example.com' })
      async.series(
        [
          cb => this.goodUser.ensureUserExists(cb),
          cb => this.goodUser.ensureAdmin(cb),
        ],
        done
      )
    })

    it('should not block the user', function (done) {
      this.goodUser.login(err => {
        expect(err).to.not.exist
        this.goodUser.getProjectListPage((err, statusCode) => {
          expect(err).to.not.exist
          expect(statusCode).to.equal(200)
          done()
        })
      })
    })
  })
})
