/* eslint-disable
    camelcase,
    handle-callback-err,
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
const Settings = require('settings-sharelatex')
const Path = require('path')
const FileWriter = require('../../infrastructure/FileWriter')
const FileSystemImportManager = require('../Uploads/FileSystemImportManager')
const ProjectEntityHandler = require('../Project/ProjectEntityHandler')
const ProjectLocator = require('../Project/ProjectLocator')
const EditorController = require('../Editor/EditorController')
const Errors = require('../Errors/Errors')
const moment = require('moment')

module.exports = RestoreManager = {
  restoreDocFromDeletedDoc(user_id, project_id, doc_id, name, callback) {
    // This is the legacy method for restoring a doc from the SL track-changes/deletedDocs system.
    // It looks up the deleted doc's contents, and then creates a new doc with the same content.
    // We don't actually remove the deleted doc entry, just create a new one from its lines.
    if (callback == null) {
      callback = function(error, doc, folder_id) {}
    }
    return ProjectEntityHandler.getDoc(
      project_id,
      doc_id,
      { include_deleted: true },
      function(error, lines) {
        if (error != null) {
          return callback(error)
        }
        const addDocWithName = (name, callback) =>
          EditorController.addDoc(
            project_id,
            null,
            name,
            lines,
            'restore',
            user_id,
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

  restoreFileFromV2(user_id, project_id, version, pathname, callback) {
    if (callback == null) {
      callback = function(error, entity) {}
    }
    return RestoreManager._writeFileVersionToDisk(
      project_id,
      version,
      pathname,
      function(error, fsPath) {
        if (error != null) {
          return callback(error)
        }
        const basename = Path.basename(pathname)
        let dirname = Path.dirname(pathname)
        if (dirname === '.') {
          // no directory
          dirname = ''
        }
        return RestoreManager._findOrCreateFolder(project_id, dirname, function(
          error,
          parent_folder_id
        ) {
          if (error != null) {
            return callback(error)
          }
          const addEntityWithName = (name, callback) =>
            FileSystemImportManager.addEntity(
              user_id,
              project_id,
              parent_folder_id,
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
        })
      }
    )
  },

  _findOrCreateFolder(project_id, dirname, callback) {
    if (callback == null) {
      callback = function(error, folder_id) {}
    }
    return EditorController.mkdirp(project_id, dirname, function(
      error,
      newFolders,
      lastFolder
    ) {
      if (error != null) {
        return callback(error)
      }
      return callback(null, lastFolder != null ? lastFolder._id : undefined)
    })
  },

  _addEntityWithUniqueName(addEntityWithName, basename, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return addEntityWithName(basename, function(error, entity) {
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

  _writeFileVersionToDisk(project_id, version, pathname, callback) {
    if (callback == null) {
      callback = function(error, fsPath) {}
    }
    const url = `${
      Settings.apis.project_history.url
    }/project/${project_id}/version/${version}/${encodeURIComponent(pathname)}`
    return FileWriter.writeUrlToDisk(project_id, url, callback)
  }
}
