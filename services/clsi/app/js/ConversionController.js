import crypto from 'node:crypto'
import logger from '@overleaf/logger'
import { expressify } from '@overleaf/promise-utils'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import Metrics from '@overleaf/metrics'
import * as HistoryResourceWriter from './HistoryResourceWriter.js'
import Errors from './Errors.js'
import ConversionManager from './ConversionManager.js'
import ConversionOutputCleaner from './ConversionOutputCleaner.js'
import OutputCacheManager from './OutputCacheManager.js'
import ResourceWriter from './ResourceWriter.js'
import RequestParser from './RequestParser.js'
import { pipeline } from 'node:stream/promises'
import Settings from '@overleaf/settings'
import Path from 'node:path'
import { parseReq, z, zz } from '@overleaf/validation-tools'
import { compileRequestBodySchema } from './schemas.js'

const CONVERSION_CONFIGS = {
  docx: { extension: 'docx' },
  markdown: { extension: 'zip' },
  html: { extension: 'zip' },
}

// Shared by every multer route: validate the schema and, if that fails,
// still clean up the uploaded temp file before propagating the error (the
// upload is guaranteed present by FileUploadMiddleware, so it is safe to
// unlink even though the schema hasn't validated it yet).
async function parseUploadedFileReq(req, schema, opts) {
  try {
    return parseReq(req, schema, opts)
  } catch (err) {
    await fs.unlink(req.file.path).catch(() => {})
    throw err
  }
}

async function runDocumentToLaTeXConversion(res, path, conversionType) {
  logger.debug({ path, conversionType }, 'received file for conversion')
  const conversionId = crypto.randomUUID()
  let zipPath
  try {
    zipPath = await ConversionManager.promises.convertToLaTeXWithLock(
      conversionId,
      path,
      conversionType
    )
  } catch (err) {
    if (err instanceof Errors.ConversionError) {
      if (err.isUserFacing) {
        return res.status(422).json({
          error: err.stderr,
          exitCode: err.exitCode,
        })
      } else {
        logger.warn(
          { err, conversionType, stderr: err.stderr },
          'Conversion failed with non-user-facing error'
        )
        return res.status(422).json({})
      }
    } else {
      throw err
    }
  } finally {
    await fs.unlink(path).catch(() => {})
  }

  try {
    const zipStat = await fs.stat(zipPath)

    res.setHeader('Content-Length', zipStat.size)
    res.attachment('conversion.zip')
    res.setHeader('X-Content-Type-Options', 'nosniff')

    const readStream = fsSync.createReadStream(zipPath)
    await pipeline(readStream, res)
  } finally {
    await fs
      .rm(Path.dirname(zipPath), { recursive: true, force: true })
      .catch(() => {})
  }
}

const uploadedFileOnlySchema = z.object({ file: zz.uploadedFile() })

const convertDocumentToLaTeXSchema = z.object({
  // web's DocumentConversionManager.mjs always appends compileBackendClass
  // and compileGroup to this route's URL (same as CompileController.js's
  // clsiRoutingQueryFields), so the strict query schema must allow them too.
  query: z.strictObject({
    type: z.enum(['docx', 'markdown']),
    compileBackendClass: zz.compileBackendClass().optional(),
    compileGroup: zz.compileGroup().optional(),
  }),
  file: zz.uploadedFile(),
})

async function convertDocumentToLaTeX(req, res) {
  if (!Settings.enablePandocConversions) {
    await fs.unlink(req.file.path).catch(() => {})
    return res.sendStatus(404)
  }
  const { file, query } = await parseUploadedFileReq(
    req,
    convertDocumentToLaTeXSchema,
    { logOnly: true }
  )
  await runDocumentToLaTeXConversion(res, file.path, query.type)
}

