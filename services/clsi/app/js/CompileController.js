const RequestParser = require('./RequestParser')
const CompileManager = require('./CompileManager')
const Settings = require('@overleaf/settings')
const Metrics = require('./Metrics')
const ProjectPersistenceManager = require('./ProjectPersistenceManager')
const logger = require('@overleaf/logger')
const Errors = require('./Errors')

let lastSuccessfulCompileTimestamp = 0

function timeSinceLastSuccessfulCompile() {
  return Date.now() - lastSuccessfulCompileTimestamp
}

function compile(req, res, next) {
  const timer = new Metrics.Timer('compile-request')
  RequestParser.parse(req.body, function (error, request) {
    if (error) {
      return next(error)
    }
    timer.opts = request.metricsOpts
    request.project_id = req.params.project_id
    if (req.params.user_id != null) {
      request.user_id = req.params.user_id
    }
    ProjectPersistenceManager.markProjectAsJustAccessed(
      request.project_id,
      function (error) {
        if (error) {
          return next(error)
        }
        CompileManager.doCompileWithLock(request, (error, result) => {
          let { buildId, outputFiles, stats, timings } = result || {}
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
            logger.warn(
              {
                projectId: request.project_id,
                userId: request.user_id,
              },
              'files out of sync, please retry'
            )
          } else if (
            error?.code === 'EPIPE' ||
            error instanceof Errors.TooManyCompileRequestsError
          ) {
            // docker returns EPIPE when shutting down
            code = 503 // send 503 Unavailable response
            status = 'unavailable'
          } else if (error?.terminated) {
            status = 'terminated'
          } else if (error?.validate) {
            status = `validation-${error.validate}`
          } else if (error?.timedout) {
            status = 'timedout'
            logger.debug(
              { err: error, projectId: request.project_id },
              'timeout running compile'
            )
          } else if (error) {
            status = 'error'
            code = 500
            logger.error(
              { err: error, projectId: request.project_id },
              'error running compile'
            )
          } else {
            if (
              outputFiles.some(
                file => file.path === 'output.pdf' && file.size > 0
              )
            ) {
              status = 'success'
              lastSuccessfulCompileTimestamp = Date.now()
            } else if (request.stopOnFirstError) {
              status = 'stopped-on-first-error'
            } else {
              status = 'failure'
              logger.warn(
                { projectId: request.project_id, outputFiles },
                'project failed to compile successfully, no output.pdf generated'
              )
            }

            // log an error if any core files are found
            if (outputFiles.some(file => file.path === 'core')) {
              logger.error(
                { projectId: request.project_id, req, outputFiles },
                'core file found in output'
              )
            }
          }

          if (error) {
            outputFiles = error.outputFiles || []
            buildId = error.buildId
          }

          timer.done()
          res.status(code || 200).send({
            compile: {
              status,
              error: error?.message || error,
              stats,
              timings,
              buildId,
              outputUrlPrefix: Settings.apis.clsi.outputUrlPrefix,
              outputFiles: outputFiles.map(file => ({
                url:
                  `${Settings.apis.clsi.url}/project/${request.project_id}` +
                  (request.user_id != null ? `/user/${request.user_id}` : '') +
                  (file.build != null ? `/build/${file.build}` : '') +
                  `/output/${file.path}`,
                ...file,
              })),
            },
          })
        })
      }
    )
  })
}

function stopCompile(req, res, next) {
  const { project_id: projectId, user_id: userId } = req.params
  CompileManager.stopCompile(projectId, userId, function (error) {
    if (error) {
      return next(error)
    }
    res.sendStatus(204)
  })
}

function clearCache(req, res, next) {
  ProjectPersistenceManager.clearProject(
    req.params.project_id,
    req.params.user_id,
    function (error) {
      if (error) {
        return next(error)
      }
      // No content
      res.sendStatus(204)
    }
  )
}

function syncFromCode(req, res, next) {
  const { file } = req.query
  const line = parseInt(req.query.line, 10)
  const column = parseInt(req.query.column, 10)
  const { imageName } = req.query
  const projectId = req.params.project_id
  const userId = req.params.user_id

  if (imageName && !_isImageNameAllowed(imageName)) {
    return res.status(400).send('invalid image')
  }

  CompileManager.syncFromCode(
    projectId,
    userId,
    file,
    line,
    column,
    imageName,
    function (error, pdfPositions) {
      if (error) {
        return next(error)
      }
      res.json({
        pdf: pdfPositions,
      })
    }
  )
}

function syncFromPdf(req, res, next) {
  const page = parseInt(req.query.page, 10)
  const h = parseFloat(req.query.h)
  const v = parseFloat(req.query.v)
  const { imageName } = req.query
  const projectId = req.params.project_id
  const userId = req.params.user_id

  if (imageName && !_isImageNameAllowed(imageName)) {
    return res.status(400).send('invalid image')
  }
  CompileManager.syncFromPdf(
    projectId,
    userId,
    page,
    h,
    v,
    imageName,
    function (error, codePositions) {
      if (error) {
        return next(error)
      }
      res.json({
        code: codePositions,
      })
    }
  )
}

function wordcount(req, res, next) {
  const file = req.query.file || 'main.tex'
  const projectId = req.params.project_id
  const userId = req.params.user_id
  const { image } = req.query
  if (image && !_isImageNameAllowed(image)) {
    return res.status(400).send('invalid image')
  }
  logger.debug({ image, file, projectId }, 'word count request')

  CompileManager.wordcount(
    projectId,
    userId,
    file,
    image,
    function (error, result) {
      if (error) {
        return next(error)
      }
      res.json({
        texcount: result,
      })
    }
  )
}

function status(req, res, next) {
  res.send('OK')
}

function _isImageNameAllowed(imageName) {
  const ALLOWED_IMAGES =
    Settings.clsi && Settings.clsi.docker && Settings.clsi.docker.allowedImages
  return !ALLOWED_IMAGES || ALLOWED_IMAGES.includes(imageName)
}

module.exports = {
  compile,
  stopCompile,
  clearCache,
  syncFromCode,
  syncFromPdf,
  wordcount,
  status,
  timeSinceLastSuccessfulCompile,
}
