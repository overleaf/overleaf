import React, { useState } from 'react'
import TwoColumnMainContent from '@/features/ide-react/components/layout/two-column-main-content'
import PlaceholderEditorAndPdf from '@/features/ide-react/components/layout/placeholder/placeholder-editor-and-pdf'
import PlaceholderEditorSidebar from '@/features/ide-react/components/layout/placeholder/placeholder-editor-sidebar'

type PlaceholderEditorMainContentProps = {
  shouldPersistLayout: boolean
  leftColumnDefaultSize: number
  setLeftColumnDefaultSize: React.Dispatch<React.SetStateAction<number>>
}

export default function PlaceholderEditorMainContent({
  shouldPersistLayout,
  leftColumnDefaultSize,
  setLeftColumnDefaultSize,
}: PlaceholderEditorMainContentProps) {
  const [leftColumnIsOpen, setLeftColumnIsOpen] = useState(true)

  const leftColumnContent = (
    <PlaceholderEditorSidebar shouldPersistLayout={shouldPersistLayout} />
  )
  const rightColumnContent = (
    <PlaceholderEditorAndPdf shouldPersistLayout={shouldPersistLayout} />
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
