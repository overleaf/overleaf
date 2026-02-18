// @ts-check
const { setTimeout } = require('node:timers/promises')
const Settings = require('@overleaf/settings')
const Errors = require('./Errors')
const OError = require('@overleaf/o-error')
const Metrics = require('./Metrics')
const logger = require('@overleaf/logger')
const { fetchJson, RequestFailedError } = require('@overleaf/fetch-utils')

const MAX_ATTEMPTS = 2
const RETRY_DELAY_MS = 10
// We have to be quick with HTTP calls because we're holding a lock that
// expires after 30 seconds. We can't let any errors in the rest of the stack
// hold us up, and need to bail out quickly if there is a problem.
const MAX_HTTP_REQUEST_LENGTH = 5000 // 5 seconds

async function getDocOnce(projectId, docId, options = {}) {
  const timer = new Metrics.Timer('persistenceManager.getDoc')
  const info = { projectId, docId } // for errors
  const url = new URL(
    `/project/${projectId}/doc/${docId}`,
    Settings.apis.web.url
  )
  if (options.peek) {
    // used by resyncs
    url.searchParams.set('peek', 'true')
  }
  const fetchParams = {
    method: 'GET',
    basicAuth: {
      user: Settings.apis.web.user,
      password: Settings.apis.web.pass,
    },
    signal: AbortSignal.timeout(MAX_HTTP_REQUEST_LENGTH),
  }
  try {
    const body = await fetchJson(url, fetchParams)

    if (body.lines == null) {
      throw new Errors.DocumentValidationError(
        'web API response had no doc lines',
        info
      )
    }
    if (body.version == null) {
      throw new Errors.DocumentValidationError(
        'web API response had no valid doc version',
        info
      )
    }
    if (body.pathname == null) {
      throw new Errors.DocumentValidationError(
        'web API response had no valid doc pathname',
        info
      )
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
    Metrics.inc('getDoc', 1, { status: '200' })
    return {
      lines: body.lines,
      version: body.version,
      ranges: body.ranges,
      pathname: body.pathname,
      projectHistoryId: body.projectHistoryId?.toString(),
      historyRangesSupport: body.historyRangesSupport || false,
      resolvedCommentIds: body.resolvedCommentIds || [],
    }
  } catch (err) {
    let status
    if (err instanceof RequestFailedError) {
      status = err.response?.status
    } else if (err instanceof Errors.DocumentValidationError) {
      status = 'validation-error'
    } else if (err instanceof Error && 'code' in err) {
      status = err.code
    } else {
      status = 'unknown'
    }
    Metrics.inc('getDoc', 1, { status })
    if (err instanceof RequestFailedError) {
      if (status === 404) {
        throw new Errors.NotFoundError('doc not found', info)
      } else if (status === 413) {
        throw new Errors.FileTooLargeError('doc exceeds maximum size', info)
      } else {
        throw new Errors.WebApiServerError('error accessing web API', {
          ...info,
          status,
        })
      }
    } else if (err instanceof Errors.DocumentValidationError) {
      throw err
    } else {
      throw OError.tag(err, 'getDoc failed', info)
    }
  } finally {
    timer.done()
  }
}

async function setDocOnce(
  projectId,
  docId,
  lines,
  version,
  ranges,
  lastUpdatedAt,
  lastUpdatedBy
) {
  const timer = new Metrics.Timer('persistenceManager.setDoc')

  const info = { projectId, docId } // for errors
  const url = new URL(
    `/project/${projectId}/doc/${docId}`,
    Settings.apis.web.url
  )
  const fetchParams = {
    method: 'POST',
    json: {
      lines,
      ranges,
      version,
      lastUpdatedBy,
      lastUpdatedAt,
    },
    basicAuth: {
      user: Settings.apis.web.user,
      password: Settings.apis.web.pass,
    },
    signal: AbortSignal.timeout(MAX_HTTP_REQUEST_LENGTH),
  }
  try {
    const result = await fetchJson(url, fetchParams)
    Metrics.inc('setDoc', 1, { status: '200' })
    return result
  } catch (err) {
    let status
    if (err instanceof RequestFailedError) {
      status = err.response?.status
    } else if (err instanceof Error && 'code' in err) {
      status = err.code
    } else {
      status = 'unknown'
    }
    Metrics.inc('setDoc', 1, { status })
    if (err instanceof RequestFailedError) {
      if (status === 404) {
        throw new Errors.NotFoundError('doc not found', info)
      } else if (status === 413) {
        throw new Errors.FileTooLargeError('doc exceeds maximum size', info)
      } else {
        throw new Errors.WebApiServerError('error accessing web API', {
          ...info,
          status,
        })
      }
    } else {
      throw OError.tag(err, 'setDoc failed', info)
    }
  } finally {
    timer.done()
  }
}

// Original set of retryable errors from requestretry
const RETRYABLE_ERRORS = new Set([
  'ECONNRESET',
  'ENOTFOUND',
  'ESOCKETTIMEDOUT',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'EPIPE',
  'EAI_AGAIN',
  'EBUSY',
])

function isRetryable(error) {
  // use the same retryable errors as requestretry
  if (error instanceof Errors.WebApiServerError) {
    const status = error.info?.status
    return (
      typeof status === 'number' &&
      (status === 429 || (status >= 500 && status < 600))
    )
  } else if (typeof error?.code === 'string') {
    return Boolean(RETRYABLE_ERRORS.has(error.code))
  } else {
    return false
  }
}

async function callWithRetries(name, fn) {
  let remainingAttempts = MAX_ATTEMPTS
  while (true) {
    try {
      const result = await fn()
      if (remainingAttempts < MAX_ATTEMPTS) {
        Metrics.inc(`${name}-retries`, 1, { status: 'success' })
      }
      return result
    } catch (err) {
      remainingAttempts--
      if (remainingAttempts > 0 && isRetryable(err)) {
        await setTimeout(RETRY_DELAY_MS)
        continue
      } else {
        if (remainingAttempts < MAX_ATTEMPTS - 1) {
          Metrics.inc(`${name}-retries`, 1, { status: 'error' })
        }
        throw err
      }
    }
  }
}

async function getDocWithRetries(projectId, docId, options = {}) {
  return await callWithRetries('getDoc', async () => {
    return await getDocOnce(projectId, docId, options)
  })
}

async function setDocWithRetries(
  projectId,
  docId,
  lines,
  version,
  ranges,
  lastUpdatedAt,
  lastUpdatedBy
) {
  return await callWithRetries('setDoc', async () => {
    return await setDocOnce(
      projectId,
      docId,
      lines,
      version,
      ranges,
      lastUpdatedAt,
      lastUpdatedBy
    )
  })
}

module.exports = {
  promises: {
    getDoc: getDocWithRetries,
    setDoc: setDocWithRetries,
  },
}
