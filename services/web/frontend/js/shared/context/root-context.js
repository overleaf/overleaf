import React from 'react'
import PropTypes from 'prop-types'
import { ApplicationProvider } from './application-context'
import { EditorProvider } from './editor-context'
import createSharedContext from 'react2angular-shared-context'

export function ContextRoot({ children, editorLoading }) {
  return (
    <ApplicationProvider>
      <EditorProvider loading={editorLoading}>{children}</EditorProvider>
    </ApplicationProvider>
  )
}

ContextRoot.propTypes = {
  children: PropTypes.any,
  editorLoading: PropTypes.bool
}

export const rootContext = createSharedContext(ContextRoot)
