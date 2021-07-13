/* eslint-disable
    camelcase,
    handle-callback-err,
    no-unsafe-negation,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let PersistenceManager
const Settings = require('@overleaf/settings')
const Errors = require('./Errors')
const Metrics = require('./Metrics')
const logger = require('logger-sharelatex')
const request = require('requestretry').defaults({
  maxAttempts: 2,
  retryDelay: 10,
})

// We have to be quick with HTTP calls because we're holding a lock that
// expires after 30 seconds. We can't let any errors in the rest of the stack
// hold us up, and need to bail out quickly if there is a problem.
const MAX_HTTP_REQUEST_LENGTH = 5000 // 5 seconds

const updateMetric = function (method, error, response) {
  // find the status, with special handling for connection timeouts
  // https://github.com/request/request#timeouts
  const status = (() => {
    if ((error != null ? error.connect : undefined) === true) {
      return `${error.code} (connect)`
    } else if (error != null) {
      return error.code
    } else if (response != null) {
      return response.statusCode
    }
  })()
  Metrics.inc(method, 1, { status })
  if ((error != null ? error.attempts : undefined) > 1) {
    Metrics.inc(`${method}-retries`, 1, { status: 'error' })
  }
  if ((response != null ? response.attempts : undefined) > 1) {
    return Metrics.inc(`${method}-retries`, 1, { status: 'success' })
  }
}

module.exports = PersistenceManager = {
  getDoc(project_id, doc_id, _callback) {
    if (_callback == null) {
      _callback = function (
        error,
        lines,
        version,
        ranges,
        pathname,
        projectHistoryId,
        projectHistoryType
      ) {}
    }
    const timer = new Metrics.Timer('persistenceManager.getDoc')
    const callback = function (...args) {
      timer.done()
      return _callback(...Array.from(args || []))
    }

    const urlPath = `/project/${project_id}/doc/${doc_id}`
    return request(
      {
        url: `${Settings.apis.web.url}${urlPath}`,
        method: 'GET',
        headers: {
          accept: 'application/json',
        },
        auth: {
          user: Settings.apis.web.user,
          pass: Settings.apis.web.pass,
          sendImmediately: true,
        },
        jar: false,
        timeout: MAX_HTTP_REQUEST_LENGTH,
      },
      function (error, res, body) {
        updateMetric('getDoc', error, res)
        if (error != null) {
          logger.error(
            { err: error, project_id, doc_id },
            'web API request failed'
          )
          return callback(new Error('error connecting to web API'))
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            body = JSON.parse(body)
          } catch (e) {
            return callback(e)
          }
          if (body.lines == null) {
            return callback(new Error('web API response had no doc lines'))
          }
          if (body.version == null || !body.version instanceof Number) {
            return callback(
              new Error('web API response had no valid doc version')
            )
          }
          if (body.pathname == null) {
            return callback(
              new Error('web API response had no valid doc pathname')
            )
          }
          return callback(
            null,
            body.lines,
            body.version,
            body.ranges,
            body.pathname,
            body.projectHistoryId,
            body.projectHistoryType
          )
        } else if (res.statusCode === 404) {
          return callback(
            new Errors.NotFoundError(`doc not not found: ${urlPath}`)
          )
        } else {
          return callback(
            new Error(`error accessing web API: ${urlPath} ${res.statusCode}`)
          )
        }
      }
    )
  },

  setDoc(
    project_id,
    doc_id,
    lines,
    version,
    ranges,
    lastUpdatedAt,
    lastUpdatedBy,
    _callback
  ) {
    if (_callback == null) {
      _callback = function (error) {}
    }
    const timer = new Metrics.Timer('persistenceManager.setDoc')
    const callback = function (...args) {
      timer.done()
      return _callback(...Array.from(args || []))
    }

    const urlPath = `/project/${project_id}/doc/${doc_id}`
    return request(
      {
        url: `${Settings.apis.web.url}${urlPath}`,
        method: 'POST',
        json: {
          lines,
          ranges,
          version,
          lastUpdatedBy,
          lastUpdatedAt,
        },
        auth: {
          user: Settings.apis.web.user,
          pass: Settings.apis.web.pass,
          sendImmediately: true,
        },
        jar: false,
        timeout: MAX_HTTP_REQUEST_LENGTH,
      },
      function (error, res, body) {
        updateMetric('setDoc', error, res)
        if (error != null) {
          logger.error(
            { err: error, project_id, doc_id },
            'web API request failed'
          )
          return callback(new Error('error connecting to web API'))
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          return callback(null)
        } else if (res.statusCode === 404) {
          return callback(
            new Errors.NotFoundError(`doc not not found: ${urlPath}`)
          )
        } else {
          return callback(
            new Error(`error accessing web API: ${urlPath} ${res.statusCode}`)
          )
        }
      }
    )
  },
}
