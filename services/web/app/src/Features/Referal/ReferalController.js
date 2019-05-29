/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const logger = require('logger-sharelatex')
const ReferalHandler = require('./ReferalHandler')
const AuthenticationController = require('../Authentication/AuthenticationController')

module.exports = {
  bonus(req, res) {
    const user_id = AuthenticationController.getLoggedInUserId(req)
    return ReferalHandler.getReferedUsers(
      user_id,
      (err, refered_users, refered_user_count) =>
        res.render('referal/bonus', {
          title: 'bonus_please_recommend_us',
          refered_users,
          refered_user_count
        })
    )
  }
}
