import React from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import PreviewLogEntry from './preview-log-entry'

function PreviewLogsPane({ logEntries, rawLog, onLogEntryLocationClick }) {
  const { t } = useTranslation()

  return (
    <div className="logs-pane">
      {logEntries && logEntries.length > 0 ? (
        logEntries.map((logEntry, idx) => (
          <PreviewLogEntry
            key={idx}
            {...logEntry}
            onLogEntryLocationClick={onLogEntryLocationClick}
          />
        ))
      ) : (
        <div>No logs</div>
      )}

      <PreviewLogEntry content={rawLog} level="raw" message={t('raw_logs')} />
    </div>
  )
}

PreviewLogsPane.propTypes = {
  logEntries: PropTypes.array,
  rawLog: PropTypes.string,
  onLogEntryLocationClick: PropTypes.func.isRequired
}

export default PreviewLogsPane
