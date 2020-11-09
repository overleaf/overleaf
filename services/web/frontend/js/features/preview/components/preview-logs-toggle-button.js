import React from 'react'
import { OverlayTrigger, Tooltip } from 'react-bootstrap'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'
import Icon from '../../../shared/components/icon'

function PreviewLogsToggleButton({
  onToggle,
  showLogs,
  logsState: { nErrors, nWarnings },
  showText
}) {
  const { t } = useTranslation()
  const toggleButtonClasses = classNames(
    'btn',
    'btn-xs',
    'btn-toggle-logs',
    'toolbar-item',
    {
      'btn-danger': !showLogs && nErrors,
      'btn-warning': !showLogs && !nErrors && nWarnings,
      'btn-default': showLogs || (!nErrors && !nWarnings)
    }
  )

  let textStyle = {}
  if (!showText) {
    textStyle = {
      position: 'absolute',
      right: '-100vw'
    }
  }

  function handleOnClick(e) {
    e.currentTarget.blur()
    onToggle()
  }

  const buttonElement = (
    <button
      id="logs-toggle"
      type="button"
      className={toggleButtonClasses}
      onClick={handleOnClick}
    >
      {showLogs ? (
        <ViewPdfButton textStyle={textStyle} />
      ) : (
        <CompilationResultIndicator
          textStyle={textStyle}
          nErrors={nErrors}
          nWarnings={nWarnings}
        />
      )}
    </button>
  )

  return showText ? (
    buttonElement
  ) : (
    <OverlayTrigger
      placement="bottom"
      overlay={
        <Tooltip id="tooltip-logs-toggle">
          {showLogs ? t('view_pdf') : t('view_logs')}
        </Tooltip>
      }
    >
      {buttonElement}
    </OverlayTrigger>
  )
}

function CompilationResultIndicator({ textStyle, nErrors, nWarnings }) {
  if (nErrors || nWarnings) {
    return (
      <LogsCompilationResultIndicator
        logType={nErrors ? 'errors' : 'warnings'}
        nLogs={nErrors || nWarnings}
        textStyle={textStyle}
      />
    )
  } else {
    return <ViewLogsButton textStyle={textStyle} />
  }
}

function LogsCompilationResultIndicator({ textStyle, logType, nLogs }) {
  const { t } = useTranslation()
  const label =
    logType === 'errors' ? t('your_project_has_errors') : t('view_warnings')
  return (
    <>
      <Icon type="file-text-o" />
      <span
        className="btn-toggle-logs-label toolbar-text"
        aria-label={label}
        style={textStyle}
      >
        {`${label} (${nLogs > 9 ? '9+' : nLogs})`}
      </span>
    </>
  )
}

function ViewLogsButton({ textStyle }) {
  const { t } = useTranslation()
  return (
    <>
      <Icon type="file-text-o" />
      <span className="toolbar-text" style={textStyle}>
        {t('view_logs')}
      </span>
    </>
  )
}

function ViewPdfButton({ textStyle }) {
  const { t } = useTranslation()
  return (
    <>
      <Icon type="file-pdf-o" />
      <span className="toolbar-text" style={textStyle}>
        {t('view_pdf')}
      </span>
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
  showLogs: PropTypes.bool.isRequired,
  showText: PropTypes.bool.isRequired
}

LogsCompilationResultIndicator.propTypes = {
  logType: PropTypes.string.isRequired,
  nLogs: PropTypes.number.isRequired,
  textStyle: PropTypes.object.isRequired
}

ViewLogsButton.propTypes = {
  textStyle: PropTypes.object.isRequired
}

ViewPdfButton.propTypes = {
  textStyle: PropTypes.object.isRequired
}

export default PreviewLogsToggleButton
