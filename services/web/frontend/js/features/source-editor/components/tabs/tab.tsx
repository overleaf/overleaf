import {
  EditorFileTab,
  TAB_TRANSFER_TYPE,
} from '@/features/ide-react/context/tabs-context'
import MaterialIcon from '@/shared/components/material-icon'
import { debugConsole } from '@/utils/debugging'
import classNames from 'classnames'
import { throttle } from 'lodash'
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

type TabProps = {
  tab: EditorFileTab
  openTab: (id: string) => void
  closeTab: (id: string) => void
  makeTabPermanent: (id: string) => void
  isSelected: boolean
  onTabDrop: (
    sourceTabId: string,
    targetTabId: string,
    position: 'left' | 'right'
  ) => void
}

function getSideOfTargetFromEvent(
  element: Element,
  clientX: number
): 'left' | 'right' {
  const rect = element.getBoundingClientRect()
  if (rect.left + rect.width / 2 < clientX) {
    return 'right'
  } else {
    return 'left'
  }
}

export const Tab = memo(function Tab({
  tab,
  openTab,
  closeTab,
  makeTabPermanent,
  isSelected,
  onTabDrop,
}: TabProps) {
  const { t } = useTranslation()
  const tabRef = useRef<HTMLDivElement>(null)

  const [dropTargetPosition, setDropTargetPosition] = useState<
    'left' | 'right' | null
  >(null)
  const onDragStart = useCallback(
    (e: React.DragEvent) => {
      e.stopPropagation()
      e.dataTransfer.setData(TAB_TRANSFER_TYPE, tab.id)
      e.dataTransfer.effectAllowed = 'move'
    },
    [tab]
  )

  const throttledOnDragOver = useMemo(
    () =>
      throttle((element: Element, clientX: number) => {
        setDropTargetPosition(getSideOfTargetFromEvent(element, clientX))
      }, 50),
    []
  )

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'move'
      throttledOnDragOver(e.currentTarget, e.clientX)
    },
    [throttledOnDragOver]
  )

  const onDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.stopPropagation()
      throttledOnDragOver.cancel()
      setDropTargetPosition(null)
    },
    [throttledOnDragOver]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      throttledOnDragOver.cancel()
      setDropTargetPosition(null)
      e.preventDefault()
      e.stopPropagation()
      const draggedTabId = e.dataTransfer.getData(TAB_TRANSFER_TYPE)
      if (!draggedTabId) {
        debugConsole.warn('No dragged tab id found in dataTransfer')
        return
      }
      onTabDrop(
        draggedTabId,
        tab.id,
        getSideOfTargetFromEvent(e.currentTarget, e.clientX)
      )
    },
    [onTabDrop, tab, throttledOnDragOver]
  )

  const onDoubleClick = useCallback(() => {
    makeTabPermanent(tab.id)
  }, [makeTabPermanent, tab])

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0) {
        openTab(tab.id)
      }
    },
    [openTab, tab]
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.code === 'Enter') {
        openTab(tab.id)
      }
    },
    [openTab, tab]
  )

  const onCloseClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      closeTab(tab.id)
    },
    [closeTab, tab]
  )

  const onMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1) {
        e.stopPropagation()
        closeTab(tab.id)
      }
    },
    [closeTab, tab]
  )

  useLayoutEffect(() => {
    if (isSelected && tabRef.current) {
      tabRef.current.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
      })
    }
  }, [isSelected])

  useEffect(() => {
    if (isSelected && tab.lifetime === 'temporary') {
      const handler = () => {
        makeTabPermanent(tab.id)
      }
      document.body.addEventListener('keydown', handler)
      return () => {
        document.body.removeEventListener('keydown', handler)
      }
    }
  }, [isSelected, makeTabPermanent, tab])

  return (
    <div
      ref={tabRef}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      draggable
      onDrop={onDrop}
      onDoubleClick={onDoubleClick}
      role="tab"
      aria-selected={isSelected}
      key={tab.id}
      onClick={onClick}
      onMouseUp={onMouseUp}
      onKeyDown={onKeyDown}
      tabIndex={0}
      className={classNames('editor-file-tab', {
        'tab-selected': isSelected,
        'tab-drop-left': dropTargetPosition === 'left',
        'tab-drop-right': dropTargetPosition === 'right',
        'tab-temporary': tab.lifetime === 'temporary',
      })}
    >
      <div className="editor-file-tab-path">&lrm;{tab.displayPath}</div>
      <div className="editor-file-tab-action">
        <button
          onClick={onCloseClick}
          className="editor-file-tab-close-action"
          aria-label={t('close_tab')}
        >
          <MaterialIcon type="close" />
        </button>
      </div>
    </div>
  )
})
