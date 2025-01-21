import {
  createContext,
  useCallback,
  useMemo,
  useReducer,
  useContext,
  useEffect,
  useState,
  FC,
} from 'react'

import { mapSeries } from '../../../infrastructure/promise'

import {
  syncRename,
  syncDelete,
  syncMove,
  syncCreateEntity,
} from '../util/sync-mutation'
import { findInTree, findInTreeOrThrow } from '../util/find-in-tree'
import { isNameUniqueInFolder } from '../util/is-name-unique-in-folder'
import { isBlockedFilename, isCleanFilename } from '../util/safe-path'

import { useProjectContext } from '../../../shared/context/project-context'
import { useFileTreeData } from '../../../shared/context/file-tree-data-context'
import { useFileTreeSelectable } from './file-tree-selectable'

import {
  InvalidFilenameError,
  BlockedFilenameError,
  DuplicateFilenameError,
  DuplicateFilenameMoveError,
} from '../errors'
import { Folder } from '../../../../../types/folder'
import { useReferencesContext } from '@/features/ide-react/context/references-context'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { fileUrl } from '@/features/utils/fileUrl'

type DroppedFile = File & {
  relativePath?: string
}

type DroppedFiles = {
  files: DroppedFile[]
  targetFolderId: string
}

const FileTreeActionableContext = createContext<
  | {
      isDeleting: boolean
      isRenaming: boolean
      isCreatingFile: boolean
      isCreatingFolder: boolean
      isMoving: boolean
      inFlight: boolean
      actionedEntities: any | null
      newFileCreateMode: any | null
      error: any | null
      canDelete: boolean
      canRename: boolean
      canCreate: boolean
      parentFolderId: string
      selectedFileName: string | null | undefined
      isDuplicate: (parentFolderId: string, name: string) => boolean
      startRenaming: any
      finishRenaming: any
      startDeleting: any
      finishDeleting: any
      finishMoving: any
      startCreatingFile: any
      startCreatingFolder: any
      finishCreatingFolder: any
      startCreatingDocOrFile: any
      startUploadingDocOrFile: any
      finishCreatingDoc: any
      finishCreatingLinkedFile: any
      cancel: () => void
      droppedFiles: { files: File[]; targetFolderId: string } | null
      setDroppedFiles: (value: DroppedFiles | null) => void
      downloadPath?: string
    }
  | undefined
>(undefined)

/* eslint-disable no-unused-vars */
enum ACTION_TYPES {
  START_RENAME = 'START_RENAME',
  START_DELETE = 'START_DELETE',
  DELETING = 'DELETING',
  START_CREATE_FILE = 'START_CREATE_FILE',
  START_CREATE_FOLDER = 'START_CREATE_FOLDER',
  CREATING_FILE = 'CREATING_FILE',
  CREATING_FOLDER = 'CREATING_FOLDER',
  MOVING = 'MOVING',
  CANCEL = 'CANCEL',
  CLEAR = 'CLEAR',
  ERROR = 'ERROR',
}
/* eslint-enable no-unused-vars */

type State = {
  isDeleting: boolean
  isRenaming: boolean
  isCreatingFile: boolean
  isCreatingFolder: boolean
  isMoving: boolean
  inFlight: boolean
  actionedEntities: any | null
  newFileCreateMode: any | null
  error: unknown | null
}

const defaultState: State = {
  isDeleting: false,
  isRenaming: false,
  isCreatingFile: false,
  isCreatingFolder: false,
  isMoving: false,
  inFlight: false,
  actionedEntities: null,
  newFileCreateMode: null,
  error: null,
}

function fileTreeActionableReadOnlyReducer(state: State) {
  return state
}

