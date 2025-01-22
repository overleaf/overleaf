const { callbackify } = require('util')
const { callbackifyMultiResult } = require('@overleaf/promise-utils')
const logger = require('@overleaf/logger')
const path = require('path')
const { ObjectId } = require('mongodb-legacy')
const Settings = require('@overleaf/settings')
const OError = require('@overleaf/o-error')
const CooldownManager = require('../Cooldown/CooldownManager')
const Errors = require('../Errors/Errors')
const { Folder } = require('../../models/Folder')
const LockManager = require('../../infrastructure/LockManager')
const { Project } = require('../../models/Project')
const ProjectEntityHandler = require('./ProjectEntityHandler')
const ProjectGetter = require('./ProjectGetter')
const ProjectLocator = require('./ProjectLocator')
const FolderStructureBuilder = require('./FolderStructureBuilder')
const SafePath = require('./SafePath')
const { DeletedFile } = require('../../models/DeletedFile')
const { iterablePaths } = require('./IterablePath')

const LOCK_NAMESPACE = 'mongoTransaction'
const ENTITY_TYPE_TO_MONGO_PATH_SEGMENT = {
  doc: 'docs',
  docs: 'docs',
  file: 'fileRefs',
  files: 'fileRefs',
  fileRefs: 'fileRefs',
  folder: 'folders',
  folders: 'folders',
}

module.exports = {
  LOCK_NAMESPACE,
  addDoc: callbackifyMultiResult(wrapWithLock(addDoc), ['result', 'project']),
  addFile: callbackifyMultiResult(wrapWithLock(addFile), ['result', 'project']),
  addFolder: callbackifyMultiResult(wrapWithLock(addFolder), [
    'folder',
    'parentFolderId',
  ]),
  replaceFileWithNew: callbackifyMultiResult(wrapWithLock(replaceFileWithNew), [
    'oldFileRef',
    'project',
    'path',
    'newProject',
    'newFileRef',
  ]),
  replaceDocWithFile: callbackify(replaceDocWithFile),
  replaceFileWithDoc: callbackify(replaceFileWithDoc),
  mkdirp: callbackifyMultiResult(wrapWithLock(mkdirp), [
    'newFolders',
    'folder',
    'parentFolder',
  ]),
  moveEntity: callbackifyMultiResult(wrapWithLock(moveEntity), [
    'project',
    'startPath',
    'endPath',
    'rev',
    'changes',
  ]),
  deleteEntity: callbackifyMultiResult(wrapWithLock(deleteEntity), [
    'entity',
    'path',
    'projectBeforeDeletion',
    'newProject',
  ]),
  renameEntity: callbackifyMultiResult(wrapWithLock(renameEntity), [
    'project',
    'startPath',
    'endPath',
    'rev',
    'changes',
  ]),
  createNewFolderStructure: callbackify(wrapWithLock(createNewFolderStructure)),
  _insertDeletedFileReference: callbackify(_insertDeletedFileReference),
  _putElement: callbackifyMultiResult(_putElement, ['result', 'project']),
  _confirmFolder,
  promises: {
    addDoc: wrapWithLock(addDoc),
    addFile: wrapWithLock(addFile),
    addFolder: wrapWithLock(addFolder),
    replaceFileWithNew: wrapWithLock(replaceFileWithNew),
    replaceDocWithFile: wrapWithLock(replaceDocWithFile),
    replaceFileWithDoc: wrapWithLock(replaceFileWithDoc),
    mkdirp: wrapWithLock(mkdirp),
    moveEntity: wrapWithLock(moveEntity),
    deleteEntity: wrapWithLock(deleteEntity),
    renameEntity: wrapWithLock(renameEntity),
    createNewFolderStructure: wrapWithLock(createNewFolderStructure),
    _insertDeletedFileReference,
    _putElement,
  },
}

