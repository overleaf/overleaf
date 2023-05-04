import { orderBy, reduce } from 'lodash'
import { useHistoryContext } from '../context/history-context'
import {
  fileTreeDiffToFileTreeData,
  reducePathsToTree,
} from '../utils/file-tree'
import HistoryFileTreeFolderList from './file-tree/history-file-tree-folder-list'

export default function HistoryFileTree() {
  const { selection, error } = useHistoryContext()

  const fileTree = reduce(selection.files, reducePathsToTree, [])

  const sortedFileTree = orderBy(fileTree, ['-type', 'operation', 'name'])

  const mappedFileTree = fileTreeDiffToFileTreeData(sortedFileTree)

  return error ? null : (
    <HistoryFileTreeFolderList
      folders={mappedFileTree.folders}
      docs={mappedFileTree.docs ?? []}
      rootClassName="history-file-tree-list"
    >
      <li className="bottom-buffer" />
    </HistoryFileTreeFolderList>
  )
}
