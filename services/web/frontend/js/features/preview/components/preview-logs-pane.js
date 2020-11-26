import React from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import PreviewLogsPaneEntry from './preview-logs-pane-entry'
import PreviewValidationIssue from './preview-validation-issue'
import PreviewError from './preview-error'

function PreviewLogsPane({
  logEntries = [],
  rawLog = '',
  validationIssues = {},
  errors = {},
  onLogEntryLocationClick
}) {
  const { t } = useTranslation()

  const errorsUI = Object.keys(errors).map((name, index) => (
    <PreviewError key={index} name={name} />
  ))

  const validationIssuesUI = Object.keys(validationIssues).map(
    (name, index) => (
      <PreviewValidationIssue
        key={index}
        name={name}
        details={validationIssues[name]}
      />
    )
  )

  const logEntriesUI = logEntries.map((logEntry, idx) => (
    <PreviewLogsPaneEntry
      key={idx}
      headerTitle={logEntry.message}
      rawContent={logEntry.content}
      formattedContent={logEntry.humanReadableHintComponent}
      extraInfoURL={logEntry.extraInfoURL}
      level={logEntry.level}
      entryAriaLabel={t('log_entry_description', {
        level: logEntry.level
      })}
      sourceLocation={{
        file: logEntry.file,
        line: logEntry.line,
        column: logEntry.column
      }}
      onSourceLocationClick={onLogEntryLocationClick}
    />
  ))

  const rawLogUI = (
    <PreviewLogsPaneEntry
      headerTitle={t('raw_logs')}
      rawContent={rawLog}
      entryAriaLabel={t('raw_logs_description')}
      level="raw"
    />
  )

  return (
    <div className="logs-pane">
      {errors ? errorsUI : null}
      {validationIssues ? validationIssuesUI : null}
      {logEntries ? logEntriesUI : null}
      {rawLog && rawLog !== '' ? rawLogUI : null}
    </div>
  )
}

PreviewLogsPane.propTypes = {
  logEntries: PropTypes.array,
  rawLog: PropTypes.string,
  onLogEntryLocationClick: PropTypes.func.isRequired,
  validationIssues: PropTypes.object,
  errors: PropTypes.object
}

export default PreviewLogsPane
