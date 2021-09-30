import { memo, useCallback } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import PreviewLogsPaneEntry from '../../preview/components/preview-logs-pane-entry'

function PdfLogsEntries({ entries }) {
  const { t } = useTranslation()

  const syncToEntry = useCallback(entry => {
    window.dispatchEvent(
      new CustomEvent('synctex:sync-to-entry', {
        detail: entry,
      })
    )
  }, [])

  return (
    <>
      {entries.map(logEntry => (
        <PreviewLogsPaneEntry
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
