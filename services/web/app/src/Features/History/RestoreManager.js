/* eslint-disable
    n/handle-callback-err,
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
let RestoreManager
const Settings = require('@overleaf/settings')
const Path = require('path')
const FileWriter = require('../../infrastructure/FileWriter')
const FileSystemImportManager = require('../Uploads/FileSystemImportManager')
const ProjectEntityHandler = require('../Project/ProjectEntityHandler')
const EditorController = require('../Editor/EditorController')
const Errors = require('../Errors/Errors')
const moment = require('moment')

module.exports = RestoreManager = {
  restoreDocFromDeletedDoc(userId, projectId, docId, name, callback) {
    // This is the legacy method for restoring a doc from the SL track-changes/deletedDocs system.
    // It looks up the deleted doc's contents, and then creates a new doc with the same content.
    // We don't actually remove the deleted doc entry, just create a new one from its lines.
    if (callback == null) {
      callback = function () {}
    }
    return ProjectEntityHandler.getDoc(
      projectId,
      docId,
      { include_deleted: true },
      function (error, lines) {
        if (error != null) {
          return callback(error)
        }
        const addDocWithName = (name, callback) =>
          EditorController.addDoc(
            projectId,
            null,
            name,
            lines,
            'restore',
            userId,
            callback
          )
        return RestoreManager._addEntityWithUniqueName(
          addDocWithName,
          name,
          callback
        )
      }
    )
  },

  restoreFileFromV2(userId, projectId, version, pathname, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return RestoreManager._writeFileVersionToDisk(
      projectId,
      version,
      pathname,
      function (error, fsPath) {
        if (error != null) {
          return callback(error)
        }
        const basename = Path.basename(pathname)
        let dirname = Path.dirname(pathname)
        if (dirname === '.') {
          // no directory
          dirname = ''
        }
        return RestoreManager._findOrCreateFolder(
          projectId,
          dirname,
          function (error, parentFolderId) {
            if (error != null) {
              return callback(error)
            }
            const addEntityWithName = (name, callback) =>
              FileSystemImportManager.addEntity(
                userId,
                projectId,
                parentFolderId,
                name,
                fsPath,
                false,
                callback
              )
            return RestoreManager._addEntityWithUniqueName(
              addEntityWithName,
              basename,
              callback
            )
          }
        )
      }
    )
  },

  _findOrCreateFolder(projectId, dirname, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return EditorController.mkdirp(
      projectId,
      dirname,
      function (error, newFolders, lastFolder) {
        if (error != null) {
          return callback(error)
        }
        return callback(null, lastFolder != null ? lastFolder._id : undefined)
      }
    )
  },

  _addEntityWithUniqueName(addEntityWithName, basename, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return addEntityWithName(basename, function (error, entity) {
      if (error != null) {
        if (error instanceof Errors.InvalidNameError) {
          // likely a duplicate name, so try with a prefix
          const date = moment(new Date()).format('Do MMM YY H:mm:ss')
          // Move extension to the end so the file type is preserved
          const extension = Path.extname(basename)
          basename = Path.basename(basename, extension)
          basename = `${basename} (Restored on ${date})`
          if (extension !== '') {
            basename = `${basename}${extension}`
          }
          return addEntityWithName(basename, callback)
        } else {
          return callback(error)
        }
      } else {
        return callback(null, entity)
      }
    })
  },

  _writeFileVersionToDisk(projectId, version, pathname, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const url = `${
      Settings.apis.project_history.url
    }/project/${projectId}/version/${version}/${encodeURIComponent(pathname)}`
    return FileWriter.writeUrlToDisk(projectId, url, callback)
  },
}
