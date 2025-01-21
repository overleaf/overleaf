import { findInTreeOrThrow } from '../util/find-in-tree'
import { Folder } from '../../../../../types/folder'
import { Doc } from '../../../../../types/doc'
import { FileRef } from '../../../../../types/file-ref'

export function isNameUniqueInFolder(
  tree: Folder,
  parentFolderId: string,
  name: string
): boolean {
  return !(
    findFileByNameInFolder(tree, parentFolderId, name) ||
    findFolderByNameInFolder(tree, parentFolderId, name)
  )
}

export function findFileByNameInFolder(
  tree: Folder,
  parentFolderId: string,
  name: string
): Doc | FileRef | undefined {
  if (tree._id !== parentFolderId) {
    tree = findInTreeOrThrow(tree, parentFolderId).entity as Folder
  }

  return (
    tree.docs.find(entity => entity.name === name) ||
    tree.fileRefs.find(entity => entity.name === name)
  )
}

export function findFolderByNameInFolder(
  tree: Folder,
  parentFolderId: string,
  name: string
): Folder | undefined {
  if (tree._id !== parentFolderId) {
    tree = findInTreeOrThrow(tree, parentFolderId).entity as Folder
  }

  return tree.folders.find(entity => entity.name === name)
}
