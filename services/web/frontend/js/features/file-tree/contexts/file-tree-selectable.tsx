// TODO: The types in this file have mismatches between string and string[] and
// it's not immediately clear how to resolve it. I've therefore left in a bunch
// of `any` types. We should fix this.
import {
  createContext,
  useCallback,
  useContext,
  useReducer,
  useEffect,
  useMemo,
  useState,
  FC,
} from 'react'
import classNames from 'classnames'
import _ from 'lodash'
import { findInTree, findInTreeOrThrow } from '../util/find-in-tree'
import { useFileTreeData } from '../../../shared/context/file-tree-data-context'
import { useProjectContext } from '../../../shared/context/project-context'
import { useLayoutContext } from '../../../shared/context/layout-context'
import usePersistedState from '../../../shared/hooks/use-persisted-state'
import usePreviousValue from '../../../shared/hooks/use-previous-value'
import { useFileTreeMainContext } from '@/features/file-tree/contexts/file-tree-main'
import { FindResult } from '@/features/file-tree/util/path'
import { fileCollator } from '@/features/file-tree/util/file-collator'
import { Folder } from '../../../../../types/folder'
import { FileTreeEntity } from '../../../../../types/file-tree-entity'
import { isMac } from '@/shared/utils/os'
import useEventListener from '@/shared/hooks/use-event-listener'

const FileTreeSelectableContext = createContext<
  | {
      selectedEntityIds: Set<string>
      isRootFolderSelected: boolean
      selectOrMultiSelectEntity: (
        id: string | string[],
        multiple?: boolean
      ) => void
      setIsRootFolderSelected: (value: boolean) => void
      selectedEntityParentIds: Set<string>
      select: (id: string | string[]) => void
      unselect: (id: string) => void
    }
  | undefined
>(undefined)

/* eslint-disable no-unused-vars */
enum ACTION_TYPES {
  SELECT = 'SELECT',
  MULTI_SELECT = 'MULTI_SELECT',
  UNSELECT = 'UNSELECT',
}
/* eslint-enable no-unused-vars */

type Action =
  | {
      type: ACTION_TYPES.SELECT
      id: string
    }
  | {
      type: ACTION_TYPES.MULTI_SELECT
      id: string
    }
  | {
      type: ACTION_TYPES.UNSELECT
      id: string
    }

