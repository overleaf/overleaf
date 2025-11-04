import { memo, MouseEventHandler, useCallback } from 'react'
import PreviewLogEntryHeader from '../../preview/components/preview-log-entry-header'
import PdfLogEntryContent from './pdf-log-entry-content'
import HumanReadableLogsHints from '../../../ide/human-readable-logs/HumanReadableLogsHints'
import getMeta from '@/utils/meta'
import { ErrorLevel, LogEntry, SourceLocation } from '../util/types'
import NewLogEntry from '@/features/ide-redesign/components/error-logs/log-entry'
import { useEditorAnalytics } from '@/shared/hooks/use-editor-analytics'
import { useIsNewEditorEnabled } from '@/features/ide-redesign/utils/new-editor-utils'

function PdfLogEntry({
  autoExpand,
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
  entryAriaLabel = undefined,
  contentDetails,
  onSourceLocationClick,
  index,
  logEntry,
  id,
}: {
  headerTitle: string | React.ReactNode
  level: ErrorLevel
  autoExpand?: boolean
  ruleId?: string
  headerIcon?: React.ReactElement
  rawContent?: string
  logType?: string
  formattedContent?: React.ReactNode
  extraInfoURL?: string | null
  sourceLocation?: SourceLocation
  showSourceLocationLink?: boolean
  entryAriaLabel?: string
  contentDetails?: string[]
  onSourceLocationClick?: (sourceLocation: SourceLocation) => void
  index?: number
  logEntry?: LogEntry
  id?: string
}) {
  const showAiErrorAssistant = getMeta('ol-showAiErrorAssistant')
  const { sendEvent } = useEditorAnalytics()

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
          sendEvent('log-entry-link-click', { level, ruleId, extension })
        }
      },
      [level, onSourceLocationClick, ruleId, sourceLocation, sendEvent]
    )

  const newEditor = useIsNewEditorEnabled()

  if (newEditor) {
    return (
      <NewLogEntry
        autoExpand={autoExpand}
        index={index}
        id={id}
        logEntry={logEntry}
        ruleId={ruleId}
        headerTitle={headerTitle}
        formattedContent={formattedContent}
        rawContent={rawContent}
        logType={logType}
        level={level}
        contentDetails={contentDetails}
        entryAriaLabel={entryAriaLabel}
        sourceLocation={sourceLocation}
        onSourceLocationClick={handleLogEntryLinkClick}
        showSourceLocationLink={showSourceLocationLink}
        extraInfoURL={extraInfoURL}
      />
    )
  }

  return (
    <div
      className="log-entry"
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
