/* eslint-disable
    camelcase,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ProjectDuplicator
const projectCreationHandler = require('./ProjectCreationHandler')
const ProjectEntityUpdateHandler = require('./ProjectEntityUpdateHandler')
const projectLocator = require('./ProjectLocator')
const projectOptionsHandler = require('./ProjectOptionsHandler')
const projectDeleter = require('./ProjectDeleter')
const DocumentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')
const DocstoreManager = require('../Docstore/DocstoreManager')
const ProjectGetter = require('./ProjectGetter')
const _ = require('underscore')
const async = require('async')
const logger = require('logger-sharelatex')

module.exports = ProjectDuplicator = {
  _copyDocs(
    owner_id,
    newProject,
    originalRootDoc,
    originalFolder,
    desFolder,
    docContents,
    callback
  ) {
    const setRootDoc = _.once(doc_id =>
      ProjectEntityUpdateHandler.setRootDoc(newProject._id, doc_id)
    )
    const docs = originalFolder.docs || []
    const jobs = docs.map(
      doc =>
        function(cb) {
          if ((doc != null ? doc._id : undefined) == null) {
            return callback()
          }
          const content = docContents[doc._id.toString()]
          return ProjectEntityUpdateHandler.addDoc(
            newProject._id,
            desFolder._id,
            doc.name,
            content.lines,
            owner_id,
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
              return cb()
            }
          )
        }
    )

    return async.series(jobs, callback)
  },

  _copyFiles(
    owner_id,
    newProject,
    originalProject_id,
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
          return ProjectEntityUpdateHandler.copyFileFromExistingProjectWithProject(
            newProject._id,
            newProject,
            desFolder._id,
            originalProject_id,
            file,
            owner_id,
            function(err) {
              if (err != null) {
                if (!firstError) {
                  firstError = err
                }
              } // set the error flag if this copy failed
              return cb()
            }
          )
        }
    )
    // If one of these jobs fails then we wait until all running jobs have
    // finished, skipping those which have not started yet. We need to wait
    // for all the copy jobs to finish to avoid them writing to the project
    // entry in the background while we are deleting it.
    return async.parallelLimit(jobs, 5, function(err) {
      if (firstError != null) {
        return callback(firstError)
      }
      if (err != null) {
        return callback(err)
      } // shouldn't happen
      return callback()
    })
  },

  _copyFolderRecursivly(
    owner_id,
    newProject_id,
    originalProject_id,
    originalRootDoc,
    originalFolder,
    desFolder,
    docContents,
    callback
  ) {
    return ProjectGetter.getProject(
      newProject_id,
      { rootFolder: true, name: true },
      function(err, newProject) {
        if (err != null) {
          logger.warn({ project_id: newProject_id }, 'could not get project')
          return callback(err)
        }

        const folders = originalFolder.folders || []

        const jobs = folders.map(
          childFolder =>
            function(cb) {
              if ((childFolder != null ? childFolder._id : undefined) == null) {
                return cb()
              }
              return ProjectEntityUpdateHandler.addFolder(
                newProject._id,
                desFolder != null ? desFolder._id : undefined,
                childFolder.name,
                function(err, newFolder) {
                  if (err != null) {
                    return cb(err)
                  }
                  return ProjectDuplicator._copyFolderRecursivly(
                    owner_id,
                    newProject_id,
                    originalProject_id,
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
          ProjectDuplicator._copyFiles(
            owner_id,
            newProject,
            originalProject_id,
            originalFolder,
            desFolder,
            cb
          )
        )
        jobs.push(cb =>
          ProjectDuplicator._copyDocs(
            owner_id,
            newProject,
            originalRootDoc,
            originalFolder,
            desFolder,
            docContents,
            cb
          )
        )

        return async.series(jobs, callback)
      }
    )
  },

  duplicate(owner, originalProject_id, newProjectName, callback) {
    const jobs = {
      flush(cb) {
        return DocumentUpdaterHandler.flushProjectToMongo(
          originalProject_id,
          cb
        )
      },
      originalProject(cb) {
        return ProjectGetter.getProject(
          originalProject_id,
          { compiler: true, rootFolder: true, rootDoc_id: true },
          cb
        )
      },
      originalRootDoc(cb) {
        return projectLocator.findRootDoc(
          { project_id: originalProject_id },
          cb
        )
      },
      docContentsArray(cb) {
        return DocstoreManager.getAllDocs(originalProject_id, cb)
      }
    }

    // Get the contents of the original project first
    return async.series(jobs, function(err, results) {
      if (err != null) {
        logger.warn(
          { err, originalProject_id },
          'error duplicating project reading original project'
        )
        return callback(err)
      }
      let { originalProject, originalRootDoc, docContentsArray } = results

      originalRootDoc = originalRootDoc != null ? originalRootDoc[0] : undefined

      const docContents = {}
      for (let docContent of Array.from(docContentsArray)) {
        docContents[docContent._id] = docContent
      }

      // Now create the new project, cleaning it up on failure if necessary
      return projectCreationHandler.createBlankProject(
        owner._id,
        newProjectName,
        function(err, newProject) {
          if (err != null) {
            logger.warn(
              { err, originalProject_id },
              'error duplicating project when creating new project'
            )
            return callback(err)
          }

          const copyJobs = {
            setCompiler(cb) {
              return projectOptionsHandler.setCompiler(
                newProject._id,
                originalProject.compiler,
                cb
              )
            },
            copyFiles(cb) {
              return ProjectDuplicator._copyFolderRecursivly(
                owner._id,
                newProject._id,
                originalProject_id,
                originalRootDoc,
                originalProject.rootFolder[0],
                newProject.rootFolder[0],
                docContents,
                cb
              )
            }
          }

          // Copy the contents of the original project into the new project
          return async.series(copyJobs, function(err) {
            if (err != null) {
              logger.warn(
                {
                  err,
                  originalProject_id,
                  newProjectName,
                  newProject_id: newProject._id
                },
                'error cloning project, will delete broken clone'
              )
              // Clean up broken clone on error.
              // Make sure we delete the new failed project, not the original one!
              return projectDeleter.deleteProject(newProject._id, function(
                delete_err
              ) {
                if (delete_err != null) {
                  logger.error(
                    { newProject_id: newProject._id, delete_err },
                    'error deleting broken clone of project'
                  )
                }
                return callback(err)
              })
            } else {
              return callback(null, newProject)
            }
          })
        }
      )
    })
  }
}
