/* eslint-disable
    camelcase,
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
const logger = require('logger-sharelatex')
const metrics = require('metrics-sharelatex')
const fs = require('fs')
const Path = require('path')
const FileSystemImportManager = require('./FileSystemImportManager')
const ProjectUploadManager = require('./ProjectUploadManager')
const AuthenticationController = require('../Authentication/AuthenticationController')
const Settings = require('settings-sharelatex')
const { InvalidZipFileError } = require('./ArchiveErrors')
const multer = require('multer')

const upload = multer({
  dest: Settings.path.uploadFolder,
  limits: {
    fileSize: Settings.maxUploadSize
  }
})

module.exports = ProjectUploadController = {
  uploadProject(req, res, next) {
    const timer = new metrics.Timer('project-upload')
    const user_id = AuthenticationController.getLoggedInUserId(req)
    const { originalname, path } = req.file
    const name = Path.basename(originalname, '.zip')
    return ProjectUploadManager.createProjectFromZipArchive(
      user_id,
      name,
      path,
      function(error, project) {
        fs.unlink(path, function() {})
        timer.done()
        if (error != null) {
          logger.error(
            { err: error, filePath: path, fileName: name },
            'error uploading project'
          )
          if (error instanceof InvalidZipFileError) {
            return res.status(422).json({
              success: false,
              error: req.i18n.translate(error.message)
            })
          } else {
            return res.status(500).json({
              success: false,
              error: req.i18n.translate('upload_failed')
            })
          }
        } else {
          return res.send({ success: true, project_id: project._id })
        }
      }
    )
  },

  uploadFile(req, res, next) {
    const timer = new metrics.Timer('file-upload')
    const name = req.file != null ? req.file.originalname : undefined
    const path = req.file != null ? req.file.path : undefined
    const project_id = req.params.Project_id
    const { folder_id } = req.query
    if (name == null || name.length === 0 || name.length > 150) {
      logger.err(
        { projectId: project_id, fileName: name },
        'bad name when trying to upload file'
      )
      return res.send({ success: false })
    }
    const user_id = AuthenticationController.getLoggedInUserId(req)

    return FileSystemImportManager.addEntity(
      user_id,
      project_id,
      folder_id,
      name,
      path,
      true,
      function(error, entity) {
        fs.unlink(path, function() {})
        timer.done()
        if (error != null) {
          logger.error(
            {
              err: error,
              projectId: project_id,
              filePath: path,
              fileName: name,
              folderId: folder_id
            },
            'error uploading file'
          )
          if (error.message === 'project_has_too_many_files') {
            return res.send({
              success: false,
              error: req.i18n.translate('project_has_too_many_files')
            })
          } else {
            return res.send({ success: false })
          }
        } else {
          return res.send({
            success: true,
            entity_id: entity != null ? entity._id : undefined,
            entity_type: entity != null ? entity.type : undefined
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
    return upload.single('qqfile')(req, res, function(err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res
          .status(422)
          .json({ success: false, error: req.i18n.translate('file_too_large') })
      }

      return next(err)
    })
  }
}
