import { useTranslation } from 'react-i18next'
import { ElementType, memo, useCallback, useMemo, useState } from 'react'
import { usePdfPreviewContext } from '@/features/pdf-preview/components/pdf-preview-provider'
import StopOnFirstErrorPrompt from '@/features/pdf-preview/components/stop-on-first-error-prompt'
import PdfPreviewError from '@/features/pdf-preview/components/pdf-preview-error'
import PdfValidationIssue from '@/features/pdf-preview/components/pdf-validation-issue'
import PdfLogsEntries from '@/features/pdf-preview/components/pdf-logs-entries'
import PdfPreviewErrorBoundaryFallback from '@/features/pdf-preview/components/pdf-preview-error-boundary-fallback'
import withErrorBoundary from '@/infrastructure/error-boundary'
import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'
import { Nav, NavLink, TabContainer, TabContent } from 'react-bootstrap'
import { LogEntry as LogEntryData } from '@/features/pdf-preview/util/types'
import LogEntry from './log-entry'
import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'
import TimeoutUpgradePromptNew from '@/features/pdf-preview/components/timeout-upgrade-prompt-new'
import getMeta from '@/utils/meta'
import PdfClearCacheButton from '@/features/pdf-preview/components/pdf-clear-cache-button'
import PdfDownloadFilesButton from '@/features/pdf-preview/components/pdf-download-files-button'
import RollingBuildSelectedReminder from './rolling-build-selected-reminder'

const logsComponents: Array<{
  import: { default: ElementType }
  path: string
}> = importOverleafModules('errorLogsComponents')

type ErrorLogTab = {
  key: string
  label: string
  entries: LogEntryData[] | undefined
}

function ErrorLogs({
  includeActionButtons,
}: {
  includeActionButtons?: boolean
}) {
  const { error, logEntries, rawLog, validationIssues, stoppedOnFirstError } =
    useCompileContext()
  const { compileTimeout } = getMeta('ol-compileSettings')
  const { t } = useTranslation()

  const tabs = useMemo(() => {
    return [
      {
        key: 'all',
        label: t('all_logs'),
        entries: logEntries?.all,
      },
      { key: 'errors', label: t('errors'), entries: logEntries?.errors },
      { key: 'warnings', label: t('warnings'), entries: logEntries?.warnings },
      { key: 'info', label: t('info'), entries: logEntries?.typesetting },
    ]
  }, [logEntries, t])

  const { loadingError } = usePdfPreviewContext()

  const [activeTab, setActiveTab] = useState<string | null>('all')

  const changeTab = useCallback(
    (key: string | null) => {
      if (tabs.some(tab => tab.key === key)) {
        setActiveTab(key)
      }
    },
    [tabs]
  )

  const entries = useMemo(() => {
    return tabs.find(tab => tab.key === activeTab)?.entries || []
  }, [activeTab, tabs])

  const includeErrors = activeTab === 'all' || activeTab === 'errors'
  const includeWarnings = activeTab === 'all' || activeTab === 'warnings'

  return (
    <TabContainer onSelect={changeTab} defaultActiveKey={activeTab ?? 'all'}>
      <Nav defaultActiveKey="all" className="error-logs-tabs">
        {tabs.map(tab => (
          <TabHeader key={tab.key} tab={tab} active={activeTab === tab.key} />
        ))}
      </Nav>
      {logsComponents.map(({ import: { default: Component }, path }) => (
        <Component key={path} />
      ))}
      <TabContent className="error-logs new-error-logs">
        <div className="logs-pane-content">
          <RollingBuildSelectedReminder />
          {stoppedOnFirstError && includeErrors && <StopOnFirstErrorPrompt />}

          {loadingError && (
            <PdfPreviewError
              error="pdf-viewer-loading-error"
              includeErrors={includeErrors}
              includeWarnings={includeWarnings}
            />
          )}

          {compileTimeout < 60 && error === 'timedout' ? (
            <TimeoutUpgradePromptNew />
          ) : (
            <>{error && <PdfPreviewError error={error} />}</>
          )}

          {includeErrors &&
            validationIssues &&
            Object.entries(validationIssues).map(([name, issue]) => (
              <PdfValidationIssue key={name} name={name} issue={issue} />
            ))}

          {entries && (
            <PdfLogsEntries
              entries={entries}
              hasErrors={
                includeErrors &&
                logEntries?.errors &&
                logEntries?.errors.length > 0
              }
            />
          )}

          {rawLog && activeTab === 'all' && (
            <LogEntry
              headerTitle={t('raw_logs')}
              rawContent={rawLog}
              entryAriaLabel={t('raw_logs_description')}
              level="raw"
              alwaysExpandRawContent
              showSourceLocationLink={false}
            />
          )}

          {includeActionButtons && (
            <div className="logs-pane-actions">
              <PdfClearCacheButton />
              <PdfDownloadFilesButton />
            </div>
          )}
        </div>
      </TabContent>
    </TabContainer>
  )
}

function formatErrorNumber(num: number | undefined) {
  if (num === undefined) {
    return undefined
  }

  if (num > 99) {
    return '99+'
  }

  return Math.floor(num).toString()
}

const TabHeader = ({ tab, active }: { tab: ErrorLogTab; active: boolean }) => {
  return (
    <NavLink
      eventKey={tab.key}
      className="error-logs-tab-header"
      active={active}
    >
      {tab.label}
      <div className="error-logs-tab-count">
        {/* TODO: it would be nice if this number included custom errors */}
        {formatErrorNumber(tab.entries?.length)}
      </div>
    </NavLink>
  )
}

export default withErrorBoundary(memo(ErrorLogs), () => (
  <PdfPreviewErrorBoundaryFallback type="logs" />
))
