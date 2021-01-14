import React from 'react'
import { render } from '@testing-library/react'
import { ApplicationProvider } from '../../../frontend/js/shared/context/application-context'
import { EditorProvider } from '../../../frontend/js/shared/context/editor-context'
import sinon from 'sinon'

export function renderWithEditorContext(
  children,
  { user = { id: '123abd' }, projectId } = {}
) {
  window.user = user || window.user
  window.project_id = projectId != null ? projectId : window.project_id
  window._ide = {
    $scope: {
      project: {
        owner: {
          _id: '124abd'
        }
      }
    },
    socket: {
      on: sinon.stub(),
      removeListener: sinon.stub()
    }
  }
  return render(
    <ApplicationProvider>
      <EditorProvider>{children}</EditorProvider>
    </ApplicationProvider>
  )
}