type Action =
  | {
      type: ACTION_TYPES.START_RENAME
    }
  | {
      type: ACTION_TYPES.START_DELETE
      actionedEntities: any | null
    }
  | {
      type: ACTION_TYPES.START_CREATE_FILE
      newFileCreateMode: any | null
    }
  | {
      type: ACTION_TYPES.START_CREATE_FOLDER
    }
  | {
      type: ACTION_TYPES.CREATING_FILE
    }
  | {
      type: ACTION_TYPES.CREATING_FOLDER
    }
  | {
      type: ACTION_TYPES.DELETING
    }
  | {
      type: ACTION_TYPES.MOVING
    }
  | {
      type: ACTION_TYPES.CLEAR
    }
  | {
      type: ACTION_TYPES.CANCEL
    }
  | {
      type: ACTION_TYPES.ERROR
      error: unknown
    }

function fileTreeActionableReducer(state: State, action: Action) {
  switch (action.type) {
    case ACTION_TYPES.START_RENAME:
      return { ...defaultState, isRenaming: true }
    case ACTION_TYPES.START_DELETE:
      return {
        ...defaultState,
        isDeleting: true,
        actionedEntities: action.actionedEntities,
      }
    case ACTION_TYPES.START_CREATE_FILE:
      return {
        ...defaultState,
        isCreatingFile: true,
        newFileCreateMode: action.newFileCreateMode,
      }
    case ACTION_TYPES.START_CREATE_FOLDER:
      return { ...defaultState, isCreatingFolder: true }
    case ACTION_TYPES.CREATING_FILE:
      return {
        ...defaultState,
        isCreatingFile: true,
        newFileCreateMode: state.newFileCreateMode,
        inFlight: true,
      }
    case ACTION_TYPES.CREATING_FOLDER:
      return { ...defaultState, isCreatingFolder: true, inFlight: true }
    case ACTION_TYPES.DELETING:
      // keep `actionedEntities` so the entities list remains displayed in the
      // delete modal
      return {
        ...defaultState,
        isDeleting: true,
        inFlight: true,
        actionedEntities: state.actionedEntities,
      }
    case ACTION_TYPES.MOVING:
      return {
        ...defaultState,
        isMoving: true,
        inFlight: true,
      }
    case ACTION_TYPES.CLEAR:
      return { ...defaultState }
    case ACTION_TYPES.CANCEL:
      if (state.inFlight) return state
      return { ...defaultState }
    case ACTION_TYPES.ERROR:
      return { ...state, inFlight: false, error: action.error }
    default:
      throw new Error(`Unknown user action type: ${(action as Action).type}`)
  }
}

