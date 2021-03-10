import React, {
  createContext,
  useCallback,
  useReducer,
  useContext
} from 'react'
import PropTypes from 'prop-types'

import {
  renameInTree,
  deleteInTree,
  moveInTree,
  createEntityInTree
} from '../util/mutate-in-tree'

const FileTreeMutableContext = createContext()

const ACTION_TYPES = {
  RENAME: 'RENAME',
  DELETE: 'DELETE',
  MOVE: 'MOVE',
  CREATE_ENTITY: 'CREATE_ENTITY'
}

function fileTreeMutableReducer({ fileTreeData }, action) {
  switch (action.type) {
    case ACTION_TYPES.RENAME:
      return {
        fileTreeData: renameInTree(fileTreeData, action.id, {
          newName: action.newName
        })
      }
    case ACTION_TYPES.DELETE:
      return {
        fileTreeData: deleteInTree(fileTreeData, action.id)
      }
    case ACTION_TYPES.MOVE:
      return {
        fileTreeData: moveInTree(
          fileTreeData,
          action.entityId,
          action.toFolderId
        )
      }
    case ACTION_TYPES.CREATE_ENTITY:
      return {
        fileTreeData: createEntityInTree(
          fileTreeData,
          action.parentFolderId,
          action.entity
        )
      }
    default:
      throw new Error(`Unknown mutable file tree action type: ${action.type}`)
  }
}

export const FileTreeMutableProvider = function({ rootFolder, children }) {
  const [{ fileTreeData }, dispatch] = useReducer(fileTreeMutableReducer, {
    fileTreeData: rootFolder[0]
  })

  return (
    <FileTreeMutableContext.Provider value={{ fileTreeData, dispatch }}>
      {children}
    </FileTreeMutableContext.Provider>
  )
}

FileTreeMutableProvider.propTypes = {
  rootFolder: PropTypes.array.isRequired,
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node
  ]).isRequired
}

export function useFileTreeMutable() {
  const { fileTreeData, dispatch } = useContext(FileTreeMutableContext)

  const dispatchCreateFolder = useCallback(
    (parentFolderId, entity) => {
      entity.type = 'folder'
      dispatch({
        type: ACTION_TYPES.CREATE_ENTITY,
        parentFolderId,
        entity
      })
    },
    [dispatch]
  )

  const dispatchCreateDoc = useCallback(
    (parentFolderId, entity) => {
      entity.type = 'doc'
      dispatch({
        type: ACTION_TYPES.CREATE_ENTITY,
        parentFolderId,
        entity
      })
    },
    [dispatch]
  )

  const dispatchCreateFile = useCallback(
    (parentFolderId, entity) => {
      entity.type = 'fileRef'
      dispatch({
        type: ACTION_TYPES.CREATE_ENTITY,
        parentFolderId,
        entity
      })
    },
    [dispatch]
  )

  const dispatchRename = useCallback(
    (id, newName) => {
      dispatch({
        type: ACTION_TYPES.RENAME,
        newName,
        id
      })
    },
    [dispatch]
  )

  const dispatchDelete = useCallback(
    id => {
      dispatch({ type: ACTION_TYPES.DELETE, id })
    },
    [dispatch]
  )

  const dispatchMove = useCallback(
    (entityId, toFolderId) => {
      dispatch({ type: ACTION_TYPES.MOVE, entityId, toFolderId })
    },
    [dispatch]
  )

  return {
    fileTreeData,
    dispatchRename,
    dispatchDelete,
    dispatchMove,
    dispatchCreateFolder,
    dispatchCreateDoc,
    dispatchCreateFile
  }
}
