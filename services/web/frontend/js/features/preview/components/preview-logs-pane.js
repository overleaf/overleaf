import React from 'react'
import PropTypes from 'prop-types'
import PreviewLogEntry from './preview-log-entry'

function PreviewLogsPane({ logEntries, onLogEntryLinkClick }) {
  return (
    <div className="logs-pane">
      {logEntries && logEntries.length > 0 ? (
        logEntries.map((logEntry, idx) => (
          <PreviewLogEntry
            key={idx}
            {...logEntry}
            onLogEntryLinkClick={onLogEntryLinkClick}
          />
        ))
      ) : (
        <div>No logs</div>
      )}
    </div>
  )
}

PreviewLogsPane.propTypes = {
  logEntries: PropTypes.array,
  onLogEntryLinkClick: PropTypes.func.isRequired
}

export default PreviewLogsPane
