export function findInTreeOrThrow(tree, id) {
  const found = findInTree(tree, id)
  if (found) return found
  throw new Error(`Entity not found with id=${id}`)
}

export function findAllInTreeOrThrow(tree, ids) {
  let list = new Set()
  ids.forEach(id => {
    list.add(findInTreeOrThrow(tree, id))
  })
  return list
}

export function findAllFolderIdsInFolder(folder) {
  const list = new Set([folder._id])
  for (const index in folder.folders) {
    const subFolder = folder.folders[index]
    findAllFolderIdsInFolder(subFolder).forEach(subFolderId => {
      list.add(subFolderId)
    })
  }
  return list
}

export function findAllFolderIdsInFolders(folders) {
  let list = new Set()
  folders.forEach(folder => {
    findAllFolderIdsInFolder(folder).forEach(folderId => {
      list.add(folderId)
    })
  })
  return list
}

export function findInTree(tree, id, path) {
  if (!path) {
    path = [tree._id]
  }
  for (const index in tree.docs) {
    const doc = tree.docs[index]
    if (doc._id === id) {
      return {
        entity: doc,
        type: 'doc',
        parent: tree.docs,
        parentFolderId: tree._id,
        path,
        index
      }
    }
  }

  for (const index in tree.fileRefs) {
    const file = tree.fileRefs[index]
    if (file._id === id) {
      return {
        entity: file,
        type: 'fileRef',
        parent: tree.fileRefs,
        parentFolderId: tree._id,
        path,
        index
      }
    }
  }

  for (const index in tree.folders) {
    const folder = tree.folders[index]
    if (folder._id === id) {
      return {
        entity: folder,
        type: 'folder',
        parent: tree.folders,
        parentFolderId: tree._id,
        path,
        index
      }
    }
    const found = findInTree(folder, id, path.concat(folder._id))
    if (found) return found
  }
  return null
}
