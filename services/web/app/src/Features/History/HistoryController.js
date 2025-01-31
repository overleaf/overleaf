let HistoryController
const OError = require('@overleaf/o-error')
const async = require('async')
const logger = require('@overleaf/logger')
const request = require('request')
const settings = require('@overleaf/settings')
const SessionManager = require('../Authentication/SessionManager')
const UserGetter = require('../User/UserGetter')
const ProjectGetter = require('../Project/ProjectGetter')
const Errors = require('../Errors/Errors')
const HistoryManager = require('./HistoryManager')
const ProjectDetailsHandler = require('../Project/ProjectDetailsHandler')
const ProjectEntityUpdateHandler = require('../Project/ProjectEntityUpdateHandler')
const RestoreManager = require('./RestoreManager')
const { pipeline } = require('stream')
const Stream = require('stream')
const { prepareZipAttachment } = require('../../infrastructure/Response')
const Features = require('../../infrastructure/Features')
const { expressify } = require('@overleaf/promise-utils')

// Number of seconds after which the browser should send a request to revalidate
// blobs
const REVALIDATE_BLOB_AFTER_SECONDS = 86400 // 1 day

// Number of seconds during which the browser can serve a stale response while
// revalidating
const STALE_WHILE_REVALIDATE_SECONDS = 365 * 86400 // 1 year

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
  let url, stream, source, contentLength
  try {
    ;({ url, stream, source, contentLength } =
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
    await Stream.promises.pipeline(stream, res)
  } catch (err) {
    // If the downstream request is cancelled, we get an
    // ERR_STREAM_PREMATURE_CLOSE, ignore these "errors".
    if (err?.code === 'ERR_STREAM_PREMATURE_CLOSE') return

    logger.warn({ err, url, method, range }, 'streaming blob error')
    throw err
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

module.exports = HistoryController = {
  getBlob: expressify(getBlob),
  headBlob: expressify(headBlob),

  proxyToHistoryApi(req, res, next) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    const url = settings.apis.project_history.url + req.url

    const getReq = request({
      url,
      method: req.method,
      headers: {
        'X-User-Id': userId,
      },
    })
    pipeline(getReq, res, function (err) {
      // If the downstream request is cancelled, we get an
      // ERR_STREAM_PREMATURE_CLOSE.
      if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
        logger.warn({ url, err }, 'history API error')
        next(err)
      }
    })
  },

  proxyToHistoryApiAndInjectUserDetails(req, res, next) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    const url = settings.apis.project_history.url + req.url
    HistoryController._makeRequest(
      {
        url,
        method: req.method,
        json: true,
        headers: {
          'X-User-Id': userId,
        },
      },
      function (err, body) {
        if (err) {
          return next(err)
        }
        HistoryManager.injectUserDetails(body, function (err, data) {
          if (err) {
            return next(err)
          }
          res.json(data)
        })
      }
    )
  },

  resyncProjectHistory(req, res, next) {
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
    ProjectEntityUpdateHandler.resyncProjectHistory(
      projectId,
      opts,
      function (err) {
        if (err instanceof Errors.ProjectHistoryDisabledError) {
          return res.sendStatus(404)
        }
        if (err) {
          return next(err)
        }
        res.sendStatus(204)
      }
    )
  },

  restoreFileFromV2(req, res, next) {
    const { project_id: projectId } = req.params
    const { version, pathname } = req.body
    const userId = SessionManager.getLoggedInUserId(req.session)
    RestoreManager.restoreFileFromV2(
      userId,
      projectId,
      version,
      pathname,
      function (err, entity) {
        if (err) {
          return next(err)
        }
        res.json({
          type: entity.type,
          id: entity._id,
        })
      }
    )
  },

  revertFile(req, res, next) {
    const { project_id: projectId } = req.params
    const { version, pathname } = req.body
    const userId = SessionManager.getLoggedInUserId(req.session)
    RestoreManager.revertFile(
      userId,
      projectId,
      version,
      pathname,
      {},
      function (err, entity) {
        if (err) {
          return next(err)
        }
        res.json({
          type: entity.type,
          id: entity._id,
        })
      }
    )
  },

  revertProject(req, res, next) {
    const { project_id: projectId } = req.params
    const { version } = req.body
    const userId = SessionManager.getLoggedInUserId(req.session)
    RestoreManager.revertProject(userId, projectId, version, function (err) {
      if (err) {
        return next(err)
      }
      res.sendStatus(200)
    })
  },

  getLabels(req, res, next) {
    const projectId = req.params.Project_id
    HistoryController._makeRequest(
      {
        method: 'GET',
        url: `${settings.apis.project_history.url}/project/${projectId}/labels`,
        json: true,
      },
      function (err, labels) {
        if (err) {
          return next(err)
        }
        HistoryController._enrichLabels(labels, (err, labels) => {
          if (err) {
            return next(err)
          }
          res.json(labels)
        })
      }
    )
  },

  createLabel(req, res, next) {
    const projectId = req.params.Project_id
    const { comment, version } = req.body
    const userId = SessionManager.getLoggedInUserId(req.session)
    HistoryController._makeRequest(
      {
        method: 'POST',
        url: `${settings.apis.project_history.url}/project/${projectId}/labels`,
        json: { comment, version, user_id: userId },
      },
      function (err, label) {
        if (err) {
          return next(err)
        }
        HistoryController._enrichLabel(label, (err, label) => {
          if (err) {
            return next(err)
          }
          res.json(label)
        })
      }
    )
  },

  _enrichLabel(label, callback) {
    if (!label.user_id) {
      const newLabel = Object.assign({}, label)
      newLabel.user_display_name = HistoryController._displayNameForUser(null)
      return callback(null, newLabel)
    }
    UserGetter.getUser(
      label.user_id,
      { first_name: 1, last_name: 1, email: 1 },
      (err, user) => {
        if (err) {
          return callback(err)
        }
        const newLabel = Object.assign({}, label)
        newLabel.user_display_name = HistoryController._displayNameForUser(user)
        callback(null, newLabel)
      }
    )
  },

  _enrichLabels(labels, callback) {
    if (!labels || !labels.length) {
      return callback(null, [])
    }
    const uniqueUsers = new Set(labels.map(label => label.user_id))

    // For backwards compatibility, and for anonymously created labels in SP
    // expect missing user_id fields
    uniqueUsers.delete(undefined)

    if (!uniqueUsers.size) {
      return callback(null, labels)
    }

    UserGetter.getUsers(
      Array.from(uniqueUsers),
      { first_name: 1, last_name: 1, email: 1 },
      function (err, rawUsers) {
        if (err) {
          return callback(err)
        }
        const users = new Map(rawUsers.map(user => [String(user._id), user]))

        labels.forEach(label => {
          const user = users.get(label.user_id)
          label.user_display_name = HistoryController._displayNameForUser(user)
        })
        callback(null, labels)
      }
    )
  },

  _displayNameForUser(user) {
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
  },

  deleteLabel(req, res, next) {
    const { Project_id: projectId, label_id: labelId } = req.params
    const userId = SessionManager.getLoggedInUserId(req.session)

    ProjectGetter.getProject(
      projectId,
      {
        owner_ref: true,
      },
      (err, project) => {
        if (err) {
          return next(err)
        }

        // If the current user is the project owner, we can use the non-user-specific delete label endpoint.
        // Otherwise, we have to use the user-specific version (which only deletes the label if it is owned by the user)
        const deleteEndpointUrl = project.owner_ref.equals(userId)
          ? `${settings.apis.project_history.url}/project/${projectId}/labels/${labelId}`
          : `${settings.apis.project_history.url}/project/${projectId}/user/${userId}/labels/${labelId}`

        HistoryController._makeRequest(
          {
            method: 'DELETE',
            url: deleteEndpointUrl,
          },
          function (err) {
            if (err) {
              return next(err)
            }
            res.sendStatus(204)
          }
        )
      }
    )
  },

  _makeRequest(options, callback) {
    return request(options, function (err, response, body) {
      if (err) {
        return callback(err)
      }
      if (response.statusCode >= 200 && response.statusCode < 300) {
        callback(null, body)
      } else {
        err = new Error(
          `history api responded with non-success code: ${response.statusCode}`
        )
        callback(err)
      }
    })
  },

  downloadZipOfVersion(req, res, next) {
    const { project_id: projectId, version } = req.params
    ProjectDetailsHandler.getDetails(projectId, function (err, project) {
      if (err) {
        return next(err)
      }
      const v1Id =
        project.overleaf &&
        project.overleaf.history &&
        project.overleaf.history.id
      if (v1Id == null) {
        logger.error(
          { projectId, version },
          'got request for zip version of non-v1 history project'
        )
        return res.sendStatus(402)
      }
      HistoryController._pipeHistoryZipToResponse(
        v1Id,
        version,
        `${project.name} (Version ${version})`,
        req,
        res,
        next
      )
    })
  },

  _pipeHistoryZipToResponse(v1ProjectId, version, name, req, res, next) {
    if (req.destroyed) {
      // client has disconnected -- skip project history api call and download
      return
    }
    // increase timeout to 6 minutes
    res.setTimeout(6 * 60 * 1000)
    const url = `${settings.apis.v1_history.url}/projects/${v1ProjectId}/version/${version}/zip`
    const options = {
      auth: {
        user: settings.apis.v1_history.user,
        pass: settings.apis.v1_history.pass,
      },
      json: true,
      url,
    }

    if (!Features.hasFeature('saas')) {
      const getReq = request({ ...options, method: 'get' })

      getReq.on('error', function (err) {
        logger.warn({ err, v1ProjectId, version }, 'history zip download error')
        res.sendStatus(500)
      })
      getReq.on('response', function (response) {
        const statusCode = response.statusCode
        if (statusCode !== 200) {
          logger.warn(
            { v1ProjectId, version, statusCode },
            'history zip download failed'
          )
          if (statusCode === 404) {
            res.sendStatus(404)
          } else {
            res.sendStatus(500)
          }
          return
        }

        prepareZipAttachment(res, `${name}.zip`)
        pipeline(response, res, function (err) {
          // If the downstream request is cancelled, we get an
          // ERR_STREAM_PREMATURE_CLOSE.
          if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
            logger.error({ err, v1ProjectId, version }, 'history API error')
            next(err)
          }
        })
      })
      return
    }

    request({ ...options, method: 'post' }, function (err, response, body) {
      if (err) {
        OError.tag(err, 'history API error', {
          v1ProjectId,
          version,
        })
        return next(err)
      }
      if (response.statusCode !== 200) {
        if (response.statusCode === 404) {
          return next(new Errors.NotFoundError('zip not found'))
        } else {
          return next(
            new OError('Error while getting zip for download', {
              v1ProjectId,
              statusCode: response.statusCode,
            })
          )
        }
      }
      if (req.destroyed) {
        // client has disconnected -- skip delayed s3 download
        return
      }
      if (!body.zipUrl) {
        return next(
          new OError('Missing zipUrl, cannot fetch zip file', {
            v1ProjectId,
            body,
            statusCode: response.statusCode,
          })
        )
      }
      let retryAttempt = 0
      let retryDelay = 2000
      // retry for about 6 minutes starting with short delay
      async.retry(
        40,
        callback =>
          setTimeout(function () {
            if (req.destroyed) {
              // client has disconnected -- skip s3 download
              return callback() // stop async.retry loop
            }

            // increase delay by 1 second up to 10
            if (retryDelay < 10000) {
              retryDelay += 1000
            }
            retryAttempt++
            const getReq = request({
              url: body.zipUrl,
              sendImmediately: true,
            })
            const abortS3Request = () => getReq.abort()
            req.on('close', abortS3Request)
            res.on('timeout', abortS3Request)
            function cleanupAbortTrigger() {
              req.off('close', abortS3Request)
              res.off('timeout', abortS3Request)
            }
            getReq.on('response', function (response) {
              if (response.statusCode !== 200) {
                cleanupAbortTrigger()
                return callback(new Error('invalid response'))
              }
              // pipe also proxies the headers, but we want to customize these ones
              delete response.headers['content-disposition']
              delete response.headers['content-type']
              res.status(response.statusCode)
              prepareZipAttachment(res, `${name}.zip`)
              pipeline(response, res, err => {
                // If the downstream request is cancelled, we get an
                // ERR_STREAM_PREMATURE_CLOSE.
                if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
                  logger.warn(
                    { err, v1ProjectId, version, retryAttempt },
                    'history s3 proxying error'
                  )
                }
              })
              callback()
            })
            getReq.on('error', function (err) {
              logger.warn(
                { err, v1ProjectId, version, retryAttempt },
                'history s3 download error'
              )
              cleanupAbortTrigger()
              callback(err)
            })
          }, retryDelay),
        function (err) {
          if (err) {
            OError.tag(err, 'history s3 download failed', {
              v1ProjectId,
              version,
              retryAttempt,
            })
            next(err)
          }
        }
      )
    })
  },
}
