import PdfLogEntry from '@/features/pdf-preview/components/pdf-log-entry'
import type { Meta, StoryObj } from '@storybook/react'
import { ruleIds } from '@/ide/human-readable-logs/HumanReadableLogsHints'
import { ScopeDecorator } from './decorators/scope'
import { useMeta } from './hooks/use-meta'
import { FC, ReactNode } from 'react'
import { EditorViewContext } from '@/features/ide-react/context/editor-view-context'
import { EditorView } from '@codemirror/view'
import { LogEntry } from '@/features/pdf-preview/util/types'

const fakeSourceLocation = {
  file: 'file.tex',
  line: 12,
  column: 5,
}

const fakeLogEntry: LogEntry = {
  key: 'fake',
  ruleId: 'hint_misplaced_alignment_tab_character',
  message: 'Fake message',
  messageComponent: 'Fake message component',
  content: 'Fake content',
  type: 'Error: ',
  level: 'error',
  contentDetails: ['Fake detail 1', 'Fake detail 2'],
  file: 'fake.tex',
  line: 12,
  column: 5,
  raw: 'Fake raw',
}

const fakeArgs = {
  headerTitle: 'PDF Preview',
  formattedContent: 'This is a log entry',
  level: 'error' as const,
  extraInfoURL: 'https://example.com',
  showSourceLocationLink: true,
  rawContent: 'This is a raw log entry',
  contentDetails: ['detail 1', 'detail 2'],
  ruleId: 'hint_misplaced_alignment_tab_character' as const,
  sourceLocation: fakeSourceLocation,
  logEntry: fakeLogEntry,
  logType: 'Fake type',
}

const meta: Meta<typeof PdfLogEntry> = {
  title: 'Editor / PDF Preview / Logs',
  component: PdfLogEntry,
  // @ts-ignore
  decorators: [ScopeDecorator],
  argTypes: {
    ruleId: { control: 'select', options: [...ruleIds, 'other'] },
  },
  args: fakeArgs,
}

export default meta

type Story = StoryObj<typeof PdfLogEntry>

const MockEditorViewProvider: FC<React.PropsWithChildren> = ({ children }) => {
  const value = {
    view: new EditorView({
      doc: '\\begin{document',
    }),
    setView: () => {},
  }

  return (
    <EditorViewContext.Provider value={value}>
      {children}
    </EditorViewContext.Provider>
  )
}

const Provider: FC<React.PropsWithChildren<{ children: ReactNode }>> = ({
  children,
}) => {
  useMeta({ 'ol-showAiErrorAssistant': true })
  return (
    <MockEditorViewProvider>
      <div className="logs-pane p-2">{children}</div>
    </MockEditorViewProvider>
  )
}

export const PdfLogEntryWithControls: Story = {
  render: args => (
    <Provider>
      <PdfLogEntry {...args} />
    </Provider>
  ),
}
