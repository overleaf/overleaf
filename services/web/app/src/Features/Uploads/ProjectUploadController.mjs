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
import multer from 'multer'
import lodash from 'lodash'
import { expressify } from '@overleaf/promise-utils'
import { DuplicateNameError, FileTooLargeError } from '../Errors/Errors.js'
import DocumentConversionManager from './DocumentConversionManager.mjs'
import ProjectOptionsHandler from '../Project/ProjectOptionsHandler.mjs'

const defaultsDeep = lodash.defaultsDeep

const upload = multer(
  defaultsDeep(
    {
      dest: Settings.path.uploadFolder,
      limits: {
        fileSize: Settings.maxUploadSize,
      },
    },
    Settings.multerOptions
  )
)

/**
 * @param {any} req
 * @param {any} res
 * @param {any} next
 */
function uploadProject(req, res, next) {
  const timer = new metrics.Timer('project-upload')
  const userId = SessionManager.getLoggedInUserId(req.session)
  const { path } = req.file
  const name = Path.basename(req.body.name, '.zip')
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
 * @param {any} req
 * @param {any} res
 * @param {any} next
 */
async function uploadFile(req, res, next) {
  const timer = new metrics.Timer('file-upload')
  const name = req.body.name
  const { path } = req.file
  const projectId = req.params.Project_id
  const userId = SessionManager.getLoggedInUserId(req.session)
  let { folder_id: folderId } = req.query
  if (name == null || name.length === 0 || name.length > 150) {
    fs.unlink(path, function () {})
    return res.status(422).json({
      success: false,
      error: 'invalid_filename',
    })
  }

  try {
    // preserve the directory structure from an uploaded folder
    const { relativePath } = req.body
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
    fs.unlink(path, function () {})
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
        } else if (error.message === 'project_has_too_many_files') {
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
 * @param {any} req
 * @param {any} res
 * @param {any} next
 */
async function importDocx(req, res, next) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  logger.debug({ path: req.file?.path, userId }, 'importing docx file')
  const { path } = req.file
  const name = Path.basename(req.body.name, '.docx')
  try {
    const archivePath =
      await DocumentConversionManager.promises.convertDocxToLaTeXZipArchive(
        path,
        userId
      )
    try {
      const project =
        await ProjectUploadManager.promises.createProjectFromZipArchive(
          userId,
          name,
          archivePath
        )
      await ProjectOptionsHandler.promises.setCompiler(project._id, 'lualatex')
      res.json({ success: true, project_id: project._id })
    } finally {
      await fsPromises.unlink(archivePath).catch(() => {})
    }
  } catch (error) {
    logger.error({ error }, 'error importing docx file')
    if (
      error instanceof FileTooLargeError ||
      error?.name === 'FileTooLargeError'
    ) {
      return res.status(422).json({
        success: false,
        error: 'file_too_large',
      })
    }
    res.status(500).json({
      success: false,
      error: req.i18n.translate('upload_failed'),
    })
  } finally {
    await fsPromises.unlink(path).catch(() => {})
  }
}

/**
 * @param {any} req
 * @param {any} res
 * @param {any} next
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
      if (err) return next(err)
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
  importDocx: expressify(importDocx),
}
