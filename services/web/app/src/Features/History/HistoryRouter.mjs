// @ts-check

import Settings from '@overleaf/settings'
import { Joi, validate } from '../../infrastructure/Validation.js'
import { RateLimiter } from '../../infrastructure/RateLimiter.js'
import AuthenticationController from '../Authentication/AuthenticationController.js'
import AuthorizationMiddleware from '../Authorization/AuthorizationMiddleware.js'
import RateLimiterMiddleware from '../Security/RateLimiterMiddleware.js'
import HistoryController from './HistoryController.js'

const rateLimiters = {
  downloadProjectRevision: new RateLimiter('download-project-revision', {
    points: 30,
    duration: 60 * 60,
  }),
  getProjectBlob: new RateLimiter('get-project-blob', {
    // Download project in full once per hour
    points: Settings.maxEntitiesPerProject,
    duration: 60 * 60,
  }),
  flushHistory: new RateLimiter('flush-project-history', {
    points: 30,
    duration: 60,
  }),
}

function apply(webRouter, privateApiRouter) {
  // Blobs

  webRouter.head(
    '/project/:project_id/blob/:hash',
    validate({
      params: Joi.object({
        project_id: Joi.objectId().required(),
        hash: Joi.string().required().hex().length(40),
      }),
      query: Joi.object({
        fallback: Joi.objectId().optional(),
      }),
    }),
    RateLimiterMiddleware.rateLimit(rateLimiters.getProjectBlob),
    AuthorizationMiddleware.ensureUserCanReadProject,
    HistoryController.headBlob
  )
  webRouter.get(
    '/project/:project_id/blob/:hash',
    validate({
      params: Joi.object({
        project_id: Joi.objectId().required(),
        hash: Joi.string().required().hex().length(40),
      }),
      query: Joi.object({
        fallback: Joi.objectId().optional(),
      }),
    }),
    RateLimiterMiddleware.rateLimit(rateLimiters.getProjectBlob),
    AuthorizationMiddleware.ensureUserCanReadProject,
    HistoryController.getBlob
  )

  // History diffs

  webRouter.get(
    '/project/:Project_id/updates',
    AuthorizationMiddleware.blockRestrictedUserFromProject,
    AuthorizationMiddleware.ensureUserCanReadProject,
    HistoryController.proxyToHistoryApiAndInjectUserDetails
  )
  webRouter.get(
    '/project/:Project_id/doc/:doc_id/diff',
    AuthorizationMiddleware.blockRestrictedUserFromProject,
    AuthorizationMiddleware.ensureUserCanReadProject,
    HistoryController.proxyToHistoryApi
  )
  webRouter.get(
    '/project/:Project_id/diff',
    AuthorizationMiddleware.blockRestrictedUserFromProject,
    AuthorizationMiddleware.ensureUserCanReadProject,
    HistoryController.proxyToHistoryApiAndInjectUserDetails
  )
  webRouter.get(
    '/project/:Project_id/filetree/diff',
    AuthorizationMiddleware.blockRestrictedUserFromProject,
    AuthorizationMiddleware.ensureUserCanReadProject,
    HistoryController.proxyToHistoryApi
  )

  // File and project restore

  webRouter.post(
    '/project/:project_id/restore_file',
    AuthorizationMiddleware.ensureUserCanWriteProjectContent,
    HistoryController.restoreFileFromV2
  )
  webRouter.post(
    '/project/:project_id/revert_file',
    AuthorizationMiddleware.ensureUserCanWriteProjectContent,
    HistoryController.revertFile
  )
  webRouter.post(
    '/project/:project_id/revert-project',
    AuthorizationMiddleware.ensureUserCanWriteProjectContent,
    HistoryController.revertProject
  )

  // History download

  webRouter.get(
    '/project/:project_id/version/:version/zip',
    RateLimiterMiddleware.rateLimit(rateLimiters.downloadProjectRevision),
    AuthorizationMiddleware.blockRestrictedUserFromProject,
    AuthorizationMiddleware.ensureUserCanReadProject,
    HistoryController.downloadZipOfVersion
  )

  // History flush and resync

  webRouter.post(
    '/project/:Project_id/flush',
    RateLimiterMiddleware.rateLimit(rateLimiters.flushHistory),
    AuthorizationMiddleware.blockRestrictedUserFromProject,
    AuthorizationMiddleware.ensureUserCanReadProject,
    HistoryController.proxyToHistoryApi
  )
  privateApiRouter.post(
    '/project/:Project_id/history/resync',
    AuthenticationController.requirePrivateApiAuth(),
    HistoryController.resyncProjectHistory
  )

  // History labels

  webRouter.get(
    '/project/:Project_id/labels',
    AuthorizationMiddleware.blockRestrictedUserFromProject,
    AuthorizationMiddleware.ensureUserCanReadProject,
    HistoryController.getLabels
  )
  webRouter.post(
    '/project/:Project_id/labels',
    AuthorizationMiddleware.ensureUserCanWriteOrReviewProjectContent,
    HistoryController.createLabel
  )
  webRouter.delete(
    '/project/:Project_id/labels/:label_id',
    AuthorizationMiddleware.ensureUserCanWriteOrReviewProjectContent,
    HistoryController.deleteLabel
  )

  // History snapshot

  webRouter.get(
    '/project/:project_id/latest/history',
    AuthorizationMiddleware.blockRestrictedUserFromProject,
    AuthorizationMiddleware.ensureUserCanReadProject,
    HistoryController.proxyToHistoryApi
  )
  webRouter.get(
    '/project/:project_id/changes',
    AuthorizationMiddleware.blockRestrictedUserFromProject,
    AuthorizationMiddleware.ensureUserCanReadProject,
    HistoryController.proxyToHistoryApi
  )
}

export default { apply }
