import React, { createContext, useReducer, useContext } from 'react'
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
import { isCleanFilename } from '../util/safe-path'

import { FileTreeMainContext } from './file-tree-main'
import { useFileTreeMutable } from './file-tree-mutable'
import { useFileTreeSelectable } from './file-tree-selectable'

import { InvalidFilenameError, DuplicateFilenameError } from '../errors'

const FileTreeActionableContext = createContext()

const ACTION_TYPES = {
  START_RENAME: 'START_RENAME',
  START_DELETE: 'START_DELETE',
  DELETING: 'DELETING',
  START_CREATE_FOLDER: 'START_CREATE_FOLDER',
  CREATING_FOLDER: 'CREATING_FOLDER',
  CANCEL: 'CANCEL',
  CLEAR: 'CLEAR',
  ERROR: 'ERROR'
}

const defaultState = {
  isDeleting: false,
  isRenaming: false,
  isCreatingFolder: false,
  inFlight: false,
  actionedEntities: null,
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
    case ACTION_TYPES.START_CREATE_FOLDER:
      return { ...defaultState, isCreatingFolder: true }
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
    isCreatingFolder,
    inFlight,
    error,
    actionedEntities,
    dispatch
  } = useContext(FileTreeActionableContext)
  const { projectId } = useContext(FileTreeMainContext)
  const { fileTreeData, dispatchRename, dispatchMove } = useFileTreeMutable()
  const { selectedEntityIds } = useFileTreeSelectable()

  function startRenaming() {
    dispatch({ type: ACTION_TYPES.START_RENAME })
  }

  // update the entity with the new name immediately in the tree, but revert to
  // the old name if the sync fails
  function finishRenaming(newName) {
    const selectedEntityId = Array.from(selectedEntityIds)[0]
    const found = findInTreeOrThrow(fileTreeData, selectedEntityId)
    const oldName = found.entity.name
    if (newName === oldName) {
      return dispatch({ type: ACTION_TYPES.CLEAR })
    }
    let error
    // check valid name
    if (!isCleanFilename(newName)) {
      error = new InvalidFilenameError()
      return dispatch({ type: ACTION_TYPES.ERROR, error })
    }

    // check for duplicates
    if (!isNameUniqueInFolder(fileTreeData, found.parentFolderId, newName)) {
      error = new DuplicateFilenameError()
      return dispatch({ type: ACTION_TYPES.ERROR, error })
    }

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
  }

  // init deletion flow (this will open the delete modal).
  // A copy of the selected entities is set as `actionedEntities` so it is kept
  // unchanged as the entities are deleted and the selection is updated
  function startDeleting() {
    const actionedEntities = Array.from(selectedEntityIds).map(
      entityId => findInTreeOrThrow(fileTreeData, entityId).entity
    )
    dispatch({ type: ACTION_TYPES.START_DELETE, actionedEntities })
  }

  // deletes entities in serie. Tree will be updated via the socket event
  function finishDeleting() {
    dispatch({ type: ACTION_TYPES.DELETING })

    return mapSeries(Array.from(selectedEntityIds), id => {
      const found = findInTreeOrThrow(fileTreeData, id)
      return syncDelete(projectId, found.type, found.entity._id).catch(
        error => {
          // throw unless 404
          if (error.info.statusCode !== '404') {
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
  }

  // moves entities. Tree is updated immediately and data are sync'd after.
  function finishMoving(toFolderId, draggedEntityIds) {
    draggedEntityIds.forEach(selectedEntityId => {
      dispatchMove(selectedEntityId, toFolderId)
    })

    return mapSeries(Array.from(draggedEntityIds), id => {
      const found = findInTreeOrThrow(fileTreeData, id)
      return syncMove(projectId, found.type, found.entity._id, toFolderId)
    })
  }

  function startCreatingFolder() {
    dispatch({ type: ACTION_TYPES.START_CREATE_FOLDER })
  }

  function finishCreatingEntity(entity) {
    const parentFolderId = getSelectedParentFolderId(
      fileTreeData,
      selectedEntityIds
    )

    // check for duplicates and throw
    if (isNameUniqueInFolder(fileTreeData, parentFolderId, entity.name)) {
      return syncCreateEntity(projectId, parentFolderId, entity)
    } else {
      return Promise.reject(new DuplicateFilenameError())
    }
  }

  function finishCreatingFolder(name) {
    dispatch({ type: ACTION_TYPES.CREATING_FOLDER })
    return finishCreatingEntity({ endpoint: 'folder', name })
      .then(() => {
        dispatch({ type: ACTION_TYPES.CLEAR })
      })
      .catch(error => {
        dispatch({ type: ACTION_TYPES.ERROR, error })
      })
  }

  // bypass React file tree entirely; requesting the Angular new doc or file
  // modal instead
  function startCreatingDocOrFile() {
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

  function startUploadingDocOrFile() {
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

  function finishCreatingDocOrFile(entity) {
    return finishCreatingEntity(entity)
      .then(() => {
        // dispatch FileTreeReactBridge event to update the Angular modal
        window.dispatchEvent(
          new CustomEvent('FileTreeReactBridge.openNewFileModal', {
            detail: {
              done: true
            }
          })
        )
      })
      .catch(error => {
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
      })
  }

  function finishCreatingDoc(entity) {
    entity.endpoint = 'doc'
    return finishCreatingDocOrFile(entity)
  }

  function finishCreatingLinkedFile(entity) {
    entity.endpoint = 'linked_file'
    return finishCreatingDocOrFile(entity)
  }

  function cancel() {
    dispatch({ type: ACTION_TYPES.CANCEL })
  }

  return {
    canDelete: selectedEntityIds.size > 0,
    canRename: selectedEntityIds.size === 1,
    canCreate: selectedEntityIds.size < 2,
    isDeleting,
    isRenaming,
    isCreatingFolder,
    inFlight,
    actionedEntities,
    error,
    startRenaming,
    finishRenaming,
    startDeleting,
    finishDeleting,
    finishMoving,
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
