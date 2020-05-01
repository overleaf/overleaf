const { callbackify, promisify } = require('util')
const OError = require('@overleaf/o-error')
const ProjectCreationHandler = require('./ProjectCreationHandler')
const ProjectEntityUpdateHandler = require('./ProjectEntityUpdateHandler')
const ProjectLocator = require('./ProjectLocator')
const ProjectOptionsHandler = require('./ProjectOptionsHandler')
const ProjectDeleter = require('./ProjectDeleter')
const DocumentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')
const DocstoreManager = require('../Docstore/DocstoreManager')
const ProjectGetter = require('./ProjectGetter')
const _ = require('underscore')
const async = require('async')
const logger = require('logger-sharelatex')

module.exports = {
  duplicate: callbackify(duplicate),
  promises: {
    duplicate
  }
}

function _copyDocs(
  ownerId,
  newProject,
  originalRootDoc,
  originalFolder,
  desFolder,
  docContents,
  callback
) {
  const setRootDoc = _.once(docId => {
    ProjectEntityUpdateHandler.setRootDoc(newProject._id, docId, () => {})
  })
  const docs = originalFolder.docs || []
  const jobs = docs.map(
    doc =>
      function(cb) {
        if (doc == null || doc._id == null) {
          return callback()
        }
        const content = docContents[doc._id.toString()]
        ProjectEntityUpdateHandler.addDoc(
          newProject._id,
          desFolder._id,
          doc.name,
          content.lines,
          ownerId,
          function(err, newDoc) {
            if (err != null) {
              logger.warn({ err }, 'error copying doc')
              return callback(err)
            }
            if (
              originalRootDoc != null &&
              newDoc.name === originalRootDoc.name
            ) {
              setRootDoc(newDoc._id)
            }
            cb()
          }
        )
      }
  )

  async.series(jobs, callback)
}

function _copyFiles(
  ownerId,
  newProject,
  originalProjectId,
  originalFolder,
  desFolder,
  callback
) {
  const fileRefs = originalFolder.fileRefs || []
  let firstError = null // track first error to exit gracefully from parallel copy
  const jobs = fileRefs.map(
    file =>
      function(cb) {
        if (firstError != null) {
          return async.setImmediate(cb)
        } // skip further copies if an error has occurred
        ProjectEntityUpdateHandler.copyFileFromExistingProjectWithProject(
          newProject._id,
          newProject,
          desFolder._id,
          originalProjectId,
          file,
          ownerId,
          function(err) {
            if (err != null) {
              if (!firstError) {
                firstError = err
              }
            } // set the error flag if this copy failed
            cb()
          }
        )
      }
  )
  // If one of these jobs fails then we wait until all running jobs have
  // finished, skipping those which have not started yet. We need to wait
  // for all the copy jobs to finish to avoid them writing to the project
  // entry in the background while we are deleting it.
  async.parallelLimit(jobs, 5, function(err) {
    if (firstError != null) {
      return callback(firstError)
    }
    if (err != null) {
      return callback(err)
    } // shouldn't happen
    callback()
  })
}

function _copyFolderRecursively(
  ownerId,
  newProjectId,
  originalProjectId,
  originalRootDoc,
  originalFolder,
  desFolder,
  docContents,
  callback
) {
  ProjectGetter.getProject(
    newProjectId,
    { rootFolder: true, name: true },
    function(err, newProject) {
      if (err != null) {
        logger.warn({ projectId: newProjectId }, 'could not get project')
        return callback(err)
      }

      const folders = originalFolder.folders || []

      const jobs = folders.map(
        childFolder =>
          function(cb) {
            if (childFolder == null || childFolder._id == null) {
              return cb()
            }
            ProjectEntityUpdateHandler.addFolder(
              newProject._id,
              desFolder != null ? desFolder._id : undefined,
              childFolder.name,
              function(err, newFolder) {
                if (err != null) {
                  return cb(err)
                }
                _copyFolderRecursively(
                  ownerId,
                  newProjectId,
                  originalProjectId,
                  originalRootDoc,
                  childFolder,
                  newFolder,
                  docContents,
                  cb
                )
              }
            )
          }
      )

      jobs.push(cb =>
        _copyFiles(
          ownerId,
          newProject,
          originalProjectId,
          originalFolder,
          desFolder,
          cb
        )
      )
      jobs.push(cb =>
        _copyDocs(
          ownerId,
          newProject,
          originalRootDoc,
          originalFolder,
          desFolder,
          docContents,
          cb
        )
      )

      async.series(jobs, callback)
    }
  )
}
const _copyFolderRecursivelyAsync = promisify(_copyFolderRecursively)

async function duplicate(owner, originalProjectId, newProjectName) {
  await DocumentUpdaterHandler.promises.flushProjectToMongo(originalProjectId)
  const originalProject = await ProjectGetter.promises.getProject(
    originalProjectId,
    {
      compiler: true,
      rootFolder: true,
      rootDoc_id: true
    }
  )
  const {
    element: originalRootDoc
  } = await ProjectLocator.promises.findRootDoc({
    project_id: originalProjectId
  })
  const docContentsArray = await DocstoreManager.promises.getAllDocs(
    originalProjectId
  )

  const docContents = {}
  for (const docContent of docContentsArray) {
    docContents[docContent._id] = docContent
  }

  // Now create the new project, cleaning it up on failure if necessary
  const newProject = await ProjectCreationHandler.promises.createBlankProject(
    owner._id,
    newProjectName
  )

  try {
    await ProjectOptionsHandler.promises.setCompiler(
      newProject._id,
      originalProject.compiler
    )
    await _copyFolderRecursivelyAsync(
      owner._id,
      newProject._id,
      originalProjectId,
      originalRootDoc,
      originalProject.rootFolder[0],
      newProject.rootFolder[0],
      docContents
    )
  } catch (err) {
    // Clean up broken clone on error.
    // Make sure we delete the new failed project, not the original one!
    await ProjectDeleter.promises.deleteProject(newProject._id)
    throw new OError({
      message: 'error cloning project, broken clone deleted',
      info: {
        originalProjectId,
        newProjectName,
        newProjectId: newProject._id
      }
    }).withCause(err)
  }
  return newProject
}
