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
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const _ = require('underscore')
const async = require('async')
const path = require('path')
const logger = require('logger-sharelatex')
const DocstoreManager = require('../Docstore/DocstoreManager')
const DocumentUpdaterHandler = require('../../Features/DocumentUpdater/DocumentUpdaterHandler')
const Errors = require('../Errors/Errors')
const { Project } = require('../../models/Project')
const ProjectGetter = require('./ProjectGetter')
const TpdsUpdateSender = require('../ThirdPartyDataStore/TpdsUpdateSender')
const { promisifyAll } = require('../../util/promises')

const ProjectEntityHandler = {
  getAllDocs(project_id, callback) {
    logger.log({ project_id }, 'getting all docs for project')

    // We get the path and name info from the project, and the lines and
    // version info from the doc store.
    return DocstoreManager.getAllDocs(project_id, function(
      error,
      docContentsArray
    ) {
      if (error != null) {
        return callback(error)
      }

      // Turn array from docstore into a dictionary based on doc id
      const docContents = {}
      for (let docContent of Array.from(docContentsArray)) {
        docContents[docContent._id] = docContent
      }

      return ProjectEntityHandler._getAllFolders(project_id, function(
        error,
        folders
      ) {
        if (folders == null) {
          folders = {}
        }
        if (error != null) {
          return callback(error)
        }
        const docs = {}
        for (let folderPath in folders) {
          const folder = folders[folderPath]
          for (let doc of Array.from(folder.docs || [])) {
            const content = docContents[doc._id.toString()]
            if (content != null) {
              docs[path.join(folderPath, doc.name)] = {
                _id: doc._id,
                name: doc.name,
                lines: content.lines,
                rev: content.rev
              }
            }
          }
        }
        logger.log(
          { count: _.keys(docs).length, project_id },
          'returning docs for project'
        )
        return callback(null, docs)
      })
    })
  },

  getAllFiles(project_id, callback) {
    logger.log({ project_id }, 'getting all files for project')
    return ProjectEntityHandler._getAllFolders(project_id, function(
      err,
      folders
    ) {
      if (folders == null) {
        folders = {}
      }
      if (err != null) {
        return callback(err)
      }
      const files = {}
      for (let folderPath in folders) {
        const folder = folders[folderPath]
        for (let file of Array.from(folder.fileRefs || [])) {
          if (file != null) {
            files[path.join(folderPath, file.name)] = file
          }
        }
      }
      return callback(null, files)
    })
  },

  getAllEntities(project_id, callback) {
    return ProjectGetter.getProject(project_id, function(err, project) {
      if (err != null) {
        return callback(err)
      }
      if (project == null) {
        return callback(new Errors.NotFoundError('project not found'))
      }

      return ProjectEntityHandler.getAllEntitiesFromProject(project, callback)
    })
  },

  getAllEntitiesFromProject(project, callback) {
    logger.log({ project }, 'getting all entities for project')
    return ProjectEntityHandler._getAllFoldersFromProject(project, function(
      err,
      folders
    ) {
      if (folders == null) {
        folders = {}
      }
      if (err != null) {
        return callback(err)
      }
      const docs = []
      const files = []
      for (let folderPath in folders) {
        const folder = folders[folderPath]
        for (let doc of Array.from(folder.docs || [])) {
          if (doc != null) {
            docs.push({ path: path.join(folderPath, doc.name), doc })
          }
        }
        for (let file of Array.from(folder.fileRefs || [])) {
          if (file != null) {
            files.push({ path: path.join(folderPath, file.name), file })
          }
        }
      }
      return callback(null, docs, files)
    })
  },

  getAllDocPathsFromProjectById(project_id, callback) {
    return ProjectGetter.getProjectWithoutDocLines(project_id, function(
      err,
      project
    ) {
      if (err != null) {
        return callback(err)
      }
      if (project == null) {
        return callback(Errors.NotFoundError('no project'))
      }
      return ProjectEntityHandler.getAllDocPathsFromProject(project, callback)
    })
  },

  getAllDocPathsFromProject(project, callback) {
    logger.log({ project }, 'getting all docs for project')
    return ProjectEntityHandler._getAllFoldersFromProject(project, function(
      err,
      folders
    ) {
      if (folders == null) {
        folders = {}
      }
      if (err != null) {
        return callback(err)
      }
      const docPath = {}
      for (let folderPath in folders) {
        const folder = folders[folderPath]
        for (let doc of Array.from(folder.docs || [])) {
          docPath[doc._id] = path.join(folderPath, doc.name)
        }
      }
      logger.log(
        { count: _.keys(docPath).length, project_id: project._id },
        'returning docPaths for project'
      )
      return callback(null, docPath)
    })
  },

  flushProjectToThirdPartyDataStore(project_id, callback) {
    logger.log({ project_id }, 'flushing project to tpds')
    return DocumentUpdaterHandler.flushProjectToMongo(project_id, function(
      error
    ) {
      if (error != null) {
        return callback(error)
      }
      return ProjectGetter.getProject(project_id, { name: true }, function(
        error,
        project
      ) {
        if (error != null) {
          return callback(error)
        }
        const requests = []
        return ProjectEntityHandler.getAllDocs(project_id, function(
          error,
          docs
        ) {
          if (error != null) {
            return callback(error)
          }
          for (let docPath in docs) {
            const doc = docs[docPath]
            ;((docPath, doc) =>
              requests.push(cb =>
                TpdsUpdateSender.addDoc(
                  {
                    project_id,
                    doc_id: doc._id,
                    path: docPath,
                    project_name: project.name,
                    rev: doc.rev || 0
                  },
                  cb
                )
              ))(docPath, doc)
          }
          return ProjectEntityHandler.getAllFiles(project_id, function(
            error,
            files
          ) {
            if (error != null) {
              return callback(error)
            }
            for (let filePath in files) {
              const file = files[filePath]
              ;((filePath, file) =>
                requests.push(cb =>
                  TpdsUpdateSender.addFile(
                    {
                      project_id,
                      file_id: file._id,
                      path: filePath,
                      project_name: project.name,
                      rev: file.rev
                    },
                    cb
                  )
                ))(filePath, file)
            }
            return async.series(requests, function(err) {
              logger.log({ project_id }, 'finished flushing project to tpds')
              return callback(err)
            })
          })
        })
      })
    })
  },

  getDoc(project_id, doc_id, options, callback) {
    if (options == null) {
      options = {}
    }
    if (callback == null) {
      callback = function(error, lines, rev) {}
    }
    if (typeof options === 'function') {
      callback = options
      options = {}
    }

    return DocstoreManager.getDoc(project_id, doc_id, options, callback)
  },

  _getAllFolders(project_id, callback) {
    logger.log({ project_id }, 'getting all folders for project')
    return ProjectGetter.getProjectWithoutDocLines(project_id, function(
      err,
      project
    ) {
      if (err != null) {
        return callback(err)
      }
      if (project == null) {
        return callback(Errors.NotFoundError('no project'))
      }
      return ProjectEntityHandler._getAllFoldersFromProject(project, callback)
    })
  },

  _getAllFoldersFromProject(project, callback) {
    const folders = {}
    var processFolder = function(basePath, folder) {
      folders[basePath] = folder
      return (() => {
        const result = []
        for (let childFolder of Array.from(folder.folders || [])) {
          if (childFolder.name != null) {
            result.push(
              processFolder(path.join(basePath, childFolder.name), childFolder)
            )
          } else {
            result.push(undefined)
          }
        }
        return result
      })()
    }

    processFolder('/', project.rootFolder[0])
    return callback(null, folders)
  }
}

ProjectEntityHandler.promises = promisifyAll(ProjectEntityHandler)
module.exports = ProjectEntityHandler
