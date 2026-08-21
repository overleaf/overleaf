// @ts-check

import { pipeline } from 'node:stream/promises'
import logger from '@overleaf/logger'
import { expressify } from '@overleaf/promise-utils'
import Metrics from '@overleaf/metrics'
import ProjectLocator from '../Project/ProjectLocator.mjs'
import HistoryManager from '../History/HistoryManager.mjs'
import Errors from '../Errors/Errors.js'
import { preparePlainTextResponse } from '../../infrastructure/Response.mjs'
import { z, zz, parseReq } from '../../infrastructure/Validation.mjs'

/**
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 * @typedef {import('express').NextFunction} NextFunction
 */

const getFileSchema = z.object({
  params: z.strictObject({
    Project_id: zz.objectId(),
    File_id: zz.objectId(),
  }),
  // the query string isn't read for any decision-making -- only logged
  // verbatim for debugging, so treat it as a generic open map
  query: z.record(z.string(), z.unknown()),
})

const getFileHeadSchema = z.object({
  params: z.strictObject({
    Project_id: zz.objectId(),
    File_id: zz.objectId(),
  }),
})

/**
 * @param {Request} req
 * @param {Response} res
 */
async function getFile(req, res) {
  const { params, query } = parseReq(req, getFileSchema, { logOnly: true })
  const projectId = params.Project_id
  const fileId = params.File_id
  const queryString = query
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

  let stream, contentLength
  try {
    // Get the file from history
    ;({ stream, contentLength } =
      await HistoryManager.promises.requestBlobWithProjectId(
        projectId,
        file.hash,
        'GET'
      ))
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
  try {
    await pipeline(stream, res)
  } catch (err) {
    if (
      err instanceof Error &&
      'code' in err &&
      (err.code === 'ERR_STREAM_PREMATURE_CLOSE' ||
        err.code === 'ERR_STREAM_UNABLE_TO_PIPE')
    ) {
      // Ignore clients closing the connection prematurely
      return
    }
    throw err
  }
}

/**
 * @param {Request} req
 * @param {Response} res
 */
async function getFileHead(req, res) {
  const { params } = parseReq(req, getFileHeadSchema, { logOnly: true })
  const projectId = params.Project_id
  const fileId = params.File_id

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

  let fileSize
  try {
    ;({ contentLength: fileSize } =
      await HistoryManager.promises.requestBlobWithProjectId(
        projectId,
        file.hash,
        'HEAD'
      ))
  } catch (err) {
    if (err instanceof Errors.NotFoundError) {
      return res.status(404).end()
    } else {
      logger.err({ err, projectId, fileId }, 'error obtaining file size')
      return res.status(500).end()
    }
  }

  res.setHeader('Content-Length', fileSize)
  res.status(200).end()
}

/**
 * @param {any} file
 */
function isHtml(file) {
  return (
    fileEndsWith(file, '.html') ||
    fileEndsWith(file, '.htm') ||
    fileEndsWith(file, '.xhtml')
  )
}

/**
 * @param {any} file
 * @param {any} ext
 */
function fileEndsWith(file, ext) {
  return (
    file.name != null &&
    file.name.length > ext.length &&
    file.name.lastIndexOf(ext) === file.name.length - ext.length
  )
}

/**
 * @param {any} userAgent
 */
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
