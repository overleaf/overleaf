import { findInTree } from '../util/find-in-tree'

export function isNameUniqueInFolder(tree, parentFolderId, name) {
  if (tree._id !== parentFolderId) {
    tree = findInTree(tree, parentFolderId).entity
  }

  if (tree.docs.some(entity => entity.name === name)) return false
  if (tree.fileRefs.some(entity => entity.name === name)) return false
  if (tree.folders.some(entity => entity.name === name)) return false

  return true
}
