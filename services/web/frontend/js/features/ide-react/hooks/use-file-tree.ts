import { FileRef } from '../../../../../types/file-ref'
import { BinaryFile } from '@/features/file-view/types/binary-file'
import { useSelectFileTreeEntity } from '@/features/ide-react/hooks/use-select-file-tree-entity'
import useScopeValue from '@/shared/hooks/use-scope-value'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FileTreeDeleteHandler,
  FileTreeDocumentFindResult,
  FileTreeFileRefFindResult,
  FileTreeFindResult,
} from '@/features/ide-react/types/file-tree'
import { debugConsole } from '@/utils/debugging'
import { useProjectContext } from '@/shared/context/project-context'
import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'

export const useFileTree = () => {
  const { rootDocId } = useProjectContext()
  const { eventEmitter } = useIdeReactContext()
  const {
    openDocId: openDocWithId,
    currentDocumentId: openDocId,
    openInitialDoc,
  } = useEditorManagerContext()
  const { projectJoined } = useIdeReactContext()
  const { selectEntity } = useSelectFileTreeEntity()
  const [, setOpenFile] = useScopeValue<BinaryFile | null>('openFile')
  const [openEntity, setOpenEntity] = useState<
    FileTreeDocumentFindResult | FileTreeFileRefFindResult | null
  >(null)
  const [selectedEntityCount, setSelectedEntityCount] = useState(0)
  const [fileTreeReady, setFileTreeReady] = useState(false)

  const handleFileTreeInit = useCallback(() => {
    setFileTreeReady(true)
  }, [])

  // Open a document in the editor when one is selected in the file tree
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

  const openDocIdRef = useRef<typeof openDocId | null>(null)

  // Synchronize the file tree when openDoc or openDocId is called on the editor
  // manager context from elsewhere. If the file tree does change, it will
  // trigger the onSelect handler in this component, which will update the local
  // state.
  useEffect(() => {
    if (openDocId !== openDocIdRef.current) {
      debugConsole.log(`openDocId changed to ${openDocId}`)
      openDocIdRef.current = openDocId
      if (openDocId !== null) {
        selectEntity(openDocId)
      }
    }
  }, [openDocId, selectEntity])

  // Open a document once the file tree and project are ready
  const initialOpenDoneRef = useRef(false)
  useEffect(() => {
    if (fileTreeReady && projectJoined && !initialOpenDoneRef.current) {
      initialOpenDoneRef.current = true
      openInitialDoc(rootDocId)
    }
  }, [fileTreeReady, openInitialDoc, projectJoined, rootDocId])

  return {
    selectedEntityCount,
    openEntity,
    openDocId,
    handleFileTreeInit,
    handleFileTreeSelect,
    handleFileTreeDelete,
  }
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
export function fileViewFile(fileRef: FileRef) {
  return {
    ...convertFileRefToBinaryFile(fileRef),
    created: fileRef.created,
  }
}
