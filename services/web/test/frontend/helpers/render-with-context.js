// Disable prop type checks for test harnesses
/* eslint-disable react/prop-types */

import { render } from '@testing-library/react'
import sinon from 'sinon'
import { ApplicationProvider } from '../../../frontend/js/shared/context/application-context'
import { EditorProvider } from '../../../frontend/js/shared/context/editor-context'
import { LayoutProvider } from '../../../frontend/js/shared/context/layout-context'
import { ChatProvider } from '../../../frontend/js/features/chat/context/chat-context'
import { IdeProvider } from '../../../frontend/js/shared/context/ide-context'
import { get } from 'lodash'
import { ProjectProvider } from '../../../frontend/js/shared/context/project-context'

export function EditorProviders({
  user = { id: '123abd' },
  projectId = 'project123',
  socket = {
    on: sinon.stub(),
    removeListener: sinon.stub(),
  },
  isRestrictedTokenMember = false,
  scope,
  children,
}) {
  window.user = user || window.user
  window.gitBridgePublicBaseUrl = 'git.overleaf.test'
  window.project_id = projectId != null ? projectId : window.project_id
  window.isRestrictedTokenMember = isRestrictedTokenMember

  const $scope = {
    project: {
      _id: window.project_id,
      name: 'project-name',
      owner: {
        _id: '124abd',
        email: 'owner@example.com',
      },
    },
    ui: {
      chatOpen: true,
      pdfLayout: 'flat',
    },
    $watch: (path, callback) => {
      callback(get($scope, path))
      return () => null
    },
    $applyAsync: () => {},
    toggleHistory: () => {},
    ...scope,
  }

  window._ide = { $scope, socket }

  return (
    <ApplicationProvider>
      <IdeProvider ide={window._ide}>
        <ProjectProvider>
          <EditorProvider settings={{}}>
            <LayoutProvider>{children}</LayoutProvider>
          </EditorProvider>
        </ProjectProvider>
      </IdeProvider>
    </ApplicationProvider>
  )
}

export function renderWithEditorContext(component, contextProps) {
  const EditorProvidersWrapper = ({ children }) => (
    <EditorProviders {...contextProps}>{children}</EditorProviders>
  )

  return render(component, { wrapper: EditorProvidersWrapper })
}

export function ChatProviders({ children, ...props }) {
  return (
    <EditorProviders {...props}>
      <ChatProvider>{children}</ChatProvider>
    </EditorProviders>
  )
}

export function renderWithChatContext(component, props) {
  const ChatProvidersWrapper = ({ children }) => (
    <ChatProviders {...props}>{children}</ChatProviders>
  )

  return render(component, { wrapper: ChatProvidersWrapper })
}

export function cleanUpContext() {
  delete window.user
  delete window.project_id
  delete window._ide
}
