import AiSessionController from './AiSessionController.mjs'
import AiSessionProxy from './AiSessionProxy.mjs'
import AuthenticationController from '../Authentication/AuthenticationController.mjs'
import AuthorizationMiddleware from '../Authorization/AuthorizationMiddleware.mjs'

export default {
  apply(webRouter, privateApiRouter) {
    // Session lifecycle — user-facing, project-scoped.
    webRouter.post(
      '/project/:Project_id/ai/session',
      AuthenticationController.requireLogin(),
      AuthorizationMiddleware.ensureUserCanReadProject,
      AiSessionController.startSession
    )
    webRouter.delete(
      '/project/:Project_id/ai/session',
      AuthenticationController.requireLogin(),
      AuthorizationMiddleware.ensureUserCanReadProject,
      AiSessionController.stopSession
    )
    webRouter.get(
      '/project/:Project_id/ai/session/status',
      AuthenticationController.requireLogin(),
      AuthorizationMiddleware.ensureUserCanReadProject,
      AiSessionController.getStatus
    )

    // The browser-facing iframe proxy. Mounted as a wildcard catch-all
    // because code-server serves arbitrary subpaths (assets, websockets,
    // /vscode-remote-resource, etc).
    webRouter.use(AiSessionProxy.MOUNT, AiSessionProxy.httpMiddleware)

    // Internal heartbeat — sync daemon pings here so the orchestrator knows
    // the OT bridge is alive. Basic-auth protected (shared secret).
    privateApiRouter.post(
      '/internal/ai/session/:sessionId/heartbeat',
      AuthenticationController.requirePrivateApiAuth(),
      AiSessionController.recordHeartbeat
    )
  },
}
