let CompileController
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
const { callbackify } = require('@overleaf/promise-utils')
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
    url: CompileController._getFileUrl(projectId, userId, buildId, fileName),
    type: 'zip',
  }
}

function getImageNameForProject(projectId, callback) {
  ProjectGetter.getProject(projectId, { imageName: 1 }, (err, project) => {
    if (err) return callback(err)
    if (!project) return callback(new Error('project not found'))
    callback(null, project.imageName)
  })
}

async function getPdfCachingMinChunkSize(req, res) {
  const { variant } = await SplitTestHandler.promises.getAssignment(
    req,
    res,
    'pdf-caching-min-chunk-size'
  )
  if (variant === 'default') return 1_000_000
  return parseInt(variant, 10)
}

const getSplitTestOptions = callbackify(async function (req, res) {
  // Use the query flags from the editor request for overriding the split test.
  let query = {}
  try {
    const u = new URL(req.headers.referer || req.url, Settings.siteUrl)
    query = Object.fromEntries(u.searchParams.entries())
  } catch (e) {}
  const editorReq = { ...req, query }

  const pdfDownloadDomain = Settings.pdfDownloadDomain

  if (!req.query.enable_pdf_caching) {
    // The frontend does not want to do pdf caching.
    return {
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
      pdfDownloadDomain,
      enablePdfCaching: false,
    }
  }
  const pdfCachingMinChunkSize = await getPdfCachingMinChunkSize(editorReq, res)
  return {
    pdfDownloadDomain,
    enablePdfCaching,
    pdfCachingMinChunkSize,
  }
})

