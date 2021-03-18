import React, {
  createContext,
  useCallback,
  useMemo,
  useReducer,
  useContext
} from 'react'
import PropTypes from 'prop-types'

import { mapSeries } from '../../../infrastructure/promise'

import {
  syncRename,
  syncDelete,
  syncMove,
  syncCreateEntity
} from '../util/sync-mutation'
import { findInTreeOrThrow } from '../util/find-in-tree'
import { isNameUniqueInFolder } from '../util/is-name-unique-in-folder'
import { isBlockedFilename, isCleanFilename } from '../util/safe-path'

import { useFileTreeMainContext } from './file-tree-main'
import { useFileTreeMutable } from './file-tree-mutable'
import { useFileTreeSelectable } from './file-tree-selectable'

import {
  InvalidFilenameError,
  BlockedFilenameError,
  DuplicateFilenameError,
  DuplicateFilenameMoveError
} from '../errors'

const FileTreeActionableContext = createContext()

const ACTION_TYPES = {
  START_RENAME: 'START_RENAME',
  START_DELETE: 'START_DELETE',
  DELETING: 'DELETING',
  START_CREATE_FILE: 'START_CREATE_FILE',
  START_CREATE_FOLDER: 'START_CREATE_FOLDER',
  CREATING_FILE: 'CREATING_FILE',
  CREATING_FOLDER: 'CREATING_FOLDER',
  MOVING: 'MOVING',
  CANCEL: 'CANCEL',
  CLEAR: 'CLEAR',
  ERROR: 'ERROR'
}

const defaultState = {
  isDeleting: false,
  isRenaming: false,
  isCreatingFile: false,
  isCreatingFolder: false,
  isMoving: false,
  inFlight: false,
  actionedEntities: null,
  newFileCreateMode: null,
  error: null
}

function fileTreeActionableReadOnlyReducer(state) {
  return state
}

function fileTreeActionableReducer(state, action) {
  switch (action.type) {
    case ACTION_TYPES.START_RENAME:
      return { ...defaultState, isRenaming: true }
    case ACTION_TYPES.START_DELETE:
      return {
        ...defaultState,
        isDeleting: true,
        actionedEntities: action.actionedEntities
      }
    case ACTION_TYPES.START_CREATE_FILE:
      return {
        ...defaultState,
        isCreatingFile: true,
        newFileCreateMode: action.newFileCreateMode
      }
    case ACTION_TYPES.START_CREATE_FOLDER:
      return { ...defaultState, isCreatingFolder: true }
    case ACTION_TYPES.CREATING_FILE:
      return {
        ...defaultState,
        isCreatingFile: true,
        newFileCreateMode: state.newFileCreateMode,
        inFlight: true
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
        actionedEntities: state.actionedEntities
      }
    case ACTION_TYPES.MOVING:
      return {
        ...defaultState,
        isMoving: true,
        inFlight: true
      }
    case ACTION_TYPES.CLEAR:
      return { ...defaultState }
    case ACTION_TYPES.CANCEL:
      if (state.inFlight) return state
      return { ...defaultState }
    case ACTION_TYPES.ERROR:
      return { ...state, inFlight: false, error: action.error }
    default:
      throw new Error(`Unknown user action type: ${action.type}`)
  }
}

export function FileTreeActionableProvider({ hasWritePermissions, children }) {
  const [state, dispatch] = useReducer(
    hasWritePermissions
      ? fileTreeActionableReducer
      : fileTreeActionableReadOnlyReducer,
    defaultState
  )

  return (
    <FileTreeActionableContext.Provider value={{ ...state, dispatch }}>
      {children}
    </FileTreeActionableContext.Provider>
  )
}

FileTreeActionableProvider.propTypes = {
  hasWritePermissions: PropTypes.bool.isRequired,
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node
  ]).isRequired
}

