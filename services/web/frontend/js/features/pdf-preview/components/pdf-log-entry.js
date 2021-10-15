import PropTypes from 'prop-types'
import classNames from 'classnames'
import { memo, useCallback } from 'react'
import PreviewLogEntryHeader from '../../preview/components/preview-log-entry-header'
import PdfLogEntryContent from './pdf-log-entry-content'

function PdfLogEntry({
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
  onSourceLocationClick,
  onClose,
}) {
  const handleLogEntryLinkClick = useCallback(
    event => {
      event.preventDefault()
      onSourceLocationClick(sourceLocation)
    },
    [onSourceLocationClick, sourceLocation]
  )

  return (
    <div
      className={classNames('log-entry', customClass)}
      aria-label={entryAriaLabel}
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
      {(rawContent || formattedContent) && (
        <PdfLogEntryContent
          rawContent={rawContent}
          formattedContent={formattedContent}
          extraInfoURL={extraInfoURL}
        />
      )}
    </div>
  )
}

PdfLogEntry.propTypes = {
  sourceLocation: PreviewLogEntryHeader.propTypes.sourceLocation,
  headerTitle: PropTypes.string,
  headerIcon: PropTypes.element,
  rawContent: PropTypes.string,
  logType: PropTypes.string,
  formattedContent: PropTypes.node,
  extraInfoURL: PropTypes.string,
  level: PropTypes.oneOf(['error', 'warning', 'typesetting', 'raw', 'success'])
    .isRequired,
  customClass: PropTypes.string,
  showSourceLocationLink: PropTypes.bool,
  showCloseButton: PropTypes.bool,
  entryAriaLabel: PropTypes.string,
  onSourceLocationClick: PropTypes.func,
  onClose: PropTypes.func,
}

export default memo(PdfLogEntry)
