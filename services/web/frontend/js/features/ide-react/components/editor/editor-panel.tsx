import NoSelectionPane from '@/features/ide-react/components/editor/no-selection-pane'
import { Editor } from '@/features/ide-react/components/layout/editor'
import { useFileTreeOpenContext } from '@/features/ide-react/context/file-tree-open-context'
import FileView from '@/features/file-view/components/file-view'
import { fileViewFile } from '@/features/ide-react/util/file-view'
import MultipleSelectionPane from '@/features/ide-react/components/editor/multiple-selection-pane'
import { TabsContainer } from '@/features/source-editor/components/tabs/tabs-container'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'

export default function EditorPanel() {
  const { selectedEntityCount, openEntity } = useFileTreeOpenContext()
  const tabsEnabled = isSplitTestEnabled('editor-tabs')

  return (
    <div className="ide-redesign-editor-container">
      {tabsEnabled && <TabsContainer />}
      {selectedEntityCount === 0 && <NoSelectionPane />}
      {selectedEntityCount === 1 && openEntity?.type === 'fileRef' && (
        <FileView
          file={fileViewFile(openEntity.entity)}
          key={openEntity.entity._id}
        />
      )}
      {selectedEntityCount > 1 && (
        <MultipleSelectionPane selectedEntityCount={selectedEntityCount} />
      )}
      <Editor />
    </div>
  )
}
