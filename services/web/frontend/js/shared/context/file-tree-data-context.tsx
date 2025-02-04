import {
  createContext,
  useCallback,
  useReducer,
  useContext,
  useMemo,
  useState,
  FC,
  useEffect,
} from 'react'
import useScopeValue from '../hooks/use-scope-value'
import {
  renameInTree,
  deleteInTree,
  moveInTree,
  createEntityInTree,
} from '../../features/file-tree/util/mutate-in-tree'
import { countFiles } from '../../features/file-tree/util/count-in-tree'
import useDeepCompareEffect from '../../shared/hooks/use-deep-compare-effect'
import { docsInFolder } from '@/features/file-tree/util/docs-in-folder'
import useScopeValueSetterOnly from '@/shared/hooks/use-scope-value-setter-only'
import { Folder } from '../../../../types/folder'
import { Project } from '../../../../types/project'
import { MainDocument } from '../../../../types/project-settings'
import { FindResult } from '@/features/file-tree/util/path'
import {
  StubSnapshotUtils,
  useSnapshotContext,
} from '@/features/ide-react/context/snapshot-context'
import importOverleafModules from '../../../macros/import-overleaf-module.macro'
const { buildFileTree, createFolder } =
  (importOverleafModules('snapshotUtils')[0]
    ?.import as typeof StubSnapshotUtils) || StubSnapshotUtils

const FileTreeDataContext = createContext<
  | {
      // fileTreeData is the up-to-date representation of the files list, updated
      // by the file tree
      fileTreeData: Folder
      fileCount: { value: number; status: string; limit: number } | number
      fileTreeReadOnly: boolean
      hasFolders: boolean
      selectedEntities: FindResult[]
      setSelectedEntities: (selectedEntities: FindResult[]) => void
      dispatchRename: (id: string, name: string) => void
      dispatchMove: (id: string, target: string) => void
      dispatchDelete: (id: string) => void
      dispatchCreateFolder: (name: string, folder: any) => void
      dispatchCreateDoc: (name: string, doc: any) => void
      dispatchCreateFile: (name: string, file: any) => void
      docs?: MainDocument[]
    }
  | undefined
>(undefined)

/* eslint-disable no-unused-vars */
enum ACTION_TYPES {
  RENAME = 'RENAME',
  RESET = 'RESET',
  DELETE = 'DELETE',
  MOVE = 'MOVE',
  CREATE = 'CREATE',
}
/* eslint-enable no-unused-vars */

type Action =
  | {
      type: ACTION_TYPES.RESET
      fileTreeData?: Folder
    }
  | {
      type: ACTION_TYPES.RENAME
      id: string
      newName: string
    }
  | {
      type: ACTION_TYPES.DELETE
      id: string
    }
  | {
      type: ACTION_TYPES.MOVE
      entityId: string
      toFolderId: string
    }
  | {
      type: typeof ACTION_TYPES.CREATE
      parentFolderId: string
      entity: any // TODO
    }

function fileTreeMutableReducer(
  { fileTreeData }: { fileTreeData: Folder },
  action: Action
) {
  switch (action.type) {
    case ACTION_TYPES.RESET: {
      const newFileTreeData = action.fileTreeData

      return {
        fileTreeData: newFileTreeData,
        fileCount: countFiles(newFileTreeData),
      }
    }

    case ACTION_TYPES.RENAME: {
      const newFileTreeData = renameInTree(fileTreeData, action.id, {
        newName: action.newName,
      })

      return {
        fileTreeData: newFileTreeData,
        fileCount: countFiles(newFileTreeData),
      }
    }

    case ACTION_TYPES.DELETE: {
      const newFileTreeData = deleteInTree(fileTreeData, action.id)

      return {
        fileTreeData: newFileTreeData,
        fileCount: countFiles(newFileTreeData),
      }
    }

    case ACTION_TYPES.MOVE: {
      const newFileTreeData = moveInTree(
        fileTreeData,
        action.entityId,
        action.toFolderId
      )

      return {
        fileTreeData: newFileTreeData,
        fileCount: countFiles(newFileTreeData),
      }
    }

    case ACTION_TYPES.CREATE: {
      const newFileTreeData = createEntityInTree(
        fileTreeData,
        action.parentFolderId,
        action.entity
      )

      return {
        fileTreeData: newFileTreeData,
        fileCount: countFiles(newFileTreeData),
      }
    }

    default: {
      throw new Error(
        `Unknown mutable file tree action type: ${(action as Action).type}`
      )
    }
  }
}

