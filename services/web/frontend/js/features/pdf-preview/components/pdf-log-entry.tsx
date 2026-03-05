import { memo } from 'react'
import HumanReadableLogsHints from '../../../ide/human-readable-logs/HumanReadableLogsHints'
import { ErrorLevel, LogEntry, SourceLocation } from '../util/types'
import NewLogEntry from '@/features/pdf-preview/components/log-entry'
import useHandleLogEntryClick from '../hooks/use-handle-log-entry-click'

function PdfLogEntry({
  autoExpand,
  ruleId,
  headerTitle,
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
  if (ruleId && HumanReadableLogsHints[ruleId]) {
    const hint = HumanReadableLogsHints[ruleId]
    formattedContent = hint.formattedContent(contentDetails)
    extraInfoURL = hint.extraInfoURL
  }

  const handleLogEntryLinkClick = useHandleLogEntryClick({
    level,
    ruleId,
    sourceLocation,
    onSourceLocationClick,
  })

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

export default memo(PdfLogEntry)
