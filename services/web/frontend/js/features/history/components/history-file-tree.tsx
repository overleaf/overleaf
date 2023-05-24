import { useMemo } from 'react'
import { orderBy, reduce } from 'lodash'
import { useHistoryContext } from '../context/history-context'
import {
  fileTreeDiffToFileTreeData,
  reducePathsToTree,
} from '../utils/file-tree'
import HistoryFileTreeFolderList from './file-tree/history-file-tree-folder-list'

export default function HistoryFileTree() {
  const { selection } = useHistoryContext()

  const fileTree = useMemo(
    () => reduce(selection.files, reducePathsToTree, []),
    [selection.files]
  )

  const sortedFileTree = useMemo(
    () => orderBy(fileTree, ['-type', 'operation', 'name']),
    [fileTree]
  )

  const mappedFileTree = useMemo(
    () => fileTreeDiffToFileTreeData(sortedFileTree),
    [sortedFileTree]
  )

  return (
    <HistoryFileTreeFolderList
      folders={mappedFileTree.folders}
      docs={mappedFileTree.docs ?? []}
      rootClassName="history-file-tree-list"
    >
      <li className="bottom-buffer" />
    </HistoryFileTreeFolderList>
  )
}
