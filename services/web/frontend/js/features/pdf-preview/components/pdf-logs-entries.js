import { memo, useCallback } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import PreviewLogsPaneMaxEntries from '../../preview/components/preview-logs-pane-max-entries'
import PdfLogEntry from './pdf-log-entry'

const LOG_PREVIEW_LIMIT = 100

function PdfLogsEntries({ entries }) {
  const { t } = useTranslation()

  const syncToEntry = useCallback(entry => {
    window.dispatchEvent(
      new CustomEvent('synctex:sync-to-entry', {
        detail: entry,
      })
    )
  }, [])

  const logEntries = entries.slice(0, LOG_PREVIEW_LIMIT)

  return (
    <>
      {entries.length > LOG_PREVIEW_LIMIT && (
        <PreviewLogsPaneMaxEntries
          totalEntries={entries.length}
          entriesShown={LOG_PREVIEW_LIMIT}
        />
      )}
      {logEntries.map(logEntry => (
        <PdfLogEntry
          key={logEntry.key}
          headerTitle={logEntry.message}
          rawContent={logEntry.content}
          logType={logEntry.type}
          formattedContent={logEntry.humanReadableHintComponent}
          extraInfoURL={logEntry.extraInfoURL}
          level={logEntry.level}
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
}

export default memo(PdfLogsEntries)
