import { findInTree } from '@/features/file-tree/util/find-in-tree'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { useProjectContext } from '@/shared/context/project-context'
import usePersistedState from '@/shared/hooks/use-persisted-state'
import React, {
  FC,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useFileTreeOpenContext } from './file-tree-open-context'
import { useEditorManagerContext } from './editor-manager-context'
import { debugConsole } from '@/utils/debugging'
import { disambiguatePaths } from '../util/disambiguate-paths'
import { useUserSettingsContext } from '@/shared/context/user-settings-context'
import {
  FileTreeFindResult,
  isFileRefResult,
} from '@/features/ide-react/types/file-tree'
import { useAreTabsEnabled } from '../hooks/use-are-tabs-enabled'

type PersistedTabInfo = { id: string; lifetime: Lifetime }

type Lifetime = 'permanent' | 'temporary'

export type EditorFileTab = {
  id: string
  name: string
  displayPath: string
  isLinkedFile: boolean
  lifetime: Lifetime
}

export const TAB_TRANSFER_TYPE = 'text/x.tab-id'

export type TabsContextMenuTarget = {
  top: number
  left: number
  tabId: string
}

const TabsContext = React.createContext<
  | {
      tabs: EditorFileTab[]
      openTab: (id: string) => void
      closeTab: (id: string) => void
      closeOtherTabs: (id: string) => void
      makeTabPermanent: (id: string) => void
      closeToRight: (id: string) => void
      moveTab: (
        sourceTabId: string,
        targetTabId: string,
        position: 'left' | 'right'
      ) => void
      contextMenuTarget: TabsContextMenuTarget | null
      setContextMenuTarget: React.Dispatch<
        React.SetStateAction<TabsContextMenuTarget | null>
      >
      headerSlot: HTMLElement | null
      setHeaderSlot: React.Dispatch<React.SetStateAction<HTMLElement | null>>
    }
  | undefined
>(undefined)

export const TabsProvider: FC<React.PropsWithChildren> = ({ children }) => {
  const { projectId } = useProjectContext()
  const { fileTreeData } = useFileTreeData()

  const { openEntity } = useFileTreeOpenContext()
  const { openDocWithId, openFileWithId } = useEditorManagerContext()
  const tabsEnabled = useAreTabsEnabled()
  const { userSettings } = useUserSettingsContext()
  const { previewTabs } = userSettings

  const [openTabs, setOpenTabs] = usePersistedState<PersistedTabInfo[]>(
    `open-tabs:${projectId}`,
    []
  )

  const [contextMenuTarget, setContextMenuTarget] =
    useState<TabsContextMenuTarget | null>(null)

  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null)

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
      .filter(x => !!x.result) as {
      lifetime: Lifetime
      result: FileTreeFindResult
    }[]

    const pathLookup = disambiguatePaths(
      tabsFileTreeLookup.map(tab => tab.result),
      fileTreeData
    )

    return tabsFileTreeLookup.map(tab => {
      const entity = tab.result.entity

      return {
        id: entity._id,
        name: entity.name,
        displayPath: pathLookup.get(entity._id) || entity.name,
        isLinkedFile:
          isFileRefResult(tab.result) &&
          !!tab.result.entity.linkedFileData?.provider,
        lifetime: tab.lifetime,
      }
    })
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

  const closeOtherTabs = useCallback(
    async (id: string) => {
      if (id !== openEntity?.entity._id) {
        await openTab(id)
      }
      setOpenTabs(current => current.filter(tab => tab.id === id))
    },
    [openEntity, openTab, setOpenTabs]
  )

  const closeToRight = useCallback(
    async (id: string) => {
      const tabIndex = openTabs.findIndex(tab => tab.id === id)
      if (tabIndex === -1) {
        debugConsole.warn(
          'Attempting to close to right on tab that is not open'
        )
        return
      }
      const openTabIndex = openTabs.findIndex(
        tab => tab.id === openEntity?.entity._id
      )
      if (openTabIndex === -1 || openTabIndex > tabIndex) {
        await openTab(id)
      }
      setOpenTabs(current => {
        const currentIndex = current.findIndex(tab => tab.id === id)
        if (currentIndex === -1) {
          return current
        }
        return current.slice(0, currentIndex + 1)
      })
    },
    [setOpenTabs, openTabs, openEntity, openTab]
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
        {
          id: openEntity.entity._id,
          lifetime: previewTabs ? 'temporary' : 'permanent',
        },
      ]
    })
  }, [openEntity, previewTabs, setOpenTabs, tabsEnabled])

  useEffect(() => {
    if (!tabsEnabled) {
      return
    }
    // Make sure file tree is ready for lookup before pruning tabs, to avoid
    // accidentally closing tabs that are still valid but not yet available
    if (!fileTreeData?._id) {
      return
    }
    setOpenTabs(current => {
      const pruned = current.filter(tab => findInTree(fileTreeData, tab.id))
      if (pruned.length === current.length) {
        return current
      }
      return pruned
    })
  }, [fileTreeData, setOpenTabs, tabsEnabled])

  const value = useMemo(
    () => ({
      tabs,
      openTab,
      closeTab,
      closeOtherTabs,
      moveTab,
      makeTabPermanent,
      contextMenuTarget,
      setContextMenuTarget,
      closeToRight,
      headerSlot,
      setHeaderSlot,
    }),
    [
      tabs,
      openTab,
      closeTab,
      closeOtherTabs,
      moveTab,
      makeTabPermanent,
      contextMenuTarget,
      setContextMenuTarget,
      closeToRight,
      headerSlot,
      setHeaderSlot,
    ]
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
