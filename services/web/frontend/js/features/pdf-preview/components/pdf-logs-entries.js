import { memo } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import PreviewLogsPaneMaxEntries from '../../preview/components/preview-logs-pane-max-entries'
import PdfLogEntry from './pdf-log-entry'
import { useDetachCompileContext } from '../../../shared/context/detach-compile-context'

const LOG_PREVIEW_LIMIT = 100

function PdfLogsEntries({ entries, hasErrors }) {
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
      {logEntries.map(logEntry => (
        <PdfLogEntry
          key={logEntry.key}
          ruleId={logEntry.ruleId}
          headerTitle={logEntry.message}
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
PdfLogsEntries.propTypes = {
  entries: PropTypes.arrayOf(PropTypes.object),
  hasErrors: PropTypes.bool,
}

export default memo(PdfLogsEntries)
