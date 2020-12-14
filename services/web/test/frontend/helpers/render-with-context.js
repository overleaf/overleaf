import React from 'react'
import { render } from '@testing-library/react'
import { ApplicationProvider } from '../../../frontend/js/shared/context/application-context'
import { EditorProvider } from '../../../frontend/js/shared/context/editor-context'

export function renderWithEditorContext(children, { user, projectId } = {}) {
  window.user = user || window.user
  window.project_id = projectId != null ? projectId : window.project_id
  return render(
    <ApplicationProvider>
      <EditorProvider>{children}</EditorProvider>
    </ApplicationProvider>
  )
}
