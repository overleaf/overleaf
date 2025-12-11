import { useTranslation } from 'react-i18next'
import { useRailContext } from '../../contexts/rail-context'
import OLIconButton from '@/shared/components/ol/ol-icon-button'
import React, { useCallback } from 'react'
import OLTooltip from '@/shared/components/ol/ol-tooltip'

export default function RailPanelHeader({
  title,
  actions,
  onClose,
}: {
  title: React.ReactNode
  actions?: React.ReactNode[]
  onClose?: () => void
}) {
  const { t } = useTranslation()
  const { handlePaneCollapse } = useRailContext()

  const handleClose = useCallback(() => {
    handlePaneCollapse()
    if (onClose) {
      onClose()
    }
  }, [handlePaneCollapse, onClose])

  return (
    <div className="rail-panel-header">
      <h4 className="rail-panel-title">{title}</h4>

      <div className="rail-panel-header-actions">
        {actions}
        <OLTooltip
          id="close-rail-panel"
          description={t('close')}
          overlayProps={{ placement: 'bottom' }}
        >
          <OLIconButton
            onClick={handleClose}
            className="rail-panel-header-button-subdued"
            icon="close"
            accessibilityLabel={t('close')}
            size="sm"
          />
        </OLTooltip>
      </div>
    </div>
  )
}
