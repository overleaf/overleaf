const fs = require('fs')
const logger = require('@overleaf/logger')
const Settings = require('@overleaf/settings')
const { fetchStream } = require('@overleaf/fetch-utils')
const { URL } = require('url')
const { pipeline } = require('stream/promises')

async function pipeUrlToFileWithRetry(url, filePath) {
  let remainingAttempts = 3
  let lastErr
  while (remainingAttempts-- > 0) {
    try {
      await pipeUrlToFile(url, filePath)
      return
    } catch (err) {
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
  })

  const atomicWrite = filePath + '~'
  try {
    await pipeline(stream, fs.createWriteStream(atomicWrite))
    await fs.promises.rename(atomicWrite, filePath)
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
