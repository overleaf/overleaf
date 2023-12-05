import React from 'react'
import { Panel, PanelGroup } from 'react-resizable-panels'
import { VerticalResizeHandle } from '@/features/ide-react/components/resize/vertical-resize-handle'
import { FileTree } from '@/features/ide-react/components/file-tree'
import {
  FileTreeDeleteHandler,
  FileTreeSelectHandler,
} from '@/features/ide-react/types/file-tree'
import classNames from 'classnames'

type EditorSidebarProps = {
  shouldShow?: boolean
  onFileTreeInit: () => void
  onFileTreeSelect: FileTreeSelectHandler
  onFileTreeDelete: FileTreeDeleteHandler
}

export default function EditorSidebar({
  shouldShow = false,
  onFileTreeInit,
  onFileTreeSelect,
  onFileTreeDelete,
}: EditorSidebarProps) {
  return (
    <aside
      className={classNames('ide-react-editor-sidebar', {
        hidden: !shouldShow,
      })}
    >
      <PanelGroup autoSaveId="ide-editor-sidebar-layout" direction="vertical">
        <Panel
          defaultSizePercentage={75}
          className="ide-react-file-tree-panel"
          id="panel-file-tree"
        >
          <FileTree
            onInit={onFileTreeInit}
            onSelect={onFileTreeSelect}
            onDelete={onFileTreeDelete}
          />
        </Panel>
        <VerticalResizeHandle />
        <Panel defaultSizePercentage={25} id="panel-outline">
          <div className="outline-container" />
        </Panel>
      </PanelGroup>
    </aside>
  )
}
