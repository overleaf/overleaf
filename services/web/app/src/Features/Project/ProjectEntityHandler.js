const path = require('path')
const DocstoreManager = require('../Docstore/DocstoreManager')
const Errors = require('../Errors/Errors')
const ProjectGetter = require('./ProjectGetter')
const { callbackifyAll } = require('@overleaf/promise-utils')
const OError = require('@overleaf/o-error')
const { iterablePaths } = require('./IterablePath')

async function getAllDocs(projectId) {
  // We get the path and name info from the project, and the lines and
  // version info from the doc store.
  const docContentsArray = await DocstoreManager.promises.getAllDocs(projectId)

  // Turn array from docstore into a dictionary based on doc id
  const docContents = {}
  for (const docContent of docContentsArray) {
    docContents[docContent._id] = docContent
  }

  const folders = await _getAllFolders(projectId)
  const docs = {}
  for (const { path: folderPath, folder } of folders) {
    for (const doc of iterablePaths(folder, 'docs')) {
      const content = docContents[doc._id.toString()]
      if (content != null) {
        docs[path.join(folderPath, doc.name)] = {
          _id: doc._id,
          name: doc.name,
          lines: content.lines,
          rev: content.rev,
          folder,
        }
      }
    }
  }

  return docs
}

async function getAllFiles(projectId) {
  const folders = await _getAllFolders(projectId)
  const files = {}
  for (const { path: folderPath, folder } of folders) {
    for (const file of iterablePaths(folder, 'fileRefs')) {
      if (file != null) {
        files[path.join(folderPath, file.name)] = { ...file, folder }
      }
    }
  }
  return files
}

async function getAllEntities(projectId) {
  const project = await ProjectGetter.promises.getProject(projectId)
  if (project == null) {
    throw new Errors.NotFoundError('project not found')
  }
  const entities = getAllEntitiesFromProject(project)
  return entities
}

function getAllEntitiesFromProject(project) {
  const folders = _getAllFoldersFromProject(project)
  const docs = []
  const files = []
  for (const { path: folderPath, folder } of folders) {
    for (const doc of iterablePaths(folder, 'docs')) {
      if (doc != null) {
        docs.push({ path: path.join(folderPath, doc.name), doc })
      }
    }
    for (const file of iterablePaths(folder, 'fileRefs')) {
      if (file != null) {
        files.push({ path: path.join(folderPath, file.name), file })
      }
    }
  }
  return { docs, files, folders }
}

async function getAllDocPathsFromProjectById(projectId) {
  const project =
    await ProjectGetter.promises.getProjectWithoutDocLines(projectId)
  if (project == null) {
    throw new Errors.NotFoundError('no project')
  }
  const docPaths = getAllDocPathsFromProject(project)
  return docPaths
}

function getAllDocPathsFromProject(project) {
  const folders = _getAllFoldersFromProject(project)
  const docPath = {}
  for (const { path: folderPath, folder } of folders) {
    for (const doc of iterablePaths(folder, 'docs')) {
      docPath[doc._id] = path.join(folderPath, doc.name)
    }
  }
  return docPath
}

async function getDoc(projectId, docId) {
  const { lines, rev, version, ranges } = await DocstoreManager.promises.getDoc(
    projectId,
    docId
  )
  return { lines, rev, version, ranges }
}

/**
 * @param {ObjectId | string} projectId
 * @param {ObjectId | string} docId
 */
async function getDocPathByProjectIdAndDocId(projectId, docId) {
  const project =
    await ProjectGetter.promises.getProjectWithoutDocLines(projectId)
  if (project == null) {
    throw new Errors.NotFoundError('no project')
  }
  const docPath = await getDocPathFromProjectByDocId(project, docId)
  if (docPath == null) {
    throw new Errors.NotFoundError('no doc')
  }
  return docPath
}

function _recursivelyFindDocInFolder(basePath, docId, folder) {
  const docInCurrentFolder = (folder.docs || []).find(
    currentDoc => currentDoc._id.toString() === docId.toString()
  )
  if (docInCurrentFolder != null) {
    return path.join(basePath, docInCurrentFolder.name)
  } else {
    let docPath, childFolder
    for (childFolder of iterablePaths(folder, 'folders')) {
      docPath = _recursivelyFindDocInFolder(
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

/**
 * @param {Project} project
 * @param {ObjectId | string} docId
 * @param {Function} callback
 */
async function getDocPathFromProjectByDocId(project, docId) {
  const docPath = _recursivelyFindDocInFolder('/', docId, project.rootFolder[0])
  return docPath
}

async function _getAllFolders(projectId) {
  const project =
    await ProjectGetter.promises.getProjectWithoutDocLines(projectId)

  if (project == null) {
    throw new Errors.NotFoundError('no project')
  }
  const folders = _getAllFoldersFromProject(project)
  return folders
}

function _getAllFoldersFromProject(project) {
  const folders = []
  try {
    const processFolder = (basePath, folder) => {
      folders.push({ path: basePath, folder })
      if (folder.folders) {
        for (const childFolder of iterablePaths(folder, 'folders')) {
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
}

const ProjectEntityHandler = {
  getAllDocs,
  getAllFiles,
  getAllEntities,
  getAllDocPathsFromProjectById,
  getDoc,
  getDocPathByProjectIdAndDocId,
  getDocPathFromProjectByDocId,
  _getAllFolders,
}

module.exports = {
  ...callbackifyAll(ProjectEntityHandler, {
    multiResult: {
      getDoc: ['lines', 'rev', 'version', 'ranges'],
    },
  }),
  promises: ProjectEntityHandler,
  getAllEntitiesFromProject,
  getAllDocPathsFromProject,
  _getAllFoldersFromProject,
}