function fileTreeSelectableReadWriteReducer(
  selectedEntityIds: Set<string>,
  action: Action
) {
  switch (action.type) {
    case ACTION_TYPES.SELECT: {
      // reset selection
      return new Set(Array.isArray(action.id) ? action.id : [action.id])
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
      throw new Error(
        `Unknown selectable action type: ${(action as Action).type}`
      )
  }
}

function fileTreeSelectableReadOnlyReducer(
  selectedEntityIds: Set<string>,
  action: Action
) {
  switch (action.type) {
    case ACTION_TYPES.SELECT:
      return new Set([action.id])

    case ACTION_TYPES.MULTI_SELECT:
    case ACTION_TYPES.UNSELECT:
      return selectedEntityIds

    default:
      throw new Error(
        `Unknown selectable action type: ${(action as Action).type}`
      )
  }
}

export const FileTreeSelectableProvider: FC<
  React.PropsWithChildren<{
    onSelect: (value: FindResult[]) => void
  }>
> = ({ onSelect, children }) => {
  const { projectId, project } = useProjectContext()
  const rootDocId = project?.rootDocId

  const [initialSelectedEntityId] = usePersistedState(
    `doc.open_id.${projectId}`,
    rootDocId
  )

  const { fileTreeData, setSelectedEntities, fileTreeReadOnly } =
    useFileTreeData()

  const [isRootFolderSelected, setIsRootFolderSelected] = useState(false)

  const [selectedEntityIds, dispatch] = useReducer(
    fileTreeReadOnly
      ? fileTreeSelectableReadOnlyReducer
      : fileTreeSelectableReadWriteReducer,
    null,
    () => {
      if (!initialSelectedEntityId) return new Set<string>()

      // the entity with id=initialSelectedEntityId might not exist in the tree
      // anymore. This checks that it exists before initialising the reducer
      // with the id.
      if (findInTree(fileTreeData, initialSelectedEntityId))
        return new Set([initialSelectedEntityId])

      // the entity doesn't exist anymore; don't select any files
      return new Set<string>()
    }
  )

  const [selectedEntityParentIds, setSelectedEntityParentIds] = useState<
    Set<string>
  >(new Set())

  // fills `selectedEntityParentIds` set
  useEffect(() => {
    const ids = new Set<string>()
    selectedEntityIds.forEach(id => {
      const found = findInTree(fileTreeData, id)
      if (found) {
        found.path.forEach((pathItem: any) => ids.add(pathItem))
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
      .filter(entity => entity !== null)
    onSelect(_selectedEntities)
    setSelectedEntities(_selectedEntities)
  }, [
    fileTreeData,
    selectedEntityIds,
    previousSelectedEntityIds,
    onSelect,
    setSelectedEntities,
  ])

  // Synchronize the file tree when openFileWithId or openDocWithId is called on the editor
  // manager context from elsewhere. If the file tree does change, it will
  // trigger the onSelect handler in this component, which will update the local
  // state.
  useEventListener(
    'entity:opened',
    useCallback(
      (event: CustomEvent<string>) => {
        const found = findInTree(fileTreeData, event.detail)
        if (!found) return

        dispatch({ type: ACTION_TYPES.SELECT, id: found.entity._id })
      },
      [fileTreeData]
    )
  )

  const select = useCallback((id: any) => {
    dispatch({ type: ACTION_TYPES.SELECT, id })
  }, [])

  const unselect = useCallback((id: any) => {
    dispatch({ type: ACTION_TYPES.UNSELECT, id })
  }, [])

  const selectOrMultiSelectEntity = useCallback(
    (id: any, isMultiSelect: any) => {
      const actionType = isMultiSelect
        ? ACTION_TYPES.MULTI_SELECT
        : ACTION_TYPES.SELECT

      dispatch({ type: actionType, id })
    },
    []
  )

  // TODO: wrap in useMemo
  const value = {
    selectedEntityIds,
    selectedEntityParentIds,
    select,
    unselect,
    selectOrMultiSelectEntity,
    isRootFolderSelected,
    setIsRootFolderSelected,
  }

  return (
    <FileTreeSelectableContext.Provider value={value}>
      {children}
    </FileTreeSelectableContext.Provider>
  )
}

export function useSelectableEntity(id: string, type: string) {
  const { view, setView } = useLayoutContext()
  const { setContextMenuCoords } = useFileTreeMainContext()
  const { fileTreeData } = useFileTreeData()
  const {
    selectedEntityIds,
    selectOrMultiSelectEntity,
    isRootFolderSelected,
    setIsRootFolderSelected,
  } = useFileTreeSelectable()

  const isSelected = selectedEntityIds.has(id)

  const buildSelectedRange = useCallback(
    (id: string) => {
      const selected = []

      let started = false

      for (const itemId of sortedItems(fileTreeData)) {
        if (itemId === id) {
          selected.push(itemId)
          if (started) {
            break
          } else {
            started = true
          }
        } else if (selectedEntityIds.has(itemId)) {
          // TODO: should only look at latest ("main") selected item
          selected.push(itemId)
          if (started) {
            break
          } else {
            started = true
          }
        } else if (started) {
          selected.push(itemId)
        }
      }

      return selected
    },
    [fileTreeData, selectedEntityIds]
  )

  const chooseView = useCallback(() => {
    for (const id of selectedEntityIds) {
      const selectedEntity = findInTreeOrThrow(fileTreeData, id)

      if (selectedEntity.type === 'doc') {
        return 'editor'
      }

      if (selectedEntity.type === 'fileRef') {
        return 'file'
      }

      if (selectedEntity.type === 'folder') {
        return view
      }
    }

    return null
  }, [fileTreeData, selectedEntityIds, view])

  const handleEvent = useCallback(
    (ev: any) => {
      ev.stopPropagation()
      // use Command (macOS) or Ctrl (other OS) to select multiple items,
      // as long as the root folder wasn't selected
      const multiSelect =
        !isRootFolderSelected && (isMac ? ev.metaKey : ev.ctrlKey)
      setIsRootFolderSelected(false)

      if (ev.shiftKey) {
        // use Shift to select a range of items
        selectOrMultiSelectEntity(buildSelectedRange(id))
      } else {
        selectOrMultiSelectEntity(id, multiSelect)
      }

      if (type === 'file') {
        setView('file')
      } else if (type === 'doc') {
        setView('editor')
      } else if (type === 'folder') {
        setView(chooseView())
      }
    },
    [
      id,
      isRootFolderSelected,
      setIsRootFolderSelected,
      selectOrMultiSelectEntity,
      setView,
      type,
      buildSelectedRange,
      chooseView,
    ]
  )

  const handleClick = useCallback(
    (ev: any) => {
      handleEvent(ev)
      if (!ev.ctrlKey && !ev.metaKey) {
        setContextMenuCoords(null)
      }
    },
    [handleEvent, setContextMenuCoords]
  )

  const handleKeyPress = useCallback(
    (ev: any) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        handleEvent(ev)
      }
    },
    [handleEvent]
  )

  const handleContextMenu = useCallback(
    (ev: any) => {
      // make sure the right-clicked entity gets selected
      if (!selectedEntityIds.has(id)) {
        handleEvent(ev)
      }
    },
    [id, handleEvent, selectedEntityIds]
  )

  const isVisuallySelected =
    !isRootFolderSelected && isSelected && view !== 'pdf'
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

export function useFileTreeSelectable() {
  const context = useContext(FileTreeSelectableContext)

  if (!context) {
    throw new Error(
      `useFileTreeSelectable is only available inside FileTreeSelectableProvider`
    )
  }

  return context
}

const alphabetical = (a: FileTreeEntity, b: FileTreeEntity) =>
  fileCollator.compare(a.name, b.name)

function* sortedItems(folder: Folder): Generator<string> {
  yield folder._id

  const folders = [...folder.folders].sort(alphabetical)
  for (const subfolder of folders) {
    for (const id of sortedItems(subfolder)) {
      yield id
    }
  }

  const files = [...folder.docs, ...folder.fileRefs].sort(alphabetical)
  for (const file of files) {
    yield file._id
  }
}
