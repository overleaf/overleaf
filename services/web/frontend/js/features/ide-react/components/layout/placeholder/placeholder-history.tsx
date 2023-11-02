import React, { useState } from 'react'
import TwoColumnMainContent from '@/features/ide-react/components/layout/two-column-main-content'

type PlaceholderHistoryProps = {
  shouldPersistLayout: boolean
  leftColumnDefaultSize: number
  setLeftColumnDefaultSize: React.Dispatch<React.SetStateAction<number>>
}

export default function PlaceholderHistory({
  shouldPersistLayout,
  leftColumnDefaultSize,
  setLeftColumnDefaultSize,
}: PlaceholderHistoryProps) {
  const [leftColumnIsOpen, setLeftColumnIsOpen] = useState(true)

  const leftColumnContent = (
    <aside className="ide-react-editor-sidebar history-file-tree">
      History file tree placeholder
    </aside>
  )
  const rightColumnContent = (
    <div>History document diff viewer and versions list placeholder</div>
  )

  return (
    <TwoColumnMainContent
      leftColumnId="editor-left-column"
      leftColumnContent={leftColumnContent}
      leftColumnDefaultSize={leftColumnDefaultSize}
      setLeftColumnDefaultSize={setLeftColumnDefaultSize}
      rightColumnContent={rightColumnContent}
      leftColumnIsOpen={leftColumnIsOpen}
      setLeftColumnIsOpen={setLeftColumnIsOpen}
      shouldPersistLayout={shouldPersistLayout}
    />
  )
}
