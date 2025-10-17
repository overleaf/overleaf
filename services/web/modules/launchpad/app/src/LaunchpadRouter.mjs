import logger from '@overleaf/logger'

import LaunchpadController from './LaunchpadController.mjs'
import AuthenticationController from '../../../../app/src/Features/Authentication/AuthenticationController.mjs'
import AuthorizationMiddleware from '../../../../app/src/Features/Authorization/AuthorizationMiddleware.mjs'

export default {
  apply(webRouter) {
    logger.debug({}, 'Init launchpad router')

    webRouter.get('/launchpad', LaunchpadController.launchpadPage)
    webRouter.post(
      '/launchpad/register_admin',
      LaunchpadController.registerAdmin
    )
    webRouter.post(
      '/launchpad/register_ldap_admin',
      LaunchpadController.registerExternalAuthAdmin('ldap')
    )
    webRouter.post(
      '/launchpad/register_saml_admin',
      LaunchpadController.registerExternalAuthAdmin('saml')
    )
    webRouter.post(
      '/launchpad/send_test_email',
      AuthorizationMiddleware.ensureUserIsSiteAdmin,
      LaunchpadController.sendTestEmail
    )

    if (AuthenticationController.addEndpointToLoginWhitelist) {
      AuthenticationController.addEndpointToLoginWhitelist('/launchpad')
      AuthenticationController.addEndpointToLoginWhitelist(
        '/launchpad/register_admin'
      )
      AuthenticationController.addEndpointToLoginWhitelist(
        '/launchpad/register_ldap_admin'
      )
      AuthenticationController.addEndpointToLoginWhitelist(
        '/launchpad/register_saml_admin'
      )
    }
  },
}