function wrapWithLock(methodWithoutLock) {
  // This lock is used whenever we read or write to an existing project's
  // structure. Some operations to project structure cannot be done atomically
  // in mongo, this lock is used to prevent reading the structure between two
  // parts of a staged update.
  async function methodWithLock(projectId, ...rest) {
    return LockManager.promises.runWithLock(LOCK_NAMESPACE, projectId, () =>
      methodWithoutLock(projectId, ...rest)
    )
  }
  return methodWithLock
}

async function addDoc(projectId, folderId, doc) {
  const project = await ProjectGetter.promises.getProjectWithoutLock(
    projectId,
    {
      rootFolder: true,
      name: true,
      overleaf: true,
    }
  )
  folderId = _confirmFolder(project, folderId)
  const { result, project: newProject } = await _putElement(
    project,
    folderId,
    doc,
    'doc'
  )
  return { result, project: newProject }
}

async function addFile(projectId, folderId, fileRef) {
  const project = await ProjectGetter.promises.getProjectWithoutLock(
    projectId,
    { rootFolder: true, name: true, overleaf: true }
  )
  folderId = _confirmFolder(project, folderId)
  const { result, project: newProject } = await _putElement(
    project,
    folderId,
    fileRef,
    'file'
  )
  return { result, project: newProject }
}

async function addFolder(projectId, parentFolderId, folderName) {
  const project = await ProjectGetter.promises.getProjectWithoutLock(
    projectId,
    { rootFolder: true, name: true, overleaf: true }
  )
  parentFolderId = _confirmFolder(project, parentFolderId)
  const folder = new Folder({ name: folderName })
  await _putElement(project, parentFolderId, folder, 'folder')
  return { folder, parentFolderId }
}

async function replaceFileWithNew(projectId, fileId, newFileRef) {
  const project = await ProjectGetter.promises.getProjectWithoutLock(
    projectId,
    { rootFolder: true, name: true, overleaf: true }
  )
  const { element: fileRef, path } = await ProjectLocator.promises.findElement({
    project,
    element_id: fileId,
    type: 'file',
  })
  await _insertDeletedFileReference(projectId, fileRef)
  const newProject = await Project.findOneAndUpdate(
    { _id: project._id, [path.mongo]: { $exists: true } },
    {
      $set: {
        [`${path.mongo}._id`]: newFileRef._id,
        [`${path.mongo}.created`]: new Date(),
        [`${path.mongo}.linkedFileData`]: newFileRef.linkedFileData,
        [`${path.mongo}.hash`]: newFileRef.hash,
      },
      $inc: {
        version: 1,
        [`${path.mongo}.rev`]: 1,
      },
    },
    // Note: Mongoose uses new:true to return the modified document
    // https://mongoosejs.com/docs/api.html#model_Model.findOneAndUpdate
    // but Mongo uses returnNewDocument:true instead
    // https://docs.mongodb.com/manual/reference/method/db.collection.findOneAndUpdate/
    // We are using Mongoose here, but if we ever switch to a direct mongo call
    // the next line will need to be updated.
    { new: true }
  ).exec()
  if (newProject == null) {
    throw new OError('Project not found or path not found in filetree', {
      projectId,
      path,
    })
  }
  // Refresh newFileRef with the version returned from the database
  newFileRef = ProjectLocator.findElementByMongoPath(newProject, path.mongo)
  return { oldFileRef: fileRef, project, path, newProject, newFileRef }
}

async function replaceDocWithFile(projectId, docId, fileRef) {
  const project = await ProjectGetter.promises.getProjectWithoutLock(
    projectId,
    { rootFolder: true, name: true, overleaf: true }
  )
  const { path } = await ProjectLocator.promises.findElement({
    project,
    element_id: docId,
    type: 'doc',
  })
  const folderMongoPath = _getParentMongoPath(path.mongo)
  const newProject = await Project.findOneAndUpdate(
    { _id: project._id, [folderMongoPath]: { $exists: true } },
    {
      $pull: {
        [`${folderMongoPath}.docs`]: { _id: docId },
      },
      $push: {
        [`${folderMongoPath}.fileRefs`]: fileRef,
      },
      $inc: { version: 1 },
    },
    { new: true }
  ).exec()
  if (newProject == null) {
    throw new OError('Project not found or path not found in filetree', {
      projectId,
      path,
    })
  }
  return newProject
}

