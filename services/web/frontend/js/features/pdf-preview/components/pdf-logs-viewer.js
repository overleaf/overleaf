import Icon from '../../../shared/components/icon'
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

function PdfLogsViewer() {
  const {
    autoCompileLintingError,
    stopOnValidationError,
    error,
    logEntries,
    rawLog,
    validationIssues,
  } = usePdfPreviewContext()

  const { t } = useTranslation()

  return (
    <div className="logs-pane">
      <div className="logs-pane-content">
        {autoCompileLintingError && stopOnValidationError && (
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
        )}

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

export default memo(PdfLogsViewer)
