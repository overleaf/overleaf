import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { Dropdown } from 'react-bootstrap'
import PreviewLogsPaneEntry from './preview-logs-pane-entry'
import PreviewLogsPaneMaxEntries from './preview-logs-pane-max-entries'
import PreviewValidationIssue from './preview-validation-issue'
import PreviewDownloadFileList from './preview-download-file-list'
import PreviewError from './preview-error'
import Icon from '../../../shared/components/icon'
import usePersistedState from '../../../shared/hooks/use-persisted-state'
import ControlledDropdown from '../../../shared/components/controlled-dropdown'

const LOG_PREVIEW_LIMIT = 100

function PreviewLogsPane({
  logEntries = { all: [], errors: [], warnings: [], typesetting: [] },
  rawLog = '',
  validationIssues = {},
  errors = {},
  outputFiles = [],
  isClearingCache,
  isCompiling = false,
  autoCompileHasLintingError = false,
  variantWithFirstErrorPopup,
  onLogEntryLocationClick,
  onClearCache,
}) {
  const { t } = useTranslation()
  const {
    all: allCompilerIssues = [],
    errors: compilerErrors = [],
    warnings: compilerWarnings = [],
    typesetting: compilerTypesettingIssues = [],
  } = logEntries
  const allLogEntries = [
    ...compilerErrors,
    ...compilerWarnings,
    ...compilerTypesettingIssues,
  ]

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
      <ControlledDropdown
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
      </ControlledDropdown>
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
        <LogsPaneInfoNotice
          variantWithFirstErrorPopup={variantWithFirstErrorPopup}
        />
        {autoCompileHasLintingError ? <AutoCompileLintingErrorEntry /> : null}
        {errors ? <PreviewErrors errors={errors} /> : null}
        {validationIssues ? (
          <PreviewValidationIssues validationIssues={validationIssues} />
        ) : null}
        {allCompilerIssues.length > 0 ? (
          <PreviewLogEntries
            logEntries={allLogEntries}
            onLogEntryLocationClick={onLogEntryLocationClick}
          />
        ) : null}
        {rawLog && rawLog !== '' ? rawLogUI : null}
        {actionsUI}
      </div>
    </div>
  )
}

const PreviewErrors = ({ errors }) => {
  const nowTS = Date.now()
  return Object.entries(errors).map(([name, exists], index) => {
    return exists && <PreviewError key={`${nowTS}-${index}`} name={name} />
  })
}

const PreviewValidationIssues = ({ validationIssues }) => {
  const nowTS = Date.now()
  return Object.keys(validationIssues).map((name, index) => (
    <PreviewValidationIssue
      key={`${nowTS}-${index}`}
      name={name}
      details={validationIssues[name]}
    />
  ))
}
const PreviewLogEntries = ({ logEntries, onLogEntryLocationClick }) => {
  const { t } = useTranslation()
  const nowTS = Date.now()

  const totalLogEntries = logEntries.length

  if (totalLogEntries > LOG_PREVIEW_LIMIT) {
    logEntries = logEntries.slice(0, 100)
  }

  logEntries = logEntries.map((logEntry, index) => (
    <PreviewLogsPaneEntry
      key={`${nowTS}-${index}`}
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
      onSourceLocationClick={onLogEntryLocationClick}
    />
  ))

  if (totalLogEntries > LOG_PREVIEW_LIMIT) {
    // Prepend log limit exceeded message to logs array
    logEntries = [
      <PreviewLogsPaneMaxEntries
        key={`${nowTS}-${LOG_PREVIEW_LIMIT}`}
        totalEntries={totalLogEntries}
        entriesShown={LOG_PREVIEW_LIMIT}
      />,
    ].concat(logEntries)
  }

  return logEntries
}

function AutoCompileLintingErrorEntry() {
  const { t } = useTranslation()
  return (
    <div className="log-entry">
      <div className="log-entry-header log-entry-header-error">
        <div className="log-entry-header-icon-container">
          <Icon type="exclamation-triangle" modifier="fw" />
        </div>
        <h3 className="log-entry-header-title">
          {t('code_check_failed_explanation')}
        </h3>
      </div>
    </div>
  )
}

// exported to be used by pdf-viewer during React migration
export function LogsPaneInfoNotice({ variantWithFirstErrorPopup }) {
  const { t } = useTranslation()
  const [dismissedInfoNotice, setDismissedInfoNotice] = usePersistedState(
    `logs_pane.dismissed_info_notice`,
    false
  )

  const surveyLink = variantWithFirstErrorPopup
    ? 'https://forms.gle/AUbDDRvroQ7KFwHR9'
    : 'https://forms.gle/bRxevtGzBHRk8BKw8'
  function handleDismissButtonClick() {
    setDismissedInfoNotice(true)
  }

  return dismissedInfoNotice ? null : (
    <div className="log-entry">
      <div className="log-entry-header log-entry-header-raw">
        <div className="log-entry-header-icon-container">
          <span className="info-badge" />
        </div>
        <h3 className="log-entry-header-title">
          {t('logs_pane_info_message')}
        </h3>
        <a
          href={surveyLink}
          target="_blank"
          rel="noopener noreferrer"
          className="log-entry-header-link log-entry-header-link-raw"
        >
          <span className="log-entry-header-link-location">
            {t('give_feedback')}
          </span>
        </a>
        <button
          className="btn-inline-link log-entry-header-link"
          type="button"
          aria-label={t('dismiss')}
          onClick={handleDismissButtonClick}
        >
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
    </div>
  )
}

PreviewErrors.propTypes = {
  errors: PropTypes.object.isRequired,
}

PreviewValidationIssues.propTypes = {
  validationIssues: PropTypes.object.isRequired,
}

PreviewLogEntries.propTypes = {
  logEntries: PropTypes.array.isRequired,
  onLogEntryLocationClick: PropTypes.func.isRequired,
}

LogsPaneInfoNotice.propTypes = {
  variantWithFirstErrorPopup: PropTypes.bool,
}

PreviewLogsPane.propTypes = {
  logEntries: PropTypes.shape({
    all: PropTypes.array,
    errors: PropTypes.array,
    warning: PropTypes.array,
    typesetting: PropTypes.array,
  }),
  autoCompileHasLintingError: PropTypes.bool,
  rawLog: PropTypes.string,
  outputFiles: PropTypes.array,
  isClearingCache: PropTypes.bool,
  isCompiling: PropTypes.bool,
  variantWithFirstErrorPopup: PropTypes.bool,
  onLogEntryLocationClick: PropTypes.func.isRequired,
  onClearCache: PropTypes.func.isRequired,
  validationIssues: PropTypes.object,
  errors: PropTypes.object,
}

export default PreviewLogsPane
