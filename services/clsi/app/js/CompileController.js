/* eslint-disable
    camelcase,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let CompileController
const RequestParser = require('./RequestParser')
const CompileManager = require('./CompileManager')
const Settings = require('@overleaf/settings')
const Metrics = require('./Metrics')
const ProjectPersistenceManager = require('./ProjectPersistenceManager')
const logger = require('@overleaf/logger')
const Errors = require('./Errors')

function isImageNameAllowed(imageName) {
  const ALLOWED_IMAGES =
    Settings.clsi && Settings.clsi.docker && Settings.clsi.docker.allowedImages
  return !ALLOWED_IMAGES || ALLOWED_IMAGES.includes(imageName)
}

module.exports = CompileController = {
  lastSuccessfulCompile: 0,

  compile(req, res, next) {
    if (next == null) {
      next = function () {}
    }
    const timer = new Metrics.Timer('compile-request')
    return RequestParser.parse(req.body, function (error, request) {
      if (error != null) {
        return next(error)
      }
      timer.opts = request.metricsOpts
      request.project_id = req.params.project_id
      if (req.params.user_id != null) {
        request.user_id = req.params.user_id
      }
      return ProjectPersistenceManager.markProjectAsJustAccessed(
        request.project_id,
        function (error) {
          if (error != null) {
            return next(error)
          }
          return CompileManager.doCompileWithLock(
            request,
            function (error, outputFiles, stats, timings) {
              let code, status
              if (outputFiles == null) {
                outputFiles = []
              }
              if (error instanceof Errors.AlreadyCompilingError) {
                code = 423 // Http 423 Locked
                status = 'compile-in-progress'
              } else if (error instanceof Errors.FilesOutOfSyncError) {
                code = 409 // Http 409 Conflict
                status = 'retry'
              } else if (error && error.code === 'EPIPE') {
                // docker returns EPIPE when shutting down
                code = 503 // send 503 Unavailable response
                status = 'unavailable'
              } else if (error != null ? error.terminated : undefined) {
                status = 'terminated'
              } else if (error != null ? error.validate : undefined) {
                status = `validation-${error.validate}`
              } else if (error != null ? error.timedout : undefined) {
                status = 'timedout'
                logger.log(
                  { err: error, project_id: request.project_id },
                  'timeout running compile'
                )
              } else if (error != null) {
                status = 'error'
                code = 500
                logger.warn(
                  { err: error, project_id: request.project_id },
                  'error running compile'
                )
              } else {
                let file
                status = 'failure'
                for (file of Array.from(outputFiles)) {
                  if (file.path === 'output.pdf' && file.size > 0) {
                    status = 'success'
                    CompileController.lastSuccessfulCompile = Date.now()
                  }
                }

                if (status === 'failure') {
                  logger.warn(
                    { project_id: request.project_id, outputFiles },
                    'project failed to compile successfully, no output.pdf generated'
                  )
                }

                // log an error if any core files are found
                for (file of Array.from(outputFiles)) {
                  if (file.path === 'core') {
                    logger.error(
                      { project_id: request.project_id, req, outputFiles },
                      'core file found in output'
                    )
                  }
                }
              }

              if (error != null) {
                outputFiles = error.outputFiles || []
              }

              timer.done()
              return res.status(code || 200).send({
                compile: {
                  status,
                  error: (error != null ? error.message : undefined) || error,
                  stats,
                  timings,
                  outputFiles: outputFiles.map(file => {
                    return {
                      url:
                        `${Settings.apis.clsi.url}/project/${request.project_id}` +
                        (request.user_id != null
                          ? `/user/${request.user_id}`
                          : '') +
                        (file.build != null ? `/build/${file.build}` : '') +
                        `/output/${file.path}`,
                      ...file,
                    }
                  }),
                },
              })
            }
          )
        }
      )
    })
  },

  stopCompile(req, res, next) {
    const { project_id, user_id } = req.params
    return CompileManager.stopCompile(project_id, user_id, function (error) {
      if (error != null) {
        return next(error)
      }
      return res.sendStatus(204)
    })
  },

  clearCache(req, res, next) {
    if (next == null) {
      next = function () {}
    }
    return ProjectPersistenceManager.clearProject(
      req.params.project_id,
      req.params.user_id,
      function (error) {
        if (error != null) {
          return next(error)
        }
        return res.sendStatus(204)
      }
    )
  }, // No content

  syncFromCode(req, res, next) {
    if (next == null) {
      next = function () {}
    }
    const { file } = req.query
    const line = parseInt(req.query.line, 10)
    const column = parseInt(req.query.column, 10)
    const { imageName } = req.query
    const { project_id } = req.params
    const { user_id } = req.params

    if (imageName && !isImageNameAllowed(imageName)) {
      return res.status(400).send('invalid image')
    }

    return CompileManager.syncFromCode(
      project_id,
      user_id,
      file,
      line,
      column,
      imageName,
      function (error, pdfPositions) {
        if (error != null) {
          return next(error)
        }
        return res.json({
          pdf: pdfPositions,
        })
      }
    )
  },

  syncFromPdf(req, res, next) {
    if (next == null) {
      next = function () {}
    }
    const page = parseInt(req.query.page, 10)
    const h = parseFloat(req.query.h)
    const v = parseFloat(req.query.v)
    const { imageName } = req.query
    const { project_id } = req.params
    const { user_id } = req.params

    if (imageName && !isImageNameAllowed(imageName)) {
      return res.status(400).send('invalid image')
    }
    return CompileManager.syncFromPdf(
      project_id,
      user_id,
      page,
      h,
      v,
      imageName,
      function (error, codePositions) {
        if (error != null) {
          return next(error)
        }
        return res.json({
          code: codePositions,
        })
      }
    )
  },

  wordcount(req, res, next) {
    if (next == null) {
      next = function () {}
    }
    const file = req.query.file || 'main.tex'
    const { project_id } = req.params
    const { user_id } = req.params
    const { image } = req.query
    if (image && !isImageNameAllowed(image)) {
      return res.status(400).send('invalid image')
    }
    logger.log({ image, file, project_id }, 'word count request')

    return CompileManager.wordcount(
      project_id,
      user_id,
      file,
      image,
      function (error, result) {
        if (error != null) {
          return next(error)
        }
        return res.json({
          texcount: result,
        })
      }
    )
  },

  status(req, res, next) {
    if (next == null) {
      next = function () {}
    }
    return res.send('OK')
  },
}
