import { useTranslation } from 'react-i18next'
import { useRailContext } from '../contexts/rail-context'
import OLIconButton from '@/features/ui/components/ol/ol-icon-button'
import React from 'react'

export default function RailPanelHeader({
  title,
  actions,
}: {
  title: string
  actions?: React.ReactNode[]
}) {
  const { t } = useTranslation()
  const { handlePaneCollapse } = useRailContext()
  return (
    <header className="rail-panel-header">
      <h4 className="rail-panel-title">{title}</h4>

      <div className="rail-panel-header-actions">
        {actions}
        <OLIconButton
          onClick={handlePaneCollapse}
          className="rail-panel-header-button-subdued"
          icon="close"
          accessibilityLabel={t('close')}
          size="sm"
        />
      </div>
    </header>
  )
}
