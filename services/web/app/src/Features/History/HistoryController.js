// @ts-check

const { setTimeout } = require('timers/promises')
const { pipeline } = require('stream/promises')
const OError = require('@overleaf/o-error')
const logger = require('@overleaf/logger')
const { expressify } = require('@overleaf/promise-utils')
const {
  fetchStream,
  fetchStreamWithResponse,
  fetchJson,
  fetchNothing,
  RequestFailedError,
} = require('@overleaf/fetch-utils')
const settings = require('@overleaf/settings')
const SessionManager = require('../Authentication/SessionManager')
const UserGetter = require('../User/UserGetter')
const ProjectGetter = require('../Project/ProjectGetter')
const Errors = require('../Errors/Errors')
const HistoryManager = require('./HistoryManager')
const ProjectDetailsHandler = require('../Project/ProjectDetailsHandler')
const ProjectEntityUpdateHandler = require('../Project/ProjectEntityUpdateHandler')
const RestoreManager = require('./RestoreManager')
const { prepareZipAttachment } = require('../../infrastructure/Response')
const Features = require('../../infrastructure/Features')

// Number of seconds after which the browser should send a request to revalidate
// blobs
const REVALIDATE_BLOB_AFTER_SECONDS = 86400 // 1 day

// Number of seconds during which the browser can serve a stale response while
// revalidating
const STALE_WHILE_REVALIDATE_SECONDS = 365 * 86400 // 1 year

const MAX_HISTORY_ZIP_ATTEMPTS = 40

async function getBlob(req, res) {
  await requestBlob('GET', req, res)
}

async function headBlob(req, res) {
  await requestBlob('HEAD', req, res)
}

async function requestBlob(method, req, res) {
  const { project_id: projectId, hash } = req.params

  // Handle conditional GET request
  if (req.get('If-None-Match') === hash) {
    setBlobCacheHeaders(res, hash)
    return res.status(304).end()
  }

  const range = req.get('Range')
  let stream, source, contentLength
  try {
    ;({ stream, source, contentLength } =
      await HistoryManager.promises.requestBlobWithFallback(
        projectId,
        hash,
        req.query.fallback,
        method,
        range
      ))
  } catch (err) {
    if (err instanceof Errors.NotFoundError) return res.status(404).end()
    throw err
  }
  res.appendHeader('X-Served-By', source)

  if (contentLength) res.setHeader('Content-Length', contentLength) // set on HEAD
  res.setHeader('Content-Type', 'application/octet-stream')
  setBlobCacheHeaders(res, hash)

  try {
    await pipeline(stream, res)
  } catch (err) {
    // If the downstream request is cancelled, we get an
    // ERR_STREAM_PREMATURE_CLOSE, ignore these "errors".
    if (!isPrematureClose(err)) {
      throw err
    }
  }
}

function setBlobCacheHeaders(res, etag) {
  // Blobs are immutable, so they can in principle be cached indefinitely. Here,
  // we ask the browser to cache them for some time, but then check back
  // regularly in case they changed (even though they shouldn't). This is a
  // precaution in case a bug makes us send bad data through that endpoint.
  res.set(
    'Cache-Control',
    `private, max-age=${REVALIDATE_BLOB_AFTER_SECONDS}, stale-while-revalidate=${STALE_WHILE_REVALIDATE_SECONDS}`
  )
  res.set('ETag', etag)
}

async function proxyToHistoryApi(req, res, next) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const url = settings.apis.project_history.url + req.url

  const { stream, response } = await fetchStreamWithResponse(url, {
    method: req.method,
    headers: { 'X-User-Id': userId },
  })

  const contentType = response.headers.get('Content-Type')
  const contentLength = response.headers.get('Content-Length')
  if (contentType != null) {
    res.set('Content-Type', contentType)
  }
  if (contentLength != null) {
    res.set('Content-Length', contentLength)
  }

  try {
    await pipeline(stream, res)
  } catch (err) {
    // If the downstream request is cancelled, we get an
    // ERR_STREAM_PREMATURE_CLOSE.
    if (!isPrematureClose(err)) {
      throw err
    }
  }
}

async function proxyToHistoryApiAndInjectUserDetails(req, res, next) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const url = settings.apis.project_history.url + req.url
  const body = await fetchJson(url, {
    method: req.method,
    headers: { 'X-User-Id': userId },
  })
  const data = await HistoryManager.promises.injectUserDetails(body)
  res.json(data)
}

