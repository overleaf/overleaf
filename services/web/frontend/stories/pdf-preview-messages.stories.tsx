import { ScopeDecorator } from './decorators/scope'
import { PdfPreviewMessages } from '@/features/pdf-preview/components/pdf-preview-messages'
import { CompileTimeWarningUpgradePromptInner } from '@/features/pdf-preview/components/compile-time-warning-upgrade-prompt-inner'
import { bsVersionDecorator } from '../../.storybook/utils/with-bootstrap-switcher'

export default {
  title: 'Editor / PDF Preview / Messages',
  component: PdfPreviewMessages,
  argTypes: {
    ...bsVersionDecorator.argTypes,
  },
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
  return <CompileTimeWarningUpgradePromptInner {...args} />
}
CompileTimeoutWarningActive.argTypes = {
  handleDismissWarning: { action: 'dismiss warning' },
}
