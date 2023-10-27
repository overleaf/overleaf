import React, { useCallback, useState } from 'react'
import TwoColumnMainContent from '@/features/ide-react/components/layout/two-column-main-content'
import Editor from '@/features/ide-react/components/editor/editor'
import EditorSidebar from '@/features/ide-react/components/editor-sidebar'
import customLocalStorage from '@/infrastructure/local-storage'
import History from '@/features/ide-react/components/history'
import { HistoryProvider } from '@/features/history/context/history-context'
import { useProjectContext } from '@/shared/context/project-context'
import { useLayoutContext } from '@/shared/context/layout-context'
import { FileTreeFindResult } from '@/features/ide-react/types/file-tree'

type EditorAndSidebarProps = {
  shouldPersistLayout: boolean
  leftColumnDefaultSize: number
  setLeftColumnDefaultSize: React.Dispatch<React.SetStateAction<number>>
}

export function EditorAndSidebar({
  shouldPersistLayout,
  leftColumnDefaultSize,
  setLeftColumnDefaultSize,
}: EditorAndSidebarProps) {
  const [leftColumnIsOpen, setLeftColumnIsOpen] = useState(true)
  const { rootDocId, _id: projectId } = useProjectContext()
  const { view } = useLayoutContext()
  const historyIsOpen = view === 'history'

  const [openDocId, setOpenDocId] = useState(
    () => customLocalStorage.getItem(`doc.open_id.${projectId}`) || rootDocId
  )
  const [fileTreeReady, setFileTreeReady] = useState(false)

  const handleFileTreeInit = useCallback(() => {
    setFileTreeReady(true)
  }, [])

  const handleFileTreeSelect = useCallback(
    (selectedEntities: FileTreeFindResult[]) => {
      const firstDocId =
        selectedEntities.find(result => result.type === 'doc')?.entity._id ||
        null
      setOpenDocId(firstDocId)
    },
    []
  )

  const leftColumnContent = (
    <EditorSidebar
      shouldPersistLayout={shouldPersistLayout}
      onFileTreeInit={handleFileTreeInit}
      onFileTreeSelect={handleFileTreeSelect}
    />
  )

  const rightColumnContent = (
    <>
      {/* Recreate the history context when the history view is toggled */}
      {historyIsOpen && (
        <HistoryProvider>
          <History />
        </HistoryProvider>
      )}
      <Editor
        shouldPersistLayout={shouldPersistLayout}
        openDocId={openDocId}
        fileTreeReady={fileTreeReady}
      />
    </>
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
