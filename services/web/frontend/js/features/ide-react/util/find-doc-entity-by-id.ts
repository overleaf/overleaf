import { findInTree } from '@/features/file-tree/util/find-in-tree'
import { Folder } from '../../../../../types/folder'
import { Doc } from '../../../../../types/doc'
import { FileRef } from '../../../../../types/file-ref'

export function findDocEntityById(fileTreeData: Folder, docId: string) {
  const item = findInTree(fileTreeData, docId)
  if (!item || item.type !== 'doc') {
    return null
  }
  return item.entity as Doc
}

export function findFileRefEntityById(fileTreeData: Folder, docId: string) {
  const item = findInTree(fileTreeData, docId)
  if (!item || item.type !== 'fileRef') {
    return null
  }
  return item.entity as FileRef
}
