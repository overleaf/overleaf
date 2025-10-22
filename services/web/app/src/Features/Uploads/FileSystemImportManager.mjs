import fs from 'node:fs'
import Path from 'node:path'
import { callbackify } from 'node:util'
import EditorController from '../Editor/EditorController.mjs'
import Errors from '../Errors/Errors.js'
import FileTypeManager from './FileTypeManager.mjs'
import SafePath from '../Project/SafePath.mjs'
import logger from '@overleaf/logger'

export default {
  addEntity: callbackify(addEntity),
  importDir: callbackify(importDir),
  importFile: callbackify(importDir),
  promises: {
    addEntity,
    importDir,
    importFile,
  },
}

async function addDoc(userId, projectId, folderId, name, lines, replace) {
  if (replace) {
    const doc = await EditorController.promises.upsertDoc(
      projectId,
      folderId,
      name,
      lines,
      'upload',
      userId
    )
    return doc
  } else {
    const doc = await EditorController.promises.addDoc(
      projectId,
      folderId,
      name,
      lines,
      'upload',
      userId
    )
    return doc
  }
}

async function addFile(userId, projectId, folderId, name, path, replace) {
  if (replace) {
    const file = await EditorController.promises.upsertFile(
      projectId,
      folderId,
      name,
      path,
      null,
      'upload',
      userId
    )
    return file
  } else {
    const file = await EditorController.promises.addFile(
      projectId,
      folderId,
      name,
      path,
      null,
      'upload',
      userId
    )
    return file
  }
}

async function addFolder(userId, projectId, folderId, name, path, replace) {
  const newFolder = await EditorController.promises.addFolder(
    projectId,
    folderId,
    name,
    'upload',
    userId
  )
  await addFolderContents(userId, projectId, newFolder._id, path, replace)
  return newFolder
}

async function addFolderContents(
  userId,
  projectId,
  parentFolderId,
  folderPath,
  replace
) {
  if (!(await _isSafeOnFileSystem(folderPath))) {
    logger.debug(
      { userId, projectId, parentFolderId, folderPath },
      'add folder contents is from symlink, stopping insert'
    )
    throw new Error('path is symlink')
  }
  const entries = (await fs.promises.readdir(folderPath)) || []
  for (const entry of entries) {
    if (FileTypeManager.shouldIgnore(entry)) {
      continue
    }
    await addEntity(
      userId,
      projectId,
      parentFolderId,
      entry,
      `${folderPath}/${entry}`,
      replace
    )
  }
}

async function addEntity(userId, projectId, folderId, name, fsPath, replace) {
  if (!(await _isSafeOnFileSystem(fsPath))) {
    logger.debug(
      { userId, projectId, folderId, fsPath },
      'add entry is from symlink, stopping insert'
    )
    throw new Error('path is symlink')
  }

  if (await FileTypeManager.promises.isDirectory(fsPath)) {
    const newFolder = await addFolder(
      userId,
      projectId,
      folderId,
      name,
      fsPath,
      replace
    )
    return newFolder
  }

  // Here, we cheat a little bit and provide the project path relative to the
  // folder, not the root of the project. This is because we don't know for sure
  // at this point what the final path of the folder will be. The project path
  // is still important for importFile() to be able to figure out if the file is
  // a binary file or an editable document.
  const projectPath = Path.join('/', name)
  const importInfo = await importFile(fsPath, projectPath)
  switch (importInfo.type) {
    case 'file': {
      const entity = await addFile(
        userId,
        projectId,
        folderId,
        name,
        importInfo.fsPath,
        replace
      )
      if (entity != null) {
        entity.type = 'file'
      }
      return entity
    }
    case 'doc': {
      const entity = await addDoc(
        userId,
        projectId,
        folderId,
        name,
        importInfo.lines,
        replace
      )
      if (entity != null) {
        entity.type = 'doc'
      }
      return entity
    }
    default: {
      throw new Error(`unknown import type: ${importInfo.type}`)
    }
  }
}

async function _isSafeOnFileSystem(path) {
  // Use lstat() to ensure we don't follow symlinks. Symlinks from an
  // untrusted source are dangerous.
  const stat = await fs.promises.lstat(path)
  return stat.isFile() || stat.isDirectory()
}

async function importFile(fsPath, projectPath) {
  const stat = await fs.promises.lstat(fsPath)
  if (!stat.isFile()) {
    throw new Error(`can't import ${fsPath}: not a regular file`)
  }
  _validateProjectPath(projectPath)
  const filename = Path.basename(projectPath)

  const { binary, encoding } = await FileTypeManager.promises.getType(
    filename,
    fsPath,
    null
  )
  if (binary) {
    return new FileImport(projectPath, fsPath)
  } else {
    const content = await fs.promises.readFile(fsPath, encoding)
    // Handle Unix, DOS and classic Mac newlines
    const lines = content.split(/\r\n|\n|\r/)
    return new DocImport(projectPath, lines)
  }
}

async function importDir(dirPath) {
  const stat = await fs.promises.lstat(dirPath)
  if (!stat.isDirectory()) {
    throw new Error(`can't import ${dirPath}: not a directory`)
  }
  const entries = []
  for await (const filePath of _walkDir(dirPath)) {
    const projectPath = Path.join('/', Path.relative(dirPath, filePath))
    const importInfo = await importFile(filePath, projectPath)
    entries.push(importInfo)
  }
  return entries
}

function _validateProjectPath(path) {
  if (!SafePath.isAllowedLength(path) || !SafePath.isCleanPath(path)) {
    throw new Errors.InvalidNameError(`Invalid path: ${path}`)
  }
}

async function* _walkDir(dirPath) {
  const entries = await fs.promises.readdir(dirPath)
  for (const entry of entries) {
    const entryPath = Path.join(dirPath, entry)
    if (FileTypeManager.shouldIgnore(entryPath)) {
      continue
    }

    // Use lstat() to ensure we don't follow symlinks. Symlinks from an
    // untrusted source are dangerous.
    const stat = await fs.promises.lstat(entryPath)
    if (stat.isFile()) {
      yield entryPath
    } else if (stat.isDirectory()) {
      yield* _walkDir(entryPath)
    }
  }
}

class FileImport {
  constructor(projectPath, fsPath) {
    this.type = 'file'
    this.projectPath = projectPath
    this.fsPath = fsPath
  }
}

class DocImport {
  constructor(projectPath, lines) {
    this.type = 'doc'
    this.projectPath = projectPath
    this.lines = lines
  }
}