// Legacy alias of convertDocumentToLaTeX, kept for backwards compatibility
// during CLSI/web deploy transitions (see app.js): conversionType is fixed to
// 'docx' rather than read from the query string.
async function convertDocxToLaTeX(req, res) {
  if (!Settings.enablePandocConversions) {
    await fs.unlink(req.file.path).catch(() => {})
    return res.sendStatus(404)
  }
  const { file } = await parseUploadedFileReq(req, uploadedFileOnlySchema, {
    logOnly: true,
  })
  await runDocumentToLaTeXConversion(res, file.path, 'docx')
}

const convertPDFToJPEGSchema = z.object({
  query: z.strictObject({
    mode: z.enum(['preview', 'thumbnail']),
    // v1's CLSI::PdfToJpeg always appends this (Rails.application.config
    // .conversion_compile_backend_class); clsi-lb's haproxy config already
    // used it to route the request to the right backend pool
    // (url_param(compileBackendClass), see clsi-lb/app/js/haproxy-config.ts),
    // so the handler below doesn't need to read it again.
    compileBackendClass: zz.compileBackendClass().optional(),
  }),
  file: zz.uploadedFile(),
})

async function convertPDFToJPEG(req, res) {
  if (!Settings.enablePdfConversions) {
    await fs.unlink(req.file.path).catch(() => {})
    return res.sendStatus(404)
  }
  const { file, query } = await parseUploadedFileReq(
    req,
    convertPDFToJPEGSchema,
    { logOnly: true }
  )
  const { path } = file
  const { mode } = query
  logger.debug({ path, mode }, 'received pdf for conversion to jpeg')
  const conversionId = crypto.randomUUID()
  let jpegPath
  try {
    jpegPath = await ConversionManager.promises.convertPDFToJPEGWithLock(
      conversionId,
      path,
      mode
    )
  } finally {
    await fs.unlink(path).catch(() => {})
  }

  try {
    const jpegStat = await fs.stat(jpegPath)

    res.setHeader('Content-Length', jpegStat.size)
    res.attachment('output.jpg')
    res.setHeader('X-Content-Type-Options', 'nosniff')

    const readStream = fsSync.createReadStream(jpegPath)
    await pipeline(readStream, res)
  } finally {
    await fs
      .rm(Path.dirname(jpegPath), { recursive: true, force: true })
      .catch(() => {})
  }
}

// type/CONVERSION_CONFIGS keys kept in sync explicitly (rather than deriving
// the enum from Object.keys) so the valid values are visible at a glance.
const convertProjectToDocumentSchema = z.object({
  params: z.strictObject({
    project_id: zz.objectId().or(zz.submissionId()),
    user_id: zz.objectId(),
  }),
  // web's DocumentConversionManager.mjs always appends compileBackendClass
  // and compileGroup to this route's URL (same as CompileController.js's
  // clsiRoutingQueryFields), so the strict query schema must allow them too.
  query: z.strictObject({
    type: z.enum(['docx', 'markdown', 'html']),
    responseFormat: z.enum(['json', 'stream']).optional().default('stream'),
    compileBackendClass: zz.compileBackendClass().optional(),
    compileGroup: zz.compileGroup().optional(),
  }),
  body: compileRequestBodySchema,
})

// Rollout-temporary fallback (loosened primary schema; no zod validation
// existed for this route on main); delete when this route's
// REQ_VALIDATION_MODE instrumentation is removed. `body` is reused as-is:
// compileRequestBodySchema has no coercions/defaults of its own, so a raw
// passthrough of it on failure hands the handler the same shape it always
// has (RequestParser does its own, non-zod parsing of the body).
const convertProjectToDocumentFallbackSchema = z.object({
  params: z.object({
    project_id: z.string(),
    user_id: z.string(),
  }),
  query: z.object({
    type: z.enum(['docx', 'markdown', 'html']),
    responseFormat: z.enum(['json', 'stream']).optional().default('stream'),
  }),
  body: compileRequestBodySchema,
})

