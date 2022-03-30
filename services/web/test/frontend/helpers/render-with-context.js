// Disable prop type checks for test harnesses
/* eslint-disable react/prop-types */

import { render } from '@testing-library/react'
import { renderHook } from '@testing-library/react-hooks'
import { ChatProvider } from '../../../frontend/js/features/chat/context/chat-context'
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

export function renderHookWithEditorContext(hook, contextProps) {
  const EditorProvidersWrapper = ({ children }) => (
    <EditorProviders {...contextProps}>{children}</EditorProviders>
  )

  return renderHook(hook, { wrapper: EditorProvidersWrapper })
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
