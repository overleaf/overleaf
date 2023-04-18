/* eslint-disable
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ProjectUploadController
const logger = require('@overleaf/logger')
const metrics = require('@overleaf/metrics')
const fs = require('fs')
const Path = require('path')
const FileSystemImportManager = require('./FileSystemImportManager')
const ProjectUploadManager = require('./ProjectUploadManager')
const SessionManager = require('../Authentication/SessionManager')
const Settings = require('@overleaf/settings')
const { InvalidZipFileError } = require('./ArchiveErrors')
const multer = require('multer')
const _ = require('lodash')

const upload = multer(
  _.defaultsDeep(
    {
      dest: Settings.path.uploadFolder,
      limits: {
        fileSize: Settings.maxUploadSize,
      },
    },
    Settings.multerOptions
  )
)

module.exports = ProjectUploadController = {
  uploadProject(req, res, next) {
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
  },

  uploadFile(req, res, next) {
    const timer = new metrics.Timer('file-upload')
    const name = req.body.name
    const path = req.file != null ? req.file.path : undefined
    const projectId = req.params.Project_id
    const { folder_id: folderId } = req.query
    if (name == null || name.length === 0 || name.length > 150) {
      logger.err(
        { projectId, fileName: name },
        'bad name when trying to upload file'
      )
      return res.status(422).json({
        success: false,
        error: 'invalid_filename',
      })
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
          if (error.name === 'InvalidNameError') {
            return res.status(422).json({
              success: false,
              error: 'invalid_filename',
            })
          } else if (error.message === 'project_has_too_many_files') {
            return res.status(422).json({
              success: false,
              error: 'project_has_too_many_files',
            })
          } else {
            return res.status(422).json({ success: false })
          }
        } else {
          return res.json({
            success: true,
            entity_id: entity != null ? entity._id : undefined,
            entity_type: entity != null ? entity.type : undefined,
          })
        }
      }
    )
  },

  multerMiddleware(req, res, next) {
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
  },
}
