import _ from 'lodash'
import { useHistoryContext } from '../context/history-context'
import {
  fileTreeDiffToFileTreeData,
  reducePathsToTree,
} from '../utils/file-tree'
import HistoryFileTreeFolderList from './file-tree/history-file-tree-folder-list'

export default function HistoryFileTree() {
  const { fileSelection } = useHistoryContext()

  if (!fileSelection) {
    return null
  }

  const fileTree = _.reduce(fileSelection.files, reducePathsToTree, [])

  const mappedFileTree = fileTreeDiffToFileTreeData(fileTree)

  return (
    <HistoryFileTreeFolderList
      folders={mappedFileTree.folders}
      docs={mappedFileTree.docs ?? []}
      rootClassName="file-tree-list"
    >
      <li className="bottom-buffer" />
    </HistoryFileTreeFolderList>
  )
}
