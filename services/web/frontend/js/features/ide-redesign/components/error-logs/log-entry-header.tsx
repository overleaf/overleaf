import classNames from 'classnames'
import { useState, useRef, MouseEventHandler, ElementType } from 'react'
import { useTranslation } from 'react-i18next'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import {
  ErrorLevel,
  SourceLocation,
  LogEntry as LogEntryData,
} from '@/features/pdf-preview/util/types'
import useResizeObserver from '@/features/preview/hooks/use-resize-observer'
import OLIconButton from '@/features/ui/components/ol/ol-icon-button'
import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'
import MaterialIcon from '@/shared/components/material-icon'

const actionComponents = importOverleafModules(
  'pdfLogEntryHeaderActionComponents'
) as {
  import: { default: ElementType }
  path: string
}[]

function LogEntryHeader({
  sourceLocation,
  level,
  headerTitle,
  logType,
  showSourceLocationLink = true,
  onSourceLocationClick,
  collapsed,
  onToggleCollapsed,
  id,
  logEntry,
  actionButtonsOverride,
  openCollapseIconOverride,
}: {
  headerTitle: string | React.ReactNode
  level: ErrorLevel
  logType?: string
  sourceLocation?: SourceLocation
  showSourceLocationLink?: boolean
  onSourceLocationClick?: MouseEventHandler<HTMLButtonElement>
  collapsed: boolean
  onToggleCollapsed: () => void
  id?: string
  logEntry?: LogEntryData
  actionButtonsOverride?: React.ReactNode
  openCollapseIconOverride?: string
}) {
  const { t } = useTranslation()
  const logLocationSpanRef = useRef<HTMLSpanElement>(null)
  const [locationSpanOverflown, setLocationSpanOverflown] = useState(false)

  useResizeObserver(
    logLocationSpanRef,
    locationSpanOverflown,
    checkLocationSpanOverflow
  )

  const file = sourceLocation ? sourceLocation.file : null
  const line = sourceLocation ? sourceLocation.line : null
  const logEntryHeaderTextClasses = classNames('log-entry-header-text', {
    'log-entry-header-text-error': level === 'error',
    'log-entry-header-text-warning': level === 'warning',
    'log-entry-header-text-info': level === 'info' || level === 'typesetting',
    'log-entry-header-text-success': level === 'success',
    'log-entry-header-text-raw': level === 'raw',
  })

  function checkLocationSpanOverflow(observedElement: ResizeObserverEntry) {
    const spanEl = observedElement.target
    const isOverflowing = spanEl.scrollWidth > spanEl.clientWidth
    setLocationSpanOverflown(isOverflowing)
  }

  const locationText =
    showSourceLocationLink && file ? `${file}${line ? `, ${line}` : ''}` : null

  // Because we want an ellipsis on the left-hand side (e.g. "...longfilename.tex"), the
  // `log-entry-location` class has text laid out from right-to-left using the CSS
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
  const formattedLocationText = locationText ? (
    <span ref={logLocationSpanRef} className="log-entry-location">
      {`\u202A${locationText}\u202C`}
    </span>
  ) : null

  const headerTitleText = logType ? `${logType} ${headerTitle}` : headerTitle

  return (
    <header className="log-entry-header-card">
      <OLTooltip
        id={`expand-collapse-${locationText}`}
        description={collapsed ? t('expand') : t('collapse')}
        overlayProps={{ placement: 'bottom' }}
      >
        <button
          data-action="expand-collapse"
          data-collapsed={collapsed}
          className="log-entry-header-button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? t('expand') : t('collapse')}
        >
          <MaterialIcon
            type={
              openCollapseIconOverride ??
              (collapsed ? 'chevron_right' : 'expand_more')
            }
          />
          <div className="log-entry-header-content">
            <h3 className={logEntryHeaderTextClasses}>{headerTitleText}</h3>
            {locationSpanOverflown && formattedLocationText && locationText ? (
              <OLTooltip
                id={locationText}
                description={locationText}
                overlayProps={{ placement: 'left' }}
                tooltipProps={{ className: 'log-location-tooltip' }}
              >
                {formattedLocationText}
              </OLTooltip>
            ) : (
              formattedLocationText
            )}
          </div>
        </button>
      </OLTooltip>

      {actionButtonsOverride ?? (
        <div className="log-entry-header-actions">
          {showSourceLocationLink && (
            <OLTooltip
              id={`go-to-location-${locationText}`}
              description={t('go_to_code_location')}
              overlayProps={{ placement: 'bottom' }}
            >
              <OLIconButton
                onClick={onSourceLocationClick}
                variant="ghost"
                icon="my_location"
                accessibilityLabel={t('go_to_code_location')}
              />
            </OLTooltip>
          )}
          {actionComponents.map(({ import: { default: Component }, path }) => (
            <Component key={path} logEntry={logEntry} id={id} />
          ))}
        </div>
      )}
    </header>
  )
}

export default LogEntryHeader
