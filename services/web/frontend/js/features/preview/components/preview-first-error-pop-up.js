import React from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import Icon from '../../../shared/components/icon'
import PreviewLogsPaneEntry from './preview-logs-pane-entry'
import { OverlayTrigger, Tooltip } from 'react-bootstrap'

function PreviewFirstErrorPopUp({
  logEntry,
  onGoToErrorLocation,
  onViewLogs,
  onClose
}) {
  const { t } = useTranslation()

  function handleGoToErrorLocation() {
    const { file, line, column } = logEntry
    onGoToErrorLocation({ file, line, column })
  }

  return (
    <div
      className="first-error-popup"
      role="alertdialog"
      aria-label={t('first_error_popup_label')}
    >
      <PreviewLogsPaneEntry
        headerTitle={logEntry.message}
        headerIcon={<FirstErrorPopUpInfoBadge />}
        rawContent={logEntry.content}
        formattedContent={logEntry.humanReadableHintComponent}
        extraInfoURL={logEntry.extraInfoURL}
        level={logEntry.level}
        showLineAndNoLink={false}
        showCloseButton
        customClass="log-entry-first-error-popup"
        onClose={onClose}
      />
      <div className="first-error-popup-actions">
        <button
          className="btn btn-info btn-xs first-error-btn"
          type="button"
          onClick={handleGoToErrorLocation}
        >
          <Icon type="chain" />
          &nbsp;
          {t('go_to_error_location')}
        </button>
        <button
          className="btn btn-info btn-xs first-error-btn"
          type="button"
          onClick={onViewLogs}
        >
          <Icon type="file-text-o" />
          &nbsp;
          {t('view_all_errors')}
        </button>
      </div>
    </div>
  )
}

function FirstErrorPopUpInfoBadge() {
  const { t } = useTranslation()
  const logsPaneInfoMessage = t('logs_pane_info_message_popup')
  const tooltip = (
    <Tooltip id="file-tree-badge-tooltip">{logsPaneInfoMessage}</Tooltip>
  )

  return (
    <OverlayTrigger placement="bottom" overlay={tooltip} delayHide={100}>
      <a
        href="https://forms.gle/AUbDDRvroQ7KFwHR9"
        target="_blank"
        rel="noopener noreferrer"
        className="info-badge-fade-bg"
      >
        <span className="sr-only">{logsPaneInfoMessage}</span>
      </a>
    </OverlayTrigger>
  )
}

PreviewFirstErrorPopUp.propTypes = {
  logEntry: PropTypes.object.isRequired,
  onGoToErrorLocation: PropTypes.func.isRequired,
  onViewLogs: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired
}

export default PreviewFirstErrorPopUp
