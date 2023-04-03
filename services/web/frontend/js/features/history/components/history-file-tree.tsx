import _ from 'lodash'
import { useCallback } from 'react'
import { useHistoryContext } from '../context/history-context'
import { HistoryFileTreeSelectableProvider } from '../context/history-file-tree-selectable'
import {
  fileTreeDiffToFileTreeData,
  reducePathsToTree,
} from '../utils/file-tree'
import HistoryFileTreeFolderList from './file-tree/history-file-tree-folder-list'

export default function HistoryFileTree() {
  const { fileSelection, setFileSelection } = useHistoryContext()

  const handleSelectFile = useCallback(
    (pathname: string) => {
      if (fileSelection) {
        setFileSelection({ files: fileSelection.files, pathname })
      }
    },
    [fileSelection, setFileSelection]
  )

  if (!fileSelection) {
    return null
  }

  const fileTree = _.reduce(fileSelection.files, reducePathsToTree, [])

  const mappedFileTree = fileTreeDiffToFileTreeData(fileTree)

  return (
    <HistoryFileTreeSelectableProvider onSelectFile={handleSelectFile}>
      <HistoryFileTreeFolderList
        folders={mappedFileTree.folders}
        docs={mappedFileTree.docs ?? []}
        rootClassName="file-tree-list"
      >
        <li className="bottom-buffer" />
      </HistoryFileTreeFolderList>
    </HistoryFileTreeSelectableProvider>
  )
}
