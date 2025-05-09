const { URL, URLSearchParams } = require('url')
const { pipeline } = require('stream/promises')
const { Cookie } = require('tough-cookie')
const OError = require('@overleaf/o-error')
const Metrics = require('@overleaf/metrics')
const ProjectGetter = require('../Project/ProjectGetter')
const CompileManager = require('./CompileManager')
const ClsiManager = require('./ClsiManager')
const logger = require('@overleaf/logger')
const Settings = require('@overleaf/settings')
const SessionManager = require('../Authentication/SessionManager')
const { RateLimiter } = require('../../infrastructure/RateLimiter')
const ClsiCookieManager = require('./ClsiCookieManager')(
  Settings.apis.clsi?.backendGroupName
)
const Path = require('path')
const AnalyticsManager = require('../Analytics/AnalyticsManager')
const SplitTestHandler = require('../SplitTests/SplitTestHandler')
const { expressify } = require('@overleaf/promise-utils')
const {
  fetchStreamWithResponse,
  RequestFailedError,
} = require('@overleaf/fetch-utils')

const COMPILE_TIMEOUT_MS = 10 * 60 * 1000

const pdfDownloadRateLimiter = new RateLimiter('full-pdf-download', {
  points: 1000,
  duration: 60 * 60,
})

function getOutputFilesArchiveSpecification(projectId, userId, buildId) {
  const fileName = 'output.zip'
  return {
    path: fileName,
    url: _CompileController._getFileUrl(projectId, userId, buildId, fileName),
    type: 'zip',
  }
}

async function getImageNameForProject(projectId) {
  const project = await ProjectGetter.promises.getProject(projectId, {
    imageName: 1,
  })
  if (!project) {
    throw new Error('project not found')
  }
  return project.imageName
}

async function getPdfCachingMinChunkSize(req, res) {
  const { variant } = await SplitTestHandler.promises.getAssignment(
    req,
    res,
    'pdf-caching-min-chunk-size'
  )
  if (variant === 'default') {
    return 1_000_000
  }
  return parseInt(variant, 10)
}

async function _getSplitTestOptions(req, res) {
  // Use the query flags from the editor request for overriding the split test.
  let query = {}
  try {
    const u = new URL(req.headers.referer || req.url, Settings.siteUrl)
    query = Object.fromEntries(u.searchParams.entries())
  } catch (e) {}
  const editorReq = { ...req, query }

  // Lookup the clsi-cache flag in the backend.
  // We may need to turn off the feature on a short notice, without requiring
  //  all users to reload their editor page to disable the feature.
  const { variant: populateClsiCacheVariant } =
    await SplitTestHandler.promises.getAssignment(
      editorReq,
      res,
      'populate-clsi-cache'
    )
  const populateClsiCache = populateClsiCacheVariant === 'enabled'
  const compileFromClsiCache = populateClsiCache // use same split-test

  const pdfDownloadDomain = Settings.pdfDownloadDomain

  if (!req.query.enable_pdf_caching) {
    // The frontend does not want to do pdf caching.
    return {
      compileFromClsiCache,
      populateClsiCache,
      pdfDownloadDomain,
      enablePdfCaching: false,
    }
  }

  // Double check with the latest split test assignment.
  // We may need to turn off the feature on a short notice, without requiring
  //  all users to reload their editor page to disable the feature.
  const { variant } = await SplitTestHandler.promises.getAssignment(
    editorReq,
    res,
    'pdf-caching-mode'
  )
  const enablePdfCaching = variant === 'enabled'
  if (!enablePdfCaching) {
    // Skip the lookup of the chunk size when caching is not enabled.
    return {
      compileFromClsiCache,
      populateClsiCache,
      pdfDownloadDomain,
      enablePdfCaching: false,
    }
  }
  const pdfCachingMinChunkSize = await getPdfCachingMinChunkSize(editorReq, res)
  return {
    compileFromClsiCache,
    populateClsiCache,
    pdfDownloadDomain,
    enablePdfCaching,
    pdfCachingMinChunkSize,
  }
}

