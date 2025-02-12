import PdfLogEntry from '@/features/pdf-preview/components/pdf-log-entry'
import type { Meta, StoryObj } from '@storybook/react'
import { bsVersionDecorator } from '../../.storybook/utils/with-bootstrap-switcher'
import { ruleIds } from '@/ide/human-readable-logs/HumanReadableLogsHints'
import { ScopeDecorator } from './decorators/scope'
import { useMeta } from './hooks/use-meta'
import { FC, ReactNode } from 'react'
import { useScope } from './hooks/use-scope'
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
  showCloseButton: true,
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
    ...bsVersionDecorator.argTypes,
  },
  args: fakeArgs,
}

export default meta

type Story = StoryObj<typeof PdfLogEntry>

const Provider: FC<{ children: ReactNode }> = ({ children }) => {
  useMeta({ 'ol-showAiErrorAssistant': true })
  useScope({ 'editor.view': new EditorView({ doc: '\\begin{document' }) })
  return <div className="logs-pane p-2">{children}</div>
}

export const PdfLogEntryWithControls: Story = {
  render: args => (
    <Provider>
      <PdfLogEntry {...args} />
    </Provider>
  ),
}
