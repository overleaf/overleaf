import { Panel, PanelGroup } from 'react-resizable-panels'
import { useState } from 'react'
import { HorizontalResizeHandle } from '../resize/horizontal-resize-handle'
import useFixedSizeColumn from '@/features/ide-react/hooks/use-fixed-size-column'
import useCollapsiblePanel from '@/features/ide-react/hooks/use-collapsible-panel'
import classNames from 'classnames'
import { useLayoutContext } from '@/shared/context/layout-context'
import EditorNavigationToolbar from '@/features/ide-react/components/editor-navigation-toolbar'
import ChatPane from '@/features/chat/components/chat-pane'
import { EditorAndSidebar } from '@/features/ide-react/components/editor-and-sidebar'

const CHAT_DEFAULT_SIZE = 20

// The main area below the header is split into two: the main content and chat.
// The reason for not splitting the left column containing the file tree and
// outline here is that the history view has its own file tree, so it is more
// convenient to replace the whole of the main content when in history view.
export default function MainLayout() {
  const { chatIsOpen } = useLayoutContext()

  const { fixedPanelRef: chatPanelRef, handleLayout } = useFixedSizeColumn(
    CHAT_DEFAULT_SIZE,
    chatIsOpen
  )

  useCollapsiblePanel(chatIsOpen, chatPanelRef)

  const [resizing, setResizing] = useState(false)

  return (
    <div className="ide-react-main">
      <EditorNavigationToolbar />
      <div className="ide-react-body">
        <PanelGroup
          autoSaveId="ide-react-chat-layout"
          direction="horizontal"
          onLayout={handleLayout}
          className={classNames({
            'ide-react-main-resizing': resizing,
          })}
        >
          <Panel id="main" order={1}>
            <EditorAndSidebar />
          </Panel>
          {chatIsOpen ? (
            <>
              <HorizontalResizeHandle onDragging={setResizing} />
              <Panel
                ref={chatPanelRef}
                id="chat"
                order={2}
                defaultSize={CHAT_DEFAULT_SIZE}
                minSize={5}
                collapsible
              >
                <ChatPane />
              </Panel>
            </>
          ) : null}
        </PanelGroup>
      </div>
    </div>
  )
}
