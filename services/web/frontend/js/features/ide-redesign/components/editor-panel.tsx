import NoSelectionPane from '@/features/ide-react/components/editor/no-selection-pane'
import { Editor } from './editor'
import { useFileTreeOpenContext } from '@/features/ide-react/context/file-tree-open-context'
import FileView from '@/features/file-view/components/file-view'
import { fileViewFile } from '@/features/ide-react/util/file-view'
import MultipleSelectionPane from '@/features/ide-react/components/editor/multiple-selection-pane'

export default function EditorPanel() {
  const { selectedEntityCount, openEntity } = useFileTreeOpenContext()

  return (
    <div className="ide-redesign-editor-container">
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
