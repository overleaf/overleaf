const { expressify } = require('../../util/promises')
const TpdsUpdateHandler = require('./TpdsUpdateHandler')
const UpdateMerger = require('./UpdateMerger')
const Errors = require('../Errors/Errors')
const logger = require('@overleaf/logger')
const Path = require('path')
const metrics = require('@overleaf/metrics')
const NotificationsBuilder = require('../Notifications/NotificationsBuilder')
const SessionManager = require('../Authentication/SessionManager')
const TpdsQueueManager = require('./TpdsQueueManager')

// mergeUpdate and deleteUpdate are used by Dropbox, where the project is only
// passed as the name, as the first part of the file path. They have to check
// the project exists, find it, and create it if not.  They also ignore 'noisy'
// files like .DS_Store, .gitignore, etc.

async function mergeUpdate(req, res) {
  metrics.inc('tpds.merge-update')
  const { filePath, userId, projectName } = parseParams(req)
  const source = req.headers['x-sl-update-source'] || 'unknown'

  let metadata
  try {
    metadata = await TpdsUpdateHandler.promises.newUpdate(
      userId,
      projectName,
      filePath,
      req,
      source
    )
  } catch (err) {
    if (err.name === 'TooManyRequestsError') {
      logger.warn(
        { err, userId, filePath },
        'tpds update failed to be processed, too many requests'
      )
      return res.sendStatus(429)
    } else if (err.message === 'project_has_too_many_files') {
      logger.warn(
        { err, userId, filePath },
        'tpds trying to append to project over file limit'
      )
      NotificationsBuilder.tpdsFileLimit(userId).create(projectName)
      return res.sendStatus(400)
    } else {
      throw err
    }
  }

  if (metadata == null) {
    return res.json({ status: 'rejected' })
  }

  const payload = {
    status: 'applied',
    entityId: metadata.entityId.toString(),
    entityType: metadata.entityType,
  }
  if (metadata.rev != null) {
    payload.rev = metadata.rev
  }
  res.json(payload)
}

async function deleteUpdate(req, res) {
  metrics.inc('tpds.delete-update')
  const { filePath, userId, projectName } = parseParams(req)
  const source = req.headers['x-sl-update-source'] || 'unknown'

  await TpdsUpdateHandler.promises.deleteUpdate(
    userId,
    projectName,
    filePath,
    source
  )
  res.sendStatus(200)
}

// updateProjectContents and deleteProjectContents are used by GitHub. The
// project_id is known so we can skip right ahead to creating/updating/deleting
// the file. These methods will not ignore noisy files like .DS_Store,
// .gitignore, etc because people are generally more explicit with the files
// they want in git.

async function updateProjectContents(req, res, next) {
  const projectId = req.params.project_id
  const path = `/${req.params[0]}` // UpdateMerger expects leading slash
  const source = req.headers['x-sl-update-source'] || 'unknown'

  try {
    await UpdateMerger.promises.mergeUpdate(null, projectId, path, req, source)
  } catch (error) {
    if (error.constructor === Errors.InvalidNameError) {
      return res.sendStatus(422)
    } else {
      throw error
    }
  }
  res.sendStatus(200)
}

async function deleteProjectContents(req, res, next) {
  const projectId = req.params.project_id
  const path = `/${req.params[0]}` // UpdateMerger expects leading slash
  const source = req.headers['x-sl-update-source'] || 'unknown'

  await UpdateMerger.promises.deleteUpdate(null, projectId, path, source)
  res.sendStatus(200)
}

async function getQueues(req, res, next) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  res.json(await TpdsQueueManager.promises.getQueues(userId))
}

function parseParams(req) {
  let filePath, projectName
  let path = req.params[0]
  const userId = req.params.user_id

  path = Path.join('/', path)
  if (path.substring(1).indexOf('/') === -1) {
    filePath = '/'
    projectName = path.substring(1)
  } else {
    filePath = path.substring(path.indexOf('/', 1))
    projectName = path.substring(0, path.indexOf('/', 1))
    projectName = projectName.replace('/', '')
  }

  return { filePath, userId, projectName }
}

module.exports = {
  mergeUpdate: expressify(mergeUpdate),
  deleteUpdate: expressify(deleteUpdate),
  updateProjectContents: expressify(updateProjectContents),
  deleteProjectContents: expressify(deleteProjectContents),
  getQueues: expressify(getQueues),

  // for tests only
  parseParams,
}
