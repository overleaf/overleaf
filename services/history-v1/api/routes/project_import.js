'use strict'

const express = require('express')
const router = express.Router()
const { getAuthHandlers } = require('../middleware/security')
const projectImportController = require('../controllers/project_import')

const { basic: handleBasicAuth } = getAuthHandlers()

router.post(
  '/projects/:project_id/import',
  handleBasicAuth,
  projectImportController.importSnapshot
)

router.post(
  '/projects/:project_id/legacy_import',
  handleBasicAuth,
  projectImportController.importSnapshot
)

router.post(
  '/projects/:project_id/changes',
  handleBasicAuth,
  projectImportController.importChanges
)

router.post(
  '/projects/:project_id/legacy_changes',
  handleBasicAuth,
  projectImportController.importChanges
)

router.post(
  '/projects/:project_id/flush',
  handleBasicAuth,
  projectImportController.flushChanges
)

router.post(
  '/projects/:project_id/expire',
  handleBasicAuth,
  projectImportController.expireProject
)

module.exports = router
