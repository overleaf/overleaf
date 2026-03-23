import { useFileTreeOpenContext } from '@/features/ide-react/context/file-tree-open-context'
import {
  TAB_TRANSFER_TYPE,
  useTabsContext,
} from '@/features/ide-react/context/tabs-context'
import { Tab } from './tab'
import SplitTestBadge from '@/shared/components/split-test-badge'
import { useCallback, useMemo, useState } from 'react'
import { throttle } from 'lodash'
import { debugConsole } from '@/utils/debugging'
import classNames from 'classnames'

export const TabsContainer = () => {
  const { tabs, openTab, closeTab, moveTab, makeTabPermanent } =
    useTabsContext()
  const { openEntity } = useFileTreeOpenContext()
  const [hovered, setHovered] = useState<boolean>(false)

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

  return (
    <div className="editor-tabs-container">
      <div
        className={classNames('editor-tabs-row', {
          'editor-tabs-row-hovered': hovered,
        })}
        role="tablist"
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragLeave={onDragLeave}
        tabIndex={-1}
      >
        {tabs.map(tab => (
          <Tab
            key={tab.id}
            tab={tab}
            openTab={openTab}
            closeTab={closeTab}
            isSelected={openEntity?.entity._id === tab.id}
            onTabDrop={moveTab}
            makeTabPermanent={makeTabPermanent}
          />
        ))}
      </div>
      <div className="editor-tabs-labs-icon">
        <SplitTestBadge
          splitTestName="editor-tabs"
          displayOnVariants={['enabled']}
        />
      </div>
    </div>
  )
}
