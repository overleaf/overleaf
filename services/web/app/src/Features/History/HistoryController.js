/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let HistoryController
const OError = require('@overleaf/o-error')
const _ = require('lodash')
const async = require('async')
const logger = require('logger-sharelatex')
const request = require('request')
const settings = require('settings-sharelatex')
const AuthenticationController = require('../Authentication/AuthenticationController')
const UserGetter = require('../User/UserGetter')
const Errors = require('../Errors/Errors')
const HistoryManager = require('./HistoryManager')
const ProjectDetailsHandler = require('../Project/ProjectDetailsHandler')
const ProjectEntityUpdateHandler = require('../Project/ProjectEntityUpdateHandler')
const RestoreManager = require('./RestoreManager')
const { pipeline } = require('stream')

module.exports = HistoryController = {
  selectHistoryApi(req, res, next) {
    if (next == null) {
      next = function(error) {}
    }
    const project_id = req.params != null ? req.params.Project_id : undefined
    // find out which type of history service this project uses
    return ProjectDetailsHandler.getDetails(project_id, function(err, project) {
      if (err != null) {
        return next(err)
      }
      const history =
        project.overleaf != null ? project.overleaf.history : undefined
      if (
        (history != null ? history.id : undefined) != null &&
        (history != null ? history.display : undefined)
      ) {
        req.useProjectHistory = true
      } else {
        req.useProjectHistory = false
      }
      return next()
    })
  },

  ensureProjectHistoryEnabled(req, res, next) {
    if (next == null) {
      next = function(error) {}
    }
    if (req.useProjectHistory != null) {
      return next()
    } else {
      return res.sendStatus(404)
    }
  },

  proxyToHistoryApi(req, res, next) {
    if (next == null) {
      next = function(error) {}
    }
    const user_id = AuthenticationController.getLoggedInUserId(req)
    const url =
      HistoryController.buildHistoryServiceUrl(req.useProjectHistory) + req.url

    const getReq = request({
      url,
      method: req.method,
      headers: {
        'X-User-Id': user_id
      }
    })
    getReq.pipe(res)
    return getReq.on('error', function(error) {
      logger.warn({ url, err: error }, 'history API error')
      return next(error)
    })
  },

  proxyToHistoryApiAndInjectUserDetails(req, res, next) {
    if (next == null) {
      next = function(error) {}
    }
    const user_id = AuthenticationController.getLoggedInUserId(req)
    const url =
      HistoryController.buildHistoryServiceUrl(req.useProjectHistory) + req.url
    return HistoryController._makeRequest(
      {
        url,
        method: req.method,
        json: true,
        headers: {
          'X-User-Id': user_id
        }
      },
      function(error, body) {
        if (error != null) {
          return next(error)
        }
        return HistoryManager.injectUserDetails(body, function(error, data) {
          if (error != null) {
            return next(error)
          }
          return res.json(data)
        })
      }
    )
  },

  buildHistoryServiceUrl(useProjectHistory) {
    // choose a history service, either document-level (trackchanges)
    // or project-level (project_history)
    if (useProjectHistory) {
      return settings.apis.project_history.url
    } else {
      return settings.apis.trackchanges.url
    }
  },

  resyncProjectHistory(req, res, next) {
    if (next == null) {
      next = function(error) {}
    }
    const project_id = req.params.Project_id
    return ProjectEntityUpdateHandler.resyncProjectHistory(project_id, function(
      error
    ) {
      if (error instanceof Errors.ProjectHistoryDisabledError) {
        return res.sendStatus(404)
      }
      if (error != null) {
        return next(error)
      }
      return res.sendStatus(204)
    })
  },

  restoreFileFromV2(req, res, next) {
    const { project_id } = req.params
    const { version, pathname } = req.body
    const user_id = AuthenticationController.getLoggedInUserId(req)
    return RestoreManager.restoreFileFromV2(
      user_id,
      project_id,
      version,
      pathname,
      function(error, entity) {
        if (error != null) {
          return next(error)
        }
        return res.json({
          type: entity.type,
          id: entity._id
        })
      }
    )
  },

  restoreDocFromDeletedDoc(req, res, next) {
    const { project_id, doc_id } = req.params
    const { name } = req.body
    const user_id = AuthenticationController.getLoggedInUserId(req)
    if (name == null) {
      return res.sendStatus(400) // Malformed request
    }
    return RestoreManager.restoreDocFromDeletedDoc(
      user_id,
      project_id,
      doc_id,
      name,
      (error, doc) => {
        if (error != null) return next(error)
        res.json({
          doc_id: doc._id
        })
      }
    )
  },

  getLabels(req, res, next) {
    const project_id = req.params.Project_id
    const user_id = AuthenticationController.getLoggedInUserId(req)
    return HistoryController._makeRequest(
      {
        method: 'GET',
        url: `${
          settings.apis.project_history.url
        }/project/${project_id}/labels`,
        json: true
      },
      function(error, labels) {
        if (error != null) {
          return next(error)
        }
        HistoryController._enrichLabels(labels, (err, labels) => {
          if (err) {
            return next(err)
          }
          return res.json(labels)
        })
      }
    )
  },

  createLabel(req, res, next) {
    const project_id = req.params.Project_id
    const { comment, version } = req.body
    const user_id = AuthenticationController.getLoggedInUserId(req)
    return HistoryController._makeRequest(
      {
        method: 'POST',
        url: `${
          settings.apis.project_history.url
        }/project/${project_id}/user/${user_id}/labels`,
        json: { comment, version }
      },
      function(error, label) {
        if (error != null) {
          return next(error)
        }
        HistoryController._enrichLabel(label, (err, label) => {
          if (err) {
            return next(err)
          }
          return res.json(label)
        })
      }
    )
  },

  _enrichLabel(label, callback) {
    if (!label.user_id) {
      return callback(null, label)
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

    // For backwards compatibility expect missing user_id fields
    uniqueUsers.delete(undefined)

    if (!uniqueUsers.size) {
      return callback(null, labels)
    }

    UserGetter.getUsers(
      Array.from(uniqueUsers),
      { first_name: 1, last_name: 1, email: 1 },
      function(err, rawUsers) {
        if (err) {
          return callback(err)
        }
        const users = new Map(rawUsers.map(user => [String(user._id), user]))

        labels.forEach(label => {
          const user = users.get(label.user_id)
          if (!user) return
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
    if (user.name != null) {
      return user.name
    }
    let name = [user.first_name, user.last_name]
      .filter(n => n != null)
      .join(' ')
      .trim()
    if (name === '') {
      name = user.email.split('@')[0]
    }
    if (name == null || name === '') {
      return '?'
    }
    return name
  },

  deleteLabel(req, res, next) {
    const project_id = req.params.Project_id
    const { label_id } = req.params
    const user_id = AuthenticationController.getLoggedInUserId(req)
    return HistoryController._makeRequest(
      {
        method: 'DELETE',
        url: `${
          settings.apis.project_history.url
        }/project/${project_id}/user/${user_id}/labels/${label_id}`
      },
      function(error) {
        if (error != null) {
          return next(error)
        }
        return res.sendStatus(204)
      }
    )
  },

  _makeRequest(options, callback) {
    return request(options, function(error, response, body) {
      if (error != null) {
        return callback(error)
      }
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return callback(null, body)
      } else {
        error = new Error(
          `history api responded with non-success code: ${response.statusCode}`
        )
        return callback(error)
      }
    })
  },

  downloadZipOfVersion(req, res, next) {
    const { project_id, version } = req.params
    return ProjectDetailsHandler.getDetails(project_id, function(err, project) {
      if (err != null) {
        return next(err)
      }
      const v1_id = __guard__(
        project.overleaf != null ? project.overleaf.history : undefined,
        x => x.id
      )
      if (v1_id == null) {
        logger.err(
          { project_id, version },
          'got request for zip version of non-v1 history project'
        )
        return res.sendStatus(402)
      }
      return HistoryController._pipeHistoryZipToResponse(
        v1_id,
        version,
        `${project.name} (Version ${version})`,
        req,
        res,
        next
      )
    })
  },

  _pipeHistoryZipToResponse(v1_project_id, version, name, req, res, next) {
    if (req.aborted) {
      // client has disconnected -- skip project history api call and download
      return
    }
    // increase timeout to 6 minutes
    res.setTimeout(6 * 60 * 1000)
    const url = `${
      settings.apis.v1_history.url
    }/projects/${v1_project_id}/version/${version}/zip`
    const options = {
      auth: {
        user: settings.apis.v1_history.user,
        pass: settings.apis.v1_history.pass
      },
      json: true,
      method: 'post',
      url
    }
    return request(options, function(err, response, body) {
      if (err) {
        OError.tag(err, 'history API error', {
          v1_project_id,
          version
        })
        return next(err)
      }
      if (req.aborted) {
        // client has disconnected -- skip delayed s3 download
        return
      }
      let retryAttempt = 0
      let retryDelay = 2000
      // retry for about 6 minutes starting with short delay
      return async.retry(
        40,
        callback =>
          setTimeout(function() {
            if (req.aborted) {
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
              sendImmediately: true
            })
            const abortS3Request = () => getReq.abort()
            req.on('aborted', abortS3Request)
            res.on('timeout', abortS3Request)
            function cleanupAbortTrigger() {
              req.off('aborted', abortS3Request)
              res.off('timeout', abortS3Request)
            }
            getReq.on('response', function(response) {
              if (response.statusCode !== 200) {
                cleanupAbortTrigger()
                return callback(new Error('invalid response'))
              }
              // pipe also proxies the headers, but we want to customize these ones
              delete response.headers['content-disposition']
              delete response.headers['content-type']
              res.status(response.statusCode)
              res.setContentDisposition('attachment', {
                filename: `${name}.zip`
              })
              res.contentType('application/zip')
              pipeline(response, res, err => {
                if (err) {
                  logger.warn(
                    { err, v1_project_id, version, retryAttempt },
                    'history s3 proxying error'
                  )
                }
              })
              callback()
            })
            return getReq.on('error', function(err) {
              logger.warn(
                { err, v1_project_id, version, retryAttempt },
                'history s3 download error'
              )
              cleanupAbortTrigger()
              return callback(err)
            })
          }, retryDelay),
        function(err) {
          if (err) {
            OError.tag(err, 'history s3 download failed', {
              v1_project_id,
              version,
              retryAttempt
            })
            return next(err)
          }
        }
      )
    })
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
