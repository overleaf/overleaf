import React from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { EditorProviders, type EditorProvidersProps } from './editor-providers'

export function renderWithEditorContext(
  component: React.ReactElement,
  contextProps: EditorProvidersProps = {},
  renderOptions: RenderOptions = {}
) {
  const EditorProvidersWrapper = ({
    children,
  }: {
    children: React.ReactNode
  }) => <EditorProviders {...contextProps}>{children}</EditorProviders>

  return render(component, {
    wrapper: EditorProvidersWrapper,
    ...renderOptions,
  })
}
