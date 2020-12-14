import React from 'react'
import { ApplicationProvider } from './application-context'
import { EditorProvider } from './editor-context'
import createSharedContext from 'react2angular-shared-context'

// eslint-disable-next-line react/prop-types
export function ContextRoot({ children }) {
  return (
    <ApplicationProvider>
      <EditorProvider>{children}</EditorProvider>
    </ApplicationProvider>
  )
}

export const rootContext = createSharedContext(ContextRoot)