async function replaceFileWithDoc(projectId, fileId, newDoc) {
  const project = await ProjectGetter.promises.getProjectWithoutLock(
    projectId,
    { rootFolder: true, name: true, overleaf: true }
  )
  const { path } = await ProjectLocator.promises.findElement({
    project,
    element_id: fileId,
    type: 'file',
  })
  const folderMongoPath = _getParentMongoPath(path.mongo)
  const newProject = await Project.findOneAndUpdate(
    { _id: project._id, [folderMongoPath]: { $exists: true } },
    {
      $pull: {
        [`${folderMongoPath}.fileRefs`]: { _id: fileId },
      },
      $push: {
        [`${folderMongoPath}.docs`]: newDoc,
      },
      $inc: { version: 1 },
    },
    { new: true }
  ).exec()
  if (newProject == null) {
    throw new OError('Project not found or path not found in filetree', {
      projectId,
      path,
    })
  }
  return newProject
}

async function mkdirp(projectId, path, options = {}) {
  // defaults to case insensitive paths, use options {exactCaseMatch:true}
  // to make matching case-sensitive
  const folders = path.split('/').filter(folder => folder.length !== 0)

  const project =
    await ProjectGetter.promises.getProjectWithOnlyFolders(projectId)
  if (path === '/') {
    return { newFolders: [], folder: project.rootFolder[0] }
  }

  const newFolders = []
  let builtUpPath = ''
  let lastFolder = null
  for (const folderName of folders) {
    builtUpPath += `/${folderName}`
    try {
      const { element: foundFolder, folder: parentFolder } =
        await ProjectLocator.promises.findElementByPath({
          project,
          path: builtUpPath,
          exactCaseMatch: options.exactCaseMatch,
        })
      lastFolder = foundFolder
      lastFolder.parentFolder_id = parentFolder._id
    } catch (err) {
      // Folder couldn't be found. Create it.
      const parentFolderId = lastFolder && lastFolder._id
      const { folder: newFolder, parentFolderId: newParentFolderId } =
        await addFolder(projectId, parentFolderId, folderName)
      newFolder.parentFolder_id = newParentFolderId
      lastFolder = newFolder
      newFolders.push(newFolder)
    }
  }
  return { folder: lastFolder, newFolders }
}

