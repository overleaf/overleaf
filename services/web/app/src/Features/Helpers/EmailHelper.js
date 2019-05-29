/* eslint-disable
    max-len,
    no-unused-vars,
    no-useless-escape,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let EmailHelper
const EMAIL_REGEXP = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\ ".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA -Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

module.exports = EmailHelper = {
  parseEmail(email) {
    if (email == null) {
      return null
    }
    if (email.length > 254) {
      return null
    }
    email = email.trim().toLowerCase()

    const matched = email.match(EMAIL_REGEXP)
    if (matched == null || matched[0] == null) {
      return null
    }

    return matched[0]
  }
}
