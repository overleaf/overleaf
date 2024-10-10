import AuthenticationController from '../Authentication/AuthenticationController.js'
import AuthorizationMiddleware from '../Authorization/AuthorizationMiddleware.js'
import TokenAccessController from './TokenAccessController.mjs'

export default {
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
