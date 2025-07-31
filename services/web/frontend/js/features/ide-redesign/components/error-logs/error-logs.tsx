import { useTranslation } from 'react-i18next'
import { ElementType, memo, useMemo, useState } from 'react'
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

const logsComponents: Array<{
  import: { default: ElementType }
  path: string
}> = importOverleafModules('errorLogsComponents')

type ErrorLogTab = {
  key: string
  label: string
  entries: LogEntryData[] | undefined
}

function ErrorLogs() {
  const { error, logEntries, rawLog, validationIssues, stoppedOnFirstError } =
    useCompileContext()

  const tabs = useMemo(() => {
    return [
      { key: 'all', label: 'All', entries: logEntries?.all },
      { key: 'errors', label: 'Errors', entries: logEntries?.errors },
      { key: 'warnings', label: 'Warnings', entries: logEntries?.warnings },
      { key: 'info', label: 'Info', entries: logEntries?.typesetting },
    ]
  }, [logEntries])

  const { loadingError } = usePdfPreviewContext()

  const { t } = useTranslation()

  const [activeTab, setActiveTab] = useState<string | null>('all')

  const entries = useMemo(() => {
    return tabs.find(tab => tab.key === activeTab)?.entries || []
  }, [activeTab, tabs])

  const includeErrors = activeTab === 'all' || activeTab === 'errors'
  const includeWarnings = activeTab === 'all' || activeTab === 'warnings'

  return (
    <TabContainer onSelect={setActiveTab} defaultActiveKey={activeTab ?? 'all'}>
      <Nav defaultActiveKey="all" className="error-logs-tabs">
        {tabs.map(tab => (
          <TabHeader key={tab.key} tab={tab} active={activeTab === tab.key} />
        ))}
      </Nav>
      {logsComponents.map(({ import: { default: Component }, path }) => (
        <Component key={path} />
      ))}
      <TabContent className="error-logs">
        <div className="logs-pane-content">
          {stoppedOnFirstError && includeErrors && <StopOnFirstErrorPrompt />}

          {loadingError && (
            <PdfPreviewError
              error="pdf-viewer-loading-error"
              includeErrors={includeErrors}
              includeWarnings={includeWarnings}
            />
          )}

          {error && (
            <PdfPreviewError
              error={error}
              includeErrors={includeErrors}
              includeWarnings={includeWarnings}
            />
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
