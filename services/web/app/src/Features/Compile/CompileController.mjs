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

// Only reads the one query field this helper itself consumes -- the route
// handlers that call this (compile, ClsiCacheController.getLatestBuildFromCache)
// separately validate their own full query/params/body with their own schema.
const splitTestOptionsQuerySchema = z.object({
  body: z.object({
    png2pdf: z.boolean().optional(),
  }),
  query: z.object({
    // presence-based flag: the frontend only ever sets this to "true" or
    // omits it (see compiler.ts buildCompileParams), so a bare optional
    // string preserves the existing truthy check below
    enable_pdf_caching: z.string().optional(),
  }),
})

async function _getSplitTestOptions(req, res) {
  const { body, query } = parseReq(req, splitTestOptionsQuerySchema, {
    logOnly: true,
  })
  const compileFromHistory = await SplitTestHandler.promises.featureFlagEnabled(
    req,
    res,
    'compile-from-history',
    { includeReferer: true }
  )

  const pdfDownloadDomain = Settings.pdfDownloadDomain
  const enablePdfCaching = Settings.enablePdfCaching
  const pdfCachingMinChunkSize = Settings.pdfCachingMinChunkSize

  const pdfCachingOptions =
    !enablePdfCaching || !query.enable_pdf_caching
      ? // The frontend does not want to do pdf caching.
        { enablePdfCaching: false }
      : { enablePdfCaching, pdfCachingMinChunkSize }

  const enablePng2Pdf = await SplitTestHandler.promises.featureFlagEnabled(
    req,
    res,
    'png2pdf',
    { includeReferer: true }
  )

  const png2PdfOptions =
    !enablePng2Pdf || !body.png2pdf
      ? { enablePng2Pdf: false }
      : { enablePng2Pdf }

  const checkpointingEnabled =
    await SplitTestHandler.promises.featureFlagEnabled(
      req,
      res,
      'compile-with-checkpoint',
      { includeReferer: true }
    )

  const checkpointCompilesOptions = {
    enableCheckpointCompiles: checkpointingEnabled,
  }

  return {
    compileFromHistory,
    pdfDownloadDomain,
    ...pdfCachingOptions,
    ...png2PdfOptions,
    ...checkpointCompilesOptions,
  }
}

