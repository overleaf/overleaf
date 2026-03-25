import { findInTree } from '@/features/file-tree/util/find-in-tree'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { useProjectContext } from '@/shared/context/project-context'
import usePersistedState from '@/shared/hooks/use-persisted-state'
import React, { FC, useCallback, useContext, useEffect, useMemo } from 'react'
import { useFileTreeOpenContext } from './file-tree-open-context'
import { useEditorManagerContext } from './editor-manager-context'
import { debugConsole } from '@/utils/debugging'
import { disambiguatePaths } from '../util/disambiguate-paths'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'

type PersistedTabInfo = { id: string; lifetime: Lifetime }

type Lifetime = 'permanent' | 'temporary'

export type EditorFileTab = {
  id: string
  displayPath: string
  lifetime: Lifetime
}

export const TAB_TRANSFER_TYPE = 'text/x.tab-id'

const TabsContext = React.createContext<
  | {
      tabs: EditorFileTab[]
      openTab: (id: string) => void
      closeTab: (id: string) => void
      makeTabPermanent: (id: string) => void
      moveTab: (
        sourceTabId: string,
        targetTabId: string,
        position: 'left' | 'right'
      ) => void
    }
  | undefined
>(undefined)

export const TabsProvider: FC<React.PropsWithChildren> = ({ children }) => {
  const { projectId } = useProjectContext()
  const { fileTreeData } = useFileTreeData()

  const { openEntity } = useFileTreeOpenContext()
  const { openDocWithId, openFileWithId } = useEditorManagerContext()
  const tabsEnabled = isSplitTestEnabled('editor-tabs')

  const [openTabs, setOpenTabs] = usePersistedState<PersistedTabInfo[]>(
    `open-tabs:${projectId}`,
    []
  )

  const tabs = useMemo(() => {
    if (!tabsEnabled) {
      return []
    }
    if (!fileTreeData) {
      return []
    }
    const tabsFileTreeLookup = openTabs
      .map(tab => ({
        lifetime: tab.lifetime,
        result: findInTree(fileTreeData, tab.id),
      }))
      .filter(x => !!x.result)

    const pathLookup = disambiguatePaths(
      tabsFileTreeLookup.map(tab => tab.result!),
      fileTreeData
    )

    return tabsFileTreeLookup.map(tab => ({
      id: tab.result!.entity._id,
      displayPath:
        pathLookup.get(tab.result!.entity._id) || tab.result!.entity.name,
      lifetime: tab.lifetime,
    }))
  }, [fileTreeData, openTabs, tabsEnabled])

  const openTab = useCallback(
    async (id: string) => {
      if (!fileTreeData) {
        return
      }
      const file = findInTree(fileTreeData, id)
      if (!file) {
        return
      }
      if (file.type === 'doc') {
        await openDocWithId(file.entity._id)
      } else if (file.type === 'fileRef') {
        openFileWithId(file.entity._id)
      } else {
        debugConsole.error('Attempting to open invalid entity type')
      }
    },
    [fileTreeData, openDocWithId, openFileWithId]
  )

  const closeTab = useCallback(
    async (id: string) => {
      if (openTabs.length <= 1) {
        // Can't close last file
        return
      }

      if (id === openEntity?.entity._id) {
        const currentIndex = openTabs.findIndex(tab => tab.id === id)
        if (currentIndex === -1) {
          debugConsole.warn('Attempting to close tab that is not open')
          return
        }

        const nextTab = openTabs[currentIndex + 1] || openTabs[currentIndex - 1]
        if (!nextTab) {
          debugConsole.warn('No next tab to switch to on close')
          return
        }

        await openTab(nextTab.id)
      }

      setOpenTabs(current => current.filter(tab => tab.id !== id))
    },
    [openTabs, openEntity, setOpenTabs, openTab]
  )

  const moveTab = useCallback(
    (sourceTabId: string, targetTabId: string, position: 'left' | 'right') => {
      debugConsole.log({ sourceTabId, targetTabId, position })
      if (sourceTabId === targetTabId) {
        debugConsole.debug(
          'Source and target tab ids are the same for moving tab'
        )
        return
      }
      setOpenTabs(current => {
        const sourceTabIndex = current.findIndex(tab => tab.id === sourceTabId)
        const targetTabIndex = current.findIndex(tab => tab.id === targetTabId)
        if (sourceTabIndex === -1 || targetTabIndex === -1) {
          debugConsole.warn('Invalid tab ids for moving tab')
          return current
        }

        if (
          (position === 'right' && targetTabIndex === sourceTabIndex - 1) ||
          (position === 'left' && targetTabIndex === sourceTabIndex + 1)
        ) {
          debugConsole.debug(
            'Source and target tab are already adjacent for move'
          )
          return current
        }

        return arrayMove(current, sourceTabIndex, targetTabIndex, position)
      })
    },
    [setOpenTabs]
  )

  const makeTabPermanent = useCallback(
    (id: string) => {
      setOpenTabs(current =>
        current.map(tab =>
          tab.id === id ? { ...tab, lifetime: 'permanent' } : tab
        )
      )
    },
    [setOpenTabs]
  )

  useEffect(() => {
    if (!tabsEnabled) {
      return
    }

    if (!openEntity) {
      return
    }

    setOpenTabs(current => {
      if (current.find(t => t.id === openEntity?.entity._id)) {
        return current
      }
      return [
        ...current.filter(tab => tab.lifetime !== 'temporary'),
        { id: openEntity.entity._id, lifetime: 'temporary' },
      ]
    })
  }, [openEntity, setOpenTabs, tabsEnabled])

  const value = useMemo(
    () => ({ tabs, openTab, closeTab, moveTab, makeTabPermanent }),
    [tabs, openTab, closeTab, moveTab, makeTabPermanent]
  )

  return <TabsContext.Provider value={value}>{children}</TabsContext.Provider>
}

export const useTabsContext = () => {
  const value = useContext(TabsContext)
  if (!value) {
    throw new Error('useTabsContext can only be used inside TabsProvider')
  }
  return value
}

function arrayMove<T>(
  array: T[],
  sourceIndex: number,
  targetIndex: number,
  side: 'left' | 'right'
): T[] {
  const result = [...array]

  const [movedItem] = result.splice(sourceIndex, 1)

  let newIndex = targetIndex
  if (sourceIndex < targetIndex) {
    newIndex -= 1
  }

  if (side === 'right') {
    newIndex += 1
  }

  result.splice(newIndex, 0, movedItem)

  return result
}
