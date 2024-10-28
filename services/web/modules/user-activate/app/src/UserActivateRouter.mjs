import logger from '@overleaf/logger'
import UserActivateController from './UserActivateController.mjs'
import AuthenticationController from '../../../../app/src/Features/Authentication/AuthenticationController.js'
import AuthorizationMiddleware from '../../../../app/src/Features/Authorization/AuthorizationMiddleware.js'

export default {
  apply(webRouter) {
    logger.debug({}, 'Init UserActivate router')

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
