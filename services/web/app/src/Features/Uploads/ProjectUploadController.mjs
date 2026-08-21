import logger from '@overleaf/logger'
import metrics from '@overleaf/metrics'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import Path from 'node:path'
import FileSystemImportManager from './FileSystemImportManager.mjs'
import ProjectUploadManager from './ProjectUploadManager.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import EditorController from '../Editor/EditorController.mjs'
import ProjectLocator from '../Project/ProjectLocator.mjs'
import Settings from '@overleaf/settings'
import { InvalidZipFileError } from './ArchiveErrors.mjs'
import { expressify } from '@overleaf/promise-utils'
import {
  DuplicateNameError,
  FileTooLargeError,
  DocumentConversionError,
  TooManyFilesError,
} from '../Errors/Errors.js'
import DocumentConversionManager from './DocumentConversionManager.mjs'
import ProjectOptionsHandler from '../Project/ProjectOptionsHandler.mjs'
import AnalyticsManager from '../Analytics/AnalyticsManager.mjs'
import { multer, multerUploadHandler } from '../../infrastructure/Multer.mjs'
import { parseReq, z, zz } from '../../infrastructure/Validation.mjs'

/**
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 * @typedef {import('express').NextFunction} NextFunction
 */

const uploadMetaTypeSchema = z.string().optional()

const uploadProjectSchema = z.object({
  body: z.strictObject({
    name: z.string().nonempty(),
    type: uploadMetaTypeSchema,
    relativePath: zz.filepath().or(z.literal('')).optional(),
  }),
  file: zz.uploadedFile(),
})

const uploadFileSchema = z.object({
  params: z.strictObject({
    Project_id: zz.objectId(),
  }),
  query: z.object({
    folder_id: zz.objectId().optional(),
  }),
  body: z.strictObject({
    // validated for presence/length by hand below (not schema-enforced),
    // so an invalid name keeps returning the existing friendly
    // {success:false, error:'invalid_filename'} response instead of a
    // generic validation error
    name: z.string().optional(),
    relativePath: zz.filepath().or(z.literal('')).optional(),
    type: uploadMetaTypeSchema,
    targetFolderId: zz.objectId().optional(),
  }),
  file: zz.uploadedFile(),
})

const importDocumentSchema = z.object({
  query: z.object({
    // validated for the ['docx','markdown'] allowlist by hand below, so an
    // unsupported value keeps returning the existing friendly
    // {success:false, error:'invalid_import_type'} response
    type: z.string().optional(),
  }),
  body: z.strictObject({
    name: z.string().nonempty(),
    relativePath: zz.filepath().or(z.literal('')).optional(),
    type: uploadMetaTypeSchema,
  }),
  file: zz.uploadedFile(),
})

const upload = multerUploadHandler({
  dest: Settings.path.uploadFolder,
  limits: {
    fileSize: Settings.maxUploadSize,
  },
})

/**
 * @param {Request} req
 * @param {Response} res
 */
function uploadProject(req, res) {
  const timer = new metrics.Timer('project-upload')
  const userId = SessionManager.getLoggedInUserId(req.session)
  const { body, file } = parseReq(req, uploadProjectSchema, {
    logOnly: true,
  })
  const { path } = file
  const name = Path.basename(body.name, '.zip')
  return ProjectUploadManager.createProjectFromZipArchive(
    userId,
    name,
    path,
    function (error, project) {
      fs.unlink(path, function () {})
      timer.done()
      if (error != null) {
        logger.error(
          { err: error, filePath: path, fileName: name },
          'error uploading project'
        )
        if (error instanceof InvalidZipFileError) {
          return res.status(422).json({
            success: false,
            error: req.i18n.translate(error.message),
          })
        } else {
          return res.status(500).json({
            success: false,
            error: req.i18n.translate('upload_failed'),
          })
        }
      } else {
        return res.json({ success: true, project_id: project._id })
      }
    }
  )
}

/**
 * @param {Request} req
 * @param {Response} res
 */
