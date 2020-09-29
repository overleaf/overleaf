import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'
import Icon from '../../../shared/components/icon'

function PreviewLogsToggleButton({
  onToggle,
  showLogs,
  logsState: { nErrors, nWarnings }
}) {
  const toggleButtonClasses = classNames('btn', 'btn-xs', 'btn-toggle-logs', {
    'btn-danger': !showLogs && nErrors,
    'btn-warning': !showLogs && !nErrors && nWarnings,
    'btn-default': showLogs || (!nErrors && !nWarnings)
  })

  function handleOnClick(e) {
    e.currentTarget.blur()
    onToggle()
  }

  return (
    <button
      type="button"
      className={toggleButtonClasses}
      onClick={handleOnClick}
    >
      {showLogs ? (
        <ViewPdfButton />
      ) : (
        <CompilationResultIndicator nErrors={nErrors} nWarnings={nWarnings} />
      )}
    </button>
  )
}

function CompilationResultIndicator({ nErrors, nWarnings }) {
  if (nErrors) {
    return <ErrorsCompilationResultIndicator nErrors={nErrors} />
  } else if (nWarnings) {
    return <WarningsCompilationResultIndicator nWarnings={nWarnings} />
  } else {
    return <ViewLogsButton />
  }
}

function ErrorsCompilationResultIndicator({ nErrors }) {
  const { t } = useTranslation()
  return (
    <>
      <Icon type="file-text-o" />
      <span className="btn-toggle-logs-label">
        {`${t('your_project_has_errors')} (${nErrors > 9 ? '9+' : nErrors})`}
      </span>
    </>
  )
}

function WarningsCompilationResultIndicator({ nWarnings }) {
  const { t } = useTranslation()
  return (
    <>
      <Icon type="file-text-o" />
      <span className="btn-toggle-logs-label">
        {`${t('view_warnings')} (${nWarnings > 9 ? '9+' : nWarnings})`}
      </span>
    </>
  )
}

function ViewLogsButton() {
  const { t } = useTranslation()
  return (
    <>
      <Icon type="file-text-o" />
      <span className="btn-toggle-logs-label">{t('view_logs')}</span>
    </>
  )
}

function ViewPdfButton() {
  const { t } = useTranslation()
  return (
    <>
      <Icon type="file-pdf-o" />
      <span className="btn-toggle-logs-label">{t('view_pdf')}</span>
    </>
  )
}

PreviewLogsToggleButton.propTypes = {
  onToggle: PropTypes.func.isRequired,
  logsState: PropTypes.shape({
    nErrors: PropTypes.number.isRequired,
    nWarnings: PropTypes.number.isRequired,
    nLogEntries: PropTypes.number.isRequired
  }),
  showLogs: PropTypes.bool.isRequired
}

ErrorsCompilationResultIndicator.propTypes = {
  nErrors: PropTypes.number.isRequired
}

WarningsCompilationResultIndicator.propTypes = {
  nWarnings: PropTypes.number.isRequired
}

export default PreviewLogsToggleButton
