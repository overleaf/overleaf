import React, { ReactNode, useEffect } from 'react'
import { Panel, PanelGroup } from 'react-resizable-panels'
import { HorizontalResizeHandle } from '@/features/ide-react/components/resize/horizontal-resize-handle'
import { useTranslation } from 'react-i18next'
import { HorizontalToggler } from '@/features/ide-react/components/resize/horizontal-toggler'
import useFixedSizeColumn from '@/features/ide-react/hooks/use-fixed-size-column'
import useCollapsiblePanel from '@/features/ide-react/hooks/use-collapsible-panel'

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
  shouldPersistLayout?: boolean
}

export default function TwoColumnMainContent({
  leftColumnId,
  leftColumnContent,
  leftColumnDefaultSize,
  setLeftColumnDefaultSize,
  rightColumnContent,
  leftColumnIsOpen,
  setLeftColumnIsOpen,
  shouldPersistLayout = false,
}: TwoColumnMainContentProps) {
  const { t } = useTranslation()

  const {
    fixedPanelRef: leftColumnPanelRef,
    fixedPanelWidthRef: leftColumnWidthRef,
    handleLayout,
  } = useFixedSizeColumn(leftColumnDefaultSize, leftColumnIsOpen)

  useCollapsiblePanel(leftColumnIsOpen, leftColumnPanelRef)

  // Update the left column default size on unmount rather than doing it on
  // every resize, which causes ResizeObserver errors
  useEffect(() => {
    if (leftColumnWidthRef.current) {
      setLeftColumnDefaultSize(leftColumnWidthRef.current.size)
    }
  }, [leftColumnWidthRef, setLeftColumnDefaultSize])

  return (
    <PanelGroup
      autoSaveId={
        shouldPersistLayout ? 'ide-react-main-content-layout' : undefined
      }
      direction="horizontal"
      onLayout={handleLayout}
    >
      <Panel
        ref={leftColumnPanelRef}
        defaultSize={leftColumnDefaultSize}
        minSize={5}
        collapsible
        onCollapse={collapsed => setLeftColumnIsOpen(!collapsed)}
      >
        {leftColumnIsOpen ? leftColumnContent : null}
      </Panel>
      <HorizontalResizeHandle>
        <HorizontalToggler
          id={leftColumnId}
          togglerType="west"
          isOpen={leftColumnIsOpen}
          setIsOpen={isOpen => setLeftColumnIsOpen(isOpen)}
          tooltipWhenOpen={t('tooltip_hide_filetree')}
          tooltipWhenClosed={t('tooltip_show_filetree')}
        />
      </HorizontalResizeHandle>
      <Panel>{rightColumnContent}</Panel>
    </PanelGroup>
  )
}
