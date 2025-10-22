import { callbackify } from 'node:util'
import _ from 'lodash'
import fsPromises from 'node:fs/promises'
import fs from 'node:fs'
import logger from '@overleaf/logger'
import EditorController from '../Editor/EditorController.mjs'
import FileTypeManager from '../Uploads/FileTypeManager.mjs'
import ProjectEntityHandler from '../Project/ProjectEntityHandler.mjs'
import crypto from 'node:crypto'
import Settings from '@overleaf/settings'
import { pipeline } from 'node:stream/promises'

async function mergeUpdate(userId, projectId, path, updateRequest, source) {
  const fsPath = await writeUpdateToDisk(projectId, updateRequest)

  try {
    // note: important to await here so file reading finishes before cleaning up below
    return await _mergeUpdate(userId, projectId, path, fsPath, source)
  } finally {
    // note: not awaited or thrown
    fsPromises.unlink(fsPath).catch(err => {
      logger.err({ err, projectId, fsPath }, 'error deleting file')
    })
  }
}

async function writeUpdateToDisk(projectId, updateStream) {
  const fsPath = `${
    Settings.path.dumpFolder
  }/${projectId}_${crypto.randomUUID()}`
  const writeStream = fs.createWriteStream(fsPath)
  try {
    await pipeline(updateStream, writeStream)
  } catch (err) {
    try {
      await fsPromises.unlink(fsPath)
    } catch (err) {
      logger.error({ err, projectId, fsPath }, 'error deleting file')
    }
    throw err
  }
  return fsPath
}

async function _findExistingFileType(projectId, path) {
  const { docs, files } =
    await ProjectEntityHandler.promises.getAllEntities(projectId)
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

  // Existing | Update    | Resulting file type
  // ---------|-----------|--------------------
  // file     | isBinary  | file
  // file     | !isBinary | file
  // doc      | isBinary  | file
  // doc      | !isBinary | doc
  // null     | isBinary  | file
  // null     | !isBinary | doc

  // if a binary file already exists, always keep it as a binary file
  // even if the update looks like a text file
  if (existingFileType === 'file') {
    return 'file'
  } else {
    return isBinary ? 'file' : 'doc'
  }
}

async function _mergeUpdate(userId, projectId, path, fsPath, source) {
  const fileType = await _determineFileType(projectId, path, fsPath)

  if (fileType === 'file') {
    const { file, folder } = await _processFile(
      projectId,
      fsPath,
      path,
      source,
      userId
    )
    return {
      projectId,
      entityType: 'file',
      entityId: file._id,
      rev: file.rev,
      folderId: folder._id,
    }
  } else if (fileType === 'doc') {
    const { doc, folder } = await _processDoc(
      projectId,
      userId,
      fsPath,
      path,
      source
    )
    return {
      projectId,
      entityType: 'doc',
      entityId: doc._id,
      rev: doc.rev,
      folderId: folder._id,
    }
  } else {
    throw new Error('unrecognized file')
  }
}

async function deleteUpdate(userId, projectId, path, source) {
  try {
    return await EditorController.promises.deleteEntityWithPath(
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
  const doc = await EditorController.promises.upsertDocWithPath(
    projectId,
    path,
    docLines,
    source,
    userId
  )
  return doc
}

async function _processFile(projectId, fsPath, path, source, userId) {
  const { file, folder } = await EditorController.promises.upsertFileWithPath(
    projectId,
    path,
    fsPath,
    null,
    source,
    userId
  )
  return { file, folder }
}

async function _readFileIntoTextArray(path) {
  let content = await fsPromises.readFile(path, 'utf8')
  if (content == null) {
    content = ''
  }
  const lines = content.split(/\r\n|\n|\r/)
  return lines
}

async function createFolder(projectId, path, userId) {
  const { lastFolder: folder } = await EditorController.promises.mkdirp(
    projectId,
    path,
    userId
  )
  return folder
}

export default {
  mergeUpdate: callbackify(mergeUpdate),
  _mergeUpdate: callbackify(_mergeUpdate),
  deleteUpdate: callbackify(deleteUpdate),
  createFolder: callbackify(createFolder),
  promises: {
    mergeUpdate,
    _mergeUpdate, // called by GitBridgeHandler
    deleteUpdate,
    createFolder,
  },
}
