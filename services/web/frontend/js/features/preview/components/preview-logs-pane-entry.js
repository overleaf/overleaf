import PropTypes from 'prop-types'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'
import useExpandCollapse from '../../../shared/hooks/use-expand-collapse'
import Icon from '../../../shared/components/icon'

import PreviewLogEntryHeader from './preview-log-entry-header'

function PreviewLogsPaneEntry({
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
  const logEntryClasses = classNames('log-entry', customClass)

  function handleLogEntryLinkClick(e) {
    e.preventDefault()
    onSourceLocationClick(sourceLocation)
  }

  return (
    <div className={logEntryClasses} aria-label={entryAriaLabel}>
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

function PreviewLogEntryContent({
  rawContent,
  formattedContent,
  extraInfoURL,
}) {
  const {
    isExpanded,
    needsExpandCollapse,
    expandableProps,
    toggleProps,
  } = useExpandCollapse({
    collapsedSize: 150,
  })

  const buttonContainerClasses = classNames(
    'log-entry-content-button-container',
    {
      'log-entry-content-button-container-collapsed': !isExpanded,
    }
  )

  const { t } = useTranslation()

  return (
    <div className="log-entry-content">
      {formattedContent ? (
        <div className="log-entry-formatted-content">{formattedContent}</div>
      ) : null}
      {extraInfoURL ? (
        <div className="log-entry-content-link">
          <a href={extraInfoURL} target="_blank" rel="noopener">
            {t('log_hint_extra_info')}
          </a>
        </div>
      ) : null}
      {rawContent ? (
        <div className="log-entry-content-raw-container">
          <div {...expandableProps}>
            <pre className="log-entry-content-raw">{rawContent.trim()}</pre>
          </div>
          {needsExpandCollapse ? (
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
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

PreviewLogEntryContent.propTypes = {
  rawContent: PropTypes.string,
  formattedContent: PropTypes.node,
  extraInfoURL: PropTypes.string,
}

PreviewLogsPaneEntry.propTypes = {
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

export default PreviewLogsPaneEntry