const initialState = (rootFolder?: Folder[]) => {
  const fileTreeData = rootFolder?.[0]
  return {
    fileTreeData,
    fileCount: countFiles(fileTreeData),
  }
}

export function useFileTreeData() {
  const context = useContext(FileTreeDataContext)

  if (!context) {
    throw new Error(
      'useFileTreeData is only available inside FileTreeDataProvider'
    )
  }

  return context
}

export const FileTreeDataProvider: FC = ({ children }) => {
  const [project] = useScopeValue<Project>('project')
  const [currentDocumentId] = useScopeValue('editor.open_doc_id')
  const [, setOpenDocName] = useScopeValueSetterOnly('editor.open_doc_name')
  const [permissionsLevel] = useScopeValue('permissionsLevel')
  const { fileTreeFromHistory, snapshot, snapshotVersion } =
    useSnapshotContext()
  const fileTreeReadOnly =
    permissionsLevel === 'readOnly' || fileTreeFromHistory

  const [rootFolder, setRootFolder] = useState(project?.rootFolder)

  useEffect(() => {
    if (fileTreeFromHistory) return
    setRootFolder(project?.rootFolder)
  }, [project, fileTreeFromHistory])

  useEffect(() => {
    if (!fileTreeFromHistory) return
    if (!rootFolder || rootFolder?.[0]?._id) {
      // Init or replace mongo rootFolder with stub while we load the snapshot.
      // In the future, project:joined should only fire once the snapshot is ready.
      setRootFolder([createFolder('', '')])
    }
  }, [fileTreeFromHistory, rootFolder])

  useEffect(() => {
    if (!fileTreeFromHistory || !snapshot) return
    setRootFolder([buildFileTree(snapshot)])
  }, [fileTreeFromHistory, snapshot, snapshotVersion])

  const [{ fileTreeData, fileCount }, dispatch] = useReducer(
    fileTreeMutableReducer,
    rootFolder,
    initialState
  )

  const [selectedEntities, setSelectedEntities] = useState<FindResult[]>([])

  const docs = useMemo(
    () => (fileTreeData ? docsInFolder(fileTreeData) : undefined),
    [fileTreeData]
  )

  useDeepCompareEffect(() => {
    dispatch({
      type: ACTION_TYPES.RESET,
      fileTreeData: rootFolder?.[0],
    })
  }, [rootFolder])

  const dispatchCreateFolder = useCallback((parentFolderId, entity) => {
    entity.type = 'folder'
    dispatch({
      type: ACTION_TYPES.CREATE,
      parentFolderId,
      entity,
    })
  }, [])

  const dispatchCreateDoc = useCallback(
    (parentFolderId: string, entity: any) => {
      entity.type = 'doc'
      dispatch({
        type: ACTION_TYPES.CREATE,
        parentFolderId,
        entity,
      })
    },
    []
  )

  const dispatchCreateFile = useCallback(
    (parentFolderId: string, entity: any) => {
      entity.type = 'fileRef'
      dispatch({
        type: ACTION_TYPES.CREATE,
        parentFolderId,
        entity,
      })
    },
    []
  )

  const dispatchRename = useCallback(
    (id: string, newName: string) => {
      dispatch({
        type: ACTION_TYPES.RENAME,
        newName,
        id,
      })
      if (id === currentDocumentId) {
        setOpenDocName(newName)
      }
    },
    [currentDocumentId, setOpenDocName]
  )

  const dispatchDelete = useCallback((id: string) => {
    dispatch({ type: ACTION_TYPES.DELETE, id })
  }, [])

  const dispatchMove = useCallback((entityId: string, toFolderId: string) => {
    dispatch({ type: ACTION_TYPES.MOVE, entityId, toFolderId })
  }, [])

  const value = useMemo(() => {
    return {
      dispatchCreateDoc,
      dispatchCreateFile,
      dispatchCreateFolder,
      dispatchDelete,
      dispatchMove,
      dispatchRename,
      fileCount,
      fileTreeData,
      fileTreeReadOnly,
      hasFolders: fileTreeData?.folders.length > 0,
      selectedEntities,
      setSelectedEntities,
      docs,
    }
  }, [
    dispatchCreateDoc,
    dispatchCreateFile,
    dispatchCreateFolder,
    dispatchDelete,
    dispatchMove,
    dispatchRename,
    fileCount,
    fileTreeData,
    fileTreeReadOnly,
    selectedEntities,
    setSelectedEntities,
    docs,
  ])

  return (
    <FileTreeDataContext.Provider value={value}>
      {children}
    </FileTreeDataContext.Provider>
  )
}
