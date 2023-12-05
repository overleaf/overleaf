import React, { ReactNode, useEffect, useState } from 'react'
import { Panel, PanelGroup } from 'react-resizable-panels'
import { HorizontalResizeHandle } from '@/features/ide-react/components/resize/horizontal-resize-handle'
import { useTranslation } from 'react-i18next'
import { HorizontalToggler } from '@/features/ide-react/components/resize/horizontal-toggler'
import useFixedSizeColumn from '@/features/ide-react/hooks/use-fixed-size-column'
import useCollapsiblePanel from '@/features/ide-react/hooks/use-collapsible-panel'
import classNames from 'classnames'

type TwoColumnMainContentProps = {
  leftColumnId: string
  leftColumnContent: ReactNode
  leftColumnDefaultSize: number
  setLeftColumnDefaultSize: React.Dispatch<React.SetStateAction<number>>
  rightColumnContent: ReactNode
  leftColumnIsOpen: boolean
  setLeftColumnIsOpen: (
    leftColumnIsOpen: TwoColumnMainContentProps['leftColumnIsOpen']
  ) => void
}

export default function TwoColumnMainContent({
  leftColumnId,
  leftColumnContent,
  leftColumnDefaultSize,
  setLeftColumnDefaultSize,
  rightColumnContent,
  leftColumnIsOpen,
  setLeftColumnIsOpen,
}: TwoColumnMainContentProps) {
  const { t } = useTranslation()

  const {
    fixedPanelRef: leftColumnPanelRef,
    fixedPanelWidthRef: leftColumnWidthRef,
    handleLayout,
  } = useFixedSizeColumn(leftColumnDefaultSize, leftColumnIsOpen)

  useCollapsiblePanel(leftColumnIsOpen, leftColumnPanelRef)

  const [resizing, setResizing] = useState(false)

  // Update the left column default size on unmount rather than doing it on
  // every resize, which causes ResizeObserver errors
  useEffect(() => {
    if (leftColumnWidthRef.current) {
      setLeftColumnDefaultSize(leftColumnWidthRef.current.size)
    }
  }, [leftColumnWidthRef, setLeftColumnDefaultSize])

  return (
    <PanelGroup
      autoSaveId="ide-react-main-content-layout"
      direction="horizontal"
      onLayout={handleLayout}
      className={classNames({
        'ide-react-main-content-resizing': resizing,
      })}
    >
      <Panel
        ref={leftColumnPanelRef}
        defaultSize={leftColumnDefaultSize}
        minSize={5}
        collapsible
        onCollapse={collapsed => setLeftColumnIsOpen(!collapsed)}
      >
        {leftColumnContent}
      </Panel>
      <HorizontalResizeHandle
        onDoubleClick={() => setLeftColumnIsOpen(!leftColumnIsOpen)}
        resizable={leftColumnIsOpen}
        onDragging={setResizing}
      >
        <HorizontalToggler
          id={leftColumnId}
          togglerType="west"
          isOpen={leftColumnIsOpen}
          setIsOpen={setLeftColumnIsOpen}
          tooltipWhenOpen={t('tooltip_hide_filetree')}
          tooltipWhenClosed={t('tooltip_show_filetree')}
        />
      </HorizontalResizeHandle>
      <Panel className="ide-react-panel">{rightColumnContent}</Panel>
    </PanelGroup>
  )
}
