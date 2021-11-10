/* eslint-disable
    camelcase,
    node/handle-callback-err,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
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
  Settings.apis.clsi != null ? Settings.apis.clsi.backendGroupName : undefined
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
    const project_id = req.params.Project_id
    const isAutoCompile = !!req.query.auto_compile
    const enablePdfCaching = !!req.query.enable_pdf_caching
    const fileLineErrors = !!req.query.file_line_errors
    const user_id = SessionManager.getLoggedInUserId(req.session)
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
    if (['validate', 'error', 'silent'].includes(req.body.check)) {
      options.check = req.body.check
    }
    if (req.body.incrementalCompilesEnabled) {
      options.incrementalCompilesEnabled = true
    }

    CompileManager.compile(
      project_id,
      user_id,
      options,
      (
        error,
        status,
        outputFiles,
        clsiServerId,
        limits,
        validationProblems,
        stats,
        timings
      ) => {
        if (error) {
          Metrics.inc('compile-error')
          return next(error)
        }
        Metrics.inc('compile-status', 1, { status: status })
        res.json({
          status,
          outputFiles,
          compileGroup: limits != null ? limits.compileGroup : undefined,
          clsiServerId,
          validationProblems,
          stats,
          timings,
          pdfDownloadDomain: Settings.pdfDownloadDomain,
        })
      }
    )
  },

  stopCompile(req, res, next) {
    if (next == null) {
      next = function () {}
    }
    const project_id = req.params.Project_id
    const user_id = SessionManager.getLoggedInUserId(req.session)
    return CompileManager.stopCompile(project_id, user_id, function (error) {
      if (error != null) {
        return next(error)
      }
      return res.status(200).send()
    })
  },

  // Used for submissions through the public API
  compileSubmission(req, res, next) {
    if (next == null) {
      next = function () {}
    }
    res.setTimeout(COMPILE_TIMEOUT_MS)
    const { submission_id } = req.params
    const options = {}
    if ((req.body != null ? req.body.rootResourcePath : undefined) != null) {
      options.rootResourcePath = req.body.rootResourcePath
    }
    if (req.body != null ? req.body.compiler : undefined) {
      options.compiler = req.body.compiler
    }
    if (req.body != null ? req.body.draft : undefined) {
      options.draft = req.body.draft
    }
    if (
      ['validate', 'error', 'silent'].includes(
        req.body != null ? req.body.check : undefined
      )
    ) {
      options.check = req.body.check
    }
    options.compileGroup =
      (req.body != null ? req.body.compileGroup : undefined) ||
      Settings.defaultFeatures.compileGroup
    options.timeout =
      (req.body != null ? req.body.timeout : undefined) ||
      Settings.defaultFeatures.compileTimeout
    return ClsiManager.sendExternalRequest(
      submission_id,
      req.body,
      options,
      function (error, status, outputFiles, clsiServerId, validationProblems) {
        if (error != null) {
          return next(error)
        }
        res.contentType('application/json')
        return res.status(200).send(
          JSON.stringify({
            status,
            outputFiles,
            clsiServerId,
            validationProblems,
          })
        )
      }
    )
  },

  _compileAsUser(req, callback) {
    // callback with user_id if per-user, undefined otherwise
    if (!Settings.disablePerUserCompiles) {
      const user_id = SessionManager.getLoggedInUserId(req.session)
      return callback(null, user_id)
    } else {
      return callback()
    }
  }, // do a per-project compile, not per-user

  _downloadAsUser(req, callback) {
    // callback with user_id if per-user, undefined otherwise
    if (!Settings.disablePerUserCompiles) {
      const user_id = SessionManager.getLoggedInUserId(req.session)
      return callback(null, user_id)
    } else {
      return callback()
    }
  }, // do a per-project compile, not per-user

  downloadPdf(req, res, next) {
    if (next == null) {
      next = function () {}
    }
    Metrics.inc('pdf-downloads')
    const project_id = req.params.Project_id
    const isPdfjsPartialDownload =
      req.query != null ? req.query.pdfng : undefined
    const rateLimit = function (callback) {
      if (isPdfjsPartialDownload) {
        return callback(null, true)
      } else {
        const rateLimitOpts = {
          endpointName: 'full-pdf-download',
          throttle: 1000,
          subjectName: req.ip,
          timeInterval: 60 * 60,
        }
        return RateLimiter.addCount(rateLimitOpts, callback)
      }
    }

    return ProjectGetter.getProject(
      project_id,
      { name: 1 },
      function (err, project) {
        res.contentType('application/pdf')
        const filename = `${CompileController._getSafeProjectName(project)}.pdf`

        if (req.query.popupDownload) {
          res.setContentDisposition('attachment', { filename })
        } else {
          res.setContentDisposition('', { filename })
        }

        return rateLimit(function (err, canContinue) {
          if (err != null) {
            logger.err({ err }, 'error checking rate limit for pdf download')
            return res.sendStatus(500)
          } else if (!canContinue) {
            logger.log(
              { project_id, ip: req.ip },
              'rate limit hit downloading pdf'
            )
            return res.sendStatus(500)
          } else {
            return CompileController._downloadAsUser(
              req,
              function (error, user_id) {
                const url = CompileController._getFileUrl(
                  project_id,
                  user_id,
                  req.params.build_id,
                  'output.pdf'
                )
                return CompileController.proxyToClsi(
                  project_id,
                  url,
                  req,
                  res,
                  next
                )
              }
            )
          }
        })
      }
    )
  },

  _getSafeProjectName(project) {
    const wordRegExp = /\W/g
    const safeProjectName = project.name.replace(wordRegExp, '_')
    return safeProjectName
  },

  deleteAuxFiles(req, res, next) {
    const project_id = req.params.Project_id
    const { clsiserverid } = req.query
    return CompileController._compileAsUser(req, function (error, user_id) {
      if (error != null) {
        return next(error)
      }
      CompileManager.deleteAuxFiles(
        project_id,
        user_id,
        clsiserverid,
        function (error) {
          if (error != null) {
            return next(error)
          }
          return res.sendStatus(200)
        }
      )
    })
  },

  // this is only used by templates, so is not called with a user_id
  compileAndDownloadPdf(req, res, next) {
    const { project_id } = req.params
    // pass user_id as null, since templates are an "anonymous" compile
    return CompileManager.compile(project_id, null, {}, function (err) {
      if (err != null) {
        logger.err(
          { err, project_id },
          'something went wrong compile and downloading pdf'
        )
        res.sendStatus(500)
      }
      const url = `/project/${project_id}/output/output.pdf`
      return CompileController.proxyToClsi(project_id, url, req, res, next)
    })
  },

  getFileFromClsi(req, res, next) {
    if (next == null) {
      next = function () {}
    }
    const project_id = req.params.Project_id
    return CompileController._downloadAsUser(req, function (error, user_id) {
      if (error != null) {
        return next(error)
      }
      const url = CompileController._getFileUrl(
        project_id,
        user_id,
        req.params.build_id,
        req.params.file
      )
      return CompileController.proxyToClsi(project_id, url, req, res, next)
    })
  },

  getFileFromClsiWithoutUser(req, res, next) {
    if (next == null) {
      next = function () {}
    }
    const { submission_id } = req.params
    const url = CompileController._getFileUrl(
      submission_id,
      null,
      req.params.build_id,
      req.params.file
    )
    const limits = {
      compileGroup:
        (req.body != null ? req.body.compileGroup : undefined) ||
        Settings.defaultFeatures.compileGroup,
    }
    return CompileController.proxyToClsiWithLimits(
      submission_id,
      url,
      limits,
      req,
      res,
      next
    )
  },

  // compute a GET file url for a given project, user (optional), build (optional) and file
  _getFileUrl(project_id, user_id, build_id, file) {
    let url
    if (user_id != null && build_id != null) {
      url = `/project/${project_id}/user/${user_id}/build/${build_id}/output/${file}`
    } else if (user_id != null) {
      url = `/project/${project_id}/user/${user_id}/output/${file}`
    } else if (build_id != null) {
      url = `/project/${project_id}/build/${build_id}/output/${file}`
    } else {
      url = `/project/${project_id}/output/${file}`
    }
    return url
  },

  // compute a POST url for a project, user (optional) and action
  _getUrl(project_id, user_id, action) {
    let path = `/project/${project_id}`
    if (user_id != null) {
      path += `/user/${user_id}`
    }
    return `${path}/${action}`
  },

  proxySyncPdf(req, res, next) {
    if (next == null) {
      next = function () {}
    }
    const project_id = req.params.Project_id
    const { page, h, v } = req.query
    if (!(page != null ? page.match(/^\d+$/) : undefined)) {
      return next(new Error('invalid page parameter'))
    }
    if (!(h != null ? h.match(/^-?\d+\.\d+$/) : undefined)) {
      return next(new Error('invalid h parameter'))
    }
    if (!(v != null ? v.match(/^-?\d+\.\d+$/) : undefined)) {
      return next(new Error('invalid v parameter'))
    }
    // whether this request is going to a per-user container
    return CompileController._compileAsUser(req, function (error, user_id) {
      if (error != null) {
        return next(error)
      }
      getImageNameForProject(project_id, (error, imageName) => {
        if (error) return next(error)

        const url = CompileController._getUrl(project_id, user_id, 'sync/pdf')
        const destination = { url, qs: { page, h, v, imageName } }
        return CompileController.proxyToClsi(
          project_id,
          destination,
          req,
          res,
          next
        )
      })
    })
  },

  proxySyncCode(req, res, next) {
    if (next == null) {
      next = function () {}
    }
    const project_id = req.params.Project_id
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
    if (!(line != null ? line.match(/^\d+$/) : undefined)) {
      return next(new Error('invalid line parameter'))
    }
    if (!(column != null ? column.match(/^\d+$/) : undefined)) {
      return next(new Error('invalid column parameter'))
    }
    return CompileController._compileAsUser(req, function (error, user_id) {
      if (error != null) {
        return next(error)
      }
      getImageNameForProject(project_id, (error, imageName) => {
        if (error) return next(error)

        const url = CompileController._getUrl(project_id, user_id, 'sync/code')
        const destination = { url, qs: { file, line, column, imageName } }
        return CompileController.proxyToClsi(
          project_id,
          destination,
          req,
          res,
          next
        )
      })
    })
  },

  proxyToClsi(project_id, url, req, res, next) {
    if (next == null) {
      next = function () {}
    }
    if (req.query != null ? req.query.compileGroup : undefined) {
      return CompileController.proxyToClsiWithLimits(
        project_id,
        url,
        { compileGroup: req.query.compileGroup },
        req,
        res,
        next
      )
    } else {
      return CompileManager.getProjectCompileLimits(
        project_id,
        function (error, limits) {
          if (error != null) {
            return next(error)
          }
          return CompileController.proxyToClsiWithLimits(
            project_id,
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

  proxyToClsiWithLimits(project_id, url, limits, req, res, next) {
    if (next == null) {
      next = function () {}
    }
    _getPersistenceOptions(req, project_id, (err, persistenceOptions) => {
      let qs
      if (err != null) {
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
      if (
        (req.query != null ? req.query.pdfng : undefined) &&
        (req.query != null ? req.query.build : undefined) != null
      ) {
        // only for new pdf viewer
        if (options.qs == null) {
          options.qs = {}
        }
        options.qs.build = req.query.build
      }
      // if we are byte serving pdfs, pass through If-* and Range headers
      // do not send any others, there's a proxying loop if Host: is passed!
      if (req.query != null ? req.query.pdfng : undefined) {
        const newHeaders = {}
        for (const h in req.headers) {
          const v = req.headers[h]
          if (/^(If-|Range)/i.test(h)) {
            newHeaders[h] = req.headers[h]
          }
        }
        options.headers = newHeaders
      }
      const proxy = request(options)
      proxy.pipe(res)
      return proxy.on('error', error =>
        logger.warn({ err: error, url }, 'CLSI proxy error')
      )
    })
  },

  wordCount(req, res, next) {
    const project_id = req.params.Project_id
    const file = req.query.file || false
    const { clsiserverid } = req.query
    return CompileController._compileAsUser(req, function (error, user_id) {
      if (error != null) {
        return next(error)
      }
      CompileManager.wordCount(
        project_id,
        user_id,
        file,
        clsiserverid,
        function (error, body) {
          if (error != null) {
            return next(error)
          }
          res.contentType('application/json')
          return res.send(body)
        }
      )
    })
  },
}

function _getPersistenceOptions(req, projectId, callback) {
  const { clsiserverid } = req.query
  const user_id = SessionManager.getLoggedInUserId(req)
  if (clsiserverid && typeof clsiserverid === 'string') {
    callback(null, { qs: { clsiserverid } })
  } else {
    ClsiCookieManager.getCookieJar(projectId, user_id, (err, jar) => {
      callback(err, { jar })
    })
  }
}
