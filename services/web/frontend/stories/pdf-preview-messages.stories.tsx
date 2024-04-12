import { ScopeDecorator } from './decorators/scope'
import { PdfPreviewMessages } from '@/features/pdf-preview/components/pdf-preview-messages'
import { CompileTimeoutWarning } from '@/features/pdf-preview/components/compile-timeout-warning'

export default {
  title: 'Editor / PDF Preview / Messages',
  component: PdfPreviewMessages,
  decorators: [
    ScopeDecorator,
    (Story: any) => (
      <div style={{ width: 800, position: 'relative' }}>
        <PdfPreviewMessages>
          <Story />
        </PdfPreviewMessages>
      </div>
    ),
  ],
}

export const CompileTimeoutWarningActive = (args: any) => {
  return <CompileTimeoutWarning {...args} />
}
CompileTimeoutWarningActive.argTypes = {
  handleDismissWarning: { action: 'dismiss warning' },
}
