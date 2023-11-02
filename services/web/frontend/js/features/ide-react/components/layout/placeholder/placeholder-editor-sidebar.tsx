import React from 'react'
import { Panel, PanelGroup } from 'react-resizable-panels'
import { VerticalResizeHandle } from '@/features/ide-react/components/resize/vertical-resize-handle'

type PlaceholderEditorSidebarProps = {
  shouldPersistLayout: boolean
}

export default function PlaceholderEditorSidebar({
  shouldPersistLayout,
}: PlaceholderEditorSidebarProps) {
  return (
    <aside className="ide-react-editor-sidebar">
      <PanelGroup
        autoSaveId={
          shouldPersistLayout ? 'ide-react-editor-sidebar-layout' : undefined
        }
        direction="vertical"
      >
        <Panel defaultSize={75}>File tree placeholder</Panel>
        <VerticalResizeHandle />
        <Panel defaultSize={25}>File outline placeholder</Panel>
      </PanelGroup>
    </aside>
  )
}
