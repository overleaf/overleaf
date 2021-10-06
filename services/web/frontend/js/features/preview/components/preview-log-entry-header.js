import PropTypes from 'prop-types'
import classNames from 'classnames'
import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { OverlayTrigger, Tooltip } from 'react-bootstrap'
import useResizeObserver from '../hooks/use-resize-observer'
import Icon from '../../../shared/components/icon'

function PreviewLogEntryHeader({
  sourceLocation,
  level,
  headerTitle,
  headerIcon,
  logType,
  showSourceLocationLink = true,
  showCloseButton = false,
  onSourceLocationClick,
  onClose,
}) {
  const { t } = useTranslation()
  const logLocationSpanRef = useRef()
  const [locationSpanOverflown, setLocationSpanOverflown] = useState(false)

  useResizeObserver(
    logLocationSpanRef,
    locationSpanOverflown,
    checkLocationSpanOverflow
  )

  const file = sourceLocation ? sourceLocation.file : null
  const line = sourceLocation ? sourceLocation.line : null
  const logEntryHeaderClasses = classNames('log-entry-header', {
    'log-entry-header-error': level === 'error',
    'log-entry-header-warning': level === 'warning',
    'log-entry-header-typesetting': level === 'typesetting',
    'log-entry-header-raw': level === 'raw',
    'log-entry-header-success': level === 'success',
  })
  const logEntryLocationBtnClasses = classNames('log-entry-header-link', {
    'log-entry-header-link-error': level === 'error',
    'log-entry-header-link-warning': level === 'warning',
    'log-entry-header-link-typesetting': level === 'typesetting',
    'log-entry-header-link-raw': level === 'raw',
    'log-entry-header-link-success': level === 'success',
  })
  const headerLogLocationTitle = t('navigate_log_source', {
    location: file + (line ? `, ${line}` : ''),
  })

  function checkLocationSpanOverflow(observedElement) {
    const spanEl = observedElement.target
    const isOverflowing = spanEl.scrollWidth > spanEl.clientWidth
    setLocationSpanOverflown(isOverflowing)
  }

  const locationLinkText =
    showSourceLocationLink && file ? `${file}${line ? `, ${line}` : ''}` : null

  // Because we want an ellipsis on the left-hand side (e.g. "...longfilename.tex"), the
  // `log-entry-header-link-location` class has text laid out from right-to-left using the CSS
  // rule `direction: rtl;`.
  // This works most of the times, except when the first character of the filename is considered
  // a punctuation mark, like `/` (e.g. `/foo/bar/baz.sty`). In this case, because of
  // right-to-left writing rules, the punctuation mark is moved to the right-side of the string,
  // resulting in `...bar/baz.sty/` instead of `...bar/baz.sty`.
  // To avoid this edge-case, we wrap the `logLocationLinkText` in two directional formatting
  // characters:
  //   * \u202A LEFT-TO-RIGHT EMBEDDING Treat the following text as embedded left-to-right.
  //   * \u202C POP DIRECTIONAL FORMATTING End the scope of the last LRE, RLE, RLO, or LRO.
  // This essentially tells the browser that, althought the text is laid out from right-to-left,
  // the wrapped portion of text should follow left-to-right writing rules.
  const locationLink = locationLinkText ? (
    <button
      className={logEntryLocationBtnClasses}
      type="button"
      aria-label={headerLogLocationTitle}
      onClick={onSourceLocationClick}
    >
      <Icon type="chain" />
      &nbsp;
      <span ref={logLocationSpanRef} className="log-entry-header-link-location">
        {`\u202A${locationLinkText}\u202C`}
      </span>
    </button>
  ) : null

  const locationTooltip =
    locationSpanOverflown && locationLinkText ? (
      <Tooltip id={locationLinkText} className="log-location-tooltip">
        {locationLinkText}
      </Tooltip>
    ) : null

  var headerTitleText = logType ? `${logType} ${headerTitle}` : headerTitle

  return (
    <header className={logEntryHeaderClasses}>
      {headerIcon ? (
        <div className="log-entry-header-icon-container">{headerIcon}</div>
      ) : null}
      <h3 className="log-entry-header-title">{headerTitleText}</h3>
      {locationTooltip ? (
        <OverlayTrigger placement="left" overlay={locationTooltip}>
          {locationLink}
        </OverlayTrigger>
      ) : (
        locationLink
      )}
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

PreviewLogEntryHeader.propTypes = {
  sourceLocation: PropTypes.shape({
    file: PropTypes.string,
    // `line should be either a number or null (i.e. not required), but currently sometimes we get
    // an empty string (from BibTeX errors), which is why we're using `any` here. We should revert
    // to PropTypes.number (not required) once we fix that.
    line: PropTypes.any,
    column: PropTypes.any,
  }),
  level: PropTypes.string.isRequired,
  headerTitle: PropTypes.string,
  headerIcon: PropTypes.element,
  logType: PropTypes.string,
  showSourceLocationLink: PropTypes.bool,
  showCloseButton: PropTypes.bool,
  onSourceLocationClick: PropTypes.func,
  onClose: PropTypes.func,
}

export default PreviewLogEntryHeader
