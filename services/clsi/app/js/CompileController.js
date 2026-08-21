import OError from '@overleaf/o-error'
import Path from 'node:path'
import RequestParser from './RequestParser.js'
import CompileManager from './CompileManager.js'
import Settings from '@overleaf/settings'
import Metrics from '@overleaf/metrics'
import ProjectPersistenceManager from './ProjectPersistenceManager.js'
import logger from '@overleaf/logger'
import Errors from './Errors.js'
import CLSICacheHandler from './CLSICacheHandler.js'
import { parseReq, z, zz } from '@overleaf/validation-tools'
import { compileRequestBodySchema } from './schemas.js'

const { notifyCLSICacheAboutBuild } = CLSICacheHandler

let lastSuccessfulCompileTimestamp = 0

function timeSinceLastSuccessfulCompile() {
  return Date.now() - lastSuccessfulCompileTimestamp
}

// project_id is a Mongo ObjectId in the common case, but this service is also
// hit directly by clsi-perf and by v1 submission/export flows using a bare
// alphanumeric submission id (see zz.objectId().or(zz.submissionId()) in
// web's ClsiURLHelpers.mjs, which this mirrors); user_id, when present, is
// always a Mongo ObjectId.
const projectOrUserParamsSchema = z.strictObject({
  project_id: zz.objectId().or(zz.submissionId()),
  user_id: zz.objectId().optional(),
})

// web's ClsiManager.mjs (_getCompilerUrl / _makeRequestWithClsiServerId)
// appends these to every GET it makes against this service, for backend
// routing and metrics; none of them are read by the handlers below. Spread
// into each affected route's strictObject query schema so genuine requests
// aren't rejected.
const clsiRoutingQueryFields = {
  compileBackendClass: zz.compileBackendClass().optional(),
  compileGroup: zz.compileGroup().optional(),
  clsiserverid: zz.clsiServerId().optional(),
}

const compileSchema = z.object({
  params: projectOrUserParamsSchema,
  body: compileRequestBodySchema,
})

