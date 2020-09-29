import React from 'react'
import PropTypes from 'prop-types'
import PreviewRecompileButton from './preview-recompile-button'
import PreviewLogsToggleButton from './preview-logs-toggle-button'

function PreviewToolbar({
  compilerState,
  logsState,
  onRecompile,
  onRunSyntaxCheckNow,
  onSetAutoCompile,
  onSetDraftMode,
  onSetSyntaxCheck,
  onToggleLogs,
  showLogs
}) {
  return (
    <div className="toolbar toolbar-pdf">
      <div className="toolbar-pdf-left">
        <PreviewRecompileButton
          compilerState={compilerState}
          onRecompile={onRecompile}
          onRunSyntaxCheckNow={onRunSyntaxCheckNow}
          onSetAutoCompile={onSetAutoCompile}
          onSetDraftMode={onSetDraftMode}
          onSetSyntaxCheck={onSetSyntaxCheck}
        />
      </div>
      <div className="toolbar-pdf-right">
        <PreviewLogsToggleButton
          logsState={logsState}
          showLogs={showLogs}
          onToggle={onToggleLogs}
        />
      </div>
    </div>
  )
}

PreviewToolbar.propTypes = {
  compilerState: PropTypes.shape({
    isAutoCompileOn: PropTypes.bool.isRequired,
    isCompiling: PropTypes.bool.isRequired,
    isDraftModeOn: PropTypes.bool.isRequired,
    isSyntaxCheckOn: PropTypes.bool.isRequired,
    logEntries: PropTypes.object.isRequired
  }),
  logsState: PropTypes.shape({
    nErrors: PropTypes.number.isRequired,
    nWarnings: PropTypes.number.isRequired,
    nLogEntries: PropTypes.number.isRequired
  }),
  showLogs: PropTypes.bool.isRequired,
  onRecompile: PropTypes.func.isRequired,
  onRunSyntaxCheckNow: PropTypes.func.isRequired,
  onSetAutoCompile: PropTypes.func.isRequired,
  onSetDraftMode: PropTypes.func.isRequired,
  onSetSyntaxCheck: PropTypes.func.isRequired,
  onToggleLogs: PropTypes.func.isRequired
}

export default PreviewToolbar
