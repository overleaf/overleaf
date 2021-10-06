// Disable prop type checks for test harnesses
/* eslint-disable react/prop-types */

import { render } from '@testing-library/react'
import sinon from 'sinon'
import { UserProvider } from '../../../frontend/js/shared/context/user-context'
import { EditorProvider } from '../../../frontend/js/shared/context/editor-context'
import { LayoutProvider } from '../../../frontend/js/shared/context/layout-context'
import { ChatProvider } from '../../../frontend/js/features/chat/context/chat-context'
import { IdeProvider } from '../../../frontend/js/shared/context/ide-context'
import { get } from 'lodash'
import { ProjectProvider } from '../../../frontend/js/shared/context/project-context'
import { SplitTestProvider } from '../../../frontend/js/shared/context/split-test-context'
import { CompileProvider } from '../../../frontend/js/shared/context/compile-context'

export function EditorProviders({
  user = { id: '123abd', email: 'testuser@example.com' },
  projectId = 'project123',
  socket = {
    on: sinon.stub(),
    removeListener: sinon.stub(),
  },
  isRestrictedTokenMember = false,
  clsiServerId = '1234',
  scope,
  children,
}) {
  window.user = user || window.user
  window.gitBridgePublicBaseUrl = 'git.overleaf.test'
  window.project_id = projectId != null ? projectId : window.project_id
  window.isRestrictedTokenMember = isRestrictedTokenMember

  const $scope = {
    user: window.user,
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

  const fileTreeManager = {
    findEntityByPath: () => null,
    getRootDocDirname: () => '',
  }

  window._ide = {
    $scope,
    socket,
    clsiServerId,
    fileTreeManager,
  }

  return (
    <SplitTestProvider>
      <IdeProvider ide={window._ide}>
        <UserProvider>
          <ProjectProvider>
            <EditorProvider settings={{}}>
              <CompileProvider>
                <LayoutProvider>{children}</LayoutProvider>
              </CompileProvider>
            </EditorProvider>
          </ProjectProvider>
        </UserProvider>
      </IdeProvider>
    </SplitTestProvider>
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
