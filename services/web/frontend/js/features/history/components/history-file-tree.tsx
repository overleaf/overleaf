import _ from 'lodash'
import FileTreeContext from '../../file-tree/components/file-tree-context'
import FileTreeFolderList from '../../file-tree/components/file-tree-folder-list'
import { useHistoryContext } from '../context/history-context'
import {
  fileTreeDiffToFileTreeData,
  reducePathsToTree,
} from '../utils/file-tree'

type HistoryFileTreeProps = {
  setRefProviderEnabled: any
  setStartedFreeTrial: any
  reindexReferences: any
  onSelect: any
  refProviders: any
}

export default function HistoryFileTree({
  setRefProviderEnabled,
  setStartedFreeTrial,
  reindexReferences,
  onSelect,
  refProviders,
}: HistoryFileTreeProps) {
  const { fileSelection } = useHistoryContext()

  if (!fileSelection) {
    return null
  }

  const fileTree = _.reduce(fileSelection.files, reducePathsToTree, [])

  const mappedFileTree = fileTreeDiffToFileTreeData(fileTree)

  return (
    <FileTreeContext
      refProviders={refProviders}
      setRefProviderEnabled={setRefProviderEnabled}
      setStartedFreeTrial={setStartedFreeTrial}
      reindexReferences={reindexReferences}
      onSelect={onSelect}
    >
      <FileTreeFolderList
        folders={mappedFileTree.folders}
        docs={mappedFileTree.docs ?? []}
        files={[]}
        classes={{ root: 'file-tree-list' }}
      >
        <li className="bottom-buffer" />
      </FileTreeFolderList>
    </FileTreeContext>
  )
}
