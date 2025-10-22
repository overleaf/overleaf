const Path = require('node:path')
const RequestParser = require('./RequestParser')
const CompileManager = require('./CompileManager')
const Settings = require('@overleaf/settings')
const Metrics = require('@overleaf/metrics')
const ProjectPersistenceManager = require('./ProjectPersistenceManager')
const logger = require('@overleaf/logger')
const Errors = require('./Errors')
const { notifyCLSICacheAboutBuild } = require('./CLSICacheHandler')

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
        const stats = {}
        const timings = {}
        CompileManager.doCompileWithLock(
          request,
          stats,
          timings,
          (error, result) => {
            let { buildId, outputFiles } = result || {}
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

            let clsiCacheShard
            if (
              status === 'success' &&
              request.editorId &&
              request.populateClsiCache
            ) {
              clsiCacheShard = notifyCLSICacheAboutBuild({
                projectId: request.project_id,
                userId: request.user_id,
                buildId: outputFiles[0].build,
                editorId: request.editorId,
                outputFiles,
                compileGroup: request.compileGroup,
                stats,
                timings,
                options: {
                  compiler: request.compiler,
                  draft: request.draft,
                  imageName: request.imageName
                    ? Path.basename(request.imageName)
                    : undefined,
                  rootResourcePath: request.rootResourcePath,
                  stopOnFirstError: request.stopOnFirstError,
                },
              })
            }

            timer.done()
            res.status(code || 200).send({
              compile: {
                status,
                error: error?.message || error,
                stats,
                timings,
                buildId,
                clsiCacheShard,
                outputUrlPrefix: Settings.apis.clsi.outputUrlPrefix,
                outputFiles: outputFiles.map(file => ({
                  url:
                    `${Settings.apis.clsi.url}/project/${request.project_id}` +
                    (request.user_id != null
                      ? `/user/${request.user_id}`
                      : '') +
                    `/build/${file.build}/output/${file.path}`,
                  ...file,
                })),
              },
            })
          }
        )
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
  const { file, editorId, buildId } = req.query
  const compileFromClsiCache = req.query.compileFromClsiCache === 'true'
  const line = parseInt(req.query.line, 10)
  const column = parseInt(req.query.column, 10)
  const { imageName } = req.query
  const projectId = req.params.project_id
  const userId = req.params.user_id
  CompileManager.syncFromCode(
    projectId,
    userId,
    file,
    line,
    column,
    { imageName, editorId, buildId, compileFromClsiCache },
    function (error, pdfPositions, downloadedFromCache) {
      if (error) {
        return next(error)
      }
      res.json({
        pdf: pdfPositions,
        downloadedFromCache,
      })
    }
  )
}

function syncFromPdf(req, res, next) {
  const page = parseInt(req.query.page, 10)
  const h = parseFloat(req.query.h)
  const v = parseFloat(req.query.v)
  const { imageName, editorId, buildId } = req.query
  const compileFromClsiCache = req.query.compileFromClsiCache === 'true'
  const projectId = req.params.project_id
  const userId = req.params.user_id
  CompileManager.syncFromPdf(
    projectId,
    userId,
    page,
    h,
    v,
    { imageName, editorId, buildId, compileFromClsiCache },
    function (error, codePositions, downloadedFromCache) {
      if (error) {
        return next(error)
      }
      res.json({
        code: codePositions,
        downloadedFromCache,
      })
    }
  )
}

function wordcount(req, res, next) {
  const file = req.query.file || 'main.tex'
  const projectId = req.params.project_id
  const userId = req.params.user_id
  const { image } = req.query
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
