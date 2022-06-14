let CompileController
const OError = require('@overleaf/o-error')
const Metrics = require('@overleaf/metrics')
const ProjectGetter = require('../Project/ProjectGetter')
const CompileManager = require('./CompileManager')
const ClsiManager = require('./ClsiManager')
const logger = require('@overleaf/logger')
const request = require('request')
const Settings = require('@overleaf/settings')
const SessionManager = require('../Authentication/SessionManager')
const RateLimiter = require('../../infrastructure/RateLimiter')
const ClsiCookieManager = require('./ClsiCookieManager')(
  Settings.apis.clsi?.backendGroupName
)
const Path = require('path')

const COMPILE_TIMEOUT_MS = 10 * 60 * 1000

function getImageNameForProject(projectId, callback) {
  ProjectGetter.getProject(projectId, { imageName: 1 }, (err, project) => {
    if (err) return callback(err)
    if (!project) return callback(new Error('project not found'))
    callback(null, project.imageName)
  })
}

module.exports = CompileController = {
  compile(req, res, next) {
    res.setTimeout(COMPILE_TIMEOUT_MS)
    const projectId = req.params.Project_id
    const isAutoCompile = !!req.query.auto_compile
    const enablePdfCaching = !!req.query.enable_pdf_caching
    const fileLineErrors = !!req.query.file_line_errors
    const userId = SessionManager.getLoggedInUserId(req.session)
    const options = {
      isAutoCompile,
      enablePdfCaching,
      fileLineErrors,
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
    if (req.body.stopOnFirstError) {
      options.stopOnFirstError = req.body.stopOnFirstError
    }
    if (['validate', 'error', 'silent'].includes(req.body.check)) {
      options.check = req.body.check
    }
    if (req.body.incrementalCompilesEnabled) {
      options.incrementalCompilesEnabled = true
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
        outputUrlPrefix
      ) => {
        if (error) {
          Metrics.inc('compile-error')
          return next(error)
        }
        Metrics.inc('compile-status', 1, { status })
        let pdfDownloadDomain = Settings.pdfDownloadDomain
        if (pdfDownloadDomain && outputUrlPrefix) {
          pdfDownloadDomain += outputUrlPrefix
        }
        res.json({
          status,
          outputFiles,
          compileGroup: limits?.compileGroup,
          clsiServerId,
          validationProblems,
          stats,
          timings,
          pdfDownloadDomain,
        })
      }
    )
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
    const isPdfjsPartialDownload = req.query?.pdfng
    const rateLimit = function (callback) {
      if (isPdfjsPartialDownload) {
        callback(null, true)
      } else {
        const rateLimitOpts = {
          endpointName: 'full-pdf-download',
          throttle: 1000,
          subjectName: req.ip,
          timeInterval: 60 * 60,
        }
        RateLimiter.addCount(rateLimitOpts, callback)
      }
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
        res.setContentDisposition('', { filename })
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
            CompileController.proxyToClsi(projectId, url, req, res, next)
          })
        }
      })
    })
  },

  _getSafeProjectName(project) {
    const wordRegExp = /\W/g
    const safeProjectName = project.name.replace(wordRegExp, '_')
    return safeProjectName
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
      }
      const url = `/project/${projectId}/output/output.pdf`
      CompileController.proxyToClsi(projectId, url, req, res, next)
    })
  },

  getFileFromClsi(req, res, next) {
    const projectId = req.params.Project_id
    CompileController._downloadAsUser(req, function (error, userId) {
      if (error) {
        return next(error)
      }
      const url = CompileController._getFileUrl(
        projectId,
        userId,
        req.params.build_id,
        req.params.file
      )
      CompileController.proxyToClsi(projectId, url, req, res, next)
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
    }
    CompileController.proxyToClsiWithLimits(
      submissionId,
      url,
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
        const destination = { url, qs: { page, h, v, imageName } }
        CompileController.proxyToClsi(projectId, destination, req, res, next)
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
        const destination = { url, qs: { file, line, column, imageName } }
        CompileController.proxyToClsi(projectId, destination, req, res, next)
      })
    })
  },

  proxyToClsi(projectId, url, req, res, next) {
    if (req.query?.compileGroup) {
      CompileController.proxyToClsiWithLimits(
        projectId,
        url,
        { compileGroup: req.query.compileGroup },
        req,
        res,
        next
      )
    } else {
      CompileManager.getProjectCompileLimits(
        projectId,
        function (error, limits) {
          if (error) {
            return next(error)
          }
          CompileController.proxyToClsiWithLimits(
            projectId,
            url,
            limits,
            req,
            res,
            next
          )
        }
      )
    }
  },

  proxyToClsiWithLimits(projectId, url, limits, req, res, next) {
    _getPersistenceOptions(
      req,
      projectId,
      limits.compileGroup,
      (err, persistenceOptions) => {
        let qs
        if (err) {
          OError.tag(err, 'error getting cookie jar for clsi request')
          return next(err)
        }
        // expand any url parameter passed in as {url:..., qs:...}
        if (typeof url === 'object') {
          ;({ url, qs } = url)
        }
        const compilerUrl = Settings.apis.clsi.url
        url = `${compilerUrl}${url}`
        const oneMinute = 60 * 1000
        // the base request
        const options = {
          url,
          method: req.method,
          timeout: oneMinute,
          ...persistenceOptions,
        }
        // add any provided query string
        if (qs != null) {
          options.qs = Object.assign(options.qs || {}, qs)
        }
        // if we have a build parameter, pass it through to the clsi
        if (req.query?.pdfng && req.query?.build != null) {
          // only for new pdf viewer
          if (options.qs == null) {
            options.qs = {}
          }
          options.qs.build = req.query.build
        }
        // if we are byte serving pdfs, pass through If-* and Range headers
        // do not send any others, there's a proxying loop if Host: is passed!
        if (req.query?.pdfng) {
          const newHeaders = {}
          for (const h in req.headers) {
            if (/^(If-|Range)/i.test(h)) {
              newHeaders[h] = req.headers[h]
            }
          }
          options.headers = newHeaders
        }
        const proxy = request(options)
        proxy.pipe(res)
        proxy.on('error', error =>
          logger.warn({ err: error, url }, 'CLSI proxy error')
        )
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

function _getPersistenceOptions(req, projectId, compileGroup, callback) {
  const { clsiserverid } = req.query
  const userId = SessionManager.getLoggedInUserId(req)
  if (clsiserverid && typeof clsiserverid === 'string') {
    callback(null, { qs: { clsiserverid, compileGroup } })
  } else {
    ClsiCookieManager.getCookieJar(
      projectId,
      userId,
      compileGroup,
      (err, jar) => {
        callback(err, { jar })
      }
    )
  }
}
