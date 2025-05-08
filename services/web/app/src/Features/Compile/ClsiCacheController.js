const { NotFoundError, ResourceGoneError } = require('../Errors/Errors')
const {
  fetchStreamWithResponse,
  RequestFailedError,
} = require('@overleaf/fetch-utils')
const Path = require('path')
const { pipeline } = require('stream/promises')
const logger = require('@overleaf/logger')
const ClsiCacheManager = require('./ClsiCacheManager')
const CompileController = require('./CompileController')
const { expressify } = require('@overleaf/promise-utils')
const ClsiCacheHandler = require('./ClsiCacheHandler')
const ProjectGetter = require('../Project/ProjectGetter')

/**
 * Download a file from a specific build on the clsi-cache.
 *
 * @param req
 * @param res
 * @return {Promise<*>}
 */
async function downloadFromCache(req, res) {
  const { Project_id: projectId, buildId, filename } = req.params
  const userId = CompileController._getUserIdForCompile(req)
  const signal = AbortSignal.timeout(60 * 1000)
  let location, projectName
  try {
    ;[{ location }, { name: projectName }] = await Promise.all([
      ClsiCacheHandler.getOutputFile(
        projectId,
        userId,
        buildId,
        filename,
        signal
      ),
      ProjectGetter.promises.getProject(projectId, { name: 1 }),
    ])
  } catch (err) {
    if (err instanceof NotFoundError) {
      // res.sendStatus() sends a description of the status as body.
      // Using res.status().end() avoids sending that fake body.
      return res.status(404).end()
    } else {
      throw err
    }
  }

  const { stream, response } = await fetchStreamWithResponse(location, {
    signal,
  })
  if (req.destroyed) {
    // The client has disconnected already, avoid trying to write into the broken connection.
    return
  }

  for (const key of ['Content-Length', 'Content-Type']) {
    if (response.headers.has(key)) res.setHeader(key, response.headers.get(key))
  }
  const ext = Path.extname(filename)
  res.attachment(
    ext === '.pdf'
      ? `${CompileController._getSafeProjectName({ name: projectName })}.pdf`
      : filename
  )
  try {
    res.writeHead(response.status)
    await pipeline(stream, res)
  } catch (err) {
    const reqAborted = Boolean(req.destroyed)
    const streamingStarted = Boolean(res.headersSent)
    if (!streamingStarted) {
      if (err instanceof RequestFailedError) {
        res.sendStatus(err.response.status)
      } else {
        res.sendStatus(500)
      }
    }
    if (
      streamingStarted &&
      reqAborted &&
      err.code === 'ERR_STREAM_PREMATURE_CLOSE'
    ) {
      // Ignore noisy spurious error
      return
    }
    logger.warn(
      {
        err,
        projectId,
        location,
        filename,
        reqAborted,
        streamingStarted,
      },
      'CLSI-cache proxy error'
    )
  }
}

/**
 * Prepare a compile response from the clsi-cache.
 *
 * @param req
 * @param res
 * @return {Promise<void>}
 */
async function getLatestBuildFromCache(req, res) {
  const { Project_id: projectId } = req.params
  const userId = CompileController._getUserIdForCompile(req)
  try {
    const {
      zone,
      outputFiles,
      compileGroup,
      clsiServerId,
      clsiCacheShard,
      options,
    } = await ClsiCacheManager.getLatestCompileResult(projectId, userId)

    let { pdfCachingMinChunkSize, pdfDownloadDomain } =
      await CompileController._getSplitTestOptions(req, res)
    pdfDownloadDomain += `/zone/${zone}`
    res.json({
      fromCache: true,
      status: 'success',
      outputFiles,
      compileGroup,
      clsiServerId,
      clsiCacheShard,
      pdfDownloadDomain,
      pdfCachingMinChunkSize,
      options,
    })
  } catch (err) {
    if (err instanceof NotFoundError) {
      res.sendStatus(404)
    } else if (err instanceof ResourceGoneError) {
      res.sendStatus(410)
    } else {
      throw err
    }
  }
}

module.exports = {
  downloadFromCache: expressify(downloadFromCache),
  getLatestBuildFromCache: expressify(getLatestBuildFromCache),
}
