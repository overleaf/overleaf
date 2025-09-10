import {
  Dispatch,
  MouseEventHandler,
  memo,
  SetStateAction,
  useState,
} from 'react'
import HumanReadableLogsHints from '../../../../ide/human-readable-logs/HumanReadableLogsHints'
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
  onSourceLocationClick?: MouseEventHandler<HTMLButtonElement>
  index?: number
  logEntry?: LogEntryData
  id?: string
  alwaysExpandRawContent?: boolean
  className?: string
  actionButtonsOverride?: React.ReactNode
  openCollapseIconOverride?: string
}

function LogEntry(props: LogEntryProps & { autoExpand?: boolean }) {
  const [collapsed, setCollapsed] = useState(!props.autoExpand)

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
        onSourceLocationClick={onSourceLocationClick}
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
