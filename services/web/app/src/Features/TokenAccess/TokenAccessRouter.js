const AuthenticationController = require('../Authentication/AuthenticationController')
const AuthorizationMiddleware = require('../Authorization/AuthorizationMiddleware')
const TokenAccessController = require('./TokenAccessController')

module.exports = {
  apply(webRouter) {
    webRouter.get(
      `/project/:Project_id/sharing-updates`,
      AuthenticationController.requireLogin(),
      AuthorizationMiddleware.ensureUserCanReadProject,
      TokenAccessController.ensureUserCanUseSharingUpdatesConsentPage,
      TokenAccessController.sharingUpdatesConsent
    )

    webRouter.post(
      `/project/:Project_id/sharing-updates/join`,
      AuthenticationController.requireLogin(),
      AuthorizationMiddleware.ensureUserCanReadProject,
      TokenAccessController.ensureUserCanUseSharingUpdatesConsentPage,
      TokenAccessController.moveReadWriteToCollaborators
    )

    webRouter.post(
      `/project/:Project_id/sharing-updates/view`,
      AuthenticationController.requireLogin(),
      AuthorizationMiddleware.ensureUserCanReadProject,
      TokenAccessController.ensureUserCanUseSharingUpdatesConsentPage,
      TokenAccessController.moveReadWriteToReadOnly
    )
  },
}
