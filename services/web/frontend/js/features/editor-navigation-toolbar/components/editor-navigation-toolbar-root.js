import React from 'react'
import PropTypes from 'prop-types'
import ToolbarHeader from './toolbar-header'
import { useEditorContext } from '../../../shared/context/editor-context'

function EditorNavigationToolbarRoot({ onShowLeftMenuClick }) {
  const { cobranding, loading } = useEditorContext()

  // using {display: 'none'} as 1:1 migration from Angular's ng-hide. Using
  // `loading ? null : <ToolbarHeader/>` causes UI glitches
  return (
    <ToolbarHeader
      style={loading ? { display: 'none' } : {}}
      cobranding={cobranding}
      onShowLeftMenuClick={onShowLeftMenuClick}
    />
  )
}

EditorNavigationToolbarRoot.propTypes = {
  onShowLeftMenuClick: PropTypes.func.isRequired
}
export default EditorNavigationToolbarRoot
