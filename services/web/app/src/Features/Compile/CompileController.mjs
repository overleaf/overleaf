import { pipeline } from 'node:stream/promises'
import Metrics from '@overleaf/metrics'
import ProjectGetter from '../Project/ProjectGetter.mjs'
import CompileManager from './CompileManager.mjs'
import ClsiManager from './ClsiManager.mjs'
import logger from '@overleaf/logger'
import Settings from '@overleaf/settings'
import Errors from '../Errors/Errors.js'
import SessionManager from '../Authentication/SessionManager.mjs'
import { RateLimiter } from '../../infrastructure/RateLimiter.mjs'
import Validation from '../../infrastructure/Validation.mjs'
import Path from 'node:path'
import AnalyticsManager from '../Analytics/AnalyticsManager.mjs'
import SplitTestHandler from '../SplitTests/SplitTestHandler.mjs'
import { expressify } from '@overleaf/promise-utils'
import {
  fetchStreamWithResponse,
  RequestFailedError,
} from '@overleaf/fetch-utils'
import Features from '../../infrastructure/Features.mjs'
import ClsiCacheController from './ClsiCacheController.mjs'
import { prepareZipAttachment } from '../../infrastructure/Response.mjs'
import ClsiCacheHandler from './ClsiCacheHandler.mjs'
import {
  getFilePath,
  getOutputFileURL,
  getOutputZipURL,
} from './ClsiURLHelpers.mjs'

const { z, zz, parseReq } = Validation

const COMPILE_TIMEOUT_MS = 12 * 60 * 1000

const pdfDownloadRateLimiter = new RateLimiter('full-pdf-download', {
  points: 1000,
  duration: 60 * 60,
})

function getOutputFilesArchiveSpecification(projectId, userId, buildId) {
  const fileName = 'output.zip'
  return {
    path: fileName,
    url: getFilePath(projectId, userId, buildId, fileName),
    type: 'zip',
  }
}

async function _getSplitTestOptions(req, res) {
  const compileFromHistory = await SplitTestHandler.promises.featureFlagEnabled(
    req,
    res,
    'compile-from-history',
    { includeReferer: true }
  )

  const pdfDownloadDomain = Settings.pdfDownloadDomain
  const enablePdfCaching = Settings.enablePdfCaching

  if (!enablePdfCaching || !req.query.enable_pdf_caching) {
    // The frontend does not want to do pdf caching.
    return {
      compileFromHistory,
      pdfDownloadDomain,
      enablePdfCaching: false,
    }
  }

  const pdfCachingMinChunkSize = Settings.pdfCachingMinChunkSize

  const enableCheckpoint = await SplitTestHandler.promises.featureFlagEnabled(
    req,
    res,
    'compile-with-checkpoint',
    { includeReferer: true }
  )

  return {
    compileFromHistory,
    pdfDownloadDomain,
    enablePdfCaching,
    pdfCachingMinChunkSize,
    enableCheckpoint,
  }
}

async function _syncTeX(req, res, direction, validatedOptions) {
  const projectId = req.params.Project_id
  const { editorId, buildId, clsiserverid: clsiServerId } = req.query
  if (!editorId?.match(/^[a-f0-9-]+$/)) throw new Error('invalid ?editorId')
  if (!buildId?.match(/^[a-f0-9-]+$/)) throw new Error('invalid ?buildId')

  const userId = CompileController._getUserIdForCompile(req)
  try {
    const body = await CompileManager.promises.syncTeX(projectId, userId, {
      direction,
      compileFromClsiCache: Features.hasFeature('saas'),
      validatedOptions: {
        ...validatedOptions,
        editorId,
        buildId,
      },
      clsiServerId,
    })
    res.json(body)
  } catch (err) {
    if (err instanceof Errors.NotFoundError) return res.status(404).end()
    throw err
  }
}

