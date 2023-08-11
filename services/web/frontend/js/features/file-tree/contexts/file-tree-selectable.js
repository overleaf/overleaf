import {
  createContext,
  useCallback,
  useContext,
  useReducer,
  useEffect,
  useMemo,
  useState,
} from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import _ from 'lodash'

import { findInTree } from '../util/find-in-tree'
import { useFileTreeData } from '../../../shared/context/file-tree-data-context'
import { useProjectContext } from '../../../shared/context/project-context'
import { useEditorContext } from '../../../shared/context/editor-context'
import { useLayoutContext } from '../../../shared/context/layout-context'
import usePersistedState from '../../../shared/hooks/use-persisted-state'
import usePreviousValue from '../../../shared/hooks/use-previous-value'

const FileTreeSelectableContext = createContext()

const ACTION_TYPES = {
  SELECT: 'SELECT',
  MULTI_SELECT: 'MULTI_SELECT',
  UNSELECT: 'UNSELECT',
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

export function FileTreeSelectableProvider({ onSelect, children }) {
  const { _id: projectId, rootDocId } = useProjectContext(
    projectContextPropTypes
  )
  const { permissionsLevel } = useEditorContext(editorContextPropTypes)

  const [initialSelectedEntityId] = usePersistedState(
    `doc.open_id.${projectId}`,
    rootDocId
  )

  const { fileTreeData, setSelectedEntities } = useFileTreeData()

  const [selectedEntityIds, dispatch] = useReducer(
    permissionsLevel === 'readOnly'
      ? fileTreeSelectableReadOnlyReducer
      : fileTreeSelectableReadWriteReducer,
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
  const previousSelectedEntityIds = usePreviousValue(selectedEntityIds)
  useEffect(() => {
    if (_.isEqual(selectedEntityIds, previousSelectedEntityIds)) {
      return
    }
    const _selectedEntities = Array.from(selectedEntityIds)
      .map(id => findInTree(fileTreeData, id))
      .filter(Boolean)
    onSelect(_selectedEntities)
    setSelectedEntities(_selectedEntities)
  }, [
    fileTreeData,
    selectedEntityIds,
    previousSelectedEntityIds,
    onSelect,
    setSelectedEntities,
  ])

  useEffect(() => {
    // listen for `editor.openDoc` and selected that doc
    function handleOpenDoc(ev) {
      const found = findInTree(fileTreeData, ev.detail)
      if (!found) return

      dispatch({ type: ACTION_TYPES.SELECT, id: found.entity._id })
    }
    window.addEventListener('editor.openDoc', handleOpenDoc)
    return () => window.removeEventListener('editor.openDoc', handleOpenDoc)
  }, [fileTreeData])

  const select = useCallback(id => {
    dispatch({ type: ACTION_TYPES.SELECT, id })
  }, [])

  const unselect = useCallback(id => {
    dispatch({ type: ACTION_TYPES.UNSELECT, id })
  }, [])

  const selectOrMultiSelectEntity = useCallback((id, isMultiSelect) => {
    const actionType = isMultiSelect
      ? ACTION_TYPES.MULTI_SELECT
      : ACTION_TYPES.SELECT

    dispatch({ type: actionType, id })
  }, [])

  const value = {
    selectedEntityIds,
    selectedEntityParentIds,
    select,
    unselect,
    selectOrMultiSelectEntity,
  }

  return (
    <FileTreeSelectableContext.Provider value={value}>
      {children}
    </FileTreeSelectableContext.Provider>
  )
}

FileTreeSelectableProvider.propTypes = {
  onSelect: PropTypes.func.isRequired,
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]).isRequired,
}

const projectContextPropTypes = {
  _id: PropTypes.string.isRequired,
  rootDocId: PropTypes.string,
}

const editorContextPropTypes = {
  permissionsLevel: PropTypes.oneOf(['readOnly', 'readAndWrite', 'owner']),
}

export function useSelectableEntity(id, isFile) {
  const { view, setView } = useLayoutContext(layoutContextPropTypes)
  const { selectedEntityIds, selectOrMultiSelectEntity } = useContext(
    FileTreeSelectableContext
  )

  const isSelected = selectedEntityIds.has(id)

  const handleEvent = useCallback(
    ev => {
      selectOrMultiSelectEntity(id, ev.ctrlKey || ev.metaKey)
      setView(isFile ? 'file' : 'editor')
    },
    [id, selectOrMultiSelectEntity, setView, isFile]
  )

  const handleClick = useCallback(
    ev => {
      handleEvent(ev)
    },
    [handleEvent]
  )

  const handleKeyPress = useCallback(
    ev => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        handleEvent(ev)
      }
    },
    [handleEvent]
  )

  const handleContextMenu = useCallback(
    ev => {
      // make sure the right-clicked entity gets selected
      if (!selectedEntityIds.has(id)) {
        handleEvent(ev)
      }
    },
    [id, handleEvent, selectedEntityIds]
  )

  const isVisuallySelected = isSelected && view !== 'pdf'
  const props = useMemo(
    () => ({
      className: classNames({ selected: isVisuallySelected }),
      'aria-selected': isVisuallySelected,
      onClick: handleClick,
      onContextMenu: handleContextMenu,
      onKeyPress: handleKeyPress,
    }),
    [handleClick, handleContextMenu, handleKeyPress, isVisuallySelected]
  )

  return { isSelected, props }
}

const layoutContextPropTypes = {
  view: PropTypes.string,
  setView: PropTypes.func.isRequired,
}

export function useFileTreeSelectable() {
  const context = useContext(FileTreeSelectableContext)

  if (!context) {
    throw new Error(
      `useFileTreeSelectable is only available inside FileTreeSelectableProvider`
    )
  }

  return context
}
