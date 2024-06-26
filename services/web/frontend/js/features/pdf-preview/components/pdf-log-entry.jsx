import PropTypes from 'prop-types'
import classNames from 'classnames'
import { memo, useCallback } from 'react'
import PreviewLogEntryHeader from '../../preview/components/preview-log-entry-header'
import PdfLogEntryContent from './pdf-log-entry-content'
import HumanReadableLogsHints from '../../../ide/human-readable-logs/HumanReadableLogsHints'
import { sendMB } from '@/infrastructure/event-tracking'
import getMeta from '@/utils/meta'

function PdfLogEntry({
  ruleId,
  headerTitle,
  headerIcon,
  rawContent,
  logType,
  formattedContent,
  extraInfoURL,
  level,
  sourceLocation,
  showSourceLocationLink = true,
  showCloseButton = false,
  entryAriaLabel = null,
  customClass,
  contentDetails,
  onSourceLocationClick,
  onClose,
  index,
  logEntry,
  id,
}) {
  const showAiErrorAssistant = getMeta('ol-showAiErrorAssistant')

  if (ruleId && HumanReadableLogsHints[ruleId]) {
    const hint = HumanReadableLogsHints[ruleId]
    formattedContent = hint.formattedContent(contentDetails)
    extraInfoURL = hint.extraInfoURL
  }

  const handleLogEntryLinkClick = useCallback(
    event => {
      event.preventDefault()
      onSourceLocationClick(sourceLocation)

      const parts = sourceLocation?.file?.split('.')
      const extension = parts?.length > 1 ? parts.pop() : ''
      sendMB('log-entry-link-click', { level, ruleId, extension })
    },
    [level, onSourceLocationClick, ruleId, sourceLocation]
  )

  return (
    <div
      className={classNames('log-entry', customClass)}
      aria-label={entryAriaLabel}
      data-ruleid={ruleId}
      data-log-entry-id={id}
    >
      <PreviewLogEntryHeader
        level={level}
        sourceLocation={sourceLocation}
        headerTitle={headerTitle}
        headerIcon={headerIcon}
        logType={logType}
        showSourceLocationLink={showSourceLocationLink}
        onSourceLocationClick={handleLogEntryLinkClick}
        showCloseButton={showCloseButton}
        onClose={onClose}
      />

      {(rawContent || formattedContent || showAiErrorAssistant) && (
        <PdfLogEntryContent
          rawContent={rawContent}
          formattedContent={formattedContent}
          extraInfoURL={extraInfoURL}
          index={index}
          logEntry={logEntry}
        />
      )}
    </div>
  )
}

PdfLogEntry.propTypes = {
  ruleId: PropTypes.string,
  sourceLocation: PreviewLogEntryHeader.propTypes.sourceLocation,
  headerTitle: PreviewLogEntryHeader.propTypes.headerTitle,
  headerIcon: PropTypes.element,
  rawContent: PropTypes.string,
  logType: PropTypes.string,
  formattedContent: PropTypes.node,
  extraInfoURL: PropTypes.string,
  level: PropTypes.oneOf([
    'error',
    'warning',
    'info',
    'typesetting',
    'raw',
    'success',
  ]).isRequired,
  customClass: PropTypes.string,
  showSourceLocationLink: PropTypes.bool,
  showCloseButton: PropTypes.bool,
  entryAriaLabel: PropTypes.string,
  contentDetails: PropTypes.arrayOf(PropTypes.string),
  onSourceLocationClick: PropTypes.func,
  onClose: PropTypes.func,
  index: PropTypes.number,
  logEntry: PropTypes.any,
  id: PropTypes.string,
}

export default memo(PdfLogEntry)
