const logger = require('@overleaf/logger')
const UserActivateController = require('./UserActivateController')
const AuthenticationController = require('../../../../app/src/Features/Authentication/AuthenticationController')
const AuthorizationMiddleware = require('../../../../app/src/Features/Authorization/AuthorizationMiddleware')

module.exports = {
  apply(webRouter) {
    logger.log({}, 'Init UserActivate router')

    webRouter.get(
      '/admin/user',
      AuthorizationMiddleware.ensureUserIsSiteAdmin,
      (req, res) => res.redirect('/admin/register')
    )

    webRouter.get('/user/activate', UserActivateController.activateAccountPage)
    AuthenticationController.addEndpointToLoginWhitelist('/user/activate')

    webRouter.get(
      '/admin/register',
      AuthorizationMiddleware.ensureUserIsSiteAdmin,
      UserActivateController.registerNewUser
    )
    webRouter.post(
      '/admin/register',
      AuthorizationMiddleware.ensureUserIsSiteAdmin,
      UserActivateController.register
    )
  },
}