const deleteAuxFilesSchema = z.object({
  params: z.object({
    Project_id: zz.objectId(),
  }),
  query: z.object({
    clsiserverid: zz.clsiServerId().optional(),
  }),
})

const wordCountSchema = z.object({
  params: z.object({
    Project_id: zz.objectId(),
  }),
  query: z.object({
    clsiserverid: zz.clsiServerId().optional(),
    file: z.string().optional(),
  }),
})

const getFileForSubmissionFromClsiSchema = z.object({
  params: z.object({
    submissionId: zz.submissionId(),
    build_id: zz.buildId(),
    file: zz.filepath(),
  }),
  query: z.object({
    clsiserverid: zz.clsiServerId().optional(),
  }),
})

const getFileFromClsiSchema = z.object({
  params: z.object({
    Project_id: zz.objectId(),
    build_id: zz.buildId(),
    file: zz.filepath(),
  }),
  query: z.object({
    clsiserverid: zz.clsiServerId().optional(),
    editorId: z.uuid().optional(),
  }),
})

const getOutputPDFFromClsiSchema = z.object({
  params: z.object({
    Project_id: zz.objectId(),
    build_id: zz.buildId(),
  }),
  query: z.object({
    clsiserverid: zz.clsiServerId().optional(),
    editorId: z.uuid().optional(),
  }),
})

const getOutputZipFromClsiSchema = z.object({
  params: z.object({
    Project_id: zz.objectId(),
    build_id: zz.buildId(),
  }),
  query: z.object({
    clsiserverid: zz.clsiServerId().optional(),
  }),
})

