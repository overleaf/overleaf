const path = require('path')
const DocstoreManager = require('../Docstore/DocstoreManager')
const Errors = require('../Errors/Errors')
const ProjectGetter = require('./ProjectGetter')
const { promisifyAll } = require('../../util/promises')
const OError = require('@overleaf/o-error')

const ProjectEntityHandler = {
  getAllDocs(projectId, callback) {
    // We get the path and name info from the project, and the lines and
    // version info from the doc store.
    DocstoreManager.getAllDocs(projectId, (error, docContentsArray) => {
      if (error != null) {
        return callback(error)
      }

      // Turn array from docstore into a dictionary based on doc id
      const docContents = {}
      for (const docContent of docContentsArray) {
        docContents[docContent._id] = docContent
      }

      ProjectEntityHandler._getAllFolders(projectId, (error, folders) => {
        if (error != null) {
          return callback(error)
        }
        const docs = {}
        for (const { path: folderPath, folder } of folders) {
          for (const doc of folder.docs || []) {
            const content = docContents[doc._id.toString()]
            if (content != null) {
              docs[path.join(folderPath, doc.name)] = {
                _id: doc._id,
                name: doc.name,
                lines: content.lines,
                rev: content.rev,
              }
            }
          }
        }

        callback(null, docs)
      })
    })
  },

  getAllFiles(projectId, callback) {
    ProjectEntityHandler._getAllFolders(projectId, (err, folders) => {
      if (err != null) {
        return callback(err)
      }
      const files = {}
      for (const { path: folderPath, folder } of folders) {
        for (const file of folder.fileRefs || []) {
          if (file != null) {
            files[path.join(folderPath, file.name)] = file
          }
        }
      }
      callback(null, files)
    })
  },

  getAllEntities(projectId, callback) {
    ProjectGetter.getProject(projectId, (err, project) => {
      if (err != null) {
        return callback(err)
      }
      if (project == null) {
        return callback(new Errors.NotFoundError('project not found'))
      }

      const entities = ProjectEntityHandler.getAllEntitiesFromProject(project)
      callback(null, entities)
    })
  },

  getAllEntitiesFromProject(project) {
    const folders = ProjectEntityHandler._getAllFoldersFromProject(project)
    const docs = []
    const files = []
    for (const { path: folderPath, folder } of folders) {
      for (const doc of folder.docs || []) {
        if (doc != null) {
          docs.push({ path: path.join(folderPath, doc.name), doc })
        }
      }
      for (const file of folder.fileRefs || []) {
        if (file != null) {
          files.push({ path: path.join(folderPath, file.name), file })
        }
      }
    }
    return { docs, files, folders }
  },

  getAllDocPathsFromProjectById(projectId, callback) {
    ProjectGetter.getProjectWithoutDocLines(projectId, (err, project) => {
      if (err != null) {
        return callback(err)
      }
      if (project == null) {
        return callback(Errors.NotFoundError('no project'))
      }
      const docPaths = ProjectEntityHandler.getAllDocPathsFromProject(project)
      callback(null, docPaths)
    })
  },

  getAllDocPathsFromProject(project) {
    const folders = ProjectEntityHandler._getAllFoldersFromProject(project)
    const docPath = {}
    for (const { path: folderPath, folder } of folders) {
      for (const doc of folder.docs || []) {
        docPath[doc._id] = path.join(folderPath, doc.name)
      }
    }
    return docPath
  },

  getDoc(projectId, docId, options, callback) {
    if (options == null) {
      options = {}
    }
    if (typeof options === 'function') {
      callback = options
      options = {}
    }

    DocstoreManager.getDoc(projectId, docId, options, callback)
  },

  /**
   * @param {ObjectID | string} projectId
   * @param {ObjectID | string} docId
   * @param {Function} callback
   */
  getDocPathByProjectIdAndDocId(projectId, docId, callback) {
    ProjectGetter.getProjectWithoutDocLines(projectId, (err, project) => {
      if (err != null) {
        return callback(err)
      }
      if (project == null) {
        return callback(new Errors.NotFoundError('no project'))
      }
      ProjectEntityHandler.getDocPathFromProjectByDocId(
        project,
        docId,
        (err, docPath) => {
          if (err) return callback(Errors.OError.tag(err))
          if (docPath == null) {
            return callback(new Errors.NotFoundError('no doc'))
          }
          callback(null, docPath)
        }
      )
    })
  },

  /**
   * @param {Project} project
   * @param {ObjectID | string} docId
   * @param {Function} callback
   */
  getDocPathFromProjectByDocId(project, docId, callback) {
    function recursivelyFindDocInFolder(basePath, docId, folder) {
      const docInCurrentFolder = (folder.docs || []).find(
        currentDoc => currentDoc._id.toString() === docId.toString()
      )
      if (docInCurrentFolder != null) {
        return path.join(basePath, docInCurrentFolder.name)
      } else {
        let docPath, childFolder
        for (childFolder of folder.folders || []) {
          docPath = recursivelyFindDocInFolder(
            path.join(basePath, childFolder.name),
            docId,
            childFolder
          )
          if (docPath != null) {
            return docPath
          }
        }
        return null
      }
    }
    const docPath = recursivelyFindDocInFolder(
      '/',
      docId,
      project.rootFolder[0]
    )
    callback(null, docPath)
  },

  _getAllFolders(projectId, callback) {
    ProjectGetter.getProjectWithoutDocLines(projectId, (err, project) => {
      if (err != null) {
        return callback(err)
      }
      if (project == null) {
        return callback(new Errors.NotFoundError('no project'))
      }
      const folders = ProjectEntityHandler._getAllFoldersFromProject(project)
      callback(null, folders)
    })
  },

  _getAllFoldersFromProject(project) {
    const folders = []
    try {
      const processFolder = (basePath, folder) => {
        folders.push({ path: basePath, folder })
        if (folder.folders) {
          for (const childFolder of folder.folders) {
            if (childFolder.name != null) {
              const childPath = path.join(basePath, childFolder.name)
              processFolder(childPath, childFolder)
            }
          }
        }
      }
      processFolder('/', project.rootFolder[0])
      return folders
    } catch (err) {
      throw OError.tag(err, 'Error getting folders', { projectId: project._id })
    }
  },
}

module.exports = ProjectEntityHandler
module.exports.promises = promisifyAll(ProjectEntityHandler, {
  without: ['getAllEntitiesFromProject'],
  multiResult: {
    getAllEntities: ['docs', 'files'],
    getDoc: ['lines', 'rev', 'version', 'ranges'],
  },
})
