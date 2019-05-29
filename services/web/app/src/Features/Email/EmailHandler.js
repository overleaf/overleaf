/* eslint-disable
    handle-callback-err,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const settings = require('settings-sharelatex')
const EmailBuilder = require('./EmailBuilder')
const EmailSender = require('./EmailSender')

if (settings.email == null) {
  settings.email = { lifecycleEnabled: false }
}

module.exports = {
  sendEmail(emailType, opts, callback) {
    if (callback == null) {
      callback = function(err) {}
    }
    const email = EmailBuilder.buildEmail(emailType, opts)
    if (email.type === 'lifecycle' && !settings.email.lifecycle) {
      return callback()
    }
    opts.html = email.html
    opts.text = email.text
    opts.subject = email.subject
    return EmailSender.sendEmail(opts, err => callback(err))
  }
}
