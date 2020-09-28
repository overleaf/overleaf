import React from 'react'
import PropTypes from 'prop-types'
import PreviewRecompileButton from './preview-recompile-button'

function PreviewToolbar({
  compilerState,
  onRecompile,
  onRunSyntaxCheckNow,
  onSetAutoCompile,
  onSetDraftMode,
  onSetSyntaxCheck,
  onToggleLogs
}) {
  return (
    <div className="toolbar toolbar-pdf">
      <PreviewRecompileButton
        compilerState={compilerState}
        onRecompile={onRecompile}
        onRunSyntaxCheckNow={onRunSyntaxCheckNow}
        onSetAutoCompile={onSetAutoCompile}
        onSetDraftMode={onSetDraftMode}
        onSetSyntaxCheck={onSetSyntaxCheck}
      />
      <button className="btn btn-sm btn-secondary" onClick={onToggleLogs}>
        Toggle logs
      </button>
    </div>
  )
}

PreviewToolbar.propTypes = {
  compilerState: PropTypes.shape({
    isAutoCompileOn: PropTypes.bool.isRequired,
    isCompiling: PropTypes.bool.isRequired,
    isDraftModeOn: PropTypes.bool.isRequired,
    isSyntaxCheckOn: PropTypes.bool.isRequired
  }),
  onRecompile: PropTypes.func.isRequired,
  onRunSyntaxCheckNow: PropTypes.func.isRequired,
  onSetAutoCompile: PropTypes.func.isRequired,
  onSetDraftMode: PropTypes.func.isRequired,
  onSetSyntaxCheck: PropTypes.func.isRequired,
  onToggleLogs: PropTypes.func.isRequired
}

export default PreviewToolbar
