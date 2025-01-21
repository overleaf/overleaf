import OError from '@overleaf/o-error'
import { Folder } from '../../../../../types/folder'
import { FileTreeFindResult } from '@/features/ide-react/types/file-tree'

export function findInTreeOrThrow(tree: Folder, id: string) {
  const found = findInTree(tree, id)
  if (found) return found
  throw new OError('Entity not found in tree', { entityId: id })
}

export function findAllInTreeOrThrow(
  tree: Folder,
  ids: Set<string>
): Set<FileTreeFindResult> {
  const list: Set<FileTreeFindResult> = new Set()
  ids.forEach(id => {
    list.add(findInTreeOrThrow(tree, id))
  })
  return list
}

export function findAllFolderIdsInFolder(folder: Folder): Set<string> {
  const list = new Set([folder._id])
  for (const index in folder.folders) {
    const subFolder = folder.folders[index]
    findAllFolderIdsInFolder(subFolder).forEach(subFolderId => {
      list.add(subFolderId)
    })
  }
  return list
}

export function findAllFolderIdsInFolders(folders: Set<Folder>): Set<string> {
  const list: Set<string> = new Set()
  folders.forEach(folder => {
    findAllFolderIdsInFolder(folder).forEach(folderId => {
      list.add(folderId)
    })
  })
  return list
}

export function findInTree(
  tree: Folder,
  id: string,
  path?: string[]
): FileTreeFindResult | null {
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
        index: Number(index),
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
        index: Number(index),
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
        index: Number(index),
      }
    }
    const found = findInTree(folder, id, path.concat(folder._id))
    if (found) return found
  }
  return null
}
