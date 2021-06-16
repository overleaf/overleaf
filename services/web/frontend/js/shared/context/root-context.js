import React from 'react'
import PropTypes from 'prop-types'
import createSharedContext from 'react2angular-shared-context'

import { ApplicationProvider } from './application-context'
import { IdeProvider } from './ide-context'
import { EditorProvider } from './editor-context'
import { CompileProvider } from './compile-context'
import { LayoutProvider } from './layout-context'
import { ChatProvider } from '../../features/chat/context/chat-context'

export function ContextRoot({ children, ide, settings }) {
  const isAnonymousUser = window.user.id == null

  return (
    <ApplicationProvider>
      <IdeProvider ide={ide}>
        <EditorProvider settings={settings}>
          <CompileProvider>
            <LayoutProvider>
              {isAnonymousUser ? (
                children
              ) : (
                <ChatProvider>{children}</ChatProvider>
              )}
            </LayoutProvider>
          </CompileProvider>
        </EditorProvider>
      </IdeProvider>
    </ApplicationProvider>
  )
}

ContextRoot.propTypes = {
  children: PropTypes.any,
  ide: PropTypes.any.isRequired,
  settings: PropTypes.any.isRequired,
}

export const rootContext = createSharedContext(ContextRoot)
