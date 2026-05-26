import AiSessionController from './AiSessionController.mjs'
import AiSessionProxy from './AiSessionProxy.mjs'
import AiSessionEditorEvents from './AiSessionEditorEvents.mjs'
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

    // Internal structural-sync endpoints used by the sync daemon. They
    // mirror the user-facing editor endpoints but take userId in the body
    // because the daemon authenticates via basic auth rather than a session.
    const requireApi = AuthenticationController.requirePrivateApiAuth()
    privateApiRouter.post(
      '/internal/ai-sync/project/:Project_id/doc',
      requireApi,
      AiSessionController.internalAddDoc
    )
    privateApiRouter.post(
      '/internal/ai-sync/project/:Project_id/folder',
      requireApi,
      AiSessionController.internalAddFolder
    )
    privateApiRouter.delete(
      '/internal/ai-sync/project/:Project_id/entity/:entity_type/:entity_id',
      requireApi,
      AiSessionController.internalDeleteEntity
    )
    privateApiRouter.get(
      '/internal/ai-sync/project/:Project_id/structure',
      requireApi,
      AiSessionController.internalGetStructure
    )
    privateApiRouter.get(
      '/internal/ai-sync/project/:Project_id/file/:File_id',
      requireApi,
      AiSessionController.internalGetFile
    )
    // Raw binary upload — body is the file content. No body-parser
    // middleware in the chain; internalAddFile streams req directly to disk.
    privateApiRouter.post(
      '/internal/ai-sync/project/:Project_id/file',
      requireApi,
      AiSessionController.internalAddFile
    )
    // SSE feed of editor-events (reciveNewDoc, removeEntity, …) for one
    // project, so the daemon can mirror structural changes made in the Web
    // UI into the workspace.
    privateApiRouter.get(
      '/internal/ai-sync/project/:Project_id/editor-events/stream',
      requireApi,
      AiSessionEditorEvents.attach
    )
  },
}
