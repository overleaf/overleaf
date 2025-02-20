import { useTranslation } from 'react-i18next'
import { memo, useState } from 'react'
import classnames from 'classnames'
import PdfValidationIssue from './pdf-validation-issue'
import StopOnFirstErrorPrompt from './stop-on-first-error-prompt'
import TimeoutUpgradePromptNew from './timeout-upgrade-prompt-new'
import PdfPreviewError from './pdf-preview-error'
import PdfClearCacheButton from './pdf-clear-cache-button'
import PdfDownloadFilesButton from './pdf-download-files-button'
import PdfLogsEntries from './pdf-logs-entries'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import PdfPreviewErrorBoundaryFallback from './pdf-preview-error-boundary-fallback'
import PdfCodeCheckFailedNotice from './pdf-code-check-failed-notice'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import PdfLogEntry from './pdf-log-entry'
import { usePdfPreviewContext } from '@/features/pdf-preview/components/pdf-preview-provider'
import TimeoutUpgradePaywallPrompt from './timeout-upgrade-paywall-prompt'
import getMeta from '@/utils/meta'

function PdfLogsViewer({ alwaysVisible = false }: { alwaysVisible?: boolean }) {
  const {
    codeCheckFailed,
    error,
    hasShortCompileTimeout,
    logEntries,
    rawLog,
    validationIssues,
    showLogs,
    stoppedOnFirstError,
    isProjectOwner,
  } = useCompileContext()

  const { loadingError } = usePdfPreviewContext()

  const { t } = useTranslation()

  const [
    isShowingPrimaryCompileTimeoutPaywall,
    setIsShowingPrimaryCompileTimeoutPaywall,
  ] = useState(false)
  const isPaywallChangeCompileTimeoutEnabled = getMeta(
    'ol-isPaywallChangeCompileTimeoutEnabled'
  )

  const isCompileTimeoutPaywallDisplay =
    isProjectOwner && isPaywallChangeCompileTimeoutEnabled

  return (
    <div
      className={classnames('logs-pane', {
        hidden: !showLogs && !alwaysVisible && !loadingError,
      })}
    >
      <div className="logs-pane-content">
        {codeCheckFailed && <PdfCodeCheckFailedNotice />}

        {stoppedOnFirstError && <StopOnFirstErrorPrompt />}

        {loadingError && <PdfPreviewError error="pdf-viewer-loading-error" />}

        {hasShortCompileTimeout && error === 'timedout' ? (
          isCompileTimeoutPaywallDisplay ? (
            <TimeoutUpgradePaywallPrompt
              setIsShowingPrimary={setIsShowingPrimaryCompileTimeoutPaywall}
            />
          ) : (
            <TimeoutUpgradePromptNew />
          )
        ) : (
          <>{error && <PdfPreviewError error={error} />}</>
        )}

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

        {!isShowingPrimaryCompileTimeoutPaywall && (
          <div className="logs-pane-actions">
            <PdfClearCacheButton />
            <PdfDownloadFilesButton />
          </div>
        )}
      </div>
    </div>
  )
}

export default withErrorBoundary(memo(PdfLogsViewer), () => (
  <PdfPreviewErrorBoundaryFallback type="logs" />
))
