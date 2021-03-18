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
    case ACTION_TYPES.RENAME: {
      const newFileTreeData = renameInTree(fileTreeData, action.id, {
        newName: action.newName
      })

      return {
        fileTreeData: newFileTreeData,
        fileCount: countFiles(newFileTreeData)
      }
    }

    case ACTION_TYPES.DELETE: {
      const newFileTreeData = deleteInTree(fileTreeData, action.id)

      return {
        fileTreeData: newFileTreeData,
        fileCount: countFiles(newFileTreeData)
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
        fileCount: countFiles(newFileTreeData)
      }
    }

    case ACTION_TYPES.CREATE_ENTITY: {
      const newFileTreeData = createEntityInTree(
        fileTreeData,
        action.parentFolderId,
        action.entity
      )

      return {
        fileTreeData: newFileTreeData,
        fileCount: countFiles(newFileTreeData)
      }
    }

    default: {
      throw new Error(`Unknown mutable file tree action type: ${action.type}`)
    }
  }
}

export const FileTreeMutableProvider = function({ rootFolder, children }) {
  const [{ fileTreeData, fileCount }, dispatch] = useReducer(
    fileTreeMutableReducer,
    {
      fileTreeData: rootFolder[0],
      fileCount: countFiles(rootFolder[0])
    }
  )

  return (
    <FileTreeMutableContext.Provider
      value={{ fileTreeData, fileCount, dispatch }}
    >
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
  const { fileTreeData, fileCount, dispatch } = useContext(
    FileTreeMutableContext
  )

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
    fileCount,
    dispatchRename,
    dispatchDelete,
    dispatchMove,
    dispatchCreateFolder,
    dispatchCreateDoc,
    dispatchCreateFile
  }
}

function filesInFolder({ docs, folders, fileRefs }) {
  const files = [...docs, ...fileRefs]

  for (const folder of folders) {
    files.push(...filesInFolder(folder))
  }

  return files
}

function countFiles(fileTreeData) {
  const files = filesInFolder(fileTreeData)

  // count all the non-deleted entities
  const value = files.filter(item => !item.deleted).length

  const limit = window.ExposedSettings.maxEntitiesPerProject
  const status = fileCountStatus(value, limit, Math.ceil(limit / 20))

  return { value, status, limit }
}

function fileCountStatus(value, limit, range) {
  if (value >= limit) {
    return 'error'
  }

  if (value >= limit - range) {
    return 'warning'
  }

  return 'success'
}
