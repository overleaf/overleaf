/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { User } = require('../../models/User')

module.exports = {
  getReferedUsers(user_id, callback) {
    return User.findById(user_id, function(err, user) {
      const refered_users = user.refered_users || []
      const refered_user_count = user.refered_user_count || refered_users.length
      return callback(null, refered_users, refered_user_count)
    })
  }
}
