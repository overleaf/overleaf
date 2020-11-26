import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'
import useExpandCollapse from '../../../shared/hooks/use-expand-collapse'
import Icon from '../../../shared/components/icon'

function PreviewLogsPaneEntry({
  headerTitle,
  rawContent,
  formattedContent,
  extraInfoURL,
  level,
  sourceLocation,
  showSourceLocationLink = true,
  showCloseButton = false,
  entryAriaLabel = null,
  onSourceLocationClick,
  onClose
}) {
  function handleLogEntryLinkClick() {
    onSourceLocationClick(sourceLocation)
  }

  return (
    <div className="log-entry" aria-label={entryAriaLabel}>
      <PreviewLogEntryHeader
        level={level}
        sourceLocation={sourceLocation}
        headerTitle={headerTitle}
        showSourceLocationLink={showSourceLocationLink}
        onSourceLocationClick={handleLogEntryLinkClick}
        showCloseButton={showCloseButton}
        onClose={onClose}
      />
      {rawContent || formattedContent ? (
        <PreviewLogEntryContent
          rawContent={rawContent}
          formattedContent={formattedContent}
          extraInfoURL={extraInfoURL}
        />
      ) : null}
    </div>
  )
}

function PreviewLogEntryHeader({
  sourceLocation,
  level,
  headerTitle,
  showSourceLocationLink = true,
  showCloseButton = false,
  onSourceLocationClick,
  onClose
}) {
  const { t } = useTranslation()
  const file = sourceLocation ? sourceLocation.file : null
  const line = sourceLocation ? sourceLocation.line : null
  const logEntryHeaderClasses = classNames('log-entry-header', {
    'log-entry-header-error': level === 'error',
    'log-entry-header-warning': level === 'warning',
    'log-entry-header-typesetting': level === 'typesetting',
    'log-entry-header-raw': level === 'raw'
  })
  const headerLogLocationTitle = t('navigate_log_source', {
    location: file + (line ? `, ${line}` : '')
  })

  return (
    <header className={logEntryHeaderClasses}>
      <h3 className="log-entry-header-title">{headerTitle}</h3>
      {showSourceLocationLink && file ? (
        <button
          className="btn-inline-link log-entry-header-link"
          type="button"
          title={headerLogLocationTitle}
          onClick={onSourceLocationClick}
        >
          <Icon type="chain" />
          &nbsp;
          <span>{file}</span>
          {line ? <span>, {line}</span> : null}
        </button>
      ) : null}
      {showCloseButton ? (
        <button
          className="btn-inline-link log-entry-header-link"
          type="button"
          aria-label={t('dismiss_error_popup')}
          onClick={onClose}
        >
          <span aria-hidden="true">&times;</span>
        </button>
      ) : null}
    </header>
  )
}

function PreviewLogEntryContent({
  rawContent,
  formattedContent,
  extraInfoURL
}) {
  const { isExpanded, expandableProps, toggleProps } = useExpandCollapse({
    collapsedSize: 150,
    classes: {
      container: 'log-entry-content-raw-expandable-container'
    }
  })
  const logContentClasses = classNames('log-entry-content-raw', {
    'log-entry-content-raw-collapsed': !isExpanded
  })
  const buttonContainerClasses = classNames(
    'log-entry-content-button-container',
    {
      'log-entry-content-button-container-collapsed': !isExpanded
    }
  )
  const { t } = useTranslation()

  return (
    <div className="log-entry-content">
      {rawContent ? (
        <div {...expandableProps}>
          <pre className={logContentClasses}>{rawContent.trim()}</pre>
          <div className={buttonContainerClasses}>
            <button
              type="button"
              className="btn btn-xs btn-default log-entry-btn-expand-collapse"
              {...toggleProps}
            >
              {isExpanded ? (
                <>
                  <Icon type="angle-up" /> {t('collapse')}
                </>
              ) : (
                <>
                  <Icon type="angle-down" /> {t('expand')}
                </>
              )}
            </button>
          </div>
        </div>
      ) : null}
      {formattedContent ? (
        <div className="log-entry-formatted-content">{formattedContent}</div>
      ) : null}
      {extraInfoURL ? (
        <div className="log-entry-content-link">
          <a href={extraInfoURL} target="_blank">
            {t('log_hint_extra_info')}
          </a>
        </div>
      ) : null}
    </div>
  )
}

PreviewLogEntryHeader.propTypes = {
  sourceLocation: PropTypes.shape({
    file: PropTypes.string,
    // `line should be either a number or null (i.e. not required), but currently sometimes we get
    // an empty string (from BibTeX errors), which is why we're using `any` here. We should revert
    // to PropTypes.number (not required) once we fix that.
    line: PropTypes.any,
    column: PropTypes.any
  }),
  level: PropTypes.string.isRequired,
  headerTitle: PropTypes.string,
  showSourceLocationLink: PropTypes.bool,
  showCloseButton: PropTypes.bool,
  onSourceLocationClick: PropTypes.func,
  onClose: PropTypes.func
}

PreviewLogEntryContent.propTypes = {
  rawContent: PropTypes.string,
  formattedContent: PropTypes.node,
  extraInfoURL: PropTypes.string
}

PreviewLogsPaneEntry.propTypes = {
  sourceLocation: PreviewLogEntryHeader.propTypes.sourceLocation,
  headerTitle: PropTypes.string,
  rawContent: PropTypes.string,
  formattedContent: PropTypes.node,
  extraInfoURL: PropTypes.string,
  level: PropTypes.oneOf(['error', 'warning', 'typesetting', 'raw']).isRequired,
  showSourceLocationLink: PropTypes.bool,
  showCloseButton: PropTypes.bool,
  entryAriaLabel: PropTypes.string,
  onSourceLocationClick: PropTypes.func,
  onClose: PropTypes.func
}

export default PreviewLogsPaneEntry
