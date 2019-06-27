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
const path = require('path')
const rimraf = require('rimraf')
const { promisify, callbackify } = require('util')
const ArchiveManager = require('./ArchiveManager')
const FileSystemImportManager = require('./FileSystemImportManager')
const ProjectCreationHandler = require('../Project/ProjectCreationHandler')
const ProjectRootDocManager = require('../Project/ProjectRootDocManager')
const ProjectDetailsHandler = require('../Project/ProjectDetailsHandler')
const ProjectDeleter = require('../Project/ProjectDeleter').promises
const DocumentHelper = require('../Documents/DocumentHelper')
const logger = require('logger-sharelatex')

const ProjectUploadManager = {
  createProjectFromZipArchive(ownerId, defaultName, zipPath, callback) {
    callbackify(ProjectUploadManager.promises.createProjectFromZipArchive)(
      ownerId,
      defaultName,
      zipPath,
      callback
    )
  },

  createProjectFromZipArchiveWithName(
    ownerId,
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

    callbackify(
      ProjectUploadManager.promises.createProjectFromZipArchiveWithName
    )(ownerId, proposedName, zipPath, attributes, callback)
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
    const destination = ProjectUploadManager._getDestinationDirectory(zipPath)
    return ArchiveManager.extractZipArchive(zipPath, destination, error => {
      if (error != null) {
        return callback(error)
      }

      return ProjectUploadManager._insertZipContentsIntoFolder(
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

const promises = {
  async createProjectFromZipArchive(ownerId, defaultName, zipPath) {
    const destination = ProjectUploadManager._getDestinationDirectory(zipPath)
    await ArchiveManager.promises.extractZipArchive(zipPath, destination)

    const {
      path,
      content
    } = await ProjectRootDocManager.promises.findRootDocFileFromDirectory(
      destination
    )

    const projectName =
      DocumentHelper.getTitleFromTexContent(content || '') || defaultName
    const proposedName = ProjectDetailsHandler.fixProjectName(projectName)
    const uniqueName = await ProjectDetailsHandler.promises.generateUniqueName(
      ownerId,
      proposedName
    )

    const project = await ProjectCreationHandler.promises.createBlankProject(
      ownerId,
      uniqueName
    )
    try {
      await ProjectUploadManager.promises._insertZipContentsIntoFolder(
        ownerId,
        project._id,
        project.rootFolder[0]._id,
        destination
      )

      if (path) {
        await ProjectRootDocManager.promises.setRootDocFromName(
          project._id,
          path
        )
      }
    } catch (err) {
      // no need to wait for the cleanup here
      ProjectDeleter.deleteProject(project._id).catch(err =>
        logger.error(
          { err, projectId: project._id },
          'there was an error cleaning up project after importing a zip failed'
        )
      )
      throw err
    }
    return project
  },

  async createProjectFromZipArchiveWithName(
    ownerId,
    proposedName,
    zipPath,
    attributes
  ) {
    attributes = attributes || {}

    const fixedProjectName = ProjectDetailsHandler.fixProjectName(proposedName)
    const projectName = await ProjectDetailsHandler.promises.generateUniqueName(
      ownerId,
      fixedProjectName
    )

    const project = await ProjectCreationHandler.promises.createBlankProject(
      ownerId,
      projectName,
      attributes
    )

    try {
      await ProjectUploadManager.promises.insertZipArchiveIntoFolder(
        ownerId,
        project._id,
        project.rootFolder[0]._id,
        zipPath
      )
      await ProjectRootDocManager.promises.setRootDocAutomatically(project._id)
    } catch (err) {
      // no need to wait for the cleanup here
      ProjectDeleter.deleteProject(project._id).catch(err =>
        logger.error(
          { err, projectId: project._id },
          'there was an error cleaning up project after importing a zip failed'
        )
      )
      throw err
    }

    return project
  },

  _insertZipContentsIntoFolder: promisify(
    ProjectUploadManager._insertZipContentsIntoFolder
  ),

  insertZipArchiveIntoFolder(ownerId, projectId, folderId, zipPath) {
    return promisify(ProjectUploadManager.insertZipArchiveIntoFolder)(
      ownerId,
      projectId,
      folderId,
      zipPath
    )
  }
}

ProjectUploadManager.promises = promises

module.exports = ProjectUploadManager
