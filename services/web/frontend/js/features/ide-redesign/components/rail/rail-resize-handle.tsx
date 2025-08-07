import { HorizontalResizeHandle } from '@/features/ide-react/components/resize/horizontal-resize-handle'
import { HorizontalToggler } from '@/features/ide-react/components/resize/horizontal-toggler'
import classNames from 'classnames'
import { useRailContext } from '../../contexts/rail-context'
import { useTranslation } from 'react-i18next'

export default function RailResizeHandle({
  isReviewPanelOpen,
}: {
  isReviewPanelOpen: boolean
}) {
  const { isOpen, setIsOpen, togglePane, setResizing } = useRailContext()
  const { t } = useTranslation()

  return (
    <HorizontalResizeHandle
      className={classNames({ hidden: isReviewPanelOpen })}
      resizable
      hitAreaMargins={{ coarse: 0, fine: 0 }}
      onDoubleClick={togglePane}
      onDragging={setResizing}
    >
      <HorizontalToggler
        id="ide-redesign-sidebar-panel"
        togglerType="west"
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        tooltipWhenOpen={t('tooltip_hide_panel')}
        tooltipWhenClosed={t('tooltip_show_panel')}
      />
    </HorizontalResizeHandle>
  )
}