export function useFileTreeActionable() {
  const {
    isDeleting,
    isRenaming,
    isMoving,
    isCreatingFile,
    isCreatingFolder,
    inFlight,
    error,
    actionedEntities,
    newFileCreateMode,
    dispatch
  } = useContext(FileTreeActionableContext)
  const { projectId } = useFileTreeMainContext()
  const { fileTreeData, dispatchRename, dispatchMove } = useFileTreeMutable()
  const { selectedEntityIds } = useFileTreeSelectable()

  const startRenaming = useCallback(() => {
    dispatch({ type: ACTION_TYPES.START_RENAME })
  }, [dispatch])

  // update the entity with the new name immediately in the tree, but revert to
  // the old name if the sync fails
  const finishRenaming = useCallback(
    newName => {
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
    [dispatch, dispatchRename, fileTreeData, projectId, selectedEntityIds]
  )

  const isDuplicate = useCallback(
    (parentFolderId, name) => {
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
  }, [dispatch, fileTreeData, selectedEntityIds])

  // deletes entities in serie. Tree will be updated via the socket event
  const finishDeleting = useCallback(() => {
    dispatch({ type: ACTION_TYPES.DELETING })

    return mapSeries(Array.from(selectedEntityIds), id => {
      const found = findInTreeOrThrow(fileTreeData, id)
      return syncDelete(projectId, found.type, found.entity._id).catch(
        error => {
          // throw unless 404
          if (error.info.statusCode !== 404) {
            throw error
          }
        }
      )
    })
      .then(() => {
        dispatch({ type: ACTION_TYPES.CLEAR })
      })
      .catch(error => {
        // set an error and allow user to retry
        dispatch({ type: ACTION_TYPES.ERROR, error })
      })
  }, [dispatch, fileTreeData, projectId, selectedEntityIds])

  // moves entities. Tree is updated immediately and data are sync'd after.
  const finishMoving = useCallback(
    (toFolderId, draggedEntityIds) => {
      dispatch({ type: ACTION_TYPES.MOVING })

      // find entities and filter out no-ops
      const founds = Array.from(draggedEntityIds)
        .map(draggedEntityId =>
          findInTreeOrThrow(fileTreeData, draggedEntityId)
        )
        .filter(found => found.parentFolderId !== toFolderId)

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

      // dispatch moves immediately
      founds.forEach(found => dispatchMove(found.entity._id, toFolderId))

      // sync dispatched moves after
      return mapSeries(founds, found =>
        syncMove(projectId, found.type, found.entity._id, toFolderId)
      )
        .then(() => {
          dispatch({ type: ACTION_TYPES.CLEAR })
        })
        .catch(error => {
          dispatch({ type: ACTION_TYPES.ERROR, error })
        })
    },
    [dispatch, dispatchMove, fileTreeData, projectId]
  )

  const startCreatingFolder = useCallback(() => {
    dispatch({ type: ACTION_TYPES.START_CREATE_FOLDER })
  }, [dispatch])

  const finishCreatingEntity = useCallback(
    entity => {
      const parentFolderId = getSelectedParentFolderId(
        fileTreeData,
        selectedEntityIds
      )

      const error = validateCreate(fileTreeData, parentFolderId, entity)
      if (error) {
        return Promise.reject(error)
      }

      return syncCreateEntity(projectId, parentFolderId, entity)
    },
    [fileTreeData, projectId, selectedEntityIds]
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
    [dispatch, finishCreatingEntity]
  )

  const startCreatingFile = useCallback(
    newFileCreateMode => {
      dispatch({ type: ACTION_TYPES.START_CREATE_FILE, newFileCreateMode })
    },
    [dispatch]
  )

  const startCreatingDocOrFile = useCallback(() => {
    if (window.showReactAddFilesModal) {
      startCreatingFile('doc')
    } else {
      const parentFolderId = getSelectedParentFolderId(
        fileTreeData,
        selectedEntityIds
      )

      window.dispatchEvent(
        new CustomEvent('FileTreeReactBridge.openNewDocModal', {
          detail: {
            mode: 'doc',
            parentFolderId
          }
        })
      )
    }
  }, [fileTreeData, selectedEntityIds, startCreatingFile])

  const startUploadingDocOrFile = useCallback(() => {
    if (window.showReactAddFilesModal) {
      startCreatingFile('upload')
    } else {
      const parentFolderId = getSelectedParentFolderId(
        fileTreeData,
        selectedEntityIds
      )

      window.dispatchEvent(
        new CustomEvent('FileTreeReactBridge.openNewDocModal', {
          detail: {
            mode: 'upload',
            parentFolderId
          }
        })
      )
    }
  }, [fileTreeData, selectedEntityIds, startCreatingFile])

  const finishCreatingDocOrFile = useCallback(
    entity => {
      dispatch({ type: ACTION_TYPES.CREATING_FILE })

      return finishCreatingEntity(entity)
        .then(() => {
          if (window.showReactAddFilesModal) {
            dispatch({ type: ACTION_TYPES.CLEAR })
          } else {
            // dispatch FileTreeReactBridge event to update the Angular modal
            window.dispatchEvent(
              new CustomEvent('FileTreeReactBridge.openNewFileModal', {
                detail: {
                  done: true
                }
              })
            )
          }
        })
        .catch(error => {
          if (window.showReactAddFilesModal) {
            dispatch({ type: ACTION_TYPES.ERROR, error })
          } else {
            // dispatch FileTreeReactBridge event to update the Angular modal with
            // an error
            window.dispatchEvent(
              new CustomEvent('FileTreeReactBridge.openNewFileModal', {
                detail: {
                  error: true,
                  data: error.message
                }
              })
            )
          }
        })
    },
    [dispatch, finishCreatingEntity]
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
  }, [dispatch])

  const parentFolderId = useMemo(
    () => getSelectedParentFolderId(fileTreeData, selectedEntityIds),
    [fileTreeData, selectedEntityIds]
  )

  return {
    canDelete: selectedEntityIds.size > 0,
    canRename: selectedEntityIds.size === 1,
    canCreate: selectedEntityIds.size < 2,
    isDeleting,
    isMoving,
    isRenaming,
    isCreatingFile,
    isCreatingFolder,
    inFlight,
    actionedEntities,
    error,
    parentFolderId,
    isDuplicate,
    newFileCreateMode,
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
    cancel
  }
}

function getSelectedParentFolderId(fileTreeData, selectedEntityIds) {
  // we expect only one entity to be selected in that case, so we pick the first
  const selectedEntityId = Array.from(selectedEntityIds)[0]
  if (!selectedEntityId) {
    // in some cases no entities are selected. Return the root folder id then.
    return fileTreeData._id
  }

  const found = findInTreeOrThrow(fileTreeData, selectedEntityId)
  return found.type === 'folder' ? found.entity._id : found.parentFolderId
}

function validateCreate(fileTreeData, parentFolderId, entity) {
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

function validateRename(fileTreeData, found, newName) {
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

function validateMove(fileTreeData, toFolderId, found, isMoveToRoot) {
  if (!isNameUniqueInFolder(fileTreeData, toFolderId, found.entity.name)) {
    const error = new DuplicateFilenameMoveError()
    error.entityName = found.entity.name
    return error
  }

  const isFolder = found.type === 'folder'
  if (isMoveToRoot && !isFolder && isBlockedFilename(found.entity.name)) {
    return new BlockedFilenameError()
  }
}
