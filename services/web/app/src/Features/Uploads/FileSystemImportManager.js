const fs = require('fs')
const { callbackify } = require('util')
const FileTypeManager = require('./FileTypeManager')
const EditorController = require('../Editor/EditorController')
const logger = require('logger-sharelatex')

module.exports = {
  addFolderContents: callbackify(addFolderContents),
  addEntity: callbackify(addEntity),
  promises: {
    addFolderContents,
    addEntity
  }
}

async function addDoc(
  userId,
  projectId,
  folderId,
  name,
  path,
  encoding,
  replace
) {
  if (!(await _isSafeOnFileSystem(path))) {
    logger.log(
      { userId, projectId, folderId, name, path },
      'add doc is from symlink, stopping process'
    )
    throw new Error('path is symlink')
  }
  let content = await fs.promises.readFile(path, encoding)
  content = content.replace(/\r\n?/g, '\n') // convert Windows line endings to unix. very old macs also created \r-separated lines
  const lines = content.split('\n')
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
  if (!(await _isSafeOnFileSystem(path))) {
    logger.log(
      { userId, projectId, folderId, name, path },
      'add file is from symlink, stopping insert'
    )
    throw new Error('path is symlink')
  }

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
  if (!(await _isSafeOnFileSystem(path))) {
    logger.log(
      { userId, projectId, folderId, path },
      'add folder is from symlink, stopping insert'
    )
    throw new Error('path is symlink')
  }
  const newFolder = await EditorController.promises.addFolder(
    projectId,
    folderId,
    name,
    'upload'
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
    logger.log(
      { userId, projectId, parentFolderId, folderPath },
      'add folder contents is from symlink, stopping insert'
    )
    throw new Error('path is symlink')
  }
  const entries = (await fs.promises.readdir(folderPath)) || []
  for (const entry of entries) {
    if (await FileTypeManager.promises.shouldIgnore(entry)) {
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

async function addEntity(userId, projectId, folderId, name, path, replace) {
  if (!(await _isSafeOnFileSystem(path))) {
    logger.log(
      { userId, projectId, folderId, path },
      'add entry is from symlink, stopping insert'
    )
    throw new Error('path is symlink')
  }

  if (await FileTypeManager.promises.isDirectory(path)) {
    const newFolder = await addFolder(
      userId,
      projectId,
      folderId,
      name,
      path,
      replace
    )
    return newFolder
  }
  const { binary, encoding } = await FileTypeManager.promises.getType(
    name,
    path
  )
  if (binary) {
    const entity = await addFile(
      userId,
      projectId,
      folderId,
      name,
      path,
      replace
    )
    if (entity != null) {
      entity.type = 'file'
    }
    return entity
  } else {
    const entity = await addDoc(
      userId,
      projectId,
      folderId,
      name,
      path,
      encoding,
      replace
    )
    if (entity != null) {
      entity.type = 'doc'
    }
    return entity
  }
}

async function _isSafeOnFileSystem(path) {
  const stat = await fs.promises.lstat(path)
  return stat.isFile() || stat.isDirectory()
}
