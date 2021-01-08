import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useState
} from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'

import { findInTree } from '../util/find-in-tree'
import { useFileTreeMutable } from './file-tree-mutable'
import { FileTreeMainContext } from './file-tree-main'
import usePersistedState from '../../../infrastructure/persisted-state-hook'

const FileTreeSelectableContext = createContext()

const ACTION_TYPES = {
  SELECT: 'SELECT',
  MULTI_SELECT: 'MULTI_SELECT',
  UNSELECT: 'UNSELECT'
}

function fileTreeSelectableReadWriteReducer(selectedEntityIds, action) {
  switch (action.type) {
    case ACTION_TYPES.SELECT: {
      // reset selection
      return new Set([action.id])
    }

    case ACTION_TYPES.MULTI_SELECT: {
      const selectedEntityIdsCopy = new Set(selectedEntityIds)
      if (selectedEntityIdsCopy.has(action.id)) {
        // entity already selected
        if (selectedEntityIdsCopy.size > 1) {
          // entity already multi-selected; remove from set
          selectedEntityIdsCopy.delete(action.id)
        }
      } else {
        // entity not selected: add to set
        selectedEntityIdsCopy.add(action.id)
      }

      return selectedEntityIdsCopy
    }

    case ACTION_TYPES.UNSELECT: {
      const selectedEntityIdsCopy = new Set(selectedEntityIds)
      selectedEntityIdsCopy.delete(action.id)
      return selectedEntityIdsCopy
    }

    default:
      throw new Error(`Unknown selectable action type: ${action.type}`)
  }
}

function fileTreeSelectableReadOnlyReducer(selectedEntityIds, action) {
  switch (action.type) {
    case ACTION_TYPES.SELECT:
      return new Set([action.id])

    case ACTION_TYPES.MULTI_SELECT:
    case ACTION_TYPES.UNSELECT:
      return selectedEntityIds

    default:
      throw new Error(`Unknown selectable action type: ${action.type}`)
  }
}

export function FileTreeSelectableProvider({
  hasWritePermissions,
  rootDocId,
  onSelect,
  children
}) {
  const { projectId } = useContext(FileTreeMainContext)

  const [initialSelectedEntityId] = usePersistedState(
    `doc.open_id.${projectId}`,
    rootDocId
  )

  const { fileTreeData } = useFileTreeMutable()

  const [selectedEntityIds, dispatch] = useReducer(
    hasWritePermissions
      ? fileTreeSelectableReadWriteReducer
      : fileTreeSelectableReadOnlyReducer,
    null,
    () => {
      if (!initialSelectedEntityId) return new Set()

      // the entity with id=initialSelectedEntityId might not exist in the tree
      // anymore. This checks that it exists before initialising the reducer
      // with the id.
      if (findInTree(fileTreeData, initialSelectedEntityId))
        return new Set([initialSelectedEntityId])

      // the entity doesn't exist anymore; don't select any files
      return new Set()
    }
  )

  const [selectedEntityParentIds, setSelectedEntityParentIds] = useState(
    new Set()
  )

  // fills `selectedEntityParentIds` set
  useEffect(() => {
    const ids = new Set()
    selectedEntityIds.forEach(id => {
      const found = findInTree(fileTreeData, id)
      if (found) {
        found.path.forEach(pathItem => ids.add(pathItem))
      }
    })
    setSelectedEntityParentIds(ids)
  }, [fileTreeData, selectedEntityIds])

  // calls `onSelect` on entities selection
  useEffect(() => {
    const selectedEntities = Array.from(selectedEntityIds).map(id =>
      findInTree(fileTreeData, id)
    )
    onSelect(selectedEntities)
  }, [fileTreeData, selectedEntityIds, onSelect])

  useEffect(() => {
    // listen for `editor.openDoc` and selected that doc
    function handleOpenDoc(ev) {
      dispatch({ type: ACTION_TYPES.SELECT, id: ev.detail })
    }
    window.addEventListener('editor.openDoc', handleOpenDoc)
    return () => window.removeEventListener('editor.openDoc', handleOpenDoc)
  }, [])

  return (
    <FileTreeSelectableContext.Provider
      value={{ selectedEntityIds, selectedEntityParentIds, dispatch }}
    >
      {children}
    </FileTreeSelectableContext.Provider>
  )
}

FileTreeSelectableProvider.propTypes = {
  hasWritePermissions: PropTypes.bool.isRequired,
  rootDocId: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node
  ]).isRequired
}

export function useSelectableEntity(id) {
  const { selectedEntityIds, dispatch } = useContext(FileTreeSelectableContext)

  const isSelected = selectedEntityIds.has(id)

  function selectOrMultiSelectEntity(ev) {
    const isMultiSelect = ev.ctrlKey || ev.metaKey
    const actionType = isMultiSelect
      ? ACTION_TYPES.MULTI_SELECT
      : ACTION_TYPES.SELECT

    dispatch({ type: actionType, id })
  }

  function handleClick(ev) {
    selectOrMultiSelectEntity(ev)
  }

  function handleKeyPress(ev) {
    if (ev.key === 'Enter' || ev.key === ' ') {
      selectOrMultiSelectEntity(ev)
    }
  }

  function handleContextMenu(ev) {
    // make sure the right-clicked entity gets selected
    if (!selectedEntityIds.has(id)) selectOrMultiSelectEntity(ev)
  }

  return {
    isSelected,
    props: {
      className: classNames({ selected: isSelected }),
      'aria-selected': isSelected,
      onClick: handleClick,
      onContextMenu: handleContextMenu,
      onKeyPress: handleKeyPress
    }
  }
}

export function useFileTreeSelectable() {
  const { selectedEntityIds, selectedEntityParentIds, dispatch } = useContext(
    FileTreeSelectableContext
  )

  function select(id) {
    dispatch({ type: ACTION_TYPES.SELECT, id })
  }

  function unselect(id) {
    dispatch({ type: ACTION_TYPES.UNSELECT, id })
  }

  return {
    selectedEntityIds,
    selectedEntityParentIds,
    select,
    unselect
  }
}