async function moveEntity(projectId, entityId, destFolderId, entityType) {
  const project = await ProjectGetter.promises.getProjectWithoutLock(
    projectId,
    { rootFolder: true, name: true, overleaf: true }
  )
  const { element: entity, path: entityPath } =
    await ProjectLocator.promises.findElement({
      project,
      element_id: entityId,
      type: entityType,
    })
  // Prevent top-level docs/files with reserved names (to match v1 behaviour)
  if (_blockedFilename(entityPath, entityType)) {
    throw new Errors.InvalidNameError('blocked element name')
  }
  await _checkValidMove(project, entityType, entity, entityPath, destFolderId)
  const { docs: oldDocs, files: oldFiles } =
    ProjectEntityHandler.getAllEntitiesFromProject(project)
  // For safety, insert the entity in the destination
  // location first, and then remove the original.  If
  // there is an error the entity may appear twice. This
  // will cause some breakage but is better than being
  // lost, which is what happens if this is done in the
  // opposite order.
  const { result } = await _putElement(
    project,
    destFolderId,
    entity,
    entityType
  )
  // Note: putElement always pushes onto the end of an
  // array so it will never change an existing mongo
  // path. Therefore it is safe to remove an element
  // from the project with an existing path after
  // calling putElement. But we must be sure that we
  // have not moved a folder subfolder of itself (which
  // is done by _checkValidMove above) because that
  // would lead to it being deleted.
  const newProject = await _removeElementFromMongoArray(
    Project,
    projectId,
    entityPath.mongo,
    entityId
  )
  const { docs: newDocs, files: newFiles } =
    ProjectEntityHandler.getAllEntitiesFromProject(newProject)
  const startPath = entityPath.fileSystem
  const endPath = result.path.fileSystem
  const changes = {
    oldDocs,
    newDocs,
    oldFiles,
    newFiles,
    newProject,
  }
  // check that no files have been lost (or duplicated)
  if (
    oldFiles.length !== newFiles.length ||
    oldDocs.length !== newDocs.length
  ) {
    logger.warn(
      {
        projectId,
        oldDocs: oldDocs.length,
        newDocs: newDocs.length,
        oldFiles: oldFiles.length,
        newFiles: newFiles.length,
        origProject: project,
        newProject,
      },
      "project corrupted moving files - shouldn't happen"
    )
    throw new Error('unexpected change in project structure')
  }
  return { project, startPath, endPath, rev: entity.rev, changes }
}

async function deleteEntity(projectId, entityId, entityType) {
  const project = await ProjectGetter.promises.getProjectWithoutLock(
    projectId,
    { name: true, rootFolder: true, overleaf: true, rootDoc_id: true }
  )
  if (
    entityType === 'folder' &&
    project.rootFolder.some(
      rootFolder => rootFolder._id.toString() === entityId.toString()
    )
  ) {
    throw new Errors.NonDeletableEntityError('cannot delete root folder')
  }

  const deleteRootDoc =
    project.rootDoc_id &&
    entityId &&
    project.rootDoc_id.toString() === entityId.toString()
  const { element: entity, path } = await ProjectLocator.promises.findElement({
    project,
    element_id: entityId,
    type: entityType,
  })
  const newProject = await _removeElementFromMongoArray(
    Project,
    projectId,
    path.mongo,
    entityId,
    deleteRootDoc
  )
  return { entity, path, projectBeforeDeletion: project, newProject }
}

async function renameEntity(
  projectId,
  entityId,
  entityType,
  newName,
  callback
) {
  const project = await ProjectGetter.promises.getProjectWithoutLock(
    projectId,
    { rootFolder: true, name: true, overleaf: true }
  )
  const {
    element: entity,
    path: entPath,
    folder: parentFolder,
  } = await ProjectLocator.promises.findElement({
    project,
    element_id: entityId,
    type: entityType,
  })
  const startPath = entPath.fileSystem
  const endPath = path.join(path.dirname(entPath.fileSystem), newName)

  // Prevent top-level docs/files with reserved names (to match v1 behaviour)
  if (_blockedFilename({ fileSystem: endPath }, entityType)) {
    throw new Errors.InvalidNameError('blocked element name')
  }

  // check if the new name already exists in the current folder
  _checkValidElementName(parentFolder, newName)

  const { docs: oldDocs, files: oldFiles } =
    ProjectEntityHandler.getAllEntitiesFromProject(project)

  // we need to increment the project version number for any structure change
  const newProject = await Project.findOneAndUpdate(
    { _id: projectId, [entPath.mongo]: { $exists: true } },
    { $set: { [`${entPath.mongo}.name`]: newName }, $inc: { version: 1 } },
    { new: true }
  ).exec()
  if (newProject == null) {
    throw new OError('Project not found or path not found in filetree', {
      projectId,
      path: entPath,
    })
  }

  const { docs: newDocs, files: newFiles } =
    ProjectEntityHandler.getAllEntitiesFromProject(newProject)
  return {
    project,
    startPath,
    endPath,
    rev: entity.rev,
    changes: { oldDocs, newDocs, oldFiles, newFiles, newProject },
  }
}

