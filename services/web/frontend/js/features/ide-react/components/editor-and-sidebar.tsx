import React, { useCallback, useEffect, useRef, useState } from 'react'
import TwoColumnMainContent from '@/features/ide-react/components/layout/two-column-main-content'
import EditorSidebar from '@/features/ide-react/components/editor-sidebar'
import History from '@/features/ide-react/components/history'
import { HistoryProvider } from '@/features/history/context/history-context'
import { useProjectContext } from '@/shared/context/project-context'
import { useLayoutContext } from '@/shared/context/layout-context'
import {
  FileTreeDeleteHandler,
  FileTreeDocumentFindResult,
  FileTreeFileRefFindResult,
  FileTreeFindResult,
} from '@/features/ide-react/types/file-tree'
import usePersistedState from '@/shared/hooks/use-persisted-state'
import FileView from '@/features/file-view/components/file-view'
import { FileRef } from '../../../../../types/file-ref'
import { EditorPane } from '@/features/ide-react/components/editor/editor-pane'
import EditorAndPdf from '@/features/ide-react/components/editor-and-pdf'
import MultipleSelectionPane from '@/features/ide-react/components/editor/multiple-selection-pane'
import NoSelectionPane from '@/features/ide-react/components/editor/no-selection-pane'
import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import NoOpenDocPane from '@/features/ide-react/components/editor/no-open-doc-pane'
import { debugConsole } from '@/utils/debugging'
import { HistorySidebar } from '@/features/ide-react/components/history-sidebar'

type EditorAndSidebarProps = {
  shouldPersistLayout: boolean
  leftColumnDefaultSize: number
  setLeftColumnDefaultSize: React.Dispatch<React.SetStateAction<number>>
}

// `FileViewHeader`, which is TypeScript, expects a BinaryFile, which has a
// `created` property of type `Date`, while `TPRFileViewInfo`, written in JS,
// into which `FileViewHeader` passes its BinaryFile, expects a file object with
// `created` property of type `string`, which is a mismatch. `TPRFileViewInfo`
// is the only one making runtime complaints and it seems that other uses of
// `FileViewHeader` pass in a string for `created`, so that's what this function
// does too.
function fileViewFile(fileRef: FileRef) {
  return {
    _id: fileRef._id,
    name: fileRef.name,
    id: fileRef._id,
    type: 'file',
    selected: true,
    linkedFileData: fileRef.linkedFileData,
    created: fileRef.created,
  }
}

export function EditorAndSidebar({
  shouldPersistLayout,
  leftColumnDefaultSize,
  setLeftColumnDefaultSize,
}: EditorAndSidebarProps) {
  const [leftColumnIsOpen, setLeftColumnIsOpen] = useState(true)
  const { rootDocId, _id: projectId } = useProjectContext()
  const { eventEmitter } = useIdeReactContext()
  const { openDocId: openDocWithId, currentDocumentId } =
    useEditorManagerContext()
  const { view } = useLayoutContext()
  const historyIsOpen = view === 'history'

  // Persist the open document ID in local storage
  const [openDocId, setOpenDocId] = usePersistedState(
    `doc.open_id.${projectId}`,
    rootDocId
  )
  const [openEntity, setOpenEntity] = useState<
    FileTreeDocumentFindResult | FileTreeFileRefFindResult | null
  >(null)
  const [selectedEntityCount, setSelectedEntityCount] = useState(0)
  const [fileTreeReady, setFileTreeReady] = useState(false)

  const handleFileTreeInit = useCallback(() => {
    setFileTreeReady(true)
  }, [])

  const handleFileTreeSelect = useCallback(
    (selectedEntities: FileTreeFindResult[]) => {
      debugConsole.log('File tree selection changed', selectedEntities)
      setSelectedEntityCount(selectedEntities.length)
      if (selectedEntities.length !== 1) {
        setOpenEntity(null)
        return
      }
      const [selected] = selectedEntities

      if (selected.type === 'folder') {
        return
      }

      setOpenEntity(selected)
      if (selected.type === 'doc') {
        setOpenDocId(selected.entity._id)
      }
    },
    [setOpenDocId]
  )

  const handleFileTreeDelete: FileTreeDeleteHandler = useCallback(
    entity => {
      eventEmitter.emit('entity:deleted', entity)
      // Select the root document if the current document was deleted
      if (entity.entity._id === openDocId) {
        openDocWithId(rootDocId)
      }
    },
    [eventEmitter, openDocId, openDocWithId, rootDocId]
  )

  // Synchronize the file tree when openDoc or openDocId is called on the editor
  // manager context from elsewhere. If the file tree does change, it will
  // trigger the onSelect handler in this component, which will update the local
  // state.
  useEffect(() => {
    debugConsole.log(
      `currentDocumentId changed to ${currentDocumentId}. Updating file tree`
    )
    if (currentDocumentId === null) {
      return
    }

    window.dispatchEvent(
      new CustomEvent('editor.openDoc', { detail: currentDocumentId })
    )
  }, [currentDocumentId])

  // Store openDocWithId, which is unstable, in a ref and keep the ref
  // synchronized with the source
  const openDocWithIdRef = useRef(openDocWithId)

  useEffect(() => {
    openDocWithIdRef.current = openDocWithId
  }, [openDocWithId])

  // Open a document in the editor when the local document ID changes
  useEffect(() => {
    if (!fileTreeReady || !openDocId) {
      return
    }
    debugConsole.log(
      `Observed change in local state. Opening document with ID ${openDocId}`
    )
    openDocWithIdRef.current(openDocId)
  }, [fileTreeReady, openDocId])

  const leftColumnContent = historyIsOpen ? (
    <HistorySidebar />
  ) : (
    <EditorSidebar
      shouldPersistLayout={shouldPersistLayout}
      onFileTreeInit={handleFileTreeInit}
      onFileTreeSelect={handleFileTreeSelect}
      onFileTreeDelete={handleFileTreeDelete}
    />
  )

  let rightColumnContent

  if (historyIsOpen) {
    rightColumnContent = (
      <HistoryProvider>
        <History />
      </HistoryProvider>
    )
  } else {
    let editorContent = null

    // Always have the editor mounted when not in history view, and hide and
    // show it as necessary
    const editorPane = (
      <EditorPane
        shouldPersistLayout={shouldPersistLayout}
        show={openEntity?.type === 'doc' && selectedEntityCount === 1}
      />
    )
    if (openDocId === undefined) {
      rightColumnContent = <NoOpenDocPane />
    } else if (selectedEntityCount === 0) {
      rightColumnContent = (
        <>
          {editorPane}
          <NoSelectionPane />
        </>
      )
    } else if (selectedEntityCount > 1) {
      editorContent = (
        <>
          {editorPane}
          <MultipleSelectionPane selectedEntityCount={selectedEntityCount} />
        </>
      )
    } else if (openEntity) {
      editorContent =
        openEntity.type === 'doc' ? (
          editorPane
        ) : (
          <>
            {editorPane}
            <FileView file={fileViewFile(openEntity.entity)} />
          </>
        )
    }

    if (editorContent) {
      rightColumnContent = (
        <EditorAndPdf
          editorContent={editorContent}
          shouldPersistLayout={shouldPersistLayout}
        />
      )
    }
  }

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
