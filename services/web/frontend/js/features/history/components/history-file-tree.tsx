import _ from 'lodash'
import { useHistoryContext } from '../context/history-context'
import {
  fileTreeDiffToFileTreeData,
  reducePathsToTree,
} from '../utils/file-tree'
import HistoryFileTreeFolderList from './file-tree/history-file-tree-folder-list'

export default function HistoryFileTree() {
  const { files } = useHistoryContext().selection

  const fileTree = _.reduce(files, reducePathsToTree, [])

  const mappedFileTree = fileTreeDiffToFileTreeData(fileTree)

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
