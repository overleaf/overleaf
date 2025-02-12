import { ElementType, memo } from 'react'
import { useTranslation } from 'react-i18next'
import PreviewLogsPaneMaxEntries from '../../preview/components/preview-logs-pane-max-entries'
import PdfLogEntry from './pdf-log-entry'
import { useDetachCompileContext } from '../../../shared/context/detach-compile-context'
import importOverleafModules from '../../../../macros/import-overleaf-module.macro'
import { LogEntry } from '../util/types'

const LOG_PREVIEW_LIMIT = 100

const pdfLogEntriesComponents = importOverleafModules(
  'pdfLogEntriesComponents'
) as {
  import: { default: ElementType }
  path: string
}[]

function PdfLogsEntries({
  entries,
  hasErrors,
}: {
  entries: LogEntry[]
  hasErrors?: boolean
}) {
  const { t } = useTranslation()
  const { syncToEntry } = useDetachCompileContext()
  const logEntries = entries.slice(0, LOG_PREVIEW_LIMIT)

  return (
    <>
      {entries.length > LOG_PREVIEW_LIMIT && (
        <PreviewLogsPaneMaxEntries
          totalEntries={entries.length}
          entriesShown={LOG_PREVIEW_LIMIT}
          hasErrors={hasErrors}
        />
      )}

      {pdfLogEntriesComponents.map(
        ({ import: { default: Component }, path }) => (
          <Component key={path} />
        )
      )}

      {logEntries.map((logEntry, index) => (
        <PdfLogEntry
          key={logEntry.key}
          index={index}
          id={logEntry.key}
          logEntry={logEntry}
          ruleId={logEntry.ruleId}
          headerTitle={logEntry.messageComponent ?? logEntry.message}
          rawContent={logEntry.content}
          logType={logEntry.type}
          level={logEntry.level}
          contentDetails={logEntry.contentDetails}
          entryAriaLabel={t('log_entry_description', {
            level: logEntry.level,
          })}
          sourceLocation={{
            file: logEntry.file,
            line: logEntry.line,
            column: logEntry.column,
          }}
          onSourceLocationClick={syncToEntry}
        />
      ))}
    </>
  )
}

export default memo(PdfLogsEntries)