export const FileTreeActionableProvider: FC = ({ children }) => {
  const { _id: projectId } = useProjectContext()
  const { fileTreeReadOnly } = useFileTreeData()
  const { indexAllReferences } = useReferencesContext()
  const { write } = usePermissionsContext()

  const [state, dispatch] = useReducer(
    fileTreeReadOnly
      ? fileTreeActionableReadOnlyReducer
      : fileTreeActionableReducer,
    defaultState
  )

  const { fileTreeData, dispatchRename, dispatchMove } = useFileTreeData()
  const { selectedEntityIds, isRootFolderSelected } = useFileTreeSelectable()

  const [droppedFiles, setDroppedFiles] = useState<DroppedFiles | null>(null)

  const startRenaming = useCallback(() => {
    dispatch({ type: ACTION_TYPES.START_RENAME })
  }, [])

  // update the entity with the new name immediately in the tree, but revert to
  // the old name if the sync fails
  const finishRenaming = useCallback(
    (newName: string) => {
      const selectedEntityId = Array.from(selectedEntityIds)[0]
      const found = findInTreeOrThrow(fileTreeData, selectedEntityId)
      const oldName = found.entity.name
      if (newName === oldName) {
        return dispatch({ type: ACTION_TYPES.CLEAR })
      }

      const error = validateRename(fileTreeData, found, newName)
      if (error) return dispatch({ type: ACTION_TYPES.ERROR, error })

      dispatch({ type: ACTION_TYPES.CLEAR })
      dispatchRename(selectedEntityId, newName)
      return syncRename(projectId, found.type, found.entity._id, newName).catch(
        error => {
          dispatchRename(selectedEntityId, oldName)
          // The state from this error action isn't used anywhere right now
          // but we need to handle the error for linting
          dispatch({ type: ACTION_TYPES.ERROR, error })
        }
      )
    },
    [dispatchRename, fileTreeData, projectId, selectedEntityIds]
  )

  const isDuplicate = useCallback(
    (parentFolderId: string, name: string) => {
      return !isNameUniqueInFolder(fileTreeData, parentFolderId, name)
    },
    [fileTreeData]
  )

  // init deletion flow (this will open the delete modal).
  // A copy of the selected entities is set as `actionedEntities` so it is kept
  // unchanged as the entities are deleted and the selection is updated
  const startDeleting = useCallback(() => {
    const actionedEntities = Array.from(selectedEntityIds).map(
      entityId => findInTreeOrThrow(fileTreeData, entityId).entity
    )
    dispatch({ type: ACTION_TYPES.START_DELETE, actionedEntities })
  }, [fileTreeData, selectedEntityIds])

  // deletes entities in series. Tree will be updated via the socket event
  const finishDeleting = useCallback(() => {
    dispatch({ type: ACTION_TYPES.DELETING })
    let shouldReindexReferences = false

    return (
      mapSeries(Array.from(selectedEntityIds), id => {
        const found = findInTreeOrThrow(fileTreeData, id)
        shouldReindexReferences =
          shouldReindexReferences || /\.bib$/.test(found.entity.name)
        return syncDelete(projectId, found.type, found.entity._id).catch(
          error => {
            // throw unless 404
            if (error.info.statusCode !== 404) {
              throw error
            }
          }
        )
      })
        // @ts-ignore (TODO: improve mapSeries types)
        .then(() => {
          if (shouldReindexReferences) {
            indexAllReferences(true)
          }
          dispatch({ type: ACTION_TYPES.CLEAR })
        })
        .catch((error: Error) => {
          // set an error and allow user to retry
          dispatch({ type: ACTION_TYPES.ERROR, error })
        })
    )
  }, [fileTreeData, projectId, selectedEntityIds, indexAllReferences])

  // moves entities. Tree is updated immediately and data are sync'd after.
  const finishMoving = useCallback(
    (toFolderId: string, draggedEntityIds: Set<string>) => {
      dispatch({ type: ACTION_TYPES.MOVING })

      // find entities and filter out no-ops and nested files
      const founds = Array.from(draggedEntityIds)
        .map(draggedEntityId =>
          findInTreeOrThrow(fileTreeData, draggedEntityId)
        )
        .filter(
          found =>
            found.parentFolderId !== toFolderId &&
            !draggedEntityIds.has(found.parentFolderId)
        )

      // make sure all entities can be moved, return early otherwise
      const isMoveToRoot = toFolderId === fileTreeData._id
      const validationError = founds
        .map(found =>
          validateMove(fileTreeData, toFolderId, found, isMoveToRoot)
        )
        .find(error => error)
      if (validationError) {
        return dispatch({ type: ACTION_TYPES.ERROR, error: validationError })
      }

      // keep track of old parent folder ids so we can revert entities if sync fails
      const oldParentFolderIds: Record<string, string> = {}
      let isMoveFailed = false

      // dispatch moves immediately
      founds.forEach(found => {
        oldParentFolderIds[found.entity._id] = found.parentFolderId
        dispatchMove(found.entity._id, toFolderId)
      })

      // sync dispatched moves after
      return (
        mapSeries(founds, async found => {
          try {
            await syncMove(projectId, found.type, found.entity._id, toFolderId)
          } catch (error) {
            isMoveFailed = true
            dispatchMove(found.entity._id, oldParentFolderIds[found.entity._id])
            dispatch({ type: ACTION_TYPES.ERROR, error })
          }
        })
          // @ts-ignore (TODO: improve mapSeries types)
          .then(() => {
            if (!isMoveFailed) {
              dispatch({ type: ACTION_TYPES.CLEAR })
            }
          })
      )
    },
    [dispatchMove, fileTreeData, projectId]
  )

  const startCreatingFolder = useCallback(() => {
    dispatch({ type: ACTION_TYPES.START_CREATE_FOLDER })
  }, [])

  const parentFolderId = useMemo(() => {
    return getSelectedParentFolderId(
      fileTreeData,
      selectedEntityIds,
      isRootFolderSelected
    )
  }, [fileTreeData, selectedEntityIds, isRootFolderSelected])

  // return the name of the selected file or doc if there is only one selected
  const selectedFileName = useMemo(() => {
    if (selectedEntityIds.size === 1) {
      const [selectedEntityId] = selectedEntityIds
      const selectedEntity = findInTree(fileTreeData, selectedEntityId)
      return selectedEntity?.entity?.name
    }
    return null
  }, [fileTreeData, selectedEntityIds])

  const finishCreatingEntity = useCallback(
    entity => {
      const error = validateCreate(fileTreeData, parentFolderId, entity)
      if (error) {
        return Promise.reject(error)
      }

      return syncCreateEntity(projectId, parentFolderId, entity)
    },
    [fileTreeData, parentFolderId, projectId]
  )

  const finishCreatingFolder = useCallback(
    name => {
      dispatch({ type: ACTION_TYPES.CREATING_FOLDER })
      return finishCreatingEntity({ endpoint: 'folder', name })
        .then(() => {
          dispatch({ type: ACTION_TYPES.CLEAR })
        })
        .catch(error => {
          dispatch({ type: ACTION_TYPES.ERROR, error })
        })
    },
    [finishCreatingEntity]
  )

  const startCreatingFile = useCallback(newFileCreateMode => {
    dispatch({ type: ACTION_TYPES.START_CREATE_FILE, newFileCreateMode })
  }, [])

  const startCreatingDocOrFile = useCallback(() => {
    startCreatingFile('doc')
  }, [startCreatingFile])

  const startUploadingDocOrFile = useCallback(() => {
    startCreatingFile('upload')
  }, [startCreatingFile])

  const finishCreatingDocOrFile = useCallback(
    entity => {
      dispatch({ type: ACTION_TYPES.CREATING_FILE })

      return finishCreatingEntity(entity)
        .then(() => {
          dispatch({ type: ACTION_TYPES.CLEAR })
        })
        .catch(error => {
          dispatch({ type: ACTION_TYPES.ERROR, error })
        })
    },
    [finishCreatingEntity]
  )

  const finishCreatingDoc = useCallback(
    entity => {
      entity.endpoint = 'doc'
      return finishCreatingDocOrFile(entity)
    },
    [finishCreatingDocOrFile]
  )

  const finishCreatingLinkedFile = useCallback(
    entity => {
      entity.endpoint = 'linked_file'
      return finishCreatingDocOrFile(entity)
    },
    [finishCreatingDocOrFile]
  )

  const cancel = useCallback(() => {
    dispatch({ type: ACTION_TYPES.CANCEL })
  }, [])

  // listen for `file-tree.start-creating` events
  useEffect(() => {
    function handleEvent(event: Event) {
      dispatch({
        type: ACTION_TYPES.START_CREATE_FILE,
        newFileCreateMode: (event as CustomEvent<{ mode: string }>).detail.mode,
      })
    }

    window.addEventListener('file-tree.start-creating', handleEvent)

    return () => {
      window.removeEventListener('file-tree.start-creating', handleEvent)
    }
  }, [])

  // build the path for downloading a single file or doc
  const downloadPath = useMemo(() => {
    if (selectedEntityIds.size === 1) {
      const [selectedEntityId] = selectedEntityIds
      const selectedEntity = findInTree(fileTreeData, selectedEntityId)

      if (selectedEntity?.type === 'fileRef') {
        return fileUrl(projectId, selectedEntityId, selectedEntity.entity.hash)
      }

      if (selectedEntity?.type === 'doc') {
        return `/project/${projectId}/doc/${selectedEntityId}/download`
      }
    }
  }, [fileTreeData, projectId, selectedEntityIds])

  const value = useMemo(
    () => ({
      canDelete: write && selectedEntityIds.size > 0 && !isRootFolderSelected,
      canRename: write && selectedEntityIds.size === 1 && !isRootFolderSelected,
      canCreate: write && selectedEntityIds.size < 2,
      ...state,
      parentFolderId,
      selectedFileName,
      isDuplicate,
      startRenaming,
      finishRenaming,
      startDeleting,
      finishDeleting,
      finishMoving,
      startCreatingFile,
      startCreatingFolder,
      finishCreatingFolder,
      startCreatingDocOrFile,
      startUploadingDocOrFile,
      finishCreatingDoc,
      finishCreatingLinkedFile,
      cancel,
      droppedFiles,
      setDroppedFiles,
      downloadPath,
    }),
    [
      cancel,
      downloadPath,
      droppedFiles,
      finishCreatingDoc,
      finishCreatingFolder,
      finishCreatingLinkedFile,
      finishDeleting,
      finishMoving,
      finishRenaming,
      isDuplicate,
      isRootFolderSelected,
      parentFolderId,
      selectedEntityIds.size,
      selectedFileName,
      startCreatingDocOrFile,
      startCreatingFile,
      startCreatingFolder,
      startDeleting,
      startRenaming,
      startUploadingDocOrFile,
      state,
      write,
    ]
  )

  return (
    <FileTreeActionableContext.Provider value={value}>
      {children}
    </FileTreeActionableContext.Provider>
  )
}

