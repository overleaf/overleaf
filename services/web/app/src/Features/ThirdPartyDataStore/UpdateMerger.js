/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let UpdateMerger
const _ = require('underscore')
const async = require('async')
const fs = require('fs')
const logger = require('logger-sharelatex')
const EditorController = require('../Editor/EditorController')
const FileTypeManager = require('../Uploads/FileTypeManager')
const FileWriter = require('../../infrastructure/FileWriter')
const ProjectEntityHandler = require('../Project/ProjectEntityHandler')

module.exports = UpdateMerger = {
  mergeUpdate(user_id, project_id, path, updateRequest, source, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    logger.log({ project_id, path }, 'merging update from tpds')
    return FileWriter.writeStreamToDisk(project_id, updateRequest, function(
      err,
      fsPath
    ) {
      if (err != null) {
        return callback(err)
      }
      return UpdateMerger._mergeUpdate(
        user_id,
        project_id,
        path,
        fsPath,
        source,
        mergeErr =>
          fs.unlink(fsPath, function(deleteErr) {
            if (deleteErr != null) {
              logger.err({ project_id, fsPath }, 'error deleting file')
            }
            return callback(mergeErr)
          })
      )
    })
  },

  _findExistingFileType(project_id, path, callback) {
    ProjectEntityHandler.getAllEntities(project_id, function(err, docs, files) {
      if (err != null) {
        return callback(err)
      }
      var existingFileType = null
      if (_.some(files, f => f.path === path)) {
        existingFileType = 'file'
      }
      if (_.some(docs, d => d.path === path)) {
        existingFileType = 'doc'
      }
      callback(null, existingFileType)
    })
  },

  _determineFileType(project_id, path, fsPath, callback) {
    if (callback == null) {
      callback = function(err, fileType) {}
    }
    // check if there is an existing file with the same path (we either need
    // to overwrite it or delete it)
    UpdateMerger._findExistingFileType(project_id, path, function(
      err,
      existingFileType
    ) {
      if (err) {
        return callback(err)
      }
      // determine whether the update should create a doc or binary file
      FileTypeManager.getStrictType(path, fsPath, function(err, isBinary) {
        if (err != null) {
          return callback(err)
        }
        // Existing | Update    | Action
        // ---------|-----------|-------
        // file     | isBinary  | existing-file
        // file     | !isBinary | existing-file
        // doc      | isBinary  | new-file, delete-existing-doc
        // doc      | !isBinary | existing-doc
        // null     | isBinary  | new-file
        // null     | !isBinary | new-doc

        // if a binary file already exists, always keep it as a binary file
        // even if the update looks like a text file
        if (existingFileType === 'file') {
          return callback(null, 'existing-file')
        }
        // if there is an existing doc, keep it as a doc except when the
        // incoming update is binary. In that case delete the doc and replace
        // it with a new file.
        if (existingFileType === 'doc') {
          if (isBinary) {
            return callback(null, 'new-file', 'delete-existing-doc')
          } else {
            return callback(null, 'existing-doc')
          }
        }
        // if there no existing file, create a file or doc as needed
        return callback(null, isBinary ? 'new-file' : 'new-doc')
      })
    })
  },

  _mergeUpdate(user_id, project_id, path, fsPath, source, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return UpdateMerger._determineFileType(project_id, path, fsPath, function(
      err,
      fileType,
      deleteOriginalEntity
    ) {
      if (err != null) {
        return callback(err)
      }
      async.series(
        [
          function(cb) {
            if (deleteOriginalEntity) {
              // currently we only delete docs
              UpdateMerger.deleteUpdate(user_id, project_id, path, source, cb)
            } else {
              cb()
            }
          },
          function(cb) {
            if (['existing-file', 'new-file'].includes(fileType)) {
              return UpdateMerger.p.processFile(
                project_id,
                fsPath,
                path,
                source,
                user_id,
                cb
              )
            } else if (['existing-doc', 'new-doc'].includes(fileType)) {
              return UpdateMerger.p.processDoc(
                project_id,
                user_id,
                fsPath,
                path,
                source,
                cb
              )
            } else {
              return cb(new Error('unrecognized file'))
            }
          }
        ],
        callback
      )
    })
  },

  deleteUpdate(user_id, project_id, path, source, callback) {
    if (callback == null) {
      callback = function() {}
    }
    return EditorController.deleteEntityWithPath(
      project_id,
      path,
      source,
      user_id,
      function() {
        logger.log(
          { project_id, path },
          'finished processing update to delete entity from tpds'
        )
        return callback()
      }
    )
  },

  p: {
    processDoc(project_id, user_id, fsPath, path, source, callback) {
      return UpdateMerger.p.readFileIntoTextArray(fsPath, function(
        err,
        docLines
      ) {
        if (err != null) {
          logger.warn(
            { project_id },
            'error reading file into text array for process doc update'
          )
          return callback(err)
        }
        logger.log({ docLines }, 'processing doc update from tpds')
        return EditorController.upsertDocWithPath(
          project_id,
          path,
          docLines,
          source,
          user_id,
          function(err) {
            logger.log(
              { project_id },
              'completed processing file update from tpds'
            )
            return callback(err)
          }
        )
      })
    },

    processFile(project_id, fsPath, path, source, user_id, callback) {
      logger.log({ project_id }, 'processing file update from tpds')
      return EditorController.upsertFileWithPath(
        project_id,
        path,
        fsPath,
        null,
        source,
        user_id,
        function(err) {
          logger.log(
            { project_id },
            'completed processing file update from tpds'
          )
          return callback(err)
        }
      )
    },

    readFileIntoTextArray(path, callback) {
      return fs.readFile(path, 'utf8', function(error, content) {
        if (content == null) {
          content = ''
        }
        if (error != null) {
          logger.warn({ path }, 'error reading file into text array')
          return callback(error)
        }
        const lines = content.split(/\r\n|\n|\r/)
        return callback(error, lines)
      })
    }
  }
}
