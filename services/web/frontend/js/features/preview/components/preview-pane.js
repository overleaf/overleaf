import React from 'react'
import PropTypes from 'prop-types'
import PreviewToolbar from './preview-toolbar'
import PreviewLogsPane from './preview-logs-pane'

function PreviewPane({
  compilerState,
  logEntries,
  onRecompile,
  onRunSyntaxCheckNow,
  onSetAutoCompile,
  onSetDraftMode,
  onSetSyntaxCheck,
  onToggleLogs,
  shouldShowLogs
}) {
  return (
    <>
      <PreviewToolbar
        compilerState={compilerState}
        onRecompile={onRecompile}
        onRunSyntaxCheckNow={onRunSyntaxCheckNow}
        onSetAutoCompile={onSetAutoCompile}
        onSetDraftMode={onSetDraftMode}
        onSetSyntaxCheck={onSetSyntaxCheck}
        onToggleLogs={onToggleLogs}
      />
      {shouldShowLogs ? <PreviewLogsPane logEntries={logEntries} /> : null}
    </>
  )
}

PreviewPane.propTypes = {
  compilerState: PropTypes.shape({
    isAutoCompileOn: PropTypes.bool.isRequired,
    isCompiling: PropTypes.bool.isRequired,
    isDraftModeOn: PropTypes.bool.isRequired,
    isSyntaxCheckOn: PropTypes.bool.isRequired
  }),
  logEntries: PropTypes.array,
  onRecompile: PropTypes.func.isRequired,
  onRunSyntaxCheckNow: PropTypes.func.isRequired,
  onSetAutoCompile: PropTypes.func.isRequired,
  onSetDraftMode: PropTypes.func.isRequired,
  onSetSyntaxCheck: PropTypes.func.isRequired,
  onToggleLogs: PropTypes.func.isRequired,
  shouldShowLogs: PropTypes.bool.isRequired
}

export default PreviewPane