const _CompileController = {
  async compile(req, res) {
    res.setTimeout(COMPILE_TIMEOUT_MS)
    const projectId = req.params.Project_id
    const isAutoCompile = !!req.query.auto_compile
    const fileLineErrors = !!req.query.file_line_errors
    const stopOnFirstError = !!req.body.stopOnFirstError
    const userId = SessionManager.getLoggedInUserId(req.session)
    const options = {
      isAutoCompile,
      fileLineErrors,
      stopOnFirstError,
      editorId: req.body.editorId,
      rootResourcePath: req.body.rootResourcePath,
    }

    if (req.body.rootDoc_id) {
      options.rootDoc_id = req.body.rootDoc_id
    } else if (
      req.body.settingsOverride &&
      req.body.settingsOverride.rootDoc_id
    ) {
      // Can be removed after deploy
      options.rootDoc_id = req.body.settingsOverride.rootDoc_id
    }
    if (req.body.compiler) {
      options.compiler = req.body.compiler
    }
    if (req.body.draft) {
      options.draft = req.body.draft
    }
    if (['validate', 'error', 'silent'].includes(req.body.check)) {
      options.check = req.body.check
    }
    if (req.body.incrementalCompilesEnabled) {
      options.incrementalCompilesEnabled = true
    }

    let {
      enablePdfCaching,
      pdfCachingMinChunkSize,
      pdfDownloadDomain,
      compileFromHistory,
      enableCheckpoint,
    } = await _getSplitTestOptions(req, res)
    if (Features.hasFeature('saas')) {
      options.compileFromClsiCache = true
      options.populateClsiCache = true
      options.compileFromHistory = compileFromHistory
      if (enableCheckpoint) {
        options.enableCheckpoint = enableCheckpoint
      }
    }
    options.enablePdfCaching = enablePdfCaching
    if (enablePdfCaching) {
      options.pdfCachingMinChunkSize = pdfCachingMinChunkSize
    }

    const {
      status,
      outputFiles,
      clsiServerId,
      limits,
      validationProblems,
      stats,
      timings,
      outputUrlPrefix,
      buildId,
      clsiCacheShard,
      instanceType,
    } = await CompileManager.promises
      .compile(projectId, userId, options)
      .catch(error => {
        Metrics.inc('compile-error')
        throw error
      })

    Metrics.inc('compile-status', 1, { status })
    if (pdfDownloadDomain && outputUrlPrefix) {
      pdfDownloadDomain += outputUrlPrefix
    }

    if (
      limits &&
      SplitTestHandler.getPercentile(
        AnalyticsManager.getIdsFromSession(req.session).analyticsId,
        'compile-result-backend',
        'release'
      ) === 1
    ) {
      // For a compile request to be sent to clsi we need limits.
      // If we get here without having the limits object populated, it is
      //  a reasonable assumption to make that nothing was compiled.
      // We need to know the limits in order to make use of the events.
      AnalyticsManager.recordEventForSession(
        req.session,
        'compile-result-backend',
        {
          projectId,
          ownerAnalyticsId: limits.ownerAnalyticsId,
          status,
          compileTime: timings?.compileE2E,
          timeout: limits.timeout,
          server: instanceType
            ? instanceType === 'c4d'
              ? 'faster'
              : 'normal'
            : clsiServerId?.includes('-c4d-')
              ? 'faster'
              : 'normal',
          clsiServerId,
          instanceType,
          isAutoCompile,
          isInitialCompile: stats?.isInitialCompile === 1,
          restoredClsiCache: stats?.restoredClsiCache === 1,
          stopOnFirstError,
          isDraftMode: !!options.draft,
        }
      )
    }

    const outputFilesArchive = buildId
      ? getOutputFilesArchiveSpecification(projectId, userId, buildId)
      : null

    res.json({
      status,
      outputFiles,
      outputFilesArchive,
      compileGroup: limits?.compileGroup,
      clsiServerId,
      clsiCacheShard,
      validationProblems,
      stats,
      timings,
      outputUrlPrefix,
      pdfDownloadDomain,
      pdfCachingMinChunkSize,
    })
  },

  async stopCompile(req, res) {
    const projectId = req.params.Project_id
    const userId = SessionManager.getLoggedInUserId(req.session)
    await CompileManager.promises.stopCompile(projectId, userId)
    res.sendStatus(200)
  },

  // Used for submissions through the public API
  async compileSubmission(req, res) {
    res.setTimeout(COMPILE_TIMEOUT_MS)
    const submissionId = req.params.submission_id
    const options = {}
    if (req.body?.rootResourcePath != null) {
      options.rootResourcePath = req.body.rootResourcePath
    }
    if (req.body?.compiler) {
      options.compiler = req.body.compiler
    }
    if (req.body?.draft) {
      options.draft = req.body.draft
    }
    if (['validate', 'error', 'silent'].includes(req.body?.check)) {
      options.check = req.body.check
    }
    options.compileGroup =
      req.body?.compileGroup || Settings.defaultFeatures.compileGroup
    options.compileBackendClass =
      Settings.apis.clsi.submissionCompileBackendClass
    options.timeout =
      req.body?.timeout || Settings.defaultFeatures.compileTimeout
    const { status, outputFiles, clsiServerId, validationProblems } =
      await ClsiManager.promises.sendExternalRequest(
        submissionId,
        req.body,
        options
      )
    res.json({
      status,
      outputFiles,
      clsiServerId,
      validationProblems,
    })
  },

  _getUserIdForCompile(req) {
    if (!Settings.disablePerUserCompiles) {
      return SessionManager.getLoggedInUserId(req.session)
    }
    return null
  },

  async downloadPdf(req, res) {
    const {
      params: { Project_id: projectId, build_id: buildId },
      query: { clsiserverid: clsiServerId, editorId },
    } = parseReq(req, getOutputPDFFromClsiSchema)
    Metrics.inc('pdf-downloads')
    try {
      await pdfDownloadRateLimiter.consume(req.ip, 1, { method: 'ip' })
    } catch (err) {
      if (err instanceof Error) {
        logger.err({ err }, 'error checking rate limit for pdf download')
        res.status(500).end()
        return
      }
      logger.debug({ projectId, ip: req.ip }, 'rate limit hit downloading pdf')
      res.status(429).end()
      return
    }

    const project = await ProjectGetter.promises.getProject(projectId, {
      name: 1,
    })

    res.contentType('application/pdf')
    const filename = `${_CompileController._getSafeProjectName(project)}.pdf`

    if (req.query.popupDownload) {
      res.setContentDisposition('attachment', { filename })
    } else {
      res.setContentDisposition('inline', { filename })
    }

    const userId = CompileController._getUserIdForCompile(req)
    await _downloadFromClsiNginx(
      projectId,
      userId,
      editorId,
      buildId,
      'output.pdf',
      clsiServerId,
      'output-file',
      req,
      res
    )
  },

  // Keep in sync with the logic for zip files in ProjectDownloadsController
  _getSafeProjectName(project) {
    return project.name.replace(/[^\p{L}\p{Nd}]/gu, '_')
  },

  async deleteAuxFiles(req, res) {
    const {
      params: { Project_id: projectId },
      query: { clsiserverid },
    } = parseReq(req, deleteAuxFilesSchema)
    const userId = CompileController._getUserIdForCompile(req)
    await CompileManager.promises.deleteAuxFiles(
      projectId,
      userId,
      clsiserverid
    )
    res.sendStatus(200)
  },

  // this is only used by templates, so is not called with a userId
  async compileAndDownloadPdf(req, res) {
    const projectId = req.params.project_id

    let outputFiles, clsiServerId, buildId
    try {
      ;({ outputFiles, clsiServerId, buildId } = await CompileManager.promises
        // pass userId as null, since templates are an "anonymous" compile
        .compile(projectId, null, {}))
    } catch (err) {
      logger.err(
        { err, projectId },
        'something went wrong compile and downloading pdf'
      )
      res.sendStatus(500)
      return
    }
    const pdf = outputFiles.find(f => f.path === 'output.pdf')
    if (!pdf) {
      logger.warn(
        { projectId },
        'something went wrong compile and downloading pdf: no pdf'
      )
      res.sendStatus(500)
      return
    }
    await _downloadFromClsiNginx(
      projectId,
      null,
      null,
      buildId,
      'output.pdf',
      clsiServerId,
      'output-file',
      req,
      res
    )
  },

  async getOutputZipFromClsi(req, res) {
    const userId = CompileController._getUserIdForCompile(req)
    const {
      params: { Project_id: projectId, build_id: buildId },
      query: { clsiserverid: clsiServerId },
    } = parseReq(req, getOutputZipFromClsiSchema)

    const project = await ProjectGetter.promises.getProject(projectId, {
      name: 1,
    })
    const filename = `${_CompileController._getSafeProjectName(project)}-output.zip`
    prepareZipAttachment(res, filename)

    await _downloadFromClsi(
      projectId,
      userId,
      null,
      buildId,
      'output.zip',
      clsiServerId,
      'output-zip-file',
      req,
      res
    )
  },

  async getFileFromClsi(req, res) {
    const userId = CompileController._getUserIdForCompile(req)
    const {
      params: { Project_id: projectId, build_id: buildId, file },
      query: { clsiserverid: clsiServerId, editorId },
    } = parseReq(req, getFileFromClsiSchema)

    await _downloadFromClsiNginx(
      projectId,
      userId,
      editorId,
      buildId,
      file,
      clsiServerId,
      'output-file',
      req,
      res
    )
  },

  async getFileForSubmissionFromClsi(req, res) {
    const {
      params: { submissionId, build_id: buildId, file },
      query: { clsiserverid: clsiServerId },
    } = parseReq(req, getFileForSubmissionFromClsiSchema)
    await _downloadFromClsiNginx(
      submissionId,
      null,
      null,
      buildId,
      file,
      clsiServerId,
      'output-file',
      req,
      res
    )
  },

  async proxySyncPdf(req, res) {
    const { page, h, v } = req.query
    if (!page?.match(/^\d+$/)) {
      throw new Error('invalid page parameter')
    }
    if (!h?.match(/^-?\d+\.\d+$/)) {
      throw new Error('invalid h parameter')
    }
    if (!v?.match(/^-?\d+\.\d+$/)) {
      throw new Error('invalid v parameter')
    }
    await _syncTeX(req, res, 'pdf', { page, h, v })
  },

  async proxySyncCode(req, res) {
    const { file, line, column } = req.query
    if (file == null) {
      throw new Error('missing file parameter')
    }
    // Check that we are dealing with a simple file path (this is not
    // strictly needed because synctex uses this parameter as a label
    // to look up in the synctex output, and does not open the file
    // itself).  Since we have valid synctex paths like foo/./bar we
    // allow those by replacing /./ with /
    const testPath = file.replace('/./', '/')
    if (Path.resolve('/', testPath) !== `/${testPath}`) {
      throw new Error('invalid file parameter')
    }
    if (!line?.match(/^\d+$/)) {
      throw new Error('invalid line parameter')
    }
    if (!column?.match(/^\d+$/)) {
      throw new Error('invalid column parameter')
    }
    await _syncTeX(req, res, 'code', { file, line, column })
  },

  async wordCount(req, res) {
    const { params, query } = parseReq(req, wordCountSchema)
    const projectId = params.Project_id
    const file = query.file || false
    const { clsiserverid } = query
    const userId = CompileController._getUserIdForCompile(req)

    const body = await CompileManager.promises.wordCount(
      projectId,
      userId,
      file,
      clsiserverid
    )
    res.json(body)
  },
}

