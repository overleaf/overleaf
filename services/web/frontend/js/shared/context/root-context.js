import React from 'react'
import PropTypes from 'prop-types'
import { ApplicationProvider } from './application-context'
import { EditorProvider } from './editor-context'
import createSharedContext from 'react2angular-shared-context'
import { ChatProvider } from '../../features/chat/context/chat-context'
import { LayoutProvider } from './layout-context'

export function ContextRoot({ children, ide }) {
  return (
    <ApplicationProvider>
      <EditorProvider $scope={ide.$scope}>
        <LayoutProvider $scope={ide.$scope}>
          <ChatProvider>{children}</ChatProvider>
        </LayoutProvider>
      </EditorProvider>
    </ApplicationProvider>
  )
}

ContextRoot.propTypes = {
  children: PropTypes.any,
  ide: PropTypes.any.isRequired
}

export const rootContext = createSharedContext(ContextRoot)