function compile(req, res, next) {
  const { params, body } = parseReq(req, compileSchema, { logOnly: true })
  const timer = new Metrics.Timer('compile-request')
  RequestParser.parse(body, function (error, request) {
    if (error) {
      return next(error)
    }
    timer.opts = request.metricsOpts
    request.project_id = params.project_id
    if (params.user_id != null) {
      request.user_id = params.user_id
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
            let { buildId, outputFiles, baseHistoryVersion } = result || {}
            let code, status
            if (outputFiles == null) {
              outputFiles = []
            }
            if (error instanceof Errors.AlreadyCompilingError) {
              code = 423 // Http 423 Locked
              status = 'compile-in-progress'
            } else if (error instanceof Errors.FilesOutOfSyncError) {
              code = 409 // Http 409 Conflict
              status = 'conflict'
              logger.warn(
                {
                  projectId: request.project_id,
                  userId: request.user_id,
                },
                'files out of sync, please retry'
              )
            } else if (error instanceof Errors.MissingUpdatesError) {
              code = 409
              status = 'missing-updates'
              baseHistoryVersion = error.info.baseHistoryVersion
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
                  png2pdf: request.png2pdf,
                  imageName: request.imageName
                    ? Path.basename(request.imageName)
                    : undefined,
                  rootResourcePath: request.rootResourcePath,
                  stopOnFirstError: request.stopOnFirstError,
                },
                metricsOpts: request.metricsOpts,
              })
            }

            timer.done()
            res.status(code || 200).send({
              compile: {
                status,
                error: error?.message || error,
                baseHistoryVersion,
                stats,
                timings,
                buildId,
                clsiCacheShard,
                instanceType: Settings.apis.clsi.instanceType,
                zone: Settings.apis.clsi.zone,
                isSpotInstance: Settings.apis.clsi.isSpotInstance,
                outputUrlPrefix: Settings.apis.clsi.outputUrlPrefix,
                outputFiles: outputFiles.map(file => ({
                  url:
                    `${Settings.apis.clsi.downloadHost}/project/${request.project_id}` +
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

const projectOrUserOnlyParamsSchema = z.object({
  params: projectOrUserParamsSchema,
})

function stopCompile(req, res, next) {
  const { params } = parseReq(req, projectOrUserOnlyParamsSchema, {
    logOnly: true,
  })
  const { project_id: projectId, user_id: userId } = params
  CompileManager.stopCompile(projectId, userId, function (error) {
    if (error) {
      return next(error)
    }
    res.sendStatus(204)
  })
}

function clearCache(req, res, next) {
  const { params } = parseReq(req, projectOrUserOnlyParamsSchema, {
    logOnly: true,
  })
  const { project_id: projectId, user_id: userId } = params
  CompileManager.stopCompile(projectId, userId, error => {
    if (error) return next(OError.tag(error, 'stop compile'))
    ProjectPersistenceManager.clearProject(projectId, userId, error => {
      if (error) return next(OError.tag(error, 'clear project'))
      res.sendStatus(204)
    })
  })
}

// imageName is validated against the allowlist enforced by
// CompileManager._runSynctex (Errors.InvalidParameter -> 400), same as
// before, since (like compile.options.imageName) it has no fixed vocabulary
// independent of deployment settings.
const syncFromCodeSchema = z.object({
  params: projectOrUserParamsSchema,
  query: z.strictObject({
    file: zz.filepath(),
    line: z.coerce.number().int(),
    column: z.coerce.number().int(),
    imageName: z.string().optional(),
    editorId: z.uuid().optional(),
    buildId: zz.buildId().optional(),
    compileFromClsiCache: z.stringbool().default(false),
    ...clsiRoutingQueryFields,
  }),
})

// Rollout-temporary fallback (loosened primary schema; no zod validation
// existed for this route on main); delete when this route's
// REQ_VALIDATION_MODE instrumentation is removed.
const syncFromCodeFallbackSchema = z.object({
  params: z.object({
    project_id: z.string(),
    user_id: z.string().optional(),
  }),
  query: z.object({
    file: z.string(),
    line: z.coerce.number(),
    column: z.coerce.number(),
    imageName: z.string().optional(),
    editorId: z.string().optional(),
    buildId: z.string().optional(),
    compileFromClsiCache: z.stringbool().default(false),
  }),
})

function syncFromCode(req, res, next) {
  const { params, query } = parseReq(req, syncFromCodeSchema, {
    logOnly: true,
    fallbackSchema: syncFromCodeFallbackSchema,
  })
  const { file, editorId, buildId, compileFromClsiCache, line, column } = query
  const { imageName } = query
  const { project_id: projectId, user_id: userId } = params
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

const syncFromPdfSchema = z.object({
  params: projectOrUserParamsSchema,
  query: z.strictObject({
    page: z.coerce.number().int(),
    h: z.coerce.number(),
    v: z.coerce.number(),
    imageName: z.string().optional(),
    editorId: z.uuid().optional(),
    buildId: zz.buildId().optional(),
    compileFromClsiCache: z.stringbool().default(false),
    ...clsiRoutingQueryFields,
  }),
})

// Rollout-temporary fallback (loosened primary schema; no zod validation
// existed for this route on main); delete when this route's
// REQ_VALIDATION_MODE instrumentation is removed.
const syncFromPdfFallbackSchema = z.object({
  params: z.object({
    project_id: z.string(),
    user_id: z.string().optional(),
  }),
  query: z.object({
    page: z.coerce.number(),
    h: z.coerce.number(),
    v: z.coerce.number(),
    imageName: z.string().optional(),
    editorId: z.string().optional(),
    buildId: z.string().optional(),
    compileFromClsiCache: z.stringbool().default(false),
  }),
})

function syncFromPdf(req, res, next) {
  const { params, query } = parseReq(req, syncFromPdfSchema, {
    logOnly: true,
    fallbackSchema: syncFromPdfFallbackSchema,
  })
  const { page, h, v, editorId, buildId, compileFromClsiCache } = query
  const { imageName } = query
  const { project_id: projectId, user_id: userId } = params
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

const wordcountSchema = z.object({
  params: projectOrUserParamsSchema,
  query: z.strictObject({
    file: zz.filepath().default('main.tex'),
    image: z.string().optional(),
    ...clsiRoutingQueryFields,
  }),
})

// Rollout-temporary fallback (loosened primary schema; no zod validation
// existed for this route on main); delete when this route's
// REQ_VALIDATION_MODE instrumentation is removed.
const wordcountFallbackSchema = z.object({
  params: z.object({
    project_id: z.string(),
    user_id: z.string().optional(),
  }),
  query: z.object({
    file: z.string().default('main.tex'),
    image: z.string().optional(),
  }),
})

function wordcount(req, res, next) {
  const { params, query } = parseReq(req, wordcountSchema, {
    logOnly: true,
    fallbackSchema: wordcountFallbackSchema,
  })
  const { file, image } = query
  const { project_id: projectId, user_id: userId } = params
  logger.debug({ image, file, projectId }, 'word count request')

  CompileManager.wordcount(
    projectId,
    userId,
    file,
    image,
    null,
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

const wordcountWithSyncSchema = z.object({
  params: projectOrUserParamsSchema,
  query: wordcountSchema.shape.query,
  body: compileRequestBodySchema,
})

// Same as wordcount, but carrying the project state as a compile request body.
// texcount reads the sources from the compile dir, which only a previous
// compile on this clsi populates -- and there may not have been one, e.g. when
// the editor served the PDF from clsi-cache, which stores output files only.
function wordcountWithSync(req, res, next) {
  const { params, query, body } = parseReq(req, wordcountWithSyncSchema)
  const { file, image } = query
  const { project_id: projectId, user_id: userId } = params
  logger.debug({ image, file, projectId }, 'word count request with sync')

  RequestParser.parse(body, function (error, request) {
    if (error) {
      return next(error)
    }
    request.project_id = projectId
    if (userId != null) {
      request.user_id = userId
    }
    ProjectPersistenceManager.markProjectAsJustAccessed(
      projectId,
      function (error) {
        if (error) {
          return next(error)
        }
        CompileManager.wordcount(
          projectId,
          userId,
          file,
          image,
          request,
          function (error, result) {
            if (error instanceof Errors.MissingUpdatesError) {
              return res.status(409).json({
                baseHistoryVersion: error.info.baseHistoryVersion,
              })
            }
            if (error instanceof Errors.AlreadyCompilingError) {
              return res.status(423).send('compile in progress') // Http 423 Locked
            }
            if (error instanceof Errors.TooManyCompileRequestsError) {
              return res.status(503).send('too many concurrent requests')
            }
            if (error) {
              return next(error)
            }
            res.json({
              texcount: result,
            })
          }
        )
      }
    )
  })
}

function status(req, res, next) {
  res.send('OK')
}

export default {
  compile,
  stopCompile,
  clearCache,
  syncFromCode,
  syncFromPdf,
  wordcount,
  wordcountWithSync,
  status,
  timeSinceLastSuccessfulCompile,
}
