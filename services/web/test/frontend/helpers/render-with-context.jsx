// Disable prop type checks for test harnesses
/* eslint-disable react/prop-types */

import { render } from '@testing-library/react'
import { EditorProviders } from './editor-providers'

export function renderWithEditorContext(
  component,
  contextProps,
  renderOptions = {}
) {
  const EditorProvidersWrapper = ({ children }) => (
    <EditorProviders {...contextProps}>{children}</EditorProviders>
  )

  return render(component, {
    wrapper: EditorProvidersWrapper,
    ...renderOptions,
  })
}

export function cleanUpContext() {
  delete window._ide
}
