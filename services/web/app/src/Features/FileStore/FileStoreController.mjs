// @ts-check

import { pipeline } from 'node:stream/promises'
import logger from '@overleaf/logger'
import { expressify } from '@overleaf/promise-utils'
import Metrics from '@overleaf/metrics'
import FileStoreHandler from './FileStoreHandler.js'
import ProjectLocator from '../Project/ProjectLocator.js'
import HistoryManager from '../History/HistoryManager.js'
import Errors from '../Errors/Errors.js'
import Features from '../../infrastructure/Features.js'
import { preparePlainTextResponse } from '../../infrastructure/Response.js'

async function getFile(req, res) {
  const projectId = req.params.Project_id
  const fileId = req.params.File_id
  const queryString = req.query
  const userAgent = req.get('User-Agent')
  req.logger.addFields({ projectId, fileId, queryString })

  let file
  try {
    ;({ element: file } = await ProjectLocator.promises.findElement({
      project_id: projectId,
      element_id: fileId,
      type: 'file',
    }))
  } catch (err) {
    if (err instanceof Errors.NotFoundError) {
      logger.warn(
        { err, projectId, fileId, queryString },
        'entity not found when downloading file'
      )
      // res.sendStatus() sends a description of the status as body.
      // Using res.status().end() avoids sending that fake body.
      return res.status(404).end()
    } else {
      // Instead of using the global error handler, we send an empty response in
      // case the client forgets to check the response status. This is arguably
      // not our responsibility, and it won't work if something else breaks in
      // this endpoint, so it could be revisited in the future.
      logger.err(
        { err, projectId, fileId, queryString },
        'error finding element for downloading file'
      )
      return res.status(500).end()
    }
  }

  // This metric has this name because it used to be recorded in a middleware.
  // It tracks how many files have a hash and can be served by the history
  // system.
  Metrics.inc('fileToBlobRedirectMiddleware', 1, {
    method: 'GET',
    status: Boolean(file?.hash),
  })

  let source, stream, contentLength
  try {
    if (Features.hasFeature('project-history-blobs') && file?.hash) {
      // Get the file from history
      ;({ source, stream, contentLength } =
        await HistoryManager.promises.requestBlobWithFallback(
          projectId,
          file.hash,
          fileId
        ))
    } else {
      // The file-hash is missing. Fall back to filestore.
      stream = await FileStoreHandler.promises.getFileStream(
        projectId,
        fileId,
        queryString
      )
      source = 'filestore'
    }
  } catch (err) {
    if (err instanceof Errors.NotFoundError) {
      return res.status(404).end()
    } else {
      logger.err(
        { err, projectId, fileId, queryString },
        'error finding element for downloading file'
      )
      return res.status(500).end()
    }
  }

  // mobile safari will try to render html files, prevent this
  if (isMobileSafari(userAgent) && isHtml(file)) {
    preparePlainTextResponse(res)
  }
  if (contentLength) {
    res.setHeader('Content-Length', contentLength)
  }
  res.setContentDisposition('attachment', { filename: file.name })
  // allow the browser to cache these immutable files
  // note: both "private" and "max-age" appear to be required for caching
  res.setHeader('Cache-Control', 'private, max-age=3600')
  res.appendHeader('X-Served-By', source)
  try {
    await pipeline(stream, res)
  } catch (err) {
    if (
      err instanceof Error &&
      'code' in err &&
      err.code === 'ERR_STREAM_PREMATURE_CLOSE'
    ) {
      // Ignore clients closing the connection prematurely
      return
    }
    throw err
  }
}

async function getFileHead(req, res) {
  const projectId = req.params.Project_id
  const fileId = req.params.File_id

  let file
  try {
    ;({ element: file } = await ProjectLocator.promises.findElement({
      project_id: projectId,
      element_id: fileId,
      type: 'file',
    }))
  } catch (err) {
    if (err instanceof Errors.NotFoundError) {
      // res.sendStatus() sends a description of the status as body.
      // Using res.status().end() avoids sending that fake body.
      return res.status(404).end()
    } else {
      // Instead of using the global error handler, we send an empty response in
      // case the client forgets to check the response status. This is arguably
      // not our responsibility, and it won't work if something else breaks in
      // this endpoint, so it could be revisited in the future.
      logger.err(
        { err, projectId, fileId },
        'error finding element for downloading file'
      )
      return res.status(500).end()
    }
  }

  // This metric has this name because it used to be recorded in a middleware.
  // It tracks how many files have a hash and can be served by the history
  // system.
  Metrics.inc('fileToBlobRedirectMiddleware', 1, {
    method: 'HEAD',
    status: Boolean(file?.hash),
  })

  let fileSize, source
  try {
    if (Features.hasFeature('project-history-blobs') && file?.hash) {
      ;({ source, contentLength: fileSize } =
        await HistoryManager.promises.requestBlobWithFallback(
          projectId,
          file.hash,
          fileId,
          'HEAD'
        ))
    } else {
      fileSize = await FileStoreHandler.promises.getFileSize(projectId, fileId)
      source = 'filestore'
    }
  } catch (err) {
    if (err instanceof Errors.NotFoundError) {
      return res.status(404).end()
    } else {
      logger.err({ err, projectId, fileId }, 'error obtaining file size')
      return res.status(500).end()
    }
  }

  res.setHeader('Content-Length', fileSize)
  res.appendHeader('X-Served-By', source)
  res.status(200).end()
}

function isHtml(file) {
  return (
    fileEndsWith(file, '.html') ||
    fileEndsWith(file, '.htm') ||
    fileEndsWith(file, '.xhtml')
  )
}

function fileEndsWith(file, ext) {
  return (
    file.name != null &&
    file.name.length > ext.length &&
    file.name.lastIndexOf(ext) === file.name.length - ext.length
  )
}

function isMobileSafari(userAgent) {
  return (
    userAgent &&
    (userAgent.indexOf('iPhone') >= 0 || userAgent.indexOf('iPad') >= 0)
  )
}

export default {
  getFile: expressify(getFile),
  getFileHead: expressify(getFileHead),
}
