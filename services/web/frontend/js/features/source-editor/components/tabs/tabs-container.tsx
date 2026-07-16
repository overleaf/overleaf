import { useFileTreeOpenContext } from '@/features/ide-react/context/file-tree-open-context'
import {
  TAB_TRANSFER_TYPE,
  useTabsContext,
} from '@/features/ide-react/context/tabs-context'
import { Tab } from './tab'
import { TabsContextMenu } from './tabs-context-menu'
import { useCallback, useMemo, useState } from 'react'
import { throttle } from 'lodash'
import { debugConsole } from '@/utils/debugging'
import classNames from 'classnames'
import { useCommandProvider } from '@/features/ide-react/hooks/use-command-provider'
import { useTranslation } from 'react-i18next'

export const TabsContainer = () => {
  const {
    tabs,
    openTab,
    closeTab,
    moveTab,
    makeTabPermanent,
    setContextMenuTarget,
    setHeaderSlot,
    closeOtherTabs,
  } = useTabsContext()
  const { openEntity } = useFileTreeOpenContext()
  const [hovered, setHovered] = useState<boolean>(false)
  const { t } = useTranslation()

  const openContextMenu = useCallback(
    (coords: { top: number; left: number }, tabId: string) => {
      setContextMenuTarget({ ...coords, tabId })
    },
    [setContextMenuTarget]
  )

  const closeContextMenu = useCallback(() => {
    setContextMenuTarget(null)
  }, [setContextMenuTarget])

  const throttledOnDragOver = useMemo(
    () =>
      throttle(() => {
        setHovered(true)
      }, 50),
    []
  )

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      throttledOnDragOver()
    },
    [throttledOnDragOver]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      throttledOnDragOver.cancel()
      e.stopPropagation()
      e.preventDefault()
      setHovered(false)

      const draggedTabId = e.dataTransfer.getData(TAB_TRANSFER_TYPE)
      if (!draggedTabId) {
        debugConsole.warn('No dragged tab id found in dataTransfer')
        return
      }
      const targetTabId = tabs[tabs.length - 1]?.id
      if (!targetTabId) {
        debugConsole.warn('No target tab id found for drop')
        return
      }
      moveTab(draggedTabId, targetTabId, 'right')
    },
    [tabs, moveTab, throttledOnDragOver]
  )

  const onDragLeave = useCallback(() => {
    throttledOnDragOver.cancel()
    setHovered(false)
  }, [throttledOnDragOver])

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (e.deltaY !== 0 && e.deltaX === 0) {
      // if this is a purely vertical scroll, convert it to a horizontal scroll
      // instead
      e.currentTarget.scrollLeft += e.deltaY
    }
  }, [])

  useCommandProvider(() => {
    if (tabs.length === 0) {
      return
    }
    if (!openEntity?.entity._id) {
      return
    }

    return [
      {
        id: 'close-tab',
        label: t('close_tab'),
        handler: () => {
          closeTab(openEntity.entity._id)
        },
      },
      {
        id: 'close-other-tabs',
        label: t('close_other_tabs'),
        handler: () => {
          closeOtherTabs(openEntity.entity._id)
        },
      },
    ]
  }, [tabs, t, openEntity, closeTab, closeOtherTabs])

  return (
    <div className="editor-tabs-container">
      <div className="review-panel-header-slot" ref={setHeaderSlot} />
      <div
        className={classNames('editor-tabs-row', {
          'editor-tabs-row-hovered': hovered,
        })}
        role="tablist"
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragLeave={onDragLeave}
        onWheel={onWheel}
        tabIndex={-1}
      >
        {tabs.map(tab => (
          <Tab
            key={tab.id}
            tab={tab}
            openTab={openTab}
            closeTab={closeTab}
            canCloseTab={tabs.length > 1}
            isSelected={openEntity?.entity._id === tab.id}
            onTabDrop={moveTab}
            makeTabPermanent={makeTabPermanent}
            openContextMenu={openContextMenu}
            closeContextMenu={closeContextMenu}
          />
        ))}
      </div>
      <TabsContextMenu />
    </div>
  )
}