async function _insertDeletedFileReference(projectId, fileRef) {
  await DeletedFile.create({
    projectId,
    _id: fileRef._id,
    name: fileRef.name,
    linkedFileData: fileRef.linkedFileData,
    hash: fileRef.hash,
    deletedAt: new Date(),
  })
}

async function _removeElementFromMongoArray(
  model,
  modelId,
  path,
  elementId,
  deleteRootDoc = false
) {
  const nonArrayPath = path.slice(0, path.lastIndexOf('.'))
  const options = { new: true }
  const query = { _id: modelId }
  const update = {
    $pull: { [nonArrayPath]: { _id: elementId } },
    $inc: { version: 1 },
  }
  if (deleteRootDoc) {
    update.$unset = { rootDoc_id: 1 }
  }
  return model.findOneAndUpdate(query, update, options).exec()
}

function _countElements(project) {
  function countFolder(folder) {
    if (folder == null) {
      return 0
    }

    let total = 0
    if (folder.folders) {
      total += folder.folders.length
      for (const subfolder of iterablePaths(folder, 'folders')) {
        total += countFolder(subfolder)
      }
    }
    if (folder.docs) {
      total += folder.docs.length
    }
    if (folder.fileRefs) {
      total += folder.fileRefs.length
    }
    return total
  }

  return countFolder(project.rootFolder[0])
}

async function _putElement(project, folderId, element, type) {
  if (element == null || element._id == null) {
    logger.warn(
      { projectId: project._id, folderId, element, type },
      'failed trying to insert element as it was null'
    )
    throw new Error('no element passed to be inserted')
  }

  const pathSegment = _getMongoPathSegmentFromType(type)

  // original check path.resolve("/", element.name) isnt "/#{element.name}" or element.name.match("/")
  // check if name is allowed
  if (!SafePath.isCleanFilename(element.name)) {
    logger.warn(
      { projectId: project._id, folderId, element, type },
      'failed trying to insert element as name was invalid'
    )
    throw new Errors.InvalidNameError('invalid element name')
  }

  if (folderId == null) {
    folderId = project.rootFolder[0]._id
  }

  if (_countElements(project) > Settings.maxEntitiesPerProject) {
    logger.warn(
      { projectId: project._id },
      'project too big, stopping insertions'
    )
    CooldownManager.putProjectOnCooldown(project._id)
    throw new Error('project_has_too_many_files')
  }

  const { element: folder, path } = await ProjectLocator.promises.findElement({
    project,
    element_id: folderId,
    type: 'folder',
  })
  const newPath = {
    fileSystem: `${path.fileSystem}/${element.name}`,
    mongo: path.mongo,
  }
  // check if the path would be too long
  if (!SafePath.isAllowedLength(newPath.fileSystem)) {
    throw new Errors.InvalidNameError('path too long')
  }
  // Prevent top-level docs/files with reserved names (to match v1 behaviour)
  if (_blockedFilename(newPath, type)) {
    throw new Errors.InvalidNameError('blocked element name')
  }
  _checkValidElementName(folder, element.name)
  element._id = new ObjectId(element._id.toString())
  const mongoPath = `${path.mongo}.${pathSegment}`
  const newProject = await Project.findOneAndUpdate(
    { _id: project._id, [path.mongo]: { $exists: true } },
    { $push: { [mongoPath]: element }, $inc: { version: 1 } },
    { new: true }
  ).exec()
  if (newProject == null) {
    throw new OError('Project not found or path not found in filetree', {
      projectId: project._id,
      path,
    })
  }
  return { result: { path: newPath }, project: newProject }
}