async function _downloadFromClsi(
  projectIdOrSubmissionId,
  userId,
  editorId,
  buildId,
  file,
  clsiServerId,
  action,
  req,
  res
) {
  const { compileBackendClass } =
    await CompileManager.promises.getProjectCompileLimits(
      projectIdOrSubmissionId
    )
  const url = getOutputZipURL(
    projectIdOrSubmissionId,
    userId,
    buildId,
    compileBackendClass,
    clsiServerId
  )
  return await _proxyToClsi(
    url,
    projectIdOrSubmissionId,
    userId,
    editorId,
    buildId,
    file,
    action,
    req,
    res
  )
}

async function _downloadFromClsiNginx(
  projectIdOrSubmissionId,
  userId,
  editorId,
  buildId,
  file,
  clsiServerId,
  action,
  req,
  res
) {
  const url = getOutputFileURL(
    projectIdOrSubmissionId,
    userId,
    buildId,
    file,
    clsiServerId
  )
  return await _proxyToClsi(
    url,
    projectIdOrSubmissionId,
    userId,
    editorId,
    buildId,
    file,
    action,
    req,
    res
  )
}

async function _proxyToClsi(
  url,
  projectIdOrSubmissionId,
  userId,
  editorId,
  buildId,
  file,
  action,
  req,
  res
) {
  const timer = new Metrics.Timer(
    'proxy_to_clsi',
    1,
    { path: action },
    [0, 100, 1000, 2000, 5000, 10000, 15000, 20000, 30000, 45000, 60000]
  )
  Metrics.inc('proxy_to_clsi', 1, { path: action, status: 'start' })
  const ac = new AbortController()
  let timeout = setTimeout(() => ac.abort(), 10_000)
  try {
    const { stream, response } = await fetchStreamWithResponse(url.href, {
      method: req.method,
      signal: ac.signal,
    })
    if (req.destroyed) {
      // The client has disconnected already, avoid trying to write into the broken connection.
      Metrics.inc('proxy_to_clsi', 1, {
        path: action,
        status: 'req-aborted',
      })
      stream.destroy(new Error('user aborted the request'))
      return
    }
    Metrics.inc('proxy_to_clsi', 1, {
      path: action,
      status: response.status,
    })

    for (const key of ['Content-Length', 'Content-Type']) {
      if (response.headers.has(key)) {
        res.setHeader(key, response.headers.get(key))
      }
    }

    // Downloads can take a while on a slow connection, increase timeouts to 10min
    const TEN_MINUTES_IN_MS = 10 * 60 * 1000
    res.setTimeout(TEN_MINUTES_IN_MS)
    clearTimeout(timeout)
    timeout = setTimeout(() => ac.abort(), TEN_MINUTES_IN_MS)

    // Disable buffering in nginx
    res.setHeader('X-Accel-Buffering', 'no')

    res.writeHead(response.status)
    await pipeline(stream, res)
    timer.labels.status = 'success'
    timer.done()
  } catch (err) {
    if (canTryClsiCacheFallback(req, res, editorId, file, action, err)) {
      await ClsiCacheController._downloadFromCacheWithParams(
        req,
        res,
        projectIdOrSubmissionId,
        `${editorId}-${buildId}`,
        file
      )
      return
    }
    const reqAborted = Boolean(req.destroyed)
    const status = reqAborted ? 'req-aborted-late' : 'error'
    timer.labels.status = status
    const duration = timer.done()
    Metrics.inc('proxy_to_clsi', 1, { path: action, status })
    const streamingStarted = Boolean(res.headersSent)
    if (!streamingStarted) {
      if (err instanceof RequestFailedError) {
        res.status(err.response.status).end()
      } else {
        res.status(500).end()
      }
    }
    if (
      streamingStarted &&
      reqAborted &&
      (err.code === 'ERR_STREAM_PREMATURE_CLOSE' ||
        err.code === 'ERR_STREAM_UNABLE_TO_PIPE')
    ) {
      // Ignore noisy spurious error
      return
    }
    if (err instanceof RequestFailedError) {
      // Ignore noisy error: https://github.com/overleaf/internal/issues/15201
      return
    }
    logger.warn(
      {
        err,
        projectId: projectIdOrSubmissionId,
        userId,
        url,
        action,
        reqAborted,
        streamingStarted,
        duration,
      },
      'CLSI proxy error'
    )
  } finally {
    clearTimeout(timeout)
  }
}

