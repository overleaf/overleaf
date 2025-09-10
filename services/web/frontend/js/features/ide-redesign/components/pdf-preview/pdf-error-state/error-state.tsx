import { useRailContext } from '@/features/ide-redesign/contexts/rail-context'
import { sendMB } from '@/infrastructure/event-tracking'
import MaterialIcon from '@/shared/components/material-icon'
import OLButton from '@/shared/components/ol/ol-button'
import classNames from 'classnames'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'

export default function ErrorState({
  title,
  description,
  iconType = 'warning',
  actions,
  iconClassName,
  extraContent,
}: {
  title: string
  description?: React.ReactNode
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
          {description && (
            <p className="pdf-error-state-description">{description}</p>
          )}
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
  const { error } = useCompileContext()

  const onClick = useCallback(() => {
    openRailTab('errors')
    sendMB('check-logs-click', { error })
  }, [openRailTab, error])

  return (
    <OLButton variant="secondary" size="sm" onClick={onClick}>
      {t('check_error_logs')}
    </OLButton>
  )
}
