const path = require('path')
const DocstoreManager = require('../Docstore/DocstoreManager')
const Errors = require('../Errors/Errors')
const ProjectGetter = require('./ProjectGetter')
const { promisifyAll } = require('../../util/promises')

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
      for (let docContent of docContentsArray) {
        docContents[docContent._id] = docContent
      }

      ProjectEntityHandler._getAllFolders(projectId, (error, folders) => {
        if (folders == null) {
          folders = {}
        }
        if (error != null) {
          return callback(error)
        }
        const docs = {}
        for (let folderPath in folders) {
          const folder = folders[folderPath]
          for (let doc of folder.docs || []) {
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

        callback(null, docs)
      })
    })
  },

  getAllFiles(projectId, callback) {
    ProjectEntityHandler._getAllFolders(projectId, (err, folders) => {
      if (folders == null) {
        folders = {}
      }
      if (err != null) {
        return callback(err)
      }
      const files = {}
      for (let folderPath in folders) {
        const folder = folders[folderPath]
        for (let file of folder.fileRefs || []) {
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

      ProjectEntityHandler.getAllEntitiesFromProject(project, callback)
    })
  },

  getAllEntitiesFromProject(project, callback) {
    ProjectEntityHandler._getAllFoldersFromProject(project, (err, folders) => {
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
        for (let doc of folder.docs || []) {
          if (doc != null) {
            docs.push({ path: path.join(folderPath, doc.name), doc })
          }
        }
        for (let file of folder.fileRefs || []) {
          if (file != null) {
            files.push({ path: path.join(folderPath, file.name), file })
          }
        }
      }
      callback(null, docs, files)
    })
  },

  getAllDocPathsFromProjectById(projectId, callback) {
    ProjectGetter.getProjectWithoutDocLines(projectId, (err, project) => {
      if (err != null) {
        return callback(err)
      }
      if (project == null) {
        return callback(Errors.NotFoundError('no project'))
      }
      ProjectEntityHandler.getAllDocPathsFromProject(project, callback)
    })
  },

  getAllDocPathsFromProject(project, callback) {
    ProjectEntityHandler._getAllFoldersFromProject(project, (err, folders) => {
      if (folders == null) {
        folders = {}
      }
      if (err != null) {
        return callback(err)
      }
      const docPath = {}
      for (let folderPath in folders) {
        const folder = folders[folderPath]
        for (let doc of folder.docs || []) {
          docPath[doc._id] = path.join(folderPath, doc.name)
        }
      }
      callback(null, docPath)
    })
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

  getDocPathByProjectIdAndDocId(projectId, docId, callback) {
    ProjectGetter.getProjectWithoutDocLines(projectId, (err, project) => {
      if (err != null) {
        return callback(err)
      }
      if (project == null) {
        return callback(new Errors.NotFoundError('no project'))
      }
      function recursivelyFindDocInFolder(basePath, docId, folder) {
        let docInCurrentFolder = (folder.docs || []).find(
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
      if (docPath == null) {
        return callback(new Errors.NotFoundError('no doc'))
      }
      callback(null, docPath)
    })
  },

  _getAllFolders(projectId, callback) {
    ProjectGetter.getProjectWithoutDocLines(projectId, (err, project) => {
      if (err != null) {
        return callback(err)
      }
      if (project == null) {
        return callback(new Errors.NotFoundError('no project'))
      }
      ProjectEntityHandler._getAllFoldersFromProject(project, callback)
    })
  },

  _getAllFoldersFromProject(project, callback) {
    const folders = {}
    function processFolder(basePath, folder) {
      folders[basePath] = folder
      for (let childFolder of folder.folders || []) {
        if (childFolder.name != null) {
          processFolder(path.join(basePath, childFolder.name), childFolder)
        }
      }
    }

    processFolder('/', project.rootFolder[0])
    callback(null, folders)
  }
}

module.exports = ProjectEntityHandler
module.exports.promises = promisifyAll(ProjectEntityHandler, {
  multiResult: {
    getAllEntities: ['docs', 'files'],
    getAllEntitiesFromProject: ['docs', 'files']
  }
})