function _blockedFilename(entityPath, entityType) {
  // check if name would be blocked in v1
  // javascript reserved names are forbidden for docs and files
  // at the top-level (but folders with reserved names are allowed).
  const isFolder = entityType === 'folder'
  const dir = path.dirname(entityPath.fileSystem)
  const file = path.basename(entityPath.fileSystem)
  const isTopLevel = dir === '/'
  if (isTopLevel && !isFolder && SafePath.isBlockedFilename(file)) {
    return true
  } else {
    return false
  }
}

function _getMongoPathSegmentFromType(type) {
  const pathSegment = ENTITY_TYPE_TO_MONGO_PATH_SEGMENT[type]
  if (pathSegment == null) {
    throw new Error(`Unknown entity type: ${type}`)
  }
  return pathSegment
}

/**
 * Check if the name is already taken by a doc, file or folder. If so, return an
 * error "file already exists".
 */
function _checkValidElementName(folder, name) {
  if (folder == null) {
    return
  }
  const elements = []
    .concat(folder.docs || [])
    .concat(folder.fileRefs || [])
    .concat(folder.folders || [])
  for (const element of elements) {
    if (element.name === name) {
      throw new Errors.DuplicateNameError('file already exists')
    }
  }
}

function _confirmFolder(project, folderId) {
  if (folderId == null) {
    return project.rootFolder[0]._id
  } else {
    return folderId
  }
}

function _checkValidFolderPath(folderPath, destinationFolderPath) {
  if (!folderPath.endsWith('/')) {
    folderPath += '/'
  }

  if (!destinationFolderPath.endsWith('/')) {
    destinationFolderPath += '/'
  }

  if (destinationFolderPath === folderPath) {
    throw new Errors.InvalidNameError('destination folder is the same as me')
  }

  if (destinationFolderPath.startsWith(folderPath)) {
    throw new Errors.InvalidNameError(
      'destination folder is a child folder of me'
    )
  }
}

async function _checkValidMove(
  project,
  entityType,
  entity,
  entityPath,
  destFolderId
) {
  const { element: destEntity, path: destFolderPath } =
    await ProjectLocator.promises.findElement({
      project,
      element_id: destFolderId,
      type: 'folder',
    })

  // check if there is already a doc/file/folder with the same name
  // in the destination folder
  _checkValidElementName(destEntity, entity.name)

  // check if the folder being moved is a parent of the destination folder
  if (/folder/.test(entityType)) {
    _checkValidFolderPath(entityPath.fileSystem, destFolderPath.fileSystem)
  }
}

/**
 * Create an initial file tree out of a list of doc and file entries
 *
 * Each entry specifies a path to the doc or file. Folders are automatically
 * created.
 *
 * @param {ObjectId} projectId - id of the project
 * @param {DocEntry[]} docEntries - list of docs to add
 * @param {FileEntry[]} fileEntries - list of files to add
 * @return {Promise<string>} the project version after the operation
 */
async function createNewFolderStructure(projectId, docEntries, fileEntries) {
  try {
    const rootFolder = FolderStructureBuilder.buildFolderStructure(
      docEntries,
      fileEntries
    )
    const project = await Project.findOneAndUpdate(
      {
        _id: projectId,
        'rootFolder.0.folders.0': { $exists: false },
        'rootFolder.0.docs.0': { $exists: false },
        'rootFolder.0.files.0': { $exists: false },
      },
      {
        $set: { rootFolder: [rootFolder] },
        $inc: { version: 1 },
      },
      {
        new: true,
        lean: true,
        fields: { version: 1 },
      }
    ).exec()
    if (project == null) {
      throw new OError('project not found or folder structure already exists', {
        projectId,
      })
    }
    return project.version
  } catch (err) {
    throw OError.tag(err, 'failed to create folder structure', { projectId })
  }
}

/**
 * Given a Mongo path to an entity, return the Mongo path to the parent folder
 */
function _getParentMongoPath(mongoPath) {
  const segments = mongoPath.split('.')
  if (segments.length <= 2) {
    throw new Error('Root folder has no parents')
  }
  return segments.slice(0, -2).join('.')
}