const _CompileController = {
  async compile(req, res) {
    res.setTimeout(COMPILE_TIMEOUT_MS)
    const projectId = req.params.Project_id
    const isAutoCompile = !!req.query.auto_compile
    const fileLineErrors = !!req.query.file_line_errors
    const stopOnFirstError = !!req.body.stopOnFirstError
    const clsiCacheSharded = !!req.body.clsiCacheSharded
    const userId = SessionManager.getLoggedInUserId(req.session)
    const options = {
      isAutoCompile,
      fileLineErrors,
      stopOnFirstError,
      editorId: req.body.editorId,
      clsiCacheSharded,
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
      compileFromClsiCache,
      populateClsiCache,
      enablePdfCaching,
      pdfCachingMinChunkSize,
      pdfDownloadDomain,
    } = await _getSplitTestOptions(req, res)
    options.compileFromClsiCache = compileFromClsiCache
    options.populateClsiCache = populateClsiCache
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

    if (limits) {
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
          server: clsiServerId?.includes('-c2d-') ? 'faster' : 'normal',
          isAutoCompile,
          isInitialCompile: stats?.isInitialCompile === 1,
          restoredClsiCache: stats?.restoredClsiCache === 1,
          stopOnFirstError,
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
    options.compileBackendClass = Settings.apis.clsi.submissionBackendClass
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
    Metrics.inc('pdf-downloads')
    const projectId = req.params.Project_id
    const rateLimit = () =>
      pdfDownloadRateLimiter
        .consume(req.ip, 1, { method: 'ip' })
        .then(() => true)
        .catch(err => {
          if (err instanceof Error) {
            throw err
          }
          return false
        })

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

    let canContinue
    try {
      canContinue = await rateLimit()
    } catch (err) {
      logger.err({ err }, 'error checking rate limit for pdf download')
      res.sendStatus(500)
      return
    }

    if (!canContinue) {
      logger.debug({ projectId, ip: req.ip }, 'rate limit hit downloading pdf')
      res.sendStatus(500) // should it be 429?
    } else {
      const userId = CompileController._getUserIdForCompile(req)

      const url = _CompileController._getFileUrl(
        projectId,
        userId,
        req.params.build_id,
        'output.pdf'
      )
      await CompileController._proxyToClsi(
        projectId,
        'output-file',
        url,
        {},
        req,
        res
      )
    }
  },

  _getSafeProjectName(project) {
    return project.name.replace(/[^\p{L}\p{Nd}]/gu, '_')
  },

  async deleteAuxFiles(req, res) {
    const projectId = req.params.Project_id
    const { clsiserverid } = req.query
    const userId = await CompileController._getUserIdForCompile(req)
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

    let outputFiles
    try {
      ;({ outputFiles } = await CompileManager.promises
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
    await CompileController._proxyToClsi(
      projectId,
      'output-file',
      pdf.url,
      {},
      req,
      res
    )
  },

  async getFileFromClsi(req, res) {
    const projectId = req.params.Project_id
    const userId = CompileController._getUserIdForCompile(req)

    const qs = {}

    const url = _CompileController._getFileUrl(
      projectId,
      userId,
      req.params.build_id,
      req.params.file
    )
    await CompileController._proxyToClsi(
      projectId,
      'output-file',
      url,
      qs,
      req,
      res
    )
  },

  async getFileFromClsiWithoutUser(req, res) {
    const submissionId = req.params.submission_id
    const url = _CompileController._getFileUrl(
      submissionId,
      null,
      req.params.build_id,
      req.params.file
    )
    const limits = {
      compileGroup:
        req.body?.compileGroup ||
        req.query?.compileGroup ||
        Settings.defaultFeatures.compileGroup,
      compileBackendClass: Settings.apis.clsi.submissionBackendClass,
    }
    await CompileController._proxyToClsiWithLimits(
      submissionId,
      'output-file',
      url,
      {},
      limits,
      req,
      res
    )
  },

  // compute a GET file url for a given project, user (optional), build (optional) and file
  _getFileUrl(projectId, userId, buildId, file) {
    let url
    if (userId != null && buildId != null) {
      url = `/project/${projectId}/user/${userId}/build/${buildId}/output/${file}`
    } else if (userId != null) {
      url = `/project/${projectId}/user/${userId}/output/${file}`
    } else if (buildId != null) {
      url = `/project/${projectId}/build/${buildId}/output/${file}`
    } else {
      url = `/project/${projectId}/output/${file}`
    }
    return url
  },

  // compute a POST url for a project, user (optional) and action
  _getUrl(projectId, userId, action) {
    let path = `/project/${projectId}`
    if (userId != null) {
      path += `/user/${userId}`
    }
    return `${path}/${action}`
  },

  async proxySyncPdf(req, res) {
    const projectId = req.params.Project_id
    const { page, h, v, editorId, buildId } = req.query
    if (!page?.match(/^\d+$/)) {
      throw new Error('invalid page parameter')
    }
    if (!h?.match(/^-?\d+\.\d+$/)) {
      throw new Error('invalid h parameter')
    }
    if (!v?.match(/^-?\d+\.\d+$/)) {
      throw new Error('invalid v parameter')
    }
    // whether this request is going to a per-user container
    const userId = CompileController._getUserIdForCompile(req)

    const imageName = await getImageNameForProject(projectId)

    const { compileFromClsiCache } = await _getSplitTestOptions(req, res)

    const url = _CompileController._getUrl(projectId, userId, 'sync/pdf')

    await CompileController._proxyToClsi(
      projectId,
      'sync-to-pdf',
      url,
      { page, h, v, imageName, editorId, buildId, compileFromClsiCache },
      req,
      res
    )
  },

  async proxySyncCode(req, res) {
    const projectId = req.params.Project_id
    const { file, line, column, editorId, buildId } = req.query
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
    const userId = CompileController._getUserIdForCompile(req)

    const imageName = await getImageNameForProject(projectId)

    const { compileFromClsiCache } = await _getSplitTestOptions(req, res)

    const url = _CompileController._getUrl(projectId, userId, 'sync/code')
    await CompileController._proxyToClsi(
      projectId,
      'sync-to-code',
      url,
      {
        file,
        line,
        column,
        imageName,
        editorId,
        buildId,
        compileFromClsiCache,
      },
      req,
      res
    )
  },

  async _proxyToClsi(projectId, action, url, qs, req, res) {
    const limits =
      await CompileManager.promises.getProjectCompileLimits(projectId)
    if (
      qs?.compileFromClsiCache &&
      !['alpha', 'priority'].includes(limits.compileGroup)
    ) {
      qs.compileFromClsiCache = false
    }
    return CompileController._proxyToClsiWithLimits(
      projectId,
      action,
      url,
      qs,
      limits,
      req,
      res
    )
  },

  async _proxyToClsiWithLimits(projectId, action, url, qs, limits, req, res) {
    const persistenceOptions = await _getPersistenceOptions(
      req,
      projectId,
      limits.compileGroup,
      limits.compileBackendClass
    ).catch(err => {
      OError.tag(err, 'error getting cookie jar for clsi request')
      throw err
    })

    url = new URL(`${Settings.apis.clsi.url}${url}`)
    url.search = new URLSearchParams({
      ...persistenceOptions.qs,
      ...qs,
    }).toString()
    const timer = new Metrics.Timer(
      'proxy_to_clsi',
      1,
      { path: action },
      [0, 100, 1000, 2000, 5000, 10000, 15000, 20000, 30000, 45000, 60000]
    )
    Metrics.inc('proxy_to_clsi', 1, { path: action, status: 'start' })
    try {
      const { stream, response } = await fetchStreamWithResponse(url.href, {
        method: req.method,
        signal: AbortSignal.timeout(60 * 1000),
        headers: persistenceOptions.headers,
      })
      if (req.destroyed) {
        // The client has disconnected already, avoid trying to write into the broken connection.
        Metrics.inc('proxy_to_clsi', 1, {
          path: action,
          status: 'req-aborted',
        })
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
      res.writeHead(response.status)
      await pipeline(stream, res)
      timer.labels.status = 'success'
      timer.done()
    } catch (err) {
      const reqAborted = Boolean(req.destroyed)
      const status = reqAborted ? 'req-aborted-late' : 'error'
      timer.labels.status = status
      const duration = timer.done()
      Metrics.inc('proxy_to_clsi', 1, { path: action, status })
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
      if (
        err instanceof RequestFailedError &&
        ['sync-to-code', 'sync-to-pdf', 'output-file'].includes(action)
      ) {
        // Ignore noisy error
        // https://github.com/overleaf/internal/issues/15201
        return
      }
      logger.warn(
        {
          err,
          projectId,
          url,
          action,
          reqAborted,
          streamingStarted,
          duration,
        },
        'CLSI proxy error'
      )
    }
  },

  async wordCount(req, res) {
    const projectId = req.params.Project_id
    const file = req.query.file || false
    const { clsiserverid } = req.query
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

async function _getPersistenceOptions(
  req,
  projectId,
  compileGroup,
  compileBackendClass
) {
  const { clsiserverid } = req.query
  const userId = SessionManager.getLoggedInUserId(req)
  if (clsiserverid && typeof clsiserverid === 'string') {
    return {
      qs: { clsiserverid, compileGroup, compileBackendClass },
      headers: {},
    }
  } else {
    const clsiServerId = await ClsiCookieManager.promises.getServerId(
      projectId,
      userId,
      compileGroup,
      compileBackendClass
    )
    return {
      qs: { compileGroup, compileBackendClass },
      headers: clsiServerId
        ? {
            Cookie: new Cookie({
              key: Settings.clsiCookie.key,
              value: clsiServerId,
            }).cookieString(),
          }
        : {},
    }
  }
}

const CompileController = {
  compile: expressify(_CompileController.compile),
  stopCompile: expressify(_CompileController.stopCompile),
  compileSubmission: expressify(_CompileController.compileSubmission),
  downloadPdf: expressify(_CompileController.downloadPdf), //
  compileAndDownloadPdf: expressify(_CompileController.compileAndDownloadPdf),
  deleteAuxFiles: expressify(_CompileController.deleteAuxFiles),
  getFileFromClsi: expressify(_CompileController.getFileFromClsi),
  getFileFromClsiWithoutUser: expressify(
    _CompileController.getFileFromClsiWithoutUser
  ),
  proxySyncPdf: expressify(_CompileController.proxySyncPdf),
  proxySyncCode: expressify(_CompileController.proxySyncCode),
  wordCount: expressify(_CompileController.wordCount),

  _getSafeProjectName: _CompileController._getSafeProjectName,
  _getSplitTestOptions,
  _getUserIdForCompile: _CompileController._getUserIdForCompile,
  _proxyToClsi: _CompileController._proxyToClsi,
  _proxyToClsiWithLimits: _CompileController._proxyToClsiWithLimits,
}

module.exports = CompileController
