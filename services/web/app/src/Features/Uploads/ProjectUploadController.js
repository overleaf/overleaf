const logger = require('@overleaf/logger')
const metrics = require('@overleaf/metrics')
const fs = require('fs')
const Path = require('path')
const FileSystemImportManager = require('./FileSystemImportManager')
const ProjectUploadManager = require('./ProjectUploadManager')
const SessionManager = require('../Authentication/SessionManager')
const EditorController = require('../Editor/EditorController')
const ProjectLocator = require('../Project/ProjectLocator')
const Settings = require('@overleaf/settings')
const { InvalidZipFileError } = require('./ArchiveErrors')
const multer = require('multer')
const { defaultsDeep } = require('lodash')
const { expressify } = require('@overleaf/promise-utils')
const { DuplicateNameError } = require('../Errors/Errors')

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

async function uploadFile(req, res, next) {
  const timer = new metrics.Timer('file-upload')
  const name = req.body.name
  const path = req.file?.path
  const projectId = req.params.Project_id
  let { folder_id: folderId } = req.query
  if (name == null || name.length === 0 || name.length > 150) {
    return res.status(422).json({
      success: false,
      error: 'invalid_filename',
    })
  }

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
      Path.dirname(Path.join('/', path.fileSystem, relativePath))
    )
    folderId = lastFolder._id
  }

  const userId = SessionManager.getLoggedInUserId(req.session)

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
        })
      }
    }
  )
}

function multerMiddleware(req, res, next) {
  if (upload == null) {
    return res
      .status(500)
      .json({ success: false, error: req.i18n.translate('upload_failed') })
  }
  return upload.single('qqfile')(req, res, function (err) {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res
        .status(422)
        .json({ success: false, error: req.i18n.translate('file_too_large') })
    }

    return next(err)
  })
}

module.exports = {
  uploadProject,
  uploadFile: expressify(uploadFile),
  multerMiddleware,
}