export function useFileTreeActionable() {
  const context = useContext(FileTreeActionableContext)

  if (!context) {
    throw new Error(
      'useFileTreeActionable is only available inside FileTreeActionableProvider'
    )
  }

  return context
}

function getSelectedParentFolderId(
  fileTreeData: Folder,
  selectedEntityIds: Set<string>,
  isRootFolderSelected: boolean
) {
  if (isRootFolderSelected) {
    return fileTreeData._id
  }

  // we expect only one entity to be selected in that case, so we pick the first
  const selectedEntityId = Array.from(selectedEntityIds)[0]
  if (!selectedEntityId) {
    // in some cases no entities are selected. Return the root folder id then.
    return fileTreeData._id
  }

  const found = findInTree(fileTreeData, selectedEntityId)

  if (!found) {
    // if the entity isn't in the tree, return the root folder id.
    return fileTreeData._id
  }

  return found.type === 'folder' ? found.entity._id : found.parentFolderId
}

function validateCreate(
  fileTreeData: Folder,
  parentFolderId: string,
  entity: { name: string; endpoint: string }
) {
  if (!isCleanFilename(entity.name)) {
    return new InvalidFilenameError()
  }

  if (!isNameUniqueInFolder(fileTreeData, parentFolderId, entity.name)) {
    return new DuplicateFilenameError()
  }

  // check that the name of a file is allowed, if creating in the root folder
  const isMoveToRoot = parentFolderId === fileTreeData._id
  const isFolder = entity.endpoint === 'folder'
  if (isMoveToRoot && !isFolder && isBlockedFilename(entity.name)) {
    return new BlockedFilenameError()
  }
}

function validateRename(
  fileTreeData: Folder,
  found: { parentFolderId: string; path: string[]; type: string },
  newName: string
) {
  if (!isCleanFilename(newName)) {
    return new InvalidFilenameError()
  }

  if (!isNameUniqueInFolder(fileTreeData, found.parentFolderId, newName)) {
    return new DuplicateFilenameError()
  }

  const isTopLevel = found.path.length === 1
  const isFolder = found.type === 'folder'
  if (isTopLevel && !isFolder && isBlockedFilename(newName)) {
    return new BlockedFilenameError()
  }
}

function validateMove(
  fileTreeData: Folder,
  toFolderId: string,
  found: { entity: { name: string }; type: string },
  isMoveToRoot: boolean
) {
  if (!isNameUniqueInFolder(fileTreeData, toFolderId, found.entity.name)) {
    const error = new DuplicateFilenameMoveError()
    ;(error as DuplicateFilenameMoveError & { entityName: string }).entityName =
      found.entity.name
    return error
  }

  const isFolder = found.type === 'folder'
  if (isMoveToRoot && !isFolder && isBlockedFilename(found.entity.name)) {
    return new BlockedFilenameError()
  }
}
