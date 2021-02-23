import React from 'react'
import { render } from '@testing-library/react'
import { ApplicationProvider } from '../../../frontend/js/shared/context/application-context'
import { EditorProvider } from '../../../frontend/js/shared/context/editor-context'
import sinon from 'sinon'
import { ChatProvider } from '../../../frontend/js/features/chat/context/chat-context'
import { LayoutProvider } from '../../../frontend/js/shared/context/layout-context'

export function renderWithEditorContext(
  children,
  { user = { id: '123abd' }, projectId = 'project123' } = {}
) {
  window.user = user || window.user
  window.project_id = projectId != null ? projectId : window.project_id
  window._ide = {
    $scope: {
      project: {
        owner: {
          _id: '124abd'
        }
      },
      ui: {
        chatOpen: true
      },
      $watch: () => {}
    },
    socket: {
      on: sinon.stub(),
      removeListener: sinon.stub()
    }
  }
  return render(
    <ApplicationProvider>
      <EditorProvider
        openDoc={() => {}}
        onlineUsersArray={[]}
        $scope={window._ide.$scope}
      >
        <LayoutProvider $scope={window._ide.$scope}>{children}</LayoutProvider>
      </EditorProvider>
    </ApplicationProvider>
  )
}

export function renderWithChatContext(children, { user, projectId } = {}) {
  return renderWithEditorContext(<ChatProvider>{children}</ChatProvider>, {
    user,
    projectId
  })
}

export function cleanUpContext() {
  delete window.user
  delete window.project_id
  delete window._ide
}
