/* eslint-disable
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const PasswordResetController = require('./PasswordResetController')
const AuthenticationController = require('../Authentication/AuthenticationController')

module.exports = {
  apply(webRouter, apiRouter) {
    webRouter.get(
      '/user/password/reset',
      PasswordResetController.renderRequestResetForm
    )
    webRouter.post('/user/password/reset', PasswordResetController.requestReset)
    AuthenticationController.addEndpointToLoginWhitelist('/user/password/reset')

    webRouter.get(
      '/user/password/set',
      PasswordResetController.renderSetPasswordForm
    )
    webRouter.post(
      '/user/password/set',
      PasswordResetController.setNewUserPassword
    )
    AuthenticationController.addEndpointToLoginWhitelist('/user/password/set')

    return webRouter.post(
      '/user/reconfirm',
      PasswordResetController.requestReset
    )
  }
}
