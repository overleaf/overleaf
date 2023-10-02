import { Panel, PanelGroup } from 'react-resizable-panels'
import { ReactNode } from 'react'
import { HorizontalResizeHandle } from '../resize/horizontal-resize-handle'
import useFixedSizeColumn from '@/features/ide-react/hooks/use-fixed-size-column'
import useCollapsiblePanel from '@/features/ide-react/hooks/use-collapsible-panel'

const CHAT_DEFAULT_SIZE = 20

type PageProps = {
  headerContent: ReactNode
  chatContent: ReactNode
  mainContent: ReactNode
  chatIsOpen: boolean
  shouldPersistLayout: boolean
}

// The main area below the header is split into two: the main content and chat.
// The reason for not splitting the left column containing the file tree and
// outline here is that the history view has its own file tree, so it is more
// convenient to replace the whole of the main content when in history view.
export default function MainLayout({
  headerContent,
  chatContent,
  mainContent,
  chatIsOpen,
  shouldPersistLayout,
}: PageProps) {
  const { fixedPanelRef: chatPanelRef, handleLayout } = useFixedSizeColumn(
    CHAT_DEFAULT_SIZE,
    chatIsOpen
  )

  useCollapsiblePanel(chatIsOpen, chatPanelRef)

  return (
    <div className="ide-react-main">
      {headerContent}
      <div className="ide-react-body">
        <PanelGroup
          autoSaveId={shouldPersistLayout ? 'ide-react-chat-layout' : undefined}
          direction="horizontal"
          onLayout={handleLayout}
        >
          <Panel id="main" order={1}>
            {mainContent}
          </Panel>
          {chatIsOpen ? (
            <>
              <HorizontalResizeHandle />
              <Panel
                ref={chatPanelRef}
                id="chat"
                order={2}
                defaultSize={CHAT_DEFAULT_SIZE}
                minSize={5}
                collapsible
              >
                {chatContent}
              </Panel>
            </>
          ) : null}
        </PanelGroup>
      </div>
    </div>
  )
}
