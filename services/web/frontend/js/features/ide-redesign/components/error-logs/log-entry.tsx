import {
  Dispatch,
  MouseEventHandler,
  useCallback,
  memo,
  SetStateAction,
  useState,
} from 'react'
import HumanReadableLogsHints from '../../../../ide/human-readable-logs/HumanReadableLogsHints'
import { sendMB } from '@/infrastructure/event-tracking'
import {
  ErrorLevel,
  LogEntry as LogEntryData,
  SourceLocation,
} from '@/features/pdf-preview/util/types'
import LogEntryHeader from './log-entry-header'
import PdfLogEntryContent from '@/features/pdf-preview/components/pdf-log-entry-content'
import classNames from 'classnames'

type LogEntryProps = {
  headerTitle: string | React.ReactNode
  level: ErrorLevel
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
  logEntry?: LogEntryData
  id?: string
  alwaysExpandRawContent?: boolean
  className?: string
  actionButtonsOverride?: React.ReactNode
  openCollapseIconOverride?: string
}

function LogEntry(props: LogEntryProps) {
  const [collapsed, setCollapsed] = useState(true)

  return (
    <ControlledLogEntry
      {...props}
      collapsed={collapsed}
      setCollapsed={setCollapsed}
    />
  )
}

export function ControlledLogEntry({
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
  alwaysExpandRawContent = false,
  className,
  collapsed,
  setCollapsed,
  actionButtonsOverride,
  openCollapseIconOverride,
}: LogEntryProps & {
  collapsed: boolean
  setCollapsed: Dispatch<SetStateAction<boolean>>
}) {
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
      className={classNames('log-entry', className)}
      data-ruleid={ruleId}
      data-log-entry-id={id}
      aria-label={entryAriaLabel}
    >
      <LogEntryHeader
        level={level}
        sourceLocation={sourceLocation}
        headerTitle={headerTitle}
        logType={logType}
        showSourceLocationLink={showSourceLocationLink}
        onSourceLocationClick={handleLogEntryLinkClick}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(collapsed => !collapsed)}
        id={id}
        logEntry={logEntry}
        actionButtonsOverride={actionButtonsOverride}
        openCollapseIconOverride={openCollapseIconOverride}
      />
      <div
        className={classNames('horizontal-divider', { hidden: collapsed })}
      />
      <PdfLogEntryContent
        className={classNames({ hidden: collapsed })}
        alwaysExpandRawContent={alwaysExpandRawContent}
        rawContent={rawContent}
        formattedContent={formattedContent}
        extraInfoURL={extraInfoURL}
        index={index}
        logEntry={logEntry}
      />
    </div>
  )
}

export default memo(LogEntry)
