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
import { z } from '@overleaf/validation-tools'

const CONVERSION_CONFIGS = {
  docx: { extension: 'docx' },
  markdown: { extension: 'zip' },
  html: { extension: 'zip' },
}

async function convertDocumentToLaTeX(req, res) {
  const { path } = req.file
  const conversionType = req.query.type
  if (!Settings.enablePandocConversions) {
    await fs.unlink(path).catch(() => {})
    return res.sendStatus(404)
  }
  if (!conversionType || !['docx', 'markdown'].includes(conversionType)) {
    await fs.unlink(path).catch(() => {})
    return res.sendStatus(400)
  }
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

const PDFToJPEGQuerySchema = z.object({
  mode: z.enum(['preview', 'thumbnail']),
})

async function convertPDFToJPEG(req, res) {
  const { path } = req.file
  if (!Settings.enablePdfConversions) {
    await fs.unlink(path).catch(() => {})
    return res.sendStatus(404)
  }
  const parsed = PDFToJPEGQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    await fs.unlink(path).catch(() => {})
    return res.sendStatus(400)
  }
  const { mode } = parsed.data
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

async function convertProjectToDocument(req, res) {
  if (!Settings.enablePandocConversions) {
    return res.sendStatus(404)
  }

  const { user_id: userId, project_id: projectId } = req.params
  const type = req.query.type
  if (!Object.hasOwn(CONVERSION_CONFIGS, type)) {
    return res.sendStatus(400)
  }
  const config = CONVERSION_CONFIGS[type]

  const request = await RequestParser.promises.parse(req.body)
  request.project_id = projectId
  request.user_id = userId
  request.metricsOpts = {}

  const responseFormat = req.query.responseFormat === 'json' ? 'json' : 'stream'

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
          {}
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
  convertProjectToDocument: expressify(convertProjectToDocument),
  convertPDFToJPEG: expressify(convertPDFToJPEG),
}
