import { Panel, PanelGroup } from 'react-resizable-panels'
import { FileTree } from '@/features/ide-react/components/file-tree'
import { OutlineContainer } from '@/features/outline/components/outline-container'
import { VerticalResizeHandle } from '@/features/ide-react/components/resize/vertical-resize-handle'
import { useOutlinePane } from '@/features/ide-react/hooks/use-outline-pane'

function FileTreeOutlinePanel() {
  const { outlineEnabled, outlinePanelRef } = useOutlinePane()

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
      <VerticalResizeHandle
        hitAreaMargins={{ coarse: 0, fine: 0 }}
        disabled={!outlineEnabled}
      />
      <Panel
        defaultSize={50}
        maxSize={75}
        id="ide-redesign-file-outline"
        order={2}
        collapsible
        ref={outlinePanelRef}
        style={{ minHeight: 36 }} // keep the header visible
      >
        <OutlineContainer />
      </Panel>
    </PanelGroup>
  )
}

export default FileTreeOutlinePanel
