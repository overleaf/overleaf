import { findInTree } from '@/features/file-tree/util/find-in-tree'
import { Folder } from '../../../../../types/folder'
import { Doc } from '../../../../../types/doc'

export function findDocEntityById(fileTreeData: Folder, docId: string) {
  const item = findInTree(fileTreeData, docId)
  if (!item || item.type !== 'doc') {
    return null
  }
  return item.entity as Doc
}
