const SplitTestController = require('./SplitTestController')
const AuthorizationMiddleware = require('../Authorization/AuthorizationMiddleware')
const Features = require('../../infrastructure/Features')

module.exports = {
  apply(webRouter) {
    if (Features.hasFeature('saas')) {
      webRouter.get(
        '/admin/splitTests',
        AuthorizationMiddleware.ensureUserIsSiteAdmin,
        SplitTestController.getSplitTests
      )

      webRouter.post(
        '/admin/createSplitTest',
        AuthorizationMiddleware.ensureUserIsSiteAdmin,
        SplitTestController.createSplitTest
      )
      webRouter.csrf.disableDefaultCsrfProtection('/admin/splitTest', 'PUT')

      webRouter.post(
        '/admin/updateSplitTest',
        AuthorizationMiddleware.ensureUserIsSiteAdmin,
        SplitTestController.updateSplitTest
      )
      webRouter.csrf.disableDefaultCsrfProtection('/admin/splitTest', 'POST')

      webRouter.post(
        '/admin/splitTest/switchToNextPhase',
        AuthorizationMiddleware.ensureUserIsSiteAdmin,
        SplitTestController.switchToNextPhase
      )
      webRouter.csrf.disableDefaultCsrfProtection(
        '/admin/splitTest/switchToNextPhase',
        'POST'
      )

      webRouter.post(
        '/admin/splitTest/revertToPreviousVersion',
        AuthorizationMiddleware.ensureUserIsSiteAdmin,
        SplitTestController.revertToPreviousVersion
      )
      webRouter.csrf.disableDefaultCsrfProtection(
        '/admin/splitTest/revertToPreviousVersion',
        'POST'
      )
    }
  },
}