async function resyncProjectHistory(req, res, next) {
  // increase timeout to 6 minutes
  res.setTimeout(6 * 60 * 1000)
  const projectId = req.params.Project_id
  const opts = {}
  const historyRangesMigration = req.body.historyRangesMigration
  if (historyRangesMigration) {
    opts.historyRangesMigration = historyRangesMigration
  }
  if (req.body.resyncProjectStructureOnly) {
    opts.resyncProjectStructureOnly = req.body.resyncProjectStructureOnly
  }

  try {
    await ProjectEntityUpdateHandler.promises.resyncProjectHistory(
      projectId,
      opts
    )
  } catch (err) {
    if (err instanceof Errors.ProjectHistoryDisabledError) {
      return res.sendStatus(404)
    } else {
      throw err
    }
  }

  res.sendStatus(204)
}

async function restoreFileFromV2(req, res, next) {
  const { project_id: projectId } = req.params
  const { version, pathname } = req.body
  const userId = SessionManager.getLoggedInUserId(req.session)

  const entity = await RestoreManager.promises.restoreFileFromV2(
    userId,
    projectId,
    version,
    pathname
  )

  res.json({
    type: entity.type,
    id: entity._id,
  })
}

async function revertFile(req, res, next) {
  const { project_id: projectId } = req.params
  const { version, pathname } = req.body
  const userId = SessionManager.getLoggedInUserId(req.session)

  const entity = await RestoreManager.promises.revertFile(
    userId,
    projectId,
    version,
    pathname,
    {}
  )

  res.json({
    type: entity.type,
    id: entity._id,
  })
}

async function revertProject(req, res, next) {
  const { project_id: projectId } = req.params
  const { version } = req.body
  const userId = SessionManager.getLoggedInUserId(req.session)

  await RestoreManager.promises.revertProject(userId, projectId, version)

  res.sendStatus(200)
}

async function getLabels(req, res, next) {
  const projectId = req.params.Project_id

  let labels = await fetchJson(
    `${settings.apis.project_history.url}/project/${projectId}/labels`
  )
  labels = await _enrichLabels(labels)

  res.json(labels)
}

async function createLabel(req, res, next) {
  const projectId = req.params.Project_id
  const { comment, version } = req.body
  const userId = SessionManager.getLoggedInUserId(req.session)

  let label = await fetchJson(
    `${settings.apis.project_history.url}/project/${projectId}/labels`,
    {
      method: 'POST',
      json: { comment, version, user_id: userId },
    }
  )
  label = await _enrichLabel(label)

  res.json(label)
}

async function _enrichLabel(label) {
  const newLabel = Object.assign({}, label)
  if (!label.user_id) {
    newLabel.user_display_name = _displayNameForUser(null)
    return newLabel
  }

  const user = await UserGetter.promises.getUser(label.user_id, {
    first_name: 1,
    last_name: 1,
    email: 1,
  })
  newLabel.user_display_name = _displayNameForUser(user)
  return newLabel
}

async function _enrichLabels(labels) {
  if (!labels || !labels.length) {
    return []
  }
  const uniqueUsers = new Set(labels.map(label => label.user_id))

  // For backwards compatibility, and for anonymously created labels in SP
  // expect missing user_id fields
  uniqueUsers.delete(undefined)

  if (!uniqueUsers.size) {
    return labels
  }

  const rawUsers = await UserGetter.promises.getUsers(Array.from(uniqueUsers), {
    first_name: 1,
    last_name: 1,
    email: 1,
  })
  const users = new Map(rawUsers.map(user => [String(user._id), user]))

  labels.forEach(label => {
    const user = users.get(label.user_id)
    label.user_display_name = _displayNameForUser(user)
  })
  return labels
}

function _displayNameForUser(user) {
  if (user == null) {
    return 'Anonymous'
  }
  if (user.name) {
    return user.name
  }
  let name = [user.first_name, user.last_name]
    .filter(n => n != null)
    .join(' ')
    .trim()
  if (name === '') {
    name = user.email.split('@')[0]
  }
  if (!name) {
    return '?'
  }
  return name
}

async function deleteLabel(req, res, next) {
  const { Project_id: projectId, label_id: labelId } = req.params
  const userId = SessionManager.getLoggedInUserId(req.session)

  const project = await ProjectGetter.promises.getProject(projectId, {
    owner_ref: true,
  })

  // If the current user is the project owner, we can use the non-user-specific
  // delete label endpoint. Otherwise, we have to use the user-specific version
  // (which only deletes the label if it is owned by the user)
  const deleteEndpointUrl = project.owner_ref.equals(userId)
    ? `${settings.apis.project_history.url}/project/${projectId}/labels/${labelId}`
    : `${settings.apis.project_history.url}/project/${projectId}/user/${userId}/labels/${labelId}`

  await fetchNothing(deleteEndpointUrl, {
    method: 'DELETE',
  })
  res.sendStatus(204)
}

