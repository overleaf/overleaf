const logger = require('logger-sharelatex')
const UserActivateController = require('./UserActivateController')
const AuthenticationController = require('../../../../app/src/Features/Authentication/AuthenticationController')

module.exports = {
  apply(webRouter) {
    logger.log({}, 'Init UserActivate router')

    webRouter.get('/user/activate', UserActivateController.activateAccountPage)
    AuthenticationController.addEndpointToLoginWhitelist('/user/activate')
  },
}
