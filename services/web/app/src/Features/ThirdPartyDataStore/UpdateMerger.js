const { callbackify } = require('util')
const _ = require('underscore')
const fsPromises = require('fs/promises')
const logger = require('@overleaf/logger')
const EditorController = require('../Editor/EditorController')
const FileTypeManager = require('../Uploads/FileTypeManager')
const FileWriter = require('../../infrastructure/FileWriter')
const ProjectEntityHandler = require('../Project/ProjectEntityHandler')

async function mergeUpdate(userId, projectId, path, updateRequest, source) {
  const fsPath = await FileWriter.promises.writeStreamToDisk(
    projectId,
    updateRequest
  )
  try {
    await _mergeUpdate(userId, projectId, path, fsPath, source)
  } finally {
    try {
      await fsPromises.unlink(fsPath)
    } catch (err) {
      logger.err({ projectId, fsPath }, 'error deleting file')
    }
  }
}

async function _findExistingFileType(projectId, path) {
  const { docs, files } = await ProjectEntityHandler.promises.getAllEntities(
    projectId
  )
  if (_.some(docs, d => d.path === path)) {
    return 'doc'
  }
  if (_.some(files, f => f.path === path)) {
    return 'file'
  }
  return null
}

async function _determineFileType(projectId, path, fsPath) {
  // check if there is an existing file with the same path (we either need
  // to overwrite it or delete it)
  const existingFileType = await _findExistingFileType(projectId, path)

  // determine whether the update should create a doc or binary file
  const { binary, encoding } = await FileTypeManager.promises.getType(
    path,
    fsPath,
    existingFileType
  )

  // If we receive a non-utf8 encoding, we won't be able to keep things in
  // sync, so we'll treat non-utf8 files as binary
  const isBinary = binary || encoding !== 'utf-8'

  // Existing | Update    | Action
  // ---------|-----------|-------
  // file     | isBinary  | existing-file
  // file     | !isBinary | existing-file
  // doc      | isBinary  | new-file, delete-existing-doc
  // doc      | !isBinary | existing-doc
  // null     | isBinary  | new-file
  // null     | !isBinary | new-doc

  // if a binary file already exists, always keep it as a binary file
  // even if the update looks like a text file
  if (existingFileType === 'file') {
    return { fileType: 'existing-file' }
  }

  // if there is an existing doc, keep it as a doc except when the
  // incoming update is binary. In that case delete the doc and replace
  // it with a new file.
  if (existingFileType === 'doc') {
    if (isBinary) {
      return {
        fileType: 'new-file',
        deleteOriginalEntity: 'delete-existing-doc',
      }
    } else {
      return { fileType: 'existing-doc' }
    }
  }

  // if there no existing file, create a file or doc as needed
  return { fileType: isBinary ? 'new-file' : 'new-doc' }
}

async function _mergeUpdate(userId, projectId, path, fsPath, source) {
  const { fileType, deleteOriginalEntity } = await _determineFileType(
    projectId,
    path,
    fsPath
  )

  if (deleteOriginalEntity) {
    await deleteUpdate(userId, projectId, path, source)
  }

  if (['existing-file', 'new-file'].includes(fileType)) {
    await _processFile(projectId, fsPath, path, source, userId)
  } else if (['existing-doc', 'new-doc'].includes(fileType)) {
    await _processDoc(projectId, userId, fsPath, path, source)
  } else {
    throw new Error('unrecognized file')
  }
}

async function deleteUpdate(userId, projectId, path, source) {
  try {
    await EditorController.promises.deleteEntityWithPath(
      projectId,
      path,
      source,
      userId
    )
  } catch (err) {
    logger.warn(
      { err, userId, projectId, path, source },
      'failed to delete entity'
    )
  }
}

async function _processDoc(projectId, userId, fsPath, path, source) {
  const docLines = await _readFileIntoTextArray(fsPath)
  logger.debug({ docLines }, 'processing doc update from tpds')
  await EditorController.promises.upsertDocWithPath(
    projectId,
    path,
    docLines,
    source,
    userId
  )
}

async function _processFile(projectId, fsPath, path, source, userId) {
  await EditorController.promises.upsertFileWithPath(
    projectId,
    path,
    fsPath,
    null,
    source,
    userId
  )
}

async function _readFileIntoTextArray(path) {
  let content = await fsPromises.readFile(path, 'utf8')
  if (content == null) {
    content = ''
  }
  const lines = content.split(/\r\n|\n|\r/)
  return lines
}

module.exports = {
  mergeUpdate: callbackify(mergeUpdate),
  _mergeUpdate: callbackify(_mergeUpdate),
  deleteUpdate: callbackify(deleteUpdate),
  promises: {
    mergeUpdate,
    _mergeUpdate, // called by GitBridgeHandler
    deleteUpdate,
  },
}