async function convertProjectToDocument(req, res) {
  if (!Settings.enablePandocConversions) {
    return res.sendStatus(404)
  }

  const { params, query, body } = parseReq(
    req,
    convertProjectToDocumentSchema,
    {
      logOnly: true,
      fallbackSchema: convertProjectToDocumentFallbackSchema,
    }
  )
  const { project_id: projectId, user_id: userId } = params
  const { type, responseFormat } = query
  const config = CONVERSION_CONFIGS[type]

  const request = await RequestParser.promises.parse(body)
  request.project_id = projectId
  request.user_id = userId
  request.metricsOpts = {}
  // Document conversions reuse the history writer but must never run png2pdf:
  // the converted PDF bytes would be fed to pandoc instead of the original png.
  request.png2pdf = false

  const conversionId = crypto.randomUUID()
  const conversionDir = Path.join(Settings.path.compilesDir, conversionId)
  const conversionCacheDir = Path.join(Settings.path.clsiCacheDir, conversionId)
  const projectCacheDir = Path.join(Settings.path.clsiCacheDir, projectId)
  const cleanupDirs = [conversionCacheDir, conversionDir]

  logger.debug(
    {
      projectId,
      userId,
      rootResourcePath: request.rootResourcePath,
      type,
    },
    'syncing resources for project-to-document conversion'
  )
  Metrics.inc('convert_project_to_document', 1, {
    compileFromHistory: request.isCompileFromHistory,
    method: type,
  })

  try {
    if (await fs.mkdir(projectCacheDir, { recursive: true })) {
      // Newly created. Cleanup behind us.
      cleanupDirs.push(projectCacheDir)
    }
    if (request.isCompileFromHistory) {
      await fs.mkdir(conversionDir)
      try {
        await HistoryResourceWriter.syncResourcesToDisk(
          projectId,
          userId,
          request,
          conversionDir,
          {}, // timings
          {} // stats
        )
      } catch (err) {
        if (err instanceof Errors.MissingUpdatesError) {
          return res.status(409).json({
            baseHistoryVersion: err.info.baseHistoryVersion,
          })
        }
        throw err
      }
    } else {
      await ResourceWriter.promises.syncResourcesToDisk(request, conversionDir)
    }

    const documentPath =
      await ConversionManager.promises.convertLaTeXToDocumentInDirWithLock(
        conversionId,
        conversionDir,
        request.rootResourcePath,
        type
      )

    const outputName = `output.${config.extension}`
    if (responseFormat === 'json') {
      // TODO: drop the streaming branch once web is migrated to the two-step flow
      const buildId = await OutputCacheManager.promises.generateBuildId()
      const buildDir = Path.join(
        Settings.path.outputDir,
        conversionId,
        OutputCacheManager.CACHE_SUBDIR,
        buildId
      )
      try {
        await fs.mkdir(buildDir, { recursive: true })
        await fs.copyFile(documentPath, Path.join(buildDir, outputName))
        res.json({ conversionId, buildId, file: outputName })
      } finally {
        ConversionOutputCleaner.scheduleCleanup(conversionId)
      }
    } else {
      const documentStat = await fs.stat(documentPath)
      res.setHeader('Content-Length', documentStat.size)
      res.attachment(outputName)
      res.setHeader('X-Content-Type-Options', 'nosniff')
      const readStream = fsSync.createReadStream(documentPath)
      await pipeline(readStream, res)
    }
  } catch (err) {
    if (err instanceof Errors.ConversionError) {
      if (err.isUserFacing) {
        return res.status(422).json({
          error: err.stderr,
          exitCode: err.exitCode,
        })
      } else {
        logger.warn(
          { err, type, stderr: err.stderr },
          'Conversion failed with non-user-facing error'
        )
        return res.status(422).json({})
      }
    } else {
      throw err
    }
  } finally {
    for (const dir of cleanupDirs) {
      try {
        await fs.rm(dir, { recursive: true, force: true })
      } catch (err) {
        logger.warn({ err, dir }, 'cleanup failed')
      }
    }
  }
}

export default {
  convertDocumentToLaTeX: expressify(convertDocumentToLaTeX),
  convertDocxToLaTeX: expressify(convertDocxToLaTeX),
  convertProjectToDocument: expressify(convertProjectToDocument),
  convertPDFToJPEG: expressify(convertPDFToJPEG),
}