async function downloadZipOfVersion(req, res, next) {
  const { project_id: projectId, version } = req.params

  const project = await ProjectDetailsHandler.promises.getDetails(projectId)
  const v1Id =
    project.overleaf && project.overleaf.history && project.overleaf.history.id

  if (v1Id == null) {
    logger.error(
      { projectId, version },
      'got request for zip version of non-v1 history project'
    )
    return res.sendStatus(402)
  }

  await _pipeHistoryZipToResponse(
    v1Id,
    version,
    `${project.name} (Version ${version})`,
    req,
    res
  )
}

async function _pipeHistoryZipToResponse(v1ProjectId, version, name, req, res) {
  if (req.destroyed) {
    // client has disconnected -- skip project history api call and download
    return
  }
  // increase timeout to 6 minutes
  res.setTimeout(6 * 60 * 1000)
  const url = `${settings.apis.v1_history.url}/projects/${v1ProjectId}/version/${version}/zip`
  const basicAuth = {
    user: settings.apis.v1_history.user,
    password: settings.apis.v1_history.pass,
  }

  if (!Features.hasFeature('saas')) {
    let stream
    try {
      stream = await fetchStream(url, { basicAuth })
    } catch (err) {
      if (err instanceof RequestFailedError && err.response.status === 404) {
        return res.sendStatus(404)
      } else {
        throw err
      }
    }

    prepareZipAttachment(res, `${name}.zip`)

    try {
      await pipeline(stream, res)
    } catch (err) {
      // If the downstream request is cancelled, we get an
      // ERR_STREAM_PREMATURE_CLOSE.
      if (!isPrematureClose(err)) {
        throw err
      }
    }
    return
  }

  let body
  try {
    body = await fetchJson(url, { method: 'POST', basicAuth })
  } catch (err) {
    if (err instanceof RequestFailedError && err.response.status === 404) {
      throw new Errors.NotFoundError('zip not found')
    } else {
      throw err
    }
  }

  if (req.destroyed) {
    // client has disconnected -- skip delayed s3 download
    return
  }

  if (!body.zipUrl) {
    throw new OError('Missing zipUrl, cannot fetch zip file', {
      v1ProjectId,
      body,
    })
  }

  // retry for about 6 minutes starting with short delay
  let retryDelay = 2000
  let attempt = 0
  while (true) {
    attempt += 1
    await setTimeout(retryDelay)

    if (req.destroyed) {
      // client has disconnected -- skip s3 download
      return
    }

    // increase delay by 1 second up to 10
    if (retryDelay < 10000) {
      retryDelay += 1000
    }

    try {
      const stream = await fetchStream(body.zipUrl)
      prepareZipAttachment(res, `${name}.zip`)
      await pipeline(stream, res)
    } catch (err) {
      if (attempt > MAX_HISTORY_ZIP_ATTEMPTS) {
        throw err
      }

      if (err instanceof RequestFailedError && err.response.status === 404) {
        // File not ready yet. Retry.
        continue
      } else if (isPrematureClose(err)) {
        // Downstream request cancelled. Retry.
        continue
      } else {
        // Unknown error. Log and retry.
        logger.warn(
          { err, v1ProjectId, version, retryAttempt: attempt },
          'history s3 proxying error'
        )
        continue
      }
    }

    // We made it through. No need to retry anymore. Exit loop
    break
  }
}

async function getLatestHistory(req, res, next) {
  const projectId = req.params.project_id
  const history = await HistoryManager.promises.getLatestHistory(projectId)
  res.json(history)
}

async function getChanges(req, res, next) {
  const projectId = req.params.project_id
  const since = req.query.since
  const changes = await HistoryManager.promises.getChanges(projectId, { since })
  res.json(changes)
}

function isPrematureClose(err) {
  return (
    err instanceof Error &&
    'code' in err &&
    err.code === 'ERR_STREAM_PREMATURE_CLOSE'
  )
}

module.exports = {
  getBlob: expressify(getBlob),
  headBlob: expressify(headBlob),
  proxyToHistoryApi: expressify(proxyToHistoryApi),
  proxyToHistoryApiAndInjectUserDetails: expressify(
    proxyToHistoryApiAndInjectUserDetails
  ),
  resyncProjectHistory: expressify(resyncProjectHistory),
  restoreFileFromV2: expressify(restoreFileFromV2),
  revertFile: expressify(revertFile),
  revertProject: expressify(revertProject),
  getLabels: expressify(getLabels),
  createLabel: expressify(createLabel),
  deleteLabel: expressify(deleteLabel),
  downloadZipOfVersion: expressify(downloadZipOfVersion),
  getLatestHistory: expressify(getLatestHistory),
  getChanges: expressify(getChanges),
  _displayNameForUser,
  promises: {
    _pipeHistoryZipToResponse,
  },
}
