const path = require('path')
const fs = require('fs-extra')
const { callbackify } = require('util')
const ArchiveManager = require('./ArchiveManager')
const FileSystemImportManager = require('./FileSystemImportManager')
const ProjectCreationHandler = require('../Project/ProjectCreationHandler')
const ProjectRootDocManager = require('../Project/ProjectRootDocManager')
const ProjectDetailsHandler = require('../Project/ProjectDetailsHandler')
const ProjectDeleter = require('../Project/ProjectDeleter')
const DocumentHelper = require('../Documents/DocumentHelper')
const logger = require('logger-sharelatex')

module.exports = {
  createProjectFromZipArchive: callbackify(createProjectFromZipArchive),
  createProjectFromZipArchiveWithName: callbackify(
    createProjectFromZipArchiveWithName
  ),
  promises: {
    createProjectFromZipArchive,
    createProjectFromZipArchiveWithName
  }
}

async function createProjectFromZipArchive(ownerId, defaultName, zipPath) {
  const extractionPath = await _extractZip(zipPath)
  const {
    path,
    content
  } = await ProjectRootDocManager.promises.findRootDocFileFromDirectory(
    extractionPath
  )

  const projectName =
    DocumentHelper.getTitleFromTexContent(content || '') || defaultName
  const uniqueName = await _generateUniqueName(ownerId, projectName)
  const project = await ProjectCreationHandler.promises.createBlankProject(
    ownerId,
    uniqueName
  )
  try {
    await _insertZipContentsIntoFolder(
      ownerId,
      project._id,
      project.rootFolder[0]._id,
      extractionPath
    )

    if (path) {
      await ProjectRootDocManager.promises.setRootDocFromName(project._id, path)
    }
  } catch (err) {
    // no need to wait for the cleanup here
    ProjectDeleter.promises
      .deleteProject(project._id)
      .catch(err =>
        logger.error(
          { err, projectId: project._id },
          'there was an error cleaning up project after importing a zip failed'
        )
      )
    throw err
  }
  return project
}

async function createProjectFromZipArchiveWithName(
  ownerId,
  proposedName,
  zipPath,
  attributes = {}
) {
  const extractionPath = await _extractZip(zipPath)
  const uniqueName = await _generateUniqueName(ownerId, proposedName)
  const project = await ProjectCreationHandler.promises.createBlankProject(
    ownerId,
    uniqueName,
    attributes
  )

  try {
    await _insertZipContentsIntoFolder(
      ownerId,
      project._id,
      project.rootFolder[0]._id,
      extractionPath
    )
    await ProjectRootDocManager.promises.setRootDocAutomatically(project._id)
  } catch (err) {
    // no need to wait for the cleanup here
    ProjectDeleter.promises
      .deleteProject(project._id)
      .catch(err =>
        logger.error(
          { err, projectId: project._id },
          'there was an error cleaning up project after importing a zip failed'
        )
      )
    throw err
  }

  return project
}

async function _insertZipContentsIntoFolder(
  ownerId,
  projectId,
  folderId,
  destination
) {
  const topLevelDestination = await ArchiveManager.promises.findTopLevelDirectory(
    destination
  )
  await FileSystemImportManager.promises.addFolderContents(
    ownerId,
    projectId,
    folderId,
    topLevelDestination,
    false
  )
  await fs.remove(destination)
}

async function _extractZip(zipPath) {
  const destination = path.join(
    path.dirname(zipPath),
    `${path.basename(zipPath, '.zip')}-${Date.now()}`
  )
  await ArchiveManager.promises.extractZipArchive(zipPath, destination)
  return destination
}

async function _generateUniqueName(ownerId, originalName) {
  const fixedName = ProjectDetailsHandler.fixProjectName(originalName)
  const uniqueName = await ProjectDetailsHandler.promises.generateUniqueName(
    ownerId,
    fixedName
  )
  return uniqueName
}
