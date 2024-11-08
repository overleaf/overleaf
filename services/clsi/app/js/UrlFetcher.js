const fs = require('node:fs')
const logger = require('@overleaf/logger')
const Settings = require('@overleaf/settings')
const {
  CustomHttpAgent,
  CustomHttpsAgent,
  fetchStream,
} = require('@overleaf/fetch-utils')
const { URL } = require('node:url')
const { pipeline } = require('node:stream/promises')
const Metrics = require('./Metrics')

const MAX_CONNECT_TIME = 1000
const httpAgent = new CustomHttpAgent({ connectTimeout: MAX_CONNECT_TIME })
const httpsAgent = new CustomHttpsAgent({ connectTimeout: MAX_CONNECT_TIME })

async function pipeUrlToFileWithRetry(url, filePath) {
  let remainingAttempts = 3
  let lastErr
  while (remainingAttempts-- > 0) {
    const timer = new Metrics.Timer('url_fetcher', {
      path: lastErr ? ' retry' : 'fetch',
    })
    try {
      await pipeUrlToFile(url, filePath)
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

async function pipeUrlToFile(url, filePath) {
  const u = new URL(url)
  if (
    Settings.filestoreDomainOveride &&
    u.host !== Settings.apis.clsiPerf.host
  ) {
    url = `${Settings.filestoreDomainOveride}${u.pathname}${u.search}`
  }

  const stream = await fetchStream(url, {
    signal: AbortSignal.timeout(60 * 1000),
    // provide a function to get the agent for each request
    // as there may be multiple requests with different protocols
    // due to redirects.
    agent: _url => (_url.protocol === 'https:' ? httpsAgent : httpAgent),
  })

  const atomicWrite = filePath + '~'
  try {
    const output = fs.createWriteStream(atomicWrite)
    await pipeline(stream, output)
    await fs.promises.rename(atomicWrite, filePath)
    Metrics.count('UrlFetcher.downloaded_bytes', output.bytesWritten)
  } catch (err) {
    try {
      await fs.promises.unlink(atomicWrite)
    } catch (e) {}
    throw err
  }
}

module.exports.promises = {
  pipeUrlToFileWithRetry,
}
