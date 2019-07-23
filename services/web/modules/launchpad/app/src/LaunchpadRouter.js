/* eslint-disable
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const logger = require('logger-sharelatex')
const LaunchpadController = require('./LaunchpadController')
const AuthenticationController = require('../../../../app/src/Features/Authentication/AuthenticationController')
const AuthorizationMiddleware = require('../../../../app/src/Features/Authorization/AuthorizationMiddleware')

module.exports = {
  apply(webRouter, apiRouter) {
    logger.log({}, 'Init launchpad router')

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

    if (AuthenticationController.addEndpointToLoginWhitelist != null) {
      AuthenticationController.addEndpointToLoginWhitelist('/launchpad')
      AuthenticationController.addEndpointToLoginWhitelist(
        '/launchpad/register_admin'
      )
      AuthenticationController.addEndpointToLoginWhitelist(
        '/launchpad/register_ldap_admin'
      )
      return AuthenticationController.addEndpointToLoginWhitelist(
        '/launchpad/register_saml_admin'
      )
    }
  }
}
