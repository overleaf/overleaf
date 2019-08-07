/* eslint-disable
    handle-callback-err,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const should = require('chai').should()
const async = require('async')
const User = require('./helpers/User')
const MockV1Api = require('./helpers/MockV1Api')

describe('SettingsPage', function() {
  beforeEach(function(done) {
    this.user = new User()
    this.v1Id = 1234
    this.v1User = {
      id: this.v1Id,
      email: this.user.email,
      password: this.user.password,
      profile: {
        id: this.v1Id,
        email: this.user.email
      }
    }
    return async.series(
      [
        this.user.ensureUserExists.bind(this.user),
        this.user.login.bind(this.user),
        cb => this.user.mongoUpdate({ $set: { 'overleaf.id': this.v1Id } }, cb),
        cb => {
          MockV1Api.setUser(this.v1Id, this.v1User)
          return cb()
        },
        this.user.activateSudoMode.bind(this.user)
      ],
      done
    )
  })

  it('load settings page', function(done) {
    return this.user.getUserSettingsPage((err, statusCode) => {
      statusCode.should.equal(200)
      return done()
    })
  })

  it('update main email address', function(done) {
    const newEmail = 'foo@bar.com'
    return this.user.updateSettings({ email: newEmail }, error => {
      should.not.exist(error)
      return this.user.get((error, user) => {
        user.email.should.equal(newEmail)
        user.emails.length.should.equal(1)
        user.emails[0].email.should.equal(newEmail)
        return done()
      })
    })
  })
})
