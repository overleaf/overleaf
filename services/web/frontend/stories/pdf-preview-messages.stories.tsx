import { useEffect } from 'react'
import { ScopeDecorator } from './decorators/scope'
import { useLocalCompileContext } from '@/shared/context/local-compile-context'
import { PdfPreviewMessages } from '@/features/pdf-preview/components/pdf-preview-messages'
import CompileTimeWarning from '@/features/pdf-preview/components/compile-time-warning'
import { CompileTimeoutChangingSoon } from '@/features/pdf-preview/components/compile-timeout-changing-soon'
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

export const CompileTime = () => {
  const { setShowCompileTimeWarning } = useLocalCompileContext()

  useEffect(() => {
    setShowCompileTimeWarning(true)
  }, [setShowCompileTimeWarning])

  return <CompileTimeWarning />
}

export const CompileTimeoutChangingSoonNotProjectOwner = (args: any) => {
  return <CompileTimeoutChangingSoon {...args} />
}
CompileTimeoutChangingSoonNotProjectOwner.argTypes = {
  handleDismissChangingSoon: { action: 'dismiss changing soon' },
}

export const CompileTimeoutChangingSoonProjectOwner = (args: any) => {
  return <CompileTimeoutChangingSoon {...args} isProjectOwner />
}
CompileTimeoutChangingSoonProjectOwner.argTypes = {
  handleDismissChangingSoon: { action: 'dismiss changing soon' },
}

export const CompileTimeoutWarningActive = (args: any) => {
  return <CompileTimeoutWarning {...args} showNewCompileTimeoutUI="active" />
}
CompileTimeoutWarningActive.argTypes = {
  handleDismissWarning: { action: 'dismiss warning' },
}

export const CompileTimeoutWarningChanging = (args: any) => {
  return <CompileTimeoutWarning {...args} showNewCompileTimeoutUI="changing" />
}
CompileTimeoutWarningChanging.argTypes = {
  handleDismissWarning: { action: 'dismiss warning' },
}
