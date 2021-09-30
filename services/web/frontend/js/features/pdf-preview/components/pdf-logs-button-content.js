import { useTranslation } from 'react-i18next'
import Icon from '../../../shared/components/icon'
import PropTypes from 'prop-types'
import { memo } from 'react'

export function PdfLogsButtonContent({
  showLogs,
  logEntries,
  autoCompileLintingError,
}) {
  const { t } = useTranslation()

  if (showLogs) {
    return (
      <>
        <Icon type="file-pdf-o" />
        <span className="toolbar-text toolbar-hide-small">{t('view_pdf')}</span>
      </>
    )
  }

  if (autoCompileLintingError) {
    return (
      <>
        <Icon type="exclamation-triangle" />
        <span className="toolbar-text toolbar-hide-small">
          {t('code_check_failed')}
        </span>
      </>
    )
  }

  const count = logEntries?.errors?.length || logEntries?.warnings?.length

  if (!count) {
    return (
      <>
        <Icon type="file-text-o" />
        <span className="toolbar-text toolbar-hide-small">
          {t('view_logs')}
        </span>
      </>
    )
  }

  return (
    <>
      <Icon type="file-text-o" />
      <span className="btn-toggle-logs-label toolbar-text toolbar-hide-small">
        {logEntries.errors?.length
          ? t('your_project_has_an_error', { count })
          : t('view_warning', { count })}
        <span className="sr-hidden">
          {count > 1 && ` (${count > 99 ? '99+' : count})`}
        </span>
      </span>
    </>
  )
}

PdfLogsButtonContent.propTypes = {
  autoCompileLintingError: PropTypes.bool,
  showLogs: PropTypes.bool,
  logEntries: PropTypes.object,
}

export default memo(PdfLogsButtonContent)
