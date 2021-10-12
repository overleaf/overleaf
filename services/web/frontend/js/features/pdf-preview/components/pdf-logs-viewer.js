import { useTranslation } from 'react-i18next'
import PreviewLogsPaneEntry from '../../preview/components/preview-logs-pane-entry'
import { usePdfPreviewContext } from '../contexts/pdf-preview-context'
import { memo } from 'react'
import PdfValidationIssue from './pdf-validation-issue'
import TimeoutUpgradePrompt from './timeout-upgrade-prompt'
import PdfPreviewError from './pdf-preview-error'
import PdfClearCacheButton from './pdf-clear-cache-button'
import PdfDownloadFilesButton from './pdf-download-files-button'
import PdfLogsEntries from './pdf-logs-entries'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import ErrorBoundaryFallback from './error-boundary-fallback'
import PdfCodeCheckFailedNotice from '../../preview/components/pdf-code-check-failed-notice'
import PdfLogsPaneInfoNotice from '../../preview/components/pdf-logs-pane-info-notice'

function PdfLogsViewer() {
  const {
    codeCheckFailed,
    error,
    logEntries,
    rawLog,
    validationIssues,
  } = usePdfPreviewContext()

  const { t } = useTranslation()

  return (
    <div className="logs-pane">
      <div className="logs-pane-content">
        <PdfLogsPaneInfoNotice />

        {codeCheckFailed && <PdfCodeCheckFailedNotice />}

        {error && <PdfPreviewError error={error} />}

        {error === 'timedout' && <TimeoutUpgradePrompt />}

        {validationIssues &&
          Object.entries(validationIssues).map(([name, issue]) => (
            <PdfValidationIssue key={name} name={name} issue={issue} />
          ))}

        {logEntries?.all && <PdfLogsEntries entries={logEntries.all} />}

        {rawLog && (
          <PreviewLogsPaneEntry
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
