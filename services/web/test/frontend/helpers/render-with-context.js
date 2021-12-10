// Disable prop type checks for test harnesses
/* eslint-disable react/prop-types */

import { render } from '@testing-library/react'
import sinon from 'sinon'
import { UserProvider } from '../../../frontend/js/shared/context/user-context'
import { EditorProvider } from '../../../frontend/js/shared/context/editor-context'
import { LayoutProvider } from '../../../frontend/js/shared/context/layout-context'
import { DetachProvider } from '../../../frontend/js/shared/context/detach-context'
import { ChatProvider } from '../../../frontend/js/features/chat/context/chat-context'
import { IdeProvider } from '../../../frontend/js/shared/context/ide-context'
import { get } from 'lodash'
import { ProjectProvider } from '../../../frontend/js/shared/context/project-context'
import { SplitTestProvider } from '../../../frontend/js/shared/context/split-test-context'
import { CompileProvider } from '../../../frontend/js/shared/context/compile-context'

// these constants can be imported in tests instead of
// using magic strings
export const PROJECT_ID = 'project123'
export const PROJECT_NAME = 'project-name'

export function EditorProviders({
  user = { id: '123abd', email: 'testuser@example.com' },
  projectId = PROJECT_ID,
  socket = {
    on: sinon.stub(),
    removeListener: sinon.stub(),
  },
  isRestrictedTokenMember = false,
  clsiServerId = '1234',
  scope,
  children,
  rootFolder,
  ui = { view: null, pdfLayout: 'flat', chatOpen: true },
}) {
  window.user = user || window.user
  window.gitBridgePublicBaseUrl = 'git.overleaf.test'
  window.project_id = projectId != null ? projectId : window.project_id
  window.isRestrictedTokenMember = isRestrictedTokenMember

  const $scope = {
    user: window.user,
    project: {
      _id: window.project_id,
      name: PROJECT_NAME,
      owner: {
        _id: '124abd',
        email: 'owner@example.com',
      },
      features: {
        referencesSearch: true,
      },
      rootDoc_id: '_root_doc_id',
    },
    rootFolder: rootFolder || {
      children: [],
    },
    ui,
    $watch: (path, callback) => {
      callback(get($scope, path))
      return () => null
    },
    $applyAsync: sinon.stub(),
    toggleHistory: sinon.stub(),
    ...scope,
  }

  const fileTreeManager = {
    findEntityById: () => null,
    findEntityByPath: () => null,
    getEntityPath: () => '',
    getRootDocDirname: () => '',
  }

  const editorManager = {
    getCurrentDocId: () => 'foo',
    getCurrentDocValue: () => {},
    openDoc: sinon.stub(),
  }

  const metadataManager = {
    metadata: {
      state: {
        documents: {},
      },
    },
  }

  window._ide = {
    $scope,
    socket,
    clsiServerId,
    editorManager,
    fileTreeManager,
    metadataManager,
  }

  return (
    <SplitTestProvider>
      <IdeProvider ide={window._ide}>
        <UserProvider>
          <ProjectProvider>
            <EditorProvider settings={{}}>
              <DetachProvider>
                <LayoutProvider>
                  <CompileProvider>{children}</CompileProvider>
                </LayoutProvider>
              </DetachProvider>
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
