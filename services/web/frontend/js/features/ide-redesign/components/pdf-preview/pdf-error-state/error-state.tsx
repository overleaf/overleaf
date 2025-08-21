import { useRailContext } from '@/features/ide-redesign/contexts/rail-context'
import MaterialIcon from '@/shared/components/material-icon'
import OLButton from '@/shared/components/ol/ol-button'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'

export default function ErrorState({
  title,
  description,
  iconType = 'warning',
  actions,
  iconClassName,
  extraContent,
}: {
  title: string
  description: React.ReactNode
  iconType?: string
  actions?: React.ReactNode
  iconClassName?: string
  extraContent?: React.ReactNode
}) {
  return (
    <div className="pdf-error-state">
      <div className="pdf-error-state-top-section">
        <div
          className={classNames(
            'pdf-error-state-icon',
            'pdf-error-state-warning-icon',
            iconClassName
          )}
        >
          <MaterialIcon type={iconType} />
        </div>
        <div className="pdf-error-state-text">
          <p className="pdf-error-state-label">{title}</p>
          <p className="pdf-error-state-description">{description}</p>
        </div>
        {actions}
      </div>
      {extraContent}
    </div>
  )
}

export const CheckLogsButton = () => {
  const { t } = useTranslation()
  const { openTab: openRailTab } = useRailContext()

  return (
    <OLButton
      variant="secondary"
      size="sm"
      onClick={() => {
        openRailTab('errors')
      }}
    >
      {t('check_logs')}
    </OLButton>
  )
}
