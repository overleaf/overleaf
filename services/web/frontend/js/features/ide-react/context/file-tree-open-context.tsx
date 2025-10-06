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
import { useEditorOpenDocContext } from '@/features/ide-react/context/editor-open-doc-context'
import {
  FileTreeDocumentFindResult,
  FileTreeFileRefFindResult,
  FileTreeFindResult,
} from '@/features/ide-react/types/file-tree'
import { debugConsole } from '@/utils/debugging'
import { convertFileRefToBinaryFile } from '@/features/ide-react/util/file-view'
import { sendMB } from '@/infrastructure/event-tracking'
import { FileRef } from '../../../../../types/file-ref'
import { useLayoutContext } from '@/shared/context/layout-context'

const FileTreeOpenContext = createContext<
  | {
      selectedEntityCount: number
      openEntity: FileTreeDocumentFindResult | FileTreeFileRefFindResult | null
      handleFileTreeInit: () => void
      handleFileTreeSelect: (selectedEntities: FileTreeFindResult[]) => void
      handleFileTreeDelete: (entity: FileTreeFindResult) => void
      fileTreeExpanded: boolean
      toggleFileTreeExpanded: () => void
      expandFileTree: () => void
      collapseFileTree: () => void
    }
  | undefined
>(undefined)

export const FileTreeOpenProvider: FC<React.PropsWithChildren> = ({
  children,
}) => {
  const { project } = useProjectContext()
  const rootDocId = project?.rootDocId
  const projectOwner = project?.owner?._id
  const { eventEmitter, projectJoined } = useIdeReactContext()
  const { openDocWithId, openInitialDoc } = useEditorManagerContext()
  const { currentDocumentId } = useEditorOpenDocContext()
  const { setOpenFile } = useLayoutContext()
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

  const expandFileTree = useCallback(() => {
    setFileTreeExpanded(true)
  }, [])

  const collapseFileTree = useCallback(() => {
    setFileTreeExpanded(false)
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
            projectOwner,
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
            projectOwner,
            isSampleFile: false,
            linkedFileProvider: (selected.entity as FileRef).linkedFileData
              ?.provider,
          })
        }
        window.dispatchEvent(new CustomEvent('file-view:file-opened'))
      }
    },
    [fileTreeReady, setOpenFile, openDocWithId, projectOwner]
  )

  const handleFileTreeDelete = useCallback(
    (entity: FileTreeFindResult, isFileRestore?: boolean) => {
      eventEmitter.emit('entity:deleted', entity)
      // Select the root document if the current document was deleted and delete is not part of a file restore
      if (!isFileRestore && entity.entity._id === currentDocumentId) {
        openDocWithId(rootDocId!)
      }
    },
    [eventEmitter, currentDocumentId, openDocWithId, rootDocId]
  )

  // Open a document once the file tree and project are ready
  const initialOpenDoneRef = useRef(false)
  useEffect(() => {
    if (fileTreeReady && projectJoined && !initialOpenDoneRef.current) {
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
      expandFileTree,
      collapseFileTree,
    }
  }, [
    handleFileTreeDelete,
    handleFileTreeInit,
    handleFileTreeSelect,
    openEntity,
    selectedEntityCount,
    fileTreeExpanded,
    toggleFileTreeExpanded,
    expandFileTree,
    collapseFileTree,
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
