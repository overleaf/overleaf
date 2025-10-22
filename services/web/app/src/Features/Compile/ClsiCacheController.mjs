import { NotFoundError, ResourceGoneError } from '../Errors/Errors.js'
import {
  fetchStreamWithResponse,
  RequestFailedError,
} from '@overleaf/fetch-utils'
import Path from 'node:path'
import { pipeline } from 'node:stream/promises'
import logger from '@overleaf/logger'
import ClsiCacheManager from './ClsiCacheManager.mjs'
import CompileController from './CompileController.mjs'
import { expressify } from '@overleaf/promise-utils'
import ClsiCacheHandler from './ClsiCacheHandler.mjs'
import ProjectGetter from '../Project/ProjectGetter.mjs'
import { MeteredStream } from '@overleaf/stream-utils'
import Metrics from '@overleaf/metrics'

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
    await pipeline(
      stream,
      new MeteredStream(Metrics, 'clsi_cache_egress', {
        path: ClsiCacheHandler.getEgressLabel(filename),
      }),
      res
    )
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
      stats,
      timings,
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
      stats,
      timings,
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

export default {
  downloadFromCache: expressify(downloadFromCache),
  getLatestBuildFromCache: expressify(getLatestBuildFromCache),
}
