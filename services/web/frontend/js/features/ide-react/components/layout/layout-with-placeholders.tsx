import { useState } from 'react'
import PlaceholderHeader from '@/features/ide-react/components/layout/placeholder/placeholder-header'
import PlaceholderChat from '@/features/ide-react/components/layout/placeholder/placeholder-chat'
import PlaceholderHistory from '@/features/ide-react/components/layout/placeholder/placeholder-history'
import PlaceholderEditorMainContent from '@/features/ide-react/components/layout/placeholder/placeholder-editor-main-content'
import MainLayout from '@/features/ide-react/components/layout/main-layout'

export default function LayoutWithPlaceholders({
  shouldPersistLayout,
}: {
  shouldPersistLayout: boolean
}) {
  const [chatIsOpen, setChatIsOpen] = useState(false)
  const [historyIsOpen, setHistoryIsOpen] = useState(false)
  const [leftColumnDefaultSize, setLeftColumnDefaultSize] = useState(20)

  const headerContent = (
    <PlaceholderHeader
      chatIsOpen={chatIsOpen}
      setChatIsOpen={setChatIsOpen}
      historyIsOpen={historyIsOpen}
      setHistoryIsOpen={setHistoryIsOpen}
    />
  )
  const chatContent = <PlaceholderChat />
  const mainContent = historyIsOpen ? (
    <PlaceholderHistory
      shouldPersistLayout
      leftColumnDefaultSize={leftColumnDefaultSize}
      setLeftColumnDefaultSize={setLeftColumnDefaultSize}
    />
  ) : (
    <PlaceholderEditorMainContent
      shouldPersistLayout
      leftColumnDefaultSize={leftColumnDefaultSize}
      setLeftColumnDefaultSize={setLeftColumnDefaultSize}
    />
  )

  return (
    <MainLayout
      headerContent={headerContent}
      chatContent={chatContent}
      mainContent={mainContent}
      chatIsOpen={chatIsOpen}
      shouldPersistLayout={shouldPersistLayout}
    />
  )
}
