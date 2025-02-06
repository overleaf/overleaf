import {
  createContext,
  FC,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useProjectContext } from '@/shared/context/project-context'
import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import useScopeValueSetterOnly from '@/shared/hooks/use-scope-value-setter-only'
import { BinaryFile } from '@/features/file-view/types/binary-file'
import {
  FileTreeDocumentFindResult,
  FileTreeFileRefFindResult,
  FileTreeFindResult,
} from '@/features/ide-react/types/file-tree'
import { debugConsole } from '@/utils/debugging'
import { convertFileRefToBinaryFile } from '@/features/ide-react/util/file-view'
import { sendMB } from '@/infrastructure/event-tracking'
import { FileRef } from '../../../../../types/file-ref'

const FileTreeOpenContext = createContext<
  | {
      selectedEntityCount: number
      openEntity: FileTreeDocumentFindResult | FileTreeFileRefFindResult | null
      handleFileTreeInit: () => void
      handleFileTreeSelect: (selectedEntities: FileTreeFindResult[]) => void
      handleFileTreeDelete: (entity: FileTreeFindResult) => void
      fileTreeExpanded: boolean
      toggleFileTreeExpanded: () => void
    }
  | undefined
>(undefined)

export const FileTreeOpenProvider: FC = ({ children }) => {
  const { rootDocId, owner } = useProjectContext()
  const { eventEmitter, projectJoined } = useIdeReactContext()
  const { openDocWithId, currentDocumentId, openInitialDoc } =
    useEditorManagerContext()
  const [, setOpenFile] = useScopeValueSetterOnly<BinaryFile | null>('openFile')
  const [openEntity, setOpenEntity] = useState<
    FileTreeDocumentFindResult | FileTreeFileRefFindResult | null
  >(null)
  const [selectedEntityCount, setSelectedEntityCount] = useState(0)
  const [fileTreeReady, setFileTreeReady] = useState(false)

  // NOTE: Only used in editor redesign
  const [fileTreeExpanded, setFileTreeExpanded] = useState(true)

  const toggleFileTreeExpanded = useCallback(() => {
    setFileTreeExpanded(prev => !prev)
  }, [])

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
        openDocWithId(selected.entity._id, { keepCurrentView: true })
        if (selected.entity.name.endsWith('.bib')) {
          sendMB('open-bib-file', {
            projectOwner: owner._id,
            isSampleFile: selected.entity.name === 'sample.bib',
            linkedFileProvider: null,
          })
        }
      }
      // Keep openFile scope value in sync with the file tree
      const openFile =
        selected.type === 'fileRef'
          ? convertFileRefToBinaryFile(selected.entity)
          : null
      setOpenFile(openFile)
      if (openFile) {
        if (selected?.entity?.name?.endsWith('.bib')) {
          sendMB('open-bib-file', {
            projectOwner: owner._id,
            isSampleFile: false,
            linkedFileProvider: (selected.entity as FileRef).linkedFileData
              ?.provider,
          })
        }
        window.dispatchEvent(new CustomEvent('file-view:file-opened'))
      }
    },
    [fileTreeReady, setOpenFile, openDocWithId, owner]
  )

  const handleFileTreeDelete = useCallback(
    (entity: FileTreeFindResult) => {
      eventEmitter.emit('entity:deleted', entity)
      // Select the root document if the current document was deleted
      if (entity.entity._id === currentDocumentId) {
        openDocWithId(rootDocId!)
      }
    },
    [eventEmitter, currentDocumentId, openDocWithId, rootDocId]
  )

  // Open a document once the file tree and project are ready
  const initialOpenDoneRef = useRef(false)
  useEffect(() => {
    if (
      rootDocId &&
      fileTreeReady &&
      projectJoined &&
      !initialOpenDoneRef.current
    ) {
      initialOpenDoneRef.current = true
      openInitialDoc(rootDocId)
    }
  }, [fileTreeReady, openInitialDoc, projectJoined, rootDocId])

  const value = useMemo(() => {
    return {
      selectedEntityCount,
      openEntity,
      handleFileTreeInit,
      handleFileTreeSelect,
      handleFileTreeDelete,
      fileTreeExpanded,
      toggleFileTreeExpanded,
    }
  }, [
    handleFileTreeDelete,
    handleFileTreeInit,
    handleFileTreeSelect,
    openEntity,
    selectedEntityCount,
    fileTreeExpanded,
    toggleFileTreeExpanded,
  ])

  return (
    <FileTreeOpenContext.Provider value={value}>
      {children}
    </FileTreeOpenContext.Provider>
  )
}

export const useFileTreeOpenContext = () => {
  const context = useContext(FileTreeOpenContext)

  if (!context) {
    throw new Error(
      'useFileTreeOpenContext is only available inside FileTreeOpenProvider'
    )
  }

  return context
}
