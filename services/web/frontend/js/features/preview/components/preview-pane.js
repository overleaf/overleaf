import React, { useState } from 'react'
import PropTypes from 'prop-types'
import PreviewToolbar from './preview-toolbar'
import PreviewLogsPane from './preview-logs-pane'
import PreviewFirstErrorPopUp from './preview-first-error-pop-up'
import { useTranslation } from 'react-i18next'

function PreviewPane({
  compilerState,
  onClearCache,
  onRecompile,
  onRecompileFromScratch,
  onRunSyntaxCheckNow,
  onSetAutoCompile,
  onSetDraftMode,
  onSetSyntaxCheck,
  onToggleLogs,
  onSetFullLayout,
  onSetSplitLayout,
  onStopCompilation,
  outputFiles,
  pdfDownloadUrl,
  onLogEntryLocationClick,
  showLogs,
  variantWithFirstErrorPopup = true,
  splitLayout
}) {
  const { t } = useTranslation()

  const [lastCompileTimestamp, setLastCompileTimestamp] = useState(
    compilerState.lastCompileTimestamp
  )
  const [seenLogsForCurrentCompile, setSeenLogsForCurrentCompile] = useState(
    false
  )
  const [dismissedFirstErrorPopUp, setDismissedFirstErrorPopUp] = useState(
    false
  )

  if (lastCompileTimestamp < compilerState.lastCompileTimestamp) {
    setLastCompileTimestamp(compilerState.lastCompileTimestamp)
    setSeenLogsForCurrentCompile(false)
  }

  if (showLogs && !seenLogsForCurrentCompile) {
    setSeenLogsForCurrentCompile(true)
  }

  const nErrors =
    compilerState.logEntries && compilerState.logEntries.errors
      ? compilerState.logEntries.errors.length
      : 0
  const nWarnings =
    compilerState.logEntries && compilerState.logEntries.warnings
      ? compilerState.logEntries.warnings.length
      : 0

  const hasCLSIErrors =
    compilerState.errors &&
    Object.keys(compilerState.errors).length > 0 &&
    compilerState.compileFailed &&
    !compilerState.isCompiling

  const hasValidationIssues =
    compilerState.validationIssues &&
    Object.keys(compilerState.validationIssues).length > 0 &&
    compilerState.compileFailed &&
    !compilerState.isCompiling

  const showFirstErrorPopUp =
    variantWithFirstErrorPopup &&
    nErrors > 0 &&
    !seenLogsForCurrentCompile &&
    !dismissedFirstErrorPopUp &&
    !compilerState.isCompiling

  function handleFirstErrorPopUpClose() {
    setDismissedFirstErrorPopUp(true)
  }

  return (
    <>
      <PreviewToolbar
        compilerState={compilerState}
        logsState={{ nErrors, nWarnings }}
        showLogs={showLogs}
        onRecompile={onRecompile}
        onRecompileFromScratch={onRecompileFromScratch}
        onRunSyntaxCheckNow={onRunSyntaxCheckNow}
        onSetAutoCompile={onSetAutoCompile}
        onSetDraftMode={onSetDraftMode}
        onSetSyntaxCheck={onSetSyntaxCheck}
        onToggleLogs={onToggleLogs}
        onSetSplitLayout={onSetSplitLayout}
        onSetFullLayout={onSetFullLayout}
        onStopCompilation={onStopCompilation}
        outputFiles={outputFiles}
        pdfDownloadUrl={pdfDownloadUrl}
        splitLayout={splitLayout}
      />
      <span aria-live="polite" className="sr-only">
        {hasCLSIErrors ? t('compile_error_description') : ''}
      </span>
      <span aria-live="polite" className="sr-only">
        {hasValidationIssues ? t('validation_issue_description') : ''}
      </span>
      <span aria-live="polite" className="sr-only">
        {nErrors && !compilerState.isCompiling
          ? t('n_errors', { count: nErrors })
          : ''}
      </span>
      <span aria-live="polite" className="sr-only">
        {nWarnings && !compilerState.isCompiling
          ? t('n_warnings', { count: nWarnings })
          : ''}
      </span>
      {showFirstErrorPopUp ? (
        <PreviewFirstErrorPopUp
          logEntry={compilerState.logEntries.errors[0]}
          onGoToErrorLocation={onLogEntryLocationClick}
          onViewLogs={onToggleLogs}
          onClose={handleFirstErrorPopUpClose}
        />
      ) : null}
      {showLogs ? (
        <PreviewLogsPane
          logEntries={compilerState.logEntries}
          rawLog={compilerState.rawLog}
          validationIssues={compilerState.validationIssues}
          errors={compilerState.errors}
          autoCompileHasLintingError={compilerState.autoCompileHasLintingError}
          outputFiles={outputFiles}
          onLogEntryLocationClick={onLogEntryLocationClick}
          isClearingCache={compilerState.isClearingCache}
          isCompiling={compilerState.isCompiling}
          variantWithFirstErrorPopup={variantWithFirstErrorPopup}
          onClearCache={onClearCache}
        />
      ) : null}
    </>
  )
}

PreviewPane.propTypes = {
  compilerState: PropTypes.shape({
    autoCompileHasLintingError: PropTypes.bool,
    isAutoCompileOn: PropTypes.bool.isRequired,
    isCompiling: PropTypes.bool.isRequired,
    isDraftModeOn: PropTypes.bool.isRequired,
    isSyntaxCheckOn: PropTypes.bool.isRequired,
    isClearingCache: PropTypes.bool.isRequired,
    lastCompileTimestamp: PropTypes.number,
    logEntries: PropTypes.object,
    validationIssues: PropTypes.object,
    errors: PropTypes.object,
    rawLog: PropTypes.string,
    compileFailed: PropTypes.bool
  }),
  onClearCache: PropTypes.func.isRequired,
  onLogEntryLocationClick: PropTypes.func.isRequired,
  onRecompile: PropTypes.func.isRequired,
  onRecompileFromScratch: PropTypes.func.isRequired,
  onRunSyntaxCheckNow: PropTypes.func.isRequired,
  onSetAutoCompile: PropTypes.func.isRequired,
  onSetDraftMode: PropTypes.func.isRequired,
  onSetSyntaxCheck: PropTypes.func.isRequired,
  onSetSplitLayout: PropTypes.func.isRequired,
  onSetFullLayout: PropTypes.func.isRequired,
  onStopCompilation: PropTypes.func.isRequired,
  onToggleLogs: PropTypes.func.isRequired,
  outputFiles: PropTypes.array,
  pdfDownloadUrl: PropTypes.string,
  showLogs: PropTypes.bool.isRequired,
  variantWithFirstErrorPopup: PropTypes.bool,
  splitLayout: PropTypes.bool.isRequired
}

export default PreviewPane
