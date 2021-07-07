const logger = require('logger-sharelatex')
const Settings = require('@overleaf/settings')
const UserActivateController = require('./UserActivateController')
const AuthenticationController = require('../../../../app/src/Features/Authentication/AuthenticationController')

module.exports = {
  apply(webRouter) {
    if (Settings.disableModule['user-activate']) {
      logger.log({}, 'Skipping Init UserActivate router')
      return
    }
    logger.log({}, 'Init UserActivate router')

    webRouter.get('/user/activate', UserActivateController.activateAccountPage)
    AuthenticationController.addEndpointToLoginWhitelist('/user/activate')
  },
}
