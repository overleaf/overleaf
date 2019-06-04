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
let ProjectUploadHandler
const path = require('path')
const rimraf = require('rimraf')
const async = require('async')
const ArchiveManager = require('./ArchiveManager')
const FileSystemImportManager = require('./FileSystemImportManager')
const ProjectCreationHandler = require('../Project/ProjectCreationHandler')
const ProjectRootDocManager = require('../Project/ProjectRootDocManager')
const ProjectDetailsHandler = require('../Project/ProjectDetailsHandler')
const DocumentHelper = require('../Documents/DocumentHelper')

module.exports = ProjectUploadHandler = {
  createProjectFromZipArchive(owner_id, defaultName, zipPath, callback) {
    if (callback == null) {
      callback = function(error, project) {}
    }
    const destination = this._getDestinationDirectory(zipPath)
    let docPath = null
    let project = null

    return async.waterfall(
      [
        cb => ArchiveManager.extractZipArchive(zipPath, destination, cb),
        cb =>
          ProjectRootDocManager.findRootDocFileFromDirectory(
            destination,
            (error, _docPath, docContents) => cb(error, _docPath, docContents)
          ),
        function(_docPath, docContents, cb) {
          docPath = _docPath
          const proposedName = ProjectDetailsHandler.fixProjectName(
            DocumentHelper.getTitleFromTexContent(docContents || '') ||
              defaultName
          )
          return ProjectDetailsHandler.generateUniqueName(
            owner_id,
            proposedName,
            (error, name) => cb(error, name)
          )
        },
        (name, cb) =>
          ProjectCreationHandler.createBlankProject(
            owner_id,
            name,
            (error, _project) => cb(error, _project)
          ),
        (_project, cb) => {
          project = _project
          return this._insertZipContentsIntoFolder(
            owner_id,
            project._id,
            project.rootFolder[0]._id,
            destination,
            cb
          )
        },
        function(cb) {
          if (docPath != null) {
            return ProjectRootDocManager.setRootDocFromName(
              project._id,
              docPath,
              error => cb(error)
            )
          } else {
            return cb(null)
          }
        },
        cb => cb(null, project)
      ],
      callback
    )
  },

  createProjectFromZipArchiveWithName(
    owner_id,
    proposedName,
    zipPath,
    attributes,
    callback
  ) {
    if (callback == null) {
      callback = function(error, project) {}
    }
    if (arguments.length === 4) {
      callback = attributes
      attributes = {}
    }
    return ProjectDetailsHandler.generateUniqueName(
      owner_id,
      ProjectDetailsHandler.fixProjectName(proposedName),
      (error, name) => {
        if (error != null) {
          return callback(error)
        }
        return ProjectCreationHandler.createBlankProject(
          owner_id,
          name,
          attributes,
          (error, project) => {
            if (error != null) {
              return callback(error)
            }
            return this.insertZipArchiveIntoFolder(
              owner_id,
              project._id,
              project.rootFolder[0]._id,
              zipPath,
              function(error) {
                if (error != null) {
                  return callback(error)
                }
                return ProjectRootDocManager.setRootDocAutomatically(
                  project._id,
                  function(error) {
                    if (error != null) {
                      return callback(error)
                    }
                    return callback(error, project)
                  }
                )
              }
            )
          }
        )
      }
    )
  },

  insertZipArchiveIntoFolder(
    owner_id,
    project_id,
    folder_id,
    zipPath,
    callback
  ) {
    if (callback == null) {
      callback = function(error) {}
    }
    const destination = this._getDestinationDirectory(zipPath)
    return ArchiveManager.extractZipArchive(zipPath, destination, error => {
      if (error != null) {
        return callback(error)
      }

      return this._insertZipContentsIntoFolder(
        owner_id,
        project_id,
        folder_id,
        destination,
        callback
      )
    })
  },

  _insertZipContentsIntoFolder(
    owner_id,
    project_id,
    folder_id,
    destination,
    callback
  ) {
    if (callback == null) {
      callback = function(error) {}
    }
    return ArchiveManager.findTopLevelDirectory(destination, function(
      error,
      topLevelDestination
    ) {
      if (error != null) {
        return callback(error)
      }
      return FileSystemImportManager.addFolderContents(
        owner_id,
        project_id,
        folder_id,
        topLevelDestination,
        false,
        function(error) {
          if (error != null) {
            return callback(error)
          }
          return rimraf(destination, callback)
        }
      )
    })
  },

  _getDestinationDirectory(source) {
    return path.join(
      path.dirname(source),
      `${path.basename(source, '.zip')}-${Date.now()}`
    )
  }
}