function canTryClsiCacheFallback(req, res, editorId, file, action, err) {
  const reqAborted = Boolean(req.destroyed)
  const streamingStarted = Boolean(res.headersSent)
  return (
    action === 'output-file' &&
    err instanceof RequestFailedError &&
    err.response.status === 404 &&
    !streamingStarted &&
    !reqAborted &&
    editorId &&
    // clsi-cache only has a small subset of files available outside the tar-ball.
    // The ClsiCacheHandler will validate the filename again.
    ClsiCacheHandler.isAllowedFilename(file)
  )
}

const CompileController = {
  COMPILE_TIMEOUT_MS,
  compile: expressify(_CompileController.compile),
  stopCompile: expressify(_CompileController.stopCompile),
  compileSubmission: expressify(_CompileController.compileSubmission),
  downloadPdf: expressify(_CompileController.downloadPdf), //
  compileAndDownloadPdf: expressify(_CompileController.compileAndDownloadPdf),
  deleteAuxFiles: expressify(_CompileController.deleteAuxFiles),
  getOutputZipFromClsi: expressify(_CompileController.getOutputZipFromClsi),
  getFileFromClsi: expressify(_CompileController.getFileFromClsi),
  getFileForSubmissionFromClsi: expressify(
    _CompileController.getFileForSubmissionFromClsi
  ),
  proxySyncPdf: expressify(_CompileController.proxySyncPdf),
  proxySyncCode: expressify(_CompileController.proxySyncCode),
  wordCount: expressify(_CompileController.wordCount),

  _getSafeProjectName: _CompileController._getSafeProjectName,
  _getSplitTestOptions,
  _getUserIdForCompile: _CompileController._getUserIdForCompile,
}

export default CompileController
