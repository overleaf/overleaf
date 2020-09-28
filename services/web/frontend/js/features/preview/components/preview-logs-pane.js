import React from 'react'
import PropTypes from 'prop-types'
import PreviewLogEntry from './preview-log-entry'

function PreviewLogsPane({ logEntries }) {
  return (
    <div className="pdf-logs">
      {logEntries && logEntries.length > 0 ? (
        logEntries.map((logEntry, idx) => (
          <PreviewLogEntry key={idx} {...logEntry} />
        ))
      ) : (
        <div>No logs</div>
      )}
    </div>
  )
}

PreviewLogsPane.propTypes = {
  logEntries: PropTypes.array
}

export default PreviewLogsPane
