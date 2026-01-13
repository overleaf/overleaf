import logger from '@overleaf/logger'

import GitHubSyncController from './GitHubSyncController.mjs'
import AuthenticationController from '../../../../app/src/Features/Authentication/AuthenticationController.mjs'
import AuthorizationMiddleware from '../../../../app/src/Features/Authorization/AuthorizationMiddleware.mjs'

export default {
  apply(webRouter) {
    logger.debug({}, 'Init github-sync router')

    // User GitHub connection endpoints
    webRouter.post(
      '/user/github-sync/connect',
      AuthenticationController.requireLogin(),
      GitHubSyncController.connect
    )

    webRouter.delete(
      '/user/github-sync/disconnect',
      AuthenticationController.requireLogin(),
      GitHubSyncController.disconnect
    )

    webRouter.get(
      '/user/github-sync/status',
      AuthenticationController.requireLogin(),
      GitHubSyncController.getStatus
    )

    // Repository listing
    webRouter.get(
      '/user/github-sync/repos',
      AuthenticationController.requireLogin(),
      GitHubSyncController.listRepos
    )

    webRouter.get(
      '/user/github-sync/repos/:owner/:repo/branches',
      AuthenticationController.requireLogin(),
      GitHubSyncController.listBranches
    )

    // Project sync configuration
    webRouter.post(
      '/project/:Project_id/github-sync/configure',
      AuthenticationController.requireLogin(),
      AuthorizationMiddleware.ensureUserCanWriteProjectSettings,
      GitHubSyncController.configureProject
    )

    webRouter.delete(
      '/project/:Project_id/github-sync/configure',
      AuthenticationController.requireLogin(),
      AuthorizationMiddleware.ensureUserCanWriteProjectSettings,
      GitHubSyncController.unconfigureProject
    )

    webRouter.get(
      '/project/:Project_id/github-sync/status',
      AuthenticationController.requireLogin(),
      AuthorizationMiddleware.ensureUserCanReadProject,
      GitHubSyncController.getProjectStatus
    )

    // Push to GitHub
    webRouter.post(
      '/project/:Project_id/github-sync/push',
      AuthenticationController.requireLogin(),
      AuthorizationMiddleware.ensureUserCanWriteProjectContent,
      GitHubSyncController.pushProject
    )

    // Import from GitHub
    webRouter.post(
      '/github-sync/import',
      AuthenticationController.requireLogin(),
      GitHubSyncController.importRepo
    )
  },
}
