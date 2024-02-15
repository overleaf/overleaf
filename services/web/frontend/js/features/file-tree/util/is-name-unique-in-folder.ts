import { findInTree } from '../util/find-in-tree'
import { Folder } from '../../../../../types/folder'
import { Doc } from '../../../../../types/doc'
import { FileRef } from '../../../../../types/file-ref'

export function isNameUniqueInFolder(
  tree: Folder,
  parentFolderId: string,
  name: string
): boolean {
  return !findByNameInFolder(tree, parentFolderId, name)
}

export function findByNameInFolder(
  tree: Folder,
  parentFolderId: string,
  name: string
): Doc | FileRef | Folder | undefined {
  if (tree._id !== parentFolderId) {
    tree = findInTree(tree, parentFolderId).entity
  }

  return (
    tree.docs.find(entity => entity.name === name) ||
    tree.fileRefs.find(entity => entity.name === name) ||
    tree.folders.find(entity => entity.name === name)
  )
}
