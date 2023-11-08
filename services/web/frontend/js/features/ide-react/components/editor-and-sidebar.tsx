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
import { BinaryFile } from '@/features/file-view/types/binary-file'
import useScopeValue from '@/shared/hooks/use-scope-value'

type EditorAndSidebarProps = {
  shouldPersistLayout: boolean
  leftColumnDefaultSize: number
  setLeftColumnDefaultSize: React.Dispatch<React.SetStateAction<number>>
}

function convertFileRefToBinaryFile(fileRef: FileRef): BinaryFile {
  return {
    _id: fileRef._id,
    name: fileRef.name,
    id: fileRef._id,
    type: 'file',
    selected: true,
    linkedFileData: fileRef.linkedFileData,
    created: fileRef.created ? new Date(fileRef.created) : new Date(),
  }
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
    ...convertFileRefToBinaryFile(fileRef),
    created: fileRef.created,
  }
}

export function EditorAndSidebar({
  shouldPersistLayout,
  leftColumnDefaultSize,
  setLeftColumnDefaultSize,
}: EditorAndSidebarProps) {
  const [leftColumnIsOpen, setLeftColumnIsOpen] = useState(true)
  const { rootDocId } = useProjectContext()
  const { eventEmitter } = useIdeReactContext()
  const {
    openDocId: openDocWithId,
    currentDocumentId: openDocId,
    openInitialDoc,
  } = useEditorManagerContext()
  const { view } = useLayoutContext()
  const { projectJoined } = useIdeReactContext()
  const [, setOpenFile] = useScopeValue<BinaryFile | null>('openFile')

  const historyIsOpen = view === 'history'

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
      if (selected.type === 'doc' && fileTreeReady) {
        openDocWithId(selected.entity._id)
      }

      // Keep openFile scope value in sync with the file tree
      const openFile =
        selected.type === 'fileRef'
          ? convertFileRefToBinaryFile(selected.entity)
          : null
      setOpenFile(openFile)
      if (openFile) {
        window.dispatchEvent(new CustomEvent('file-view:file-opened'))
      }
    },
    [fileTreeReady, setOpenFile, openDocWithId]
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
    debugConsole.log(`openDocId changed to ${openDocId}`)
    if (openDocId === null) {
      return
    }

    window.dispatchEvent(
      new CustomEvent('editor.openDoc', { detail: openDocId })
    )
  }, [openDocId])

  // Open a document once the file tree and project are ready
  const initialOpenDoneRef = useRef(false)
  useEffect(() => {
    if (fileTreeReady && projectJoined && !initialOpenDoneRef.current) {
      initialOpenDoneRef.current = true
      openInitialDoc(rootDocId)
    }
  }, [fileTreeReady, openInitialDoc, projectJoined, rootDocId])

  // Keep the editor file tree around so that it is available and up to date
  // when restoring a file
  const leftColumnContent = (
    <>
      <EditorSidebar
        shouldShow={!historyIsOpen}
        shouldPersistLayout={shouldPersistLayout}
        onFileTreeInit={handleFileTreeInit}
        onFileTreeSelect={handleFileTreeSelect}
        onFileTreeDelete={handleFileTreeDelete}
      />
      {historyIsOpen ? <HistorySidebar /> : null}
    </>
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
