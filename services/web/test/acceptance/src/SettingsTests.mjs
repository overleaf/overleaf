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
import { expect } from 'chai'

import async from 'async'
import User from './helpers/User.mjs'
import Features from '../../../app/src/infrastructure/Features.js'

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
    if (Features.externalAuthenticationSystemUsed()) {
      this.skip()
      return
    }
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

  it('prevents first name from being updated to a string longer than 255 characters', function (done) {
    const newFirstName = 'a'.repeat(256)
    return this.user.updateSettings({ first_name: newFirstName }, error => {
      expect(error).to.exist
      expect(error.message).to.contain('update settings failed: status=400')
      return done()
    })
  })
})
