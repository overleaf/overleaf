const { NotFoundError } = require('../Errors/Errors')
const {
  fetchStreamWithResponse,
  RequestFailedError,
  fetchJson,
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
      internal: { location: metaLocation, zone },
      external: { isUpToDate, allFiles },
    } = await ClsiCacheManager.getLatestBuildFromCache(
      projectId,
      userId,
      'output.overleaf.json'
    )

    if (!isUpToDate) return res.sendStatus(410)

    const meta = await fetchJson(metaLocation, {
      signal: AbortSignal.timeout(5 * 1000),
    })

    const [, editorId, buildId] = metaLocation.match(
      /\/build\/([a-f0-9-]+?)-([a-f0-9]+-[a-f0-9]+)\//
    )

    let baseURL = `/project/${projectId}`
    if (userId) {
      baseURL += `/user/${userId}`
    }

    const { ranges, contentId, clsiServerId, compileGroup, size, options } =
      meta

    const outputFiles = allFiles
      .filter(
        path => path !== 'output.overleaf.json' && path !== 'output.tar.gz'
      )
      .map(path => {
        const f = {
          url: `${baseURL}/build/${editorId}-${buildId}/output/${path}`,
          downloadURL: `/download/project/${projectId}/build/${editorId}-${buildId}/output/cached/${path}`,
          build: buildId,
          path,
          type: path.split('.').pop(),
        }
        if (path === 'output.pdf') {
          Object.assign(f, {
            size,
            editorId,
          })
          if (clsiServerId !== 'cache') {
            // Enable PDF caching and attempt to download from VM first.
            // (clsi VMs do not have the editorId in the path on disk, omit it).
            Object.assign(f, {
              url: `${baseURL}/build/${buildId}/output/output.pdf`,
              ranges,
              contentId,
            })
          }
        }
        return f
      })
    let { pdfCachingMinChunkSize, pdfDownloadDomain } =
      await CompileController._getSplitTestOptions(req, res)
    pdfDownloadDomain += `/zone/${zone}`
    res.json({
      fromCache: true,
      status: 'success',
      outputFiles,
      compileGroup,
      clsiServerId,
      pdfDownloadDomain,
      pdfCachingMinChunkSize,
      options,
    })
  } catch (err) {
    if (err instanceof NotFoundError) {
      res.sendStatus(404)
    } else {
      throw err
    }
  }
}

module.exports = {
  downloadFromCache: expressify(downloadFromCache),
  getLatestBuildFromCache: expressify(getLatestBuildFromCache),
}
