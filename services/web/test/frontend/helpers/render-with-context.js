// Disable prop type checks for test harnesses
/* eslint-disable react/prop-types */

import React from 'react'
import { render } from '@testing-library/react'
import sinon from 'sinon'
import { ApplicationProvider } from '../../../frontend/js/shared/context/application-context'
import { EditorProvider } from '../../../frontend/js/shared/context/editor-context'
import { LayoutProvider } from '../../../frontend/js/shared/context/layout-context'
import { ChatProvider } from '../../../frontend/js/features/chat/context/chat-context'

export function EditorProviders({
  user = { id: '123abd' },
  projectId = 'project123',
  socket = {
    on: sinon.stub(),
    removeListener: sinon.stub(),
  },
  children,
}) {
  window.user = user || window.user
  window.ExposedSettings.appName = 'test'
  window.gitBridgePublicBaseUrl = 'git.overleaf.test'
  window.project_id = projectId != null ? projectId : window.project_id

  window._ide = {
    $scope: {
      project: {
        owner: {
          _id: '124abd',
        },
      },
      ui: {
        chatOpen: true,
        pdfLayout: 'flat',
      },
      $watch: () => {},
    },
    socket,
  }
  return (
    <ApplicationProvider>
      <EditorProvider ide={window._ide} settings={{}}>
        <LayoutProvider $scope={window._ide.$scope}>{children}</LayoutProvider>
      </EditorProvider>
    </ApplicationProvider>
  )
}

export function renderWithEditorContext(children, props) {
  return render(<EditorProviders {...props}>{children}</EditorProviders>)
}

export function ChatProviders({ children, ...props }) {
  return (
    <EditorProviders {...props}>
      <ChatProvider>{children}</ChatProvider>
    </EditorProviders>
  )
}

export function renderWithChatContext(children, props) {
  return render(<ChatProviders {...props}>{children}</ChatProviders>)
}

export function cleanUpContext() {
  delete window.user
  delete window.project_id
  delete window._ide
}
