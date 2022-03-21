import {
  createContext,
  useCallback,
  useReducer,
  useContext,
  useMemo,
  useState,
} from 'react'
import PropTypes from 'prop-types'
import useScopeValue from '../hooks/use-scope-value'
import {
  renameInTree,
  deleteInTree,
  moveInTree,
  createEntityInTree,
} from '../../features/file-tree/util/mutate-in-tree'
import { countFiles } from '../../features/file-tree/util/count-in-tree'
import useDeepCompareEffect from '../../shared/hooks/use-deep-compare-effect'

const FileTreeDataContext = createContext()

const fileTreeDataPropType = PropTypes.shape({
  _id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  docs: PropTypes.array.isRequired,
  fileRefs: PropTypes.array.isRequired,
  folders: PropTypes.array.isRequired,
})

FileTreeDataContext.Provider.propTypes = {
  value: PropTypes.shape({
    // fileTreeData is the up-to-date representation of the files list, updated
    // by the file tree
    fileTreeData: fileTreeDataPropType,
    hasFolders: PropTypes.bool,
  }),
}

const ACTION_TYPES = {
  RENAME: 'RENAME',
  RESET: 'RESET',
  DELETE: 'DELETE',
  MOVE: 'MOVE',
  CREATE: 'CREATE',
}

function fileTreeMutableReducer({ fileTreeData }, action) {
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
      throw new Error(`Unknown mutable file tree action type: ${action.type}`)
    }
  }
}

const initialState = rootFolder => {
  const fileTreeData = rootFolder?.[0]
  return {
    fileTreeData,
    fileCount: countFiles(fileTreeData),
  }
}

export function useFileTreeData(propTypes) {
  const context = useContext(FileTreeDataContext)

  if (!context) {
    throw new Error(
      'useFileTreeData is only available inside FileTreeDataProvider'
    )
  }

  PropTypes.checkPropTypes(
    propTypes,
    context,
    'data',
    'FileTreeDataContext.Provider'
  )

  return context
}

export function FileTreeDataProvider({ children }) {
  const [project] = useScopeValue('project', true)

  const { rootFolder } = project || {}

  const [{ fileTreeData, fileCount }, dispatch] = useReducer(
    fileTreeMutableReducer,
    rootFolder,
    initialState
  )

  const [selectedEntities, setSelectedEntities] = useState([])

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

  const dispatchCreateDoc = useCallback((parentFolderId, entity) => {
    entity.type = 'doc'
    dispatch({
      type: ACTION_TYPES.CREATE,
      parentFolderId,
      entity,
    })
  }, [])

  const dispatchCreateFile = useCallback((parentFolderId, entity) => {
    entity.type = 'fileRef'
    dispatch({
      type: ACTION_TYPES.CREATE,
      parentFolderId,
      entity,
    })
  }, [])

  const dispatchRename = useCallback((id, newName) => {
    dispatch({
      type: ACTION_TYPES.RENAME,
      newName,
      id,
    })
  }, [])

  const dispatchDelete = useCallback(id => {
    dispatch({ type: ACTION_TYPES.DELETE, id })
  }, [])

  const dispatchMove = useCallback((entityId, toFolderId) => {
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
      hasFolders: fileTreeData?.folders.length > 0,
      selectedEntities,
      setSelectedEntities,
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
    selectedEntities,
    setSelectedEntities,
  ])

  return (
    <FileTreeDataContext.Provider value={value}>
      {children}
    </FileTreeDataContext.Provider>
  )
}

FileTreeDataProvider.propTypes = {
  children: PropTypes.any,
}
