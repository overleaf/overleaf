import { Panel, PanelGroup } from 'react-resizable-panels'
import { FileTree } from '@/features/ide-react/components/file-tree'
import { OutlineContainer } from '@/features/outline/components/outline-container'
import { VerticalResizeHandle } from '@/features/ide-react/components/resize/vertical-resize-handle'

function FileTreeOutlinePanel() {
  return (
    <PanelGroup
      autoSaveId="ide-redesign-file-tree-outline"
      direction="vertical"
    >
      <Panel
        defaultSize={50}
        minSize={25}
        id="ide-redesign-file-tree"
        order={1}
      >
        <FileTree />
      </Panel>
      <VerticalResizeHandle hitAreaMargins={{ coarse: 0, fine: 0 }} />
      <Panel
        defaultSize={50}
        maxSize={75}
        id="ide-redesign-file-outline"
        order={2}
      >
        <OutlineContainer />
      </Panel>
    </PanelGroup>
  )
}

export default FileTreeOutlinePanel
