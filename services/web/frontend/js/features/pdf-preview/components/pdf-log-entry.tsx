import classNames from 'classnames'
import { memo, MouseEventHandler, useCallback } from 'react'
import PreviewLogEntryHeader from '../../preview/components/preview-log-entry-header'
import PdfLogEntryContent from './pdf-log-entry-content'
import HumanReadableLogsHints from '../../../ide/human-readable-logs/HumanReadableLogsHints'
import { sendMB } from '@/infrastructure/event-tracking'
import getMeta from '@/utils/meta'
import { ErrorLevel, LogEntry, SourceLocation } from '../util/types'

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
  entryAriaLabel = undefined,
  customClass,
  contentDetails,
  onSourceLocationClick,
  onClose,
  index,
  logEntry,
  id,
}: {
  headerTitle: string | React.ReactNode
  level: ErrorLevel
  ruleId?: string
  headerIcon?: React.ReactElement
  rawContent?: string
  logType?: string
  formattedContent?: React.ReactNode
  extraInfoURL?: string | null
  sourceLocation?: SourceLocation
  showSourceLocationLink?: boolean
  showCloseButton?: boolean
  entryAriaLabel?: string
  customClass?: string
  contentDetails?: string[]
  onSourceLocationClick?: (sourceLocation: SourceLocation) => void
  onClose?: () => void
  index?: number
  logEntry?: LogEntry
  id?: string
}) {
  const showAiErrorAssistant = getMeta('ol-showAiErrorAssistant')

  if (ruleId && HumanReadableLogsHints[ruleId]) {
    const hint = HumanReadableLogsHints[ruleId]
    formattedContent = hint.formattedContent(contentDetails)
    extraInfoURL = hint.extraInfoURL
  }

  const handleLogEntryLinkClick: MouseEventHandler<HTMLButtonElement> =
    useCallback(
      event => {
        event.preventDefault()

        if (onSourceLocationClick && sourceLocation) {
          onSourceLocationClick(sourceLocation)

          const parts = sourceLocation?.file?.split('.')
          const extension =
            parts?.length && parts?.length > 1 ? parts.pop() : ''
          sendMB('log-entry-link-click', { level, ruleId, extension })
        }
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

export default memo(PdfLogEntry)
