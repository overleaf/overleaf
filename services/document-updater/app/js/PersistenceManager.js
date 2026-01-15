const { promisify } = require('node:util')
const { promisifyMultiResult } = require('@overleaf/promise-utils')
const Settings = require('@overleaf/settings')
const Errors = require('./Errors')
const Metrics = require('./Metrics')
const logger = require('@overleaf/logger')
const request = require('requestretry').defaults({
  maxAttempts: 2,
  retryDelay: 10,
})

// We have to be quick with HTTP calls because we're holding a lock that
// expires after 30 seconds. We can't let any errors in the rest of the stack
// hold us up, and need to bail out quickly if there is a problem.
const MAX_HTTP_REQUEST_LENGTH = 5000 // 5 seconds

function updateMetric(method, error, response) {
  // find the status, with special handling for connection timeouts
  // https://github.com/request/request#timeouts
  let status
  if (error && error.connect === true) {
    status = `${error.code} (connect)`
  } else if (error) {
    status = error.code
  } else if (response) {
    status = response.statusCode
  }

  Metrics.inc(method, 1, { status })
  if (error && error.attempts > 1) {
    Metrics.inc(`${method}-retries`, 1, { status: 'error' })
  }
  if (response && response.attempts > 1) {
    Metrics.inc(`${method}-retries`, 1, { status: 'success' })
  }
}

function getDoc(projectId, docId, options = {}, _callback) {
  const timer = new Metrics.Timer('persistenceManager.getDoc')
  if (typeof options === 'function') {
    _callback = options
    options = {}
  }
  const callback = function (...args) {
    timer.done()
    _callback(...args)
  }

  const urlPath = `/project/${projectId}/doc/${docId}`
  const requestParams = {
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
  }
  if (options.peek) {
    requestParams.qs = { peek: 'true' }
  }
  request(requestParams, (error, res, body) => {
    updateMetric('getDoc', error, res)
    if (error) {
      logger.error({ err: error, projectId, docId }, 'web API request failed')
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
      if (body.version == null) {
        return callback(new Error('web API response had no valid doc version'))
      }
      if (body.pathname == null) {
        return callback(new Error('web API response had no valid doc pathname'))
      }
      if (!body.pathname) {
        logger.warn(
          { projectId, docId },
          'missing pathname in PersistenceManager getDoc'
        )
        Metrics.inc('pathname', 1, {
          path: 'PersistenceManager.getDoc',
          status: body.pathname === '' ? 'zero-length' : 'undefined',
        })
      }

      if (body.otMigrationStage > 0) {
        // Use history-ot
        body.lines = { content: body.lines.join('\n') }
        body.ranges = {}
      }

      if (!body.projectHistoryId) {
        logger.warn(
          { projectId, docId },
          'projectHistoryId not found for doc from web'
        )
      }

      callback(
        null,
        body.lines,
        body.version,
        body.ranges,
        body.pathname,
        body.projectHistoryId?.toString(),
        body.historyRangesSupport || false,
        body.resolvedCommentIds || []
      )
    } else if (res.statusCode === 404) {
      callback(new Errors.NotFoundError(`doc not not found: ${urlPath}`))
    } else if (res.statusCode === 413) {
      callback(
        new Errors.FileTooLargeError(`doc exceeds maximum size: ${urlPath}`)
      )
    } else {
      callback(
        new Error(`error accessing web API: ${urlPath} ${res.statusCode}`)
      )
    }
  })
}

function setDoc(
  projectId,
  docId,
  lines,
  version,
  ranges,
  lastUpdatedAt,
  lastUpdatedBy,
  _callback
) {
  const timer = new Metrics.Timer('persistenceManager.setDoc')
  const callback = function (...args) {
    timer.done()
    _callback(...args)
  }

  const urlPath = `/project/${projectId}/doc/${docId}`
  request(
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
    (error, res, body) => {
      updateMetric('setDoc', error, res)
      if (error) {
        logger.error({ err: error, projectId, docId }, 'web API request failed')
        return callback(new Error('error connecting to web API'))
      }
      if (res.statusCode >= 200 && res.statusCode < 300) {
        callback(null, body)
      } else if (res.statusCode === 404) {
        callback(new Errors.NotFoundError(`doc not not found: ${urlPath}`))
      } else if (res.statusCode === 413) {
        callback(
          new Errors.FileTooLargeError(`doc exceeds maximum size: ${urlPath}`)
        )
      } else {
        callback(
          new Error(`error accessing web API: ${urlPath} ${res.statusCode}`)
        )
      }
    }
  )
}

module.exports = {
  getDoc,
  setDoc,
  promises: {
    getDoc: promisifyMultiResult(getDoc, [
      'lines',
      'version',
      'ranges',
      'pathname',
      'projectHistoryId',
      'historyRangesSupport',
      'resolvedCommentIds',
    ]),
    setDoc: promisify(setDoc),
  },
}
