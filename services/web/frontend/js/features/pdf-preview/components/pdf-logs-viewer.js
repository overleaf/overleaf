import { useTranslation } from 'react-i18next'
import { memo } from 'react'
import classnames from 'classnames'
import PdfValidationIssue from './pdf-validation-issue'
import TimeoutUpgradePrompt from './timeout-upgrade-prompt'
import PdfPreviewError from './pdf-preview-error'
import PdfClearCacheButton from './pdf-clear-cache-button'
import PdfDownloadFilesButton from './pdf-download-files-button'
import PdfLogsEntries from './pdf-logs-entries'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import ErrorBoundaryFallback from './error-boundary-fallback'
import PdfCodeCheckFailedNotice from './pdf-code-check-failed-notice'
import PdfLogsPaneInfoNotice from './pdf-logs-pane-info-notice'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import PdfLogEntry from './pdf-log-entry'

function PdfLogsViewer() {
  const {
    codeCheckFailed,
    error,
    logEntries,
    rawLog,
    validationIssues,
    showLogs,
  } = useCompileContext()

  const { t } = useTranslation()

  return (
    <div className={classnames('logs-pane', { hidden: !showLogs })}>
      <div className="logs-pane-content">
        <PdfLogsPaneInfoNotice />

        {codeCheckFailed && <PdfCodeCheckFailedNotice />}

        {error && <PdfPreviewError error={error} />}

        {error === 'timedout' && <TimeoutUpgradePrompt />}

        {validationIssues &&
          Object.entries(validationIssues).map(([name, issue]) => (
            <PdfValidationIssue key={name} name={name} issue={issue} />
          ))}

        {logEntries?.all && (
          <PdfLogsEntries
            entries={logEntries.all}
            hasErrors={logEntries.errors.length > 0}
          />
        )}

        {rawLog && (
          <PdfLogEntry
            headerTitle={t('raw_logs')}
            rawContent={rawLog}
            entryAriaLabel={t('raw_logs_description')}
            level="raw"
          />
        )}

        <div className="logs-pane-actions">
          <PdfClearCacheButton />
          <PdfDownloadFilesButton />
        </div>
      </div>
    </div>
  )
}

export default withErrorBoundary(memo(PdfLogsViewer), () => (
  <ErrorBoundaryFallback type="logs" />
))