// buildId in syncTeXBaseQuery below is validated with zz.buildId(), which
// requires a hyphen-separated pair of hex runs (/^[0-9a-f]+-[0-9a-f]+$/) --
// stricter than the bare hex-ish regex the manual guards restored below
// check editorId/buildId against. Both layers run: the schema during this
// rollout's logOnly phase, and the manual guards unconditionally.
async function _syncTeX(
  req,
  res,
  projectId,
  editorId,
  buildId,
  clsiServerId,
  direction,
  validatedOptions
) {
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

const compileSchema = z.object({
  params: z.strictObject({
    Project_id: zz.objectId(),
  }),
  query: z.object({
    // presence-based flags: the frontend only ever sets these to "true" or
    // omits them (see compiler.ts buildCompileParams); bare optional
    // strings preserve the existing truthy checks below rather than
    // z.stringbool(), which would treat an (unused-in-practice) explicit
    // "false" value differently than the current code does
    auto_compile: z.string().optional(),
    file_line_errors: z.string().optional(),
    enable_pdf_caching: z.string().optional(),
  }),
  body: z.strictObject({
    stopOnFirstError: z.boolean().optional(),
    editorId: z.uuid().optional(),
    rootResourcePath: zz.filepath().optional(),
    rootDoc_id: zz.objectId().nullish(),
    compiler: z.string().optional(),
    draft: z.boolean().optional(),
    png2pdf: z.boolean().optional(),
    // silently ignored (not rejected) when not one of these three, to
    // match the existing .includes() check below
    check: z.string().optional(),
    incrementalCompilesEnabled: z.boolean().optional(),
  }),
})

const stopCompileSchema = z.object({
  params: z.strictObject({
    Project_id: zz.objectId(),
  }),
})

const compileSubmissionSchema = z.object({
  params: z.strictObject({
    submission_id: zz.submissionId(),
  }),
  // This is the public compile-submission API used by external callers (see
  // modules/publish-modal/app/src/PublishModalRouter.mjs): the body is a
  // whole CLSI compile job spec ("resources" etc.) forwarded verbatim to
  // ClsiManager.sendExternalRequest -- CLSI's own compileSchema
  // (services/clsi/app/js/CompileController.js) is what actually validates
  // that job spec, so this is treated as a genuinely open map, letting the
  // few option flags below still be read out named without stripping the
  // rest of the payload before it's forwarded (a non-strict z.object() would
  // strip unrecognized keys from the parsed result, breaking the forward).
  body: z.record(z.string(), z.unknown()),
})

const deleteAuxFilesSchema = z.object({
  params: z.strictObject({
    Project_id: zz.objectId(),
  }),
  query: z.object({
    clsiserverid: zz.clsiServerId().optional(),
  }),
})

// Rollout-temporary fallback (pre-refinement schema from main); delete
// when this route's REQ_VALIDATION_MODE instrumentation is removed.
const deleteAuxFilesFallbackSchema = z.object({
  params: z.object({
    Project_id: zz.objectId(),
  }),
  query: z.object({
    clsiserverid: zz.clsiServerId().optional(),
  }),
})

const wordCountSchema = z.object({
  params: z.strictObject({
    Project_id: zz.objectId(),
  }),
  query: z.object({
    clsiserverid: zz.clsiServerId().optional(),
    file: z.string().optional(),
    rootResourcePath: zz.filepath().optional(),
  }),
})

// Rollout-temporary fallback (pre-refinement schema from main); delete
// when this route's REQ_VALIDATION_MODE instrumentation is removed.
const wordCountFallbackSchema = z.object({
  params: z.object({
    Project_id: zz.objectId(),
  }),
  query: z.object({
    clsiserverid: zz.clsiServerId().optional(),
    file: z.string().optional(),
    rootResourcePath: z.string().optional(),
  }),
})

const getFileForSubmissionFromClsiSchema = z.object({
  params: z.strictObject({
    submissionId: zz.submissionId(),
    build_id: zz.buildId(),
    file: zz.filepath(),
  }),
  query: z.object({
    clsiserverid: zz.clsiServerId().optional(),
    // V1's CLSI::Response#v2_api_url always appends this (from the
    // compile response's compileGroup field, which compileSubmission below
    // never populates -- see its res.json()), so it arrives here blank
    // rather than one of zz.compileGroup()'s enum values. Unread by the
    // handler either way; accept the real enum plus that one specific
    // blank case, rather than opening this up to an arbitrary string.
    compileGroup: zz.compileGroup().or(z.literal('')).optional(),
  }),
})

// Rollout-temporary fallback (pre-refinement schema from main); delete
// when this route's REQ_VALIDATION_MODE instrumentation is removed.
const getFileForSubmissionFromClsiFallbackSchema = z.object({
  params: z.object({
    submissionId: zz.submissionId(),
    build_id: zz.buildId(),
    file: zz.filepath(),
  }),
  query: z.object({
    clsiserverid: zz.clsiServerId().optional(),
  }),
})

// getFileFromClsi/getOutputZipFromClsi below (not downloadPdf, which only
// has one route) are each mounted on two routes: one plain, and one with an
// extra (unused by the handler) :user_id segment for a specific user's
// build -- see router.mjs. user_id is declared but never read, purely so
// the strict params schema still accepts the second route's extra segment.
const getFileFromClsiSchema = z.object({
  params: z.strictObject({
    Project_id: zz.objectId(),
    user_id: zz.objectId().optional(),
    build_id: zz.buildId(),
    file: zz.filepath(),
  }),
  query: z.object({
    clsiserverid: zz.clsiServerId().optional(),
    editorId: z.uuid().optional(),
    // frontend's buildFileList always appends this to every per-file
    // download link it builds for the "Other logs and files" menu
    // (services/web/frontend/js/features/pdf-preview/util/file-list.ts)
    compileGroup: zz.compileGroup().optional(),
    // not consumed, traffic tag
    enable_pdf_caching: z.stringbool().optional(),
  }),
})

// Rollout-temporary fallback (pre-refinement schema from main); delete
// when this route's REQ_VALIDATION_MODE instrumentation is removed.
const getFileFromClsiFallbackSchema = z.object({
  params: z.object({
    Project_id: zz.objectId(),
    build_id: zz.buildId(),
    file: zz.filepath(),
  }),
  query: z.object({
    clsiserverid: zz.clsiServerId().optional(),
    editorId: z.uuid().optional(),
    // not consumed, traffic tag
    enable_pdf_caching: z.string().optional(),
  }),
})

const getOutputPDFFromClsiSchema = z.object({
  params: z.strictObject({
    Project_id: zz.objectId(),
    build_id: zz.buildId(),
  }),
  query: z.object({
    clsiserverid: zz.clsiServerId().optional(),
    editorId: z.uuid().optional(),
    // presence-based flag, see compile()'s query fields above
    popupDownload: z.string().optional(),
    // the PDF download link is built from the same query params as the
    // preview's pdfUrl (see output-files.ts), which includes compileGroup
    compileGroup: zz.compileGroup().optional(),
    // not consumed, traffic tag
    enable_pdf_caching: z.stringbool().optional(),
  }),
})

// Rollout-temporary fallback (pre-refinement schema from main); delete
// when this route's REQ_VALIDATION_MODE instrumentation is removed.
const getOutputPDFFromClsiFallbackSchema = z.object({
  params: z.object({
    Project_id: zz.objectId(),
    build_id: zz.buildId(),
  }),
  query: z.object({
    clsiserverid: zz.clsiServerId().optional(),
    editorId: z.uuid().optional(),
    // not consumed, traffic tag
    enable_pdf_caching: z.string().optional(),
  }),
})

const getOutputZipFromClsiSchema = z.object({
  params: z.strictObject({
    Project_id: zz.objectId(),
    user_id: zz.objectId().optional(),
    build_id: zz.buildId(),
  }),
  query: z.object({
    clsiserverid: zz.clsiServerId().optional(),
    // not consumed, traffic tag
    enable_pdf_caching: z.stringbool().optional(),
  }),
})

// Rollout-temporary fallback (pre-refinement schema from main); delete
// when this route's REQ_VALIDATION_MODE instrumentation is removed.
const getOutputZipFromClsiFallbackSchema = z.object({
  params: z.object({
    Project_id: zz.objectId(),
    build_id: zz.buildId(),
  }),
  query: z.object({
    clsiserverid: zz.clsiServerId().optional(),
    // not consumed, traffic tag
    enable_pdf_caching: z.string().optional(),
  }),
})

const compileAndDownloadPdfSchema = z.object({
  params: z.strictObject({
    project_id: zz.objectId(),
  }),
})

const syncTeXBaseQuery = {
  editorId: z.uuid().optional(),
  buildId: zz.buildId(),
  clsiserverid: zz.clsiServerId().optional(),
}

const proxySyncPdfSchema = z.object({
  params: z.strictObject({
    Project_id: zz.objectId(),
  }),
  query: z.object({
    page: z.string().regex(/^\d+$/),
    h: z.string().regex(/^-?\d+(\.\d+)?$/),
    v: z.string().regex(/^-?\d+(\.\d+)?$/),
    ...syncTeXBaseQuery,
  }),
})

const proxySyncCodeSchema = z.object({
  params: z.strictObject({
    Project_id: zz.objectId(),
  }),
  query: z.object({
    file: zz.filepath(),
    line: z.string().regex(/^\d+$/),
    column: z.string().regex(/^\d+$/),
    ...syncTeXBaseQuery,
  }),
})

const _CompileController = {
  async compile(req, res) {
    res.setTimeout(COMPILE_TIMEOUT_MS)
    const { params, query, body } = parseReq(req, compileSchema, {
      logOnly: true,
    })
    const projectId = params.Project_id
    const isAutoCompile = !!query.auto_compile
    const fileLineErrors = !!query.file_line_errors
    const stopOnFirstError = !!body.stopOnFirstError
    const userId = SessionManager.getLoggedInUserId(req.session)
    const options = {
      isAutoCompile,
      fileLineErrors,
      stopOnFirstError,
      editorId: body.editorId,
      rootResourcePath: body.rootResourcePath,
    }

    if (body.rootDoc_id) {
      options.rootDoc_id = body.rootDoc_id
    }
    if (body.compiler) {
      options.compiler = body.compiler
    }
    if (body.draft) {
      options.draft = body.draft
    }
    if (['validate', 'error', 'silent'].includes(body.check)) {
      options.check = body.check
    }
    if (body.incrementalCompilesEnabled) {
      options.incrementalCompilesEnabled = true
    }

    let {
      enablePdfCaching,
      pdfCachingMinChunkSize,
      pdfDownloadDomain,
      compileFromHistory,
      enablePng2Pdf,
      enableCheckpointCompiles,
    } = await _getSplitTestOptions(req, res)
    if (Features.hasFeature('saas')) {
      options.compileFromClsiCache = true
      options.populateClsiCache = true
      options.compileFromHistory = compileFromHistory
      if (enablePng2Pdf) {
        options.png2pdf = enablePng2Pdf
      }
      if (enableCheckpointCompiles) {
        options.checkpointing = true
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
          isPng2pdf: !!options.png2pdf,
        }
      )
    }

    // Report image-inclusion timings for compiles that either used optimised
    // PNGs or contained PNGs the optimisation would have targeted.
    // Projects the optimisation would never have touched are excluded,
    // so they cannot dilute the comparison.
    const latexRuns = stats?.['latex-runs']
    const optimisedPngCount = stats?.['include-image-optimised'] || 0
    const optimisablePngCount = stats?.['optimisable-png-count']
    const projectHasUnconvertedPngs = Boolean(stats?.projectHasUnconvertedPngs)
    if (latexRuns > 0 && (optimisedPngCount > 0 || projectHasUnconvertedPngs)) {
      // included images are counted on every run, normalise them to get the number
      // of images in the project - this is then comparable to optimisablePngCount which
      // is computed from the project itself and does not vary with the number of runs
      const normalisedOptPngCount = Math.round(optimisedPngCount / latexRuns)
      const normalisedTotalImageCount = Math.round(
        (stats?.['include-image-all'] || 0) / latexRuns
      )
      AnalyticsManager.recordEventForUserInBackground(
        userId,
        'compile-with-optimizable-pngs',
        {
          projectId,
          optimizablePngCount: optimisablePngCount || normalisedOptPngCount,
          optimizedPngCount: normalisedOptPngCount,
          optimizedImageInclusionTime:
            timings?.['include-image-optimised'] || 0,
          totalImages: normalisedTotalImageCount,
          totalImageInclusionTime: timings?.['include-image-all'] || 0,
          isPng2pdf: !!options.png2pdf,
          compiler: options.compiler,
          compileTime: timings?.compileE2E,
          isDraftMode: !!options.draft,
          status,
          latexRuns,
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
    const { params } = parseReq(req, stopCompileSchema, { logOnly: true })
    const projectId = params.Project_id
    const userId = SessionManager.getLoggedInUserId(req.session)
    await CompileManager.promises.stopCompile(projectId, userId)
    res.sendStatus(200)
  },

  // Used for submissions through the public API
  async compileSubmission(req, res) {
    res.setTimeout(COMPILE_TIMEOUT_MS)
    const { params, body } = parseReq(req, compileSubmissionSchema, {
      logOnly: true,
    })
    const submissionId = params.submission_id
    const options = {}
    if (body?.rootResourcePath != null) {
      options.rootResourcePath = body.rootResourcePath
    }
    if (body?.compiler) {
      options.compiler = body.compiler
    }
    if (body?.draft) {
      options.draft = body.draft
    }
    if (['validate', 'error', 'silent'].includes(body?.check)) {
      options.check = body.check
    }
    options.compileGroup =
      body?.compileGroup || Settings.defaultFeatures.compileGroup
    options.compileBackendClass =
      Settings.apis.clsi.submissionCompileBackendClass
    options.timeout = body?.timeout || Settings.defaultFeatures.compileTimeout
    const { status, outputFiles, clsiServerId, validationProblems } =
      await ClsiManager.promises.sendExternalRequest(
        submissionId,
        body,
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
      query: { clsiserverid: clsiServerId, editorId, popupDownload },
    } = parseReq(req, getOutputPDFFromClsiSchema, {
      fallbackSchema: getOutputPDFFromClsiFallbackSchema,
    })
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

    if (popupDownload) {
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
    } = parseReq(req, deleteAuxFilesSchema, {
      fallbackSchema: deleteAuxFilesFallbackSchema,
    })
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
    const { params } = parseReq(req, compileAndDownloadPdfSchema, {
      logOnly: true,
    })
    const projectId = params.project_id

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
    } = parseReq(req, getOutputZipFromClsiSchema, {
      fallbackSchema: getOutputZipFromClsiFallbackSchema,
    })

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
    } = parseReq(req, getFileFromClsiSchema, {
      fallbackSchema: getFileFromClsiFallbackSchema,
    })

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
    } = parseReq(req, getFileForSubmissionFromClsiSchema, {
      fallbackSchema: getFileForSubmissionFromClsiFallbackSchema,
    })
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
    const {
      params: { Project_id: projectId },
      query: { page, h, v, editorId, buildId, clsiserverid: clsiServerId },
    } = parseReq(req, proxySyncPdfSchema, { logOnly: true })
    if (!editorId?.match(/^[a-f0-9-]+$/)) throw new Error('invalid ?editorId')
    if (!buildId?.match(/^[a-f0-9-]+$/)) throw new Error('invalid ?buildId')
    if (!page?.match(/^\d+$/)) {
      throw new Error('invalid page parameter')
    }
    if (!h?.match(/^-?\d+(\.\d+)?$/)) {
      throw new Error('invalid h parameter')
    }
    if (!v?.match(/^-?\d+(\.\d+)?$/)) {
      throw new Error('invalid v parameter')
    }
    await _syncTeX(
      req,
      res,
      projectId,
      editorId,
      buildId,
      clsiServerId,
      'pdf',
      { page, h, v }
    )
  },

  async proxySyncCode(req, res) {
    const {
      params: { Project_id: projectId },
      query: {
        file,
        line,
        column,
        editorId,
        buildId,
        clsiserverid: clsiServerId,
      },
    } = parseReq(req, proxySyncCodeSchema, { logOnly: true })
    if (!editorId?.match(/^[a-f0-9-]+$/)) throw new Error('invalid ?editorId')
    if (!buildId?.match(/^[a-f0-9-]+$/)) throw new Error('invalid ?buildId')
    if (!file) {
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
    await _syncTeX(
      req,
      res,
      projectId,
      editorId,
      buildId,
      clsiServerId,
      'code',
      { file, line, column }
    )
  },

  async wordCount(req, res) {
    const { params, query } = parseReq(req, wordCountSchema, {
      fallbackSchema: wordCountFallbackSchema,
    })
    const projectId = params.Project_id
    const file = query.file || false
    const { clsiserverid, rootResourcePath } = query
    const userId = CompileController._getUserIdForCompile(req)

    const body = await CompileManager.promises.wordCount(
      projectId,
      userId,
      file,
      clsiserverid,
      rootResourcePath
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
