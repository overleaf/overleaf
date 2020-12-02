import React from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { Dropdown } from 'react-bootstrap'
import PreviewLogsPaneEntry from './preview-logs-pane-entry'
import PreviewValidationIssue from './preview-validation-issue'
import PreviewDownloadFileList from './preview-download-file-list'
import PreviewError from './preview-error'
import Icon from '../../../shared/components/icon'

function PreviewLogsPane({
  logEntries = { all: [], errors: [], warnings: [], typesetting: [] },
  rawLog = '',
  validationIssues = {},
  errors = {},
  outputFiles = [],
  isClearingCache,
  isCompiling = false,
  onLogEntryLocationClick,
  onClearCache
}) {
  const { t } = useTranslation()
  const {
    all: allCompilerIssues = [],
    errors: compilerErrors = [],
    warnings: compilerWarnings = [],
    typesetting: compilerTypesettingIssues = []
  } = logEntries

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

  const logEntriesUI = [
    ...compilerErrors,
    ...compilerWarnings,
    ...compilerTypesettingIssues
  ].map((logEntry, idx) => (
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

  const actionsUI = (
    <div className="logs-pane-actions">
      <button
        className="btn btn-sm btn-danger logs-pane-actions-clear-cache"
        onClick={onClearCache}
        disabled={isClearingCache || isCompiling}
      >
        {isClearingCache ? (
          <Icon type="refresh" spin />
        ) : (
          <Icon type="trash-o" />
        )}
        &nbsp;
        <span>{t('clear_cached_files')}</span>
      </button>
      <Dropdown
        id="dropdown-files-logs-pane"
        dropup
        pullRight
        disabled={isCompiling}
      >
        <Dropdown.Toggle
          className="btn btn-sm btn-info dropdown-toggle"
          title={t('other_logs_and_files')}
          bsStyle="info"
        />
        <Dropdown.Menu id="dropdown-files-logs-pane-list">
          <PreviewDownloadFileList fileList={outputFiles} />
        </Dropdown.Menu>
      </Dropdown>
    </div>
  )

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
      <div className="logs-pane-content">
        {errors ? errorsUI : null}
        {validationIssues ? validationIssuesUI : null}
        {allCompilerIssues.length > 0 ? logEntriesUI : null}
        {rawLog && rawLog !== '' ? rawLogUI : null}
        {actionsUI}
      </div>
    </div>
  )
}

PreviewLogsPane.propTypes = {
  logEntries: PropTypes.shape({
    all: PropTypes.array,
    errors: PropTypes.array,
    warning: PropTypes.array,
    typesetting: PropTypes.array
  }),
  rawLog: PropTypes.string,
  outputFiles: PropTypes.array,
  isClearingCache: PropTypes.bool,
  isCompiling: PropTypes.bool,
  onLogEntryLocationClick: PropTypes.func.isRequired,
  onClearCache: PropTypes.func.isRequired,
  validationIssues: PropTypes.object,
  errors: PropTypes.object
}

export default PreviewLogsPane