async function uploadFile(req, res) {
  const timer = new metrics.Timer('file-upload')
  const { params, query, body, file } = parseReq(req, uploadFileSchema, {
    logOnly: true,
    logFields: ['body.relativePath'],
  })
  const name = body.name
  const { path } = file
  const projectId = params.Project_id
  const userId = SessionManager.getLoggedInUserId(req.session)
  let folderId = query.folder_id
  if (name == null || name.length === 0 || name.length > 150) {
    await fsPromises.unlink(path).catch(unlinkErr => {
      logger.warn({ err: unlinkErr, path }, 'error unlinking uploaded file')
    })
    return res.status(422).json({
      success: false,
      error: 'invalid_filename',
    })
  }

  try {
    // preserve the directory structure from an uploaded folder
    const { relativePath } = body
    // NOTE: Uppy sends a "null" string for `relativePath` when the file is not nested in a folder
    if (relativePath && relativePath !== 'null') {
      const { path } = await ProjectLocator.promises.findElement({
        project_id: projectId,
        element_id: folderId,
        type: 'folder',
      })
      const { lastFolder } = await EditorController.promises.mkdirp(
        projectId,
        Path.dirname(Path.join('/', path.fileSystem, relativePath)),
        userId
      )
      folderId = lastFolder._id
    }
  } catch (error) {
    await fsPromises.unlink(path).catch(unlinkErr => {
      logger.warn({ err: unlinkErr, path }, 'error unlinking uploaded file')
    })
    throw error
  }

  return FileSystemImportManager.addEntity(
    userId,
    projectId,
    folderId,
    name,
    path,
    true,
    function (error, entity) {
      fs.unlink(path, function () {})
      timer.done()
      if (error != null) {
        if (error.name === 'InvalidNameError') {
          return res.status(422).json({
            success: false,
            error: 'invalid_filename',
          })
        } else if (error instanceof DuplicateNameError) {
          return res.status(422).json({
            success: false,
            error: 'duplicate_file_name',
          })
        } else if (error instanceof TooManyFilesError) {
          return res.status(422).json({
            success: false,
            error: 'project_has_too_many_files',
          })
        } else if (error.message === 'folder_not_found') {
          return res.status(422).json({
            success: false,
            error: 'folder_not_found',
          })
        } else {
          logger.error(
            {
              err: error,
              projectId,
              filePath: path,
              fileName: name,
              folderId,
            },
            'error uploading file'
          )
          return res.status(422).json({ success: false })
        }
      } else {
        return res.json({
          success: true,
          entity_id: entity?._id,
          entity_type: entity?.type,
          hash: entity?.hash,
        })
      }
    }
  )
}

/**
 * @param {Request} req
 * @param {Response} res
 */
async function importDocument(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const { query, body, file } = parseReq(req, importDocumentSchema, {
    logOnly: true,
  })
  const { path } = file
  const conversionType = query.type
  if (!['docx', 'markdown'].includes(conversionType)) {
    return res.status(400).json({
      success: false,
      error: req.i18n.translate('invalid_import_type'),
    })
  }
  const name = Path.basename(body.name, Path.extname(body.name))
  logger.debug({ path, userId, conversionType }, 'importing document file')
  try {
    const archivePath =
      await DocumentConversionManager.promises.convertDocumentToLaTeXZipArchive(
        path,
        userId,
        conversionType
      )
    try {
      const project =
        await ProjectUploadManager.promises.createProjectFromZipArchive(
          userId,
          name,
          archivePath
        )
      await ProjectOptionsHandler.promises.setCompiler(project._id, 'lualatex')
      AnalyticsManager.recordEventForSession(req.session, 'convert-format', {
        sourceFormat: conversionType,
        targetFormat: 'latex',
        status: 'success',
        operation: 'import',
      })
      res.json({ success: true, project_id: project._id })
    } finally {
      await fsPromises.unlink(archivePath).catch(unlinkErr => {
        logger.warn(
          { err: unlinkErr, archivePath },
          'error unlinking after docx conversion'
        )
      })
    }
  } catch (error) {
    AnalyticsManager.recordEventForSession(req.session, 'convert-format', {
      sourceFormat: conversionType,
      targetFormat: 'latex',
      status: 'failure',
      operation: 'import',
    })
    if (
      error instanceof FileTooLargeError ||
      error?.name === 'FileTooLargeError'
    ) {
      return res.status(422).json({
        success: false,
        error: req.i18n.translate('file_too_large'),
      })
    }
    if (error instanceof DocumentConversionError) {
      return res.status(422).json({
        success: false,
        error: error.message || req.i18n.translate('upload_failed'),
      })
    }
    logger.error({ error, userId }, 'unhandled error while importing document')
    res.status(500).json({
      success: false,
      error: req.i18n.translate('upload_failed'),
    })
  } finally {
    await fsPromises.unlink(path).catch(unlinkErr => {
      logger.warn(
        { err: unlinkErr, path },
        'error unlinking uploaded file in importDocx'
      )
    })
  }
}

/**
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
function multerMiddleware(req, res, next) {
  if (upload == null) {
    return res
      .status(500)
      .json({ success: false, error: req.i18n.translate('upload_failed') })
  }
  return upload.single('qqfile')(
    req,
    res,
    /** @param {any} err */ function (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res
          .status(422)
          .json({ success: false, error: req.i18n.translate('file_too_large') })
      }
      if (err) {
        if (req.destroyed) {
          // Client disconnected during upload, nothing to do — but clean up
          // any file that multer may have written to disk already
          if (req.file?.path) {
            fs.unlink(req.file.path, function () {})
          }
          return
        }
        return next(err)
      }
      if (!req.file?.path) {
        logger.info({ req }, 'missing req.file.path on upload')
        return res
          .status(400)
          .json({ success: false, error: 'invalid_upload_request' })
      }
      next()
    }
  )
}

export default {
  uploadProject,
  uploadFile: expressify(uploadFile),
  multerMiddleware,
  importDocument: expressify(importDocument),
}
