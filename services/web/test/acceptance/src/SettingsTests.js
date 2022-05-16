/* eslint-disable
    n/handle-callback-err,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { expect } = require('chai')
const async = require('async')
const User = require('./helpers/User')

describe('SettingsPage', function () {
  beforeEach(function (done) {
    this.user = new User()
    return async.series(
      [
        this.user.ensureUserExists.bind(this.user),
        this.user.login.bind(this.user),
      ],
      done
    )
  })

  it('load settings page', function (done) {
    return this.user.getUserSettingsPage((err, statusCode) => {
      statusCode.should.equal(200)
      return done()
    })
  })

  it('update main email address', function (done) {
    const newEmail = 'foo@bar.com'
    return this.user.updateSettings({ email: newEmail }, error => {
      expect(error).not.to.exist
      return this.user.get((error, user) => {
        user.email.should.equal(newEmail)
        user.emails.length.should.equal(1)
        user.emails[0].email.should.equal(newEmail)
        return done()
      })
    })
  })
})