module.exports = CompileController = {
  compile(req, res, next) {
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

    getSplitTestOptions(req, res, (err, splitTestOptions) => {
      if (err) return next(err)
      let { enablePdfCaching, pdfCachingMinChunkSize, pdfDownloadDomain } =
        splitTestOptions
      options.enablePdfCaching = enablePdfCaching
      if (enablePdfCaching) {
        options.pdfCachingMinChunkSize = pdfCachingMinChunkSize
      }

      CompileManager.compile(
        projectId,
        userId,
        options,
        (
          error,
          status,
          outputFiles,
          clsiServerId,
          limits,
          validationProblems,
          stats,
          timings,
          outputUrlPrefix,
          buildId
        ) => {
          if (error) {
            Metrics.inc('compile-error')
            return next(error)
          }
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
                timeout: limits.timeout === 60 ? 'short' : 'long',
                server: clsiServerId?.includes('-c2d-') ? 'faster' : 'normal',
                isAutoCompile,
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
            validationProblems,
            stats,
            timings,
            outputUrlPrefix,
            pdfDownloadDomain,
            pdfCachingMinChunkSize,
          })
        }
      )
    })
  },

  stopCompile(req, res, next) {
    const projectId = req.params.Project_id
    const userId = SessionManager.getLoggedInUserId(req.session)
    CompileManager.stopCompile(projectId, userId, function (error) {
      if (error) {
        return next(error)
      }
      res.sendStatus(200)
    })
  },

  // Used for submissions through the public API
  compileSubmission(req, res, next) {
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
    ClsiManager.sendExternalRequest(
      submissionId,
      req.body,
      options,
      function (error, status, outputFiles, clsiServerId, validationProblems) {
        if (error) {
          return next(error)
        }
        res.json({
          status,
          outputFiles,
          clsiServerId,
          validationProblems,
        })
      }
    )
  },

  _compileAsUser(req, callback) {
    // callback with userId if per-user, undefined otherwise
    if (!Settings.disablePerUserCompiles) {
      const userId = SessionManager.getLoggedInUserId(req.session)
      callback(null, userId)
    } else {
      callback()
    }
  }, // do a per-project compile, not per-user

  _downloadAsUser(req, callback) {
    // callback with userId if per-user, undefined otherwise
    if (!Settings.disablePerUserCompiles) {
      const userId = SessionManager.getLoggedInUserId(req.session)
      callback(null, userId)
    } else {
      callback()
    }
  }, // do a per-project compile, not per-user

  downloadPdf(req, res, next) {
    Metrics.inc('pdf-downloads')
    const projectId = req.params.Project_id
    const rateLimit = function (callback) {
      pdfDownloadRateLimiter
        .consume(req.ip, 1, { method: 'ip' })
        .then(() => {
          callback(null, true)
        })
        .catch(err => {
          if (err instanceof Error) {
            callback(err)
          } else {
            callback(null, false)
          }
        })
    }

    ProjectGetter.getProject(projectId, { name: 1 }, function (err, project) {
      if (err) {
        return next(err)
      }
      res.contentType('application/pdf')
      const filename = `${CompileController._getSafeProjectName(project)}.pdf`

      if (req.query.popupDownload) {
        res.setContentDisposition('attachment', { filename })
      } else {
        res.setContentDisposition('inline', { filename })
      }

      rateLimit(function (err, canContinue) {
        if (err) {
          logger.err({ err }, 'error checking rate limit for pdf download')
          res.sendStatus(500)
        } else if (!canContinue) {
          logger.debug(
            { projectId, ip: req.ip },
            'rate limit hit downloading pdf'
          )
          res.sendStatus(500)
        } else {
          CompileController._downloadAsUser(req, function (error, userId) {
            if (error) {
              return next(error)
            }
            const url = CompileController._getFileUrl(
              projectId,
              userId,
              req.params.build_id,
              'output.pdf'
            )
            CompileController.proxyToClsi(
              projectId,
              'output-file',
              url,
              {},
              req,
              res,
              next
            )
          })
        }
      })
    })
  },

  _getSafeProjectName(project) {
    return project.name.replace(/[^\p{L}\p{Nd}]/gu, '_')
  },

  deleteAuxFiles(req, res, next) {
    const projectId = req.params.Project_id
    const { clsiserverid } = req.query
    CompileController._compileAsUser(req, function (error, userId) {
      if (error) {
        return next(error)
      }
      CompileManager.deleteAuxFiles(
        projectId,
        userId,
        clsiserverid,
        function (error) {
          if (error) {
            return next(error)
          }
          res.sendStatus(200)
        }
      )
    })
  },

  // this is only used by templates, so is not called with a userId
  compileAndDownloadPdf(req, res, next) {
    const projectId = req.params.project_id
    // pass userId as null, since templates are an "anonymous" compile
    CompileManager.compile(projectId, null, {}, function (err) {
      if (err) {
        logger.err(
          { err, projectId },
          'something went wrong compile and downloading pdf'
        )
        res.sendStatus(500)
        return
      }
      const url = `/project/${projectId}/output/output.pdf`
      CompileController.proxyToClsi(
        projectId,
        'output-file',
        url,
        {},
        req,
        res,
        next
      )
    })
  },

  getFileFromClsi(req, res, next) {
    const projectId = req.params.Project_id
    CompileController._downloadAsUser(req, function (error, userId) {
      if (error) {
        return next(error)
      }

      const qs = {}

      const url = CompileController._getFileUrl(
        projectId,
        userId,
        req.params.build_id,
        req.params.file
      )
      CompileController.proxyToClsi(
        projectId,
        'output-file',
        url,
        qs,
        req,
        res,
        next
      )
    })
  },

  getFileFromClsiWithoutUser(req, res, next) {
    const submissionId = req.params.submission_id
    const url = CompileController._getFileUrl(
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
    CompileController.proxyToClsiWithLimits(
      submissionId,
      'output-file',
      url,
      {},
      limits,
      req,
      res,
      next
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

  proxySyncPdf(req, res, next) {
    const projectId = req.params.Project_id
    const { page, h, v } = req.query
    if (!page?.match(/^\d+$/)) {
      return next(new Error('invalid page parameter'))
    }
    if (!h?.match(/^-?\d+\.\d+$/)) {
      return next(new Error('invalid h parameter'))
    }
    if (!v?.match(/^-?\d+\.\d+$/)) {
      return next(new Error('invalid v parameter'))
    }
    // whether this request is going to a per-user container
    CompileController._compileAsUser(req, function (error, userId) {
      if (error) {
        return next(error)
      }
      getImageNameForProject(projectId, (error, imageName) => {
        if (error) return next(error)

        const url = CompileController._getUrl(projectId, userId, 'sync/pdf')
        CompileController.proxyToClsi(
          projectId,
          'sync-to-pdf',
          url,
          { page, h, v, imageName },
          req,
          res,
          next
        )
      })
    })
  },

  proxySyncCode(req, res, next) {
    const projectId = req.params.Project_id
    const { file, line, column } = req.query
    if (file == null) {
      return next(new Error('missing file parameter'))
    }
    // Check that we are dealing with a simple file path (this is not
    // strictly needed because synctex uses this parameter as a label
    // to look up in the synctex output, and does not open the file
    // itself).  Since we have valid synctex paths like foo/./bar we
    // allow those by replacing /./ with /
    const testPath = file.replace('/./', '/')
    if (Path.resolve('/', testPath) !== `/${testPath}`) {
      return next(new Error('invalid file parameter'))
    }
    if (!line?.match(/^\d+$/)) {
      return next(new Error('invalid line parameter'))
    }
    if (!column?.match(/^\d+$/)) {
      return next(new Error('invalid column parameter'))
    }
    CompileController._compileAsUser(req, function (error, userId) {
      if (error) {
        return next(error)
      }
      getImageNameForProject(projectId, (error, imageName) => {
        if (error) return next(error)

        const url = CompileController._getUrl(projectId, userId, 'sync/code')
        CompileController.proxyToClsi(
          projectId,
          'sync-to-code',
          url,
          { file, line, column, imageName },
          req,
          res,
          next
        )
      })
    })
  },

  proxyToClsi(projectId, action, url, qs, req, res, next) {
    CompileManager.getProjectCompileLimits(projectId, function (error, limits) {
      if (error) {
        return next(error)
      }
      CompileController.proxyToClsiWithLimits(
        projectId,
        action,
        url,
        qs,
        limits,
        req,
        res,
        next
      )
    })
  },

  proxyToClsiWithLimits(projectId, action, url, qs, limits, req, res, next) {
    _getPersistenceOptions(
      req,
      projectId,
      limits.compileGroup,
      limits.compileBackendClass,
      (err, persistenceOptions) => {
        if (err) {
          OError.tag(err, 'error getting cookie jar for clsi request')
          return next(err)
        }
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
        fetchStreamWithResponse(url.href, {
          method: req.method,
          signal: AbortSignal.timeout(60 * 1000),
          headers: persistenceOptions.headers,
        })
          .then(({ stream, response }) => {
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
            return pipeline(stream, res)
          })
          .then(() => {
            timer.labels.status = 'success'
            timer.done()
          })
          .catch(err => {
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
          })
      }
    )
  },

  wordCount(req, res, next) {
    const projectId = req.params.Project_id
    const file = req.query.file || false
    const { clsiserverid } = req.query
    CompileController._compileAsUser(req, function (error, userId) {
      if (error) {
        return next(error)
      }
      CompileManager.wordCount(
        projectId,
        userId,
        file,
        clsiserverid,
        function (error, body) {
          if (error) {
            return next(error)
          }
          res.json(body)
        }
      )
    })
  },
}

function _getPersistenceOptions(
  req,
  projectId,
  compileGroup,
  compileBackendClass,
  callback
) {
  const { clsiserverid } = req.query
  const userId = SessionManager.getLoggedInUserId(req)
  if (clsiserverid && typeof clsiserverid === 'string') {
    callback(null, {
      qs: { clsiserverid, compileGroup, compileBackendClass },
      headers: {},
    })
  } else {
    ClsiCookieManager.getServerId(
      projectId,
      userId,
      compileGroup,
      compileBackendClass,
      (err, clsiServerId) => {
        if (err) return callback(err)
        callback(null, {
          qs: { compileGroup, compileBackendClass },
          headers: clsiServerId
            ? {
                Cookie: new Cookie({
                  key: Settings.clsiCookie.key,
                  value: clsiServerId,
                }).cookieString(),
              }
            : {},
        })
      }
    )
  }
}
