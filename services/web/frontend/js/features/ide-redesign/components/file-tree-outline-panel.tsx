import { Panel, PanelGroup } from 'react-resizable-panels'
import { FileTree } from '@/features/ide-react/components/file-tree'
import { OutlineContainer } from '@/features/outline/components/outline-container'
import { VerticalResizeHandle } from '@/features/ide-react/components/resize/vertical-resize-handle'
import { useOutlinePane } from '@/features/ide-react/hooks/use-outline-pane'
import useCollapsibleFileTree from '../hooks/use-collapsible-file-tree'
import classNames from 'classnames'

function FileTreeOutlinePanel() {
  const { outlineEnabled, outlinePanelRef } = useOutlinePane()
  const { fileTreeExpanded, fileTreePanelRef } = useCollapsibleFileTree()

  return (
    <PanelGroup
      className="file-tree-outline-panel-group"
      autoSaveId="ide-redesign-file-tree-outline"
      direction="vertical"
    >
      <Panel
        className={classNames('file-tree-panel', {
          'file-tree-panel-collapsed': !fileTreeExpanded,
        })}
        defaultSize={50}
        id="ide-redesign-file-tree"
        order={1}
        collapsible
        ref={fileTreePanelRef}
      >
        <FileTree />
      </Panel>
      <VerticalResizeHandle
        hitAreaMargins={{ coarse: 0, fine: 0 }}
        disabled={!outlineEnabled || !fileTreeExpanded}
      />
      <Panel
        className="file-outline-panel"
        defaultSize={50}
        id="ide-redesign-file-outline"
        order={2}
        collapsible
        ref={outlinePanelRef}
      >
        <OutlineContainer />
      </Panel>
    </PanelGroup>
  )
}

export default FileTreeOutlinePanel
