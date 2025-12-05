'use strict'

const express = require('express')
const router = express.Router()
const { getAuthHandlers } = require('../middleware/security')
const projectsController = require('../controllers/projects')

const {
  basic: handleBasicAuth,
  jwt: handleJWTAuth,
  token: handleTokenAuth,
  either: handleJWTOrTokenAuth,
} = getAuthHandlers()

router.post('/projects', handleBasicAuth, projectsController.initializeProject)

router.post(
  '/projects/blob-stats',
  handleBasicAuth,
  projectsController.getProjectBlobsStats
)

router.post(
  '/projects/:project_id/blob-stats',
  handleBasicAuth,
  projectsController.getBlobStats
)

router.delete(
  '/projects/:project_id',
  handleBasicAuth,
  projectsController.deleteProject
)

router.get(
  '/projects/:project_id/blobs/:hash',
  handleJWTOrTokenAuth,
  projectsController.getProjectBlob
)

router.put(
  '/projects/:project_id/blobs/:hash',
  handleJWTAuth,
  projectsController.createProjectBlob
)

router.post(
  '/projects/:project_id/blobs/:hash',
  handleJWTAuth,
  projectsController.copyProjectBlob
)

router.get(
  '/projects/:project_id/latest/content',
  handleJWTAuth,
  projectsController.getLatestContent
)

router.get(
  '/projects/:project_id/latest/hashed_content',
  handleBasicAuth,
  projectsController.getLatestHashedContent
)

router.get(
  '/projects/:project_id/latest/history',
  handleJWTAuth,
  projectsController.getLatestHistory
)

router.get(
  '/projects/:project_id/latest/history/raw',
  handleJWTAuth,
  projectsController.getLatestHistoryRaw
)

router.get(
  '/projects/:project_id/latest/persistedHistory',
  handleJWTAuth,
  projectsController.getLatestPersistedHistory
)

router.get(
  '/projects/:project_id/versions/:version/history',
  handleJWTAuth,
  projectsController.getHistory
)

router.get(
  '/projects/:project_id/versions/:version/content',
  handleJWTAuth,
  projectsController.getContentAtVersion
)

router.get(
  '/projects/:project_id/timestamp/:timestamp/history',
  handleJWTAuth,
  projectsController.getHistoryBefore
)

router.get(
  '/projects/:project_id/version/:version/zip',
  handleTokenAuth,
  projectsController.getZip
)

router.post(
  '/projects/:project_id/version/:version/zip',
  handleBasicAuth,
  projectsController.createZip
)

router.get(
  '/projects/:project_id/changes',
  handleBasicAuth,
  projectsController.getChanges
)

module.exports = router
