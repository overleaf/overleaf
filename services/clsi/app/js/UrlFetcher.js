const fs = require('node:fs')
const logger = require('@overleaf/logger')
const Settings = require('@overleaf/settings')
const {
  CustomHttpAgent,
  CustomHttpsAgent,
  fetchStream,
  RequestFailedError,
} = require('@overleaf/fetch-utils')
const { URL } = require('node:url')
const { pipeline } = require('node:stream/promises')
const Metrics = require('./Metrics')

const MAX_CONNECT_TIME = 1000
const httpAgent = new CustomHttpAgent({ connectTimeout: MAX_CONNECT_TIME })
const httpsAgent = new CustomHttpsAgent({ connectTimeout: MAX_CONNECT_TIME })

async function pipeUrlToFileWithRetry(url, fallbackURL, filePath) {
  let remainingAttempts = 3
  let lastErr
  while (remainingAttempts-- > 0) {
    const timer = new Metrics.Timer('url_fetcher', {
      path: lastErr ? ' retry' : 'fetch',
    })
    try {
      await pipeUrlToFile(url, fallbackURL, filePath)
      timer.done({ status: 'success' })
      return
    } catch (err) {
      timer.done({ status: 'error' })
      logger.warn(
        { err, url, filePath, remainingAttempts },
        'error downloading url'
      )
      lastErr = err
    }
  }
  throw lastErr
}

async function pipeUrlToFile(url, fallbackURL, filePath) {
  const u = new URL(url)
  if (
    Settings.filestoreDomainOveride &&
    u.host !== Settings.apis.clsiPerf.host
  ) {
    url = `${Settings.filestoreDomainOveride}${u.pathname}${u.search}`
  }
  if (fallbackURL) {
    const u2 = new URL(fallbackURL)
    if (
      Settings.filestoreDomainOveride &&
      u2.host !== Settings.apis.clsiPerf.host
    ) {
      fallbackURL = `${Settings.filestoreDomainOveride}${u2.pathname}${u2.search}`
    }
  }

  let stream
  try {
    stream = await fetchStream(url, {
      signal: AbortSignal.timeout(60 * 1000),
      // provide a function to get the agent for each request
      // as there may be multiple requests with different protocols
      // due to redirects.
      agent: _url => (_url.protocol === 'https:' ? httpsAgent : httpAgent),
    })
  } catch (err) {
    if (
      fallbackURL &&
      err instanceof RequestFailedError &&
      err.response.status === 404
    ) {
      stream = await fetchStream(fallbackURL, {
        signal: AbortSignal.timeout(60 * 1000),
        // provide a function to get the agent for each request
        // as there may be multiple requests with different protocols
        // due to redirects.
        agent: _url => (_url.protocol === 'https:' ? httpsAgent : httpAgent),
      })
      url = fallbackURL
    } else {
      throw err
    }
  }

  const source = inferSource(url)
  Metrics.inc('url_source', 1, { path: source })

  const atomicWrite = filePath + '~'
  try {
    const output = fs.createWriteStream(atomicWrite)
    await pipeline(stream, output)
    await fs.promises.rename(atomicWrite, filePath)
    Metrics.count('UrlFetcher.downloaded_bytes', output.bytesWritten, {
      path: source,
    })
  } catch (err) {
    try {
      await fs.promises.unlink(atomicWrite)
    } catch (e) {}
    throw err
  }
}

const BUCKET_REGEX = /\/bucket\/([^/]+)\/key\//

function inferSource(url) {
  if (url.includes(Settings.apis.clsiPerf.host)) {
    return 'clsi-perf'
  } else if (url.includes('/project/') && url.includes('/file/')) {
    return 'user-files'
  } else if (url.includes('/key/')) {
    const match = url.match(BUCKET_REGEX)
    if (match) return match[1]
  }
  return 'unknown'
}

module.exports.promises = {
  pipeUrlToFileWithRetry,
}
