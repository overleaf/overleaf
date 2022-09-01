import { ScopeDecorator } from './decorators/scope'
import { useLocalCompileContext } from '../js/shared/context/local-compile-context'
import { useEffect } from 'react'
import { PdfPreviewMessages } from '../js/features/pdf-preview/components/pdf-preview-messages'
import { useScope } from './hooks/use-scope'
import { RichTextSurveyInner } from '../js/features/pdf-preview/components/rich-text-survey-inner'
import CompileTimeWarning from '../js/features/pdf-preview/components/compile-time-warning'
import RichTextSurvey from '../js/features/pdf-preview/components/rich-text-survey'

export default {
  title: 'Editor / PDF Preview / Messages',
  component: PdfPreviewMessages,
  decorators: [ScopeDecorator],
}

export const Dismissible = () => {
  const { setShowCompileTimeWarning } = useLocalCompileContext()

  useEffect(() => {
    setShowCompileTimeWarning(true)
  }, [setShowCompileTimeWarning])

  useScope({
    editor: {
      showRichText: true,
    },
  })

  return (
    <div style={{ width: 800, position: 'relative' }}>
      <PdfPreviewMessages>
        <CompileTimeWarning />
        <RichTextSurvey delay={10} />
      </PdfPreviewMessages>
    </div>
  )
}

export const Inner = args => {
  return (
    <div style={{ width: 800, position: 'relative' }}>
      <RichTextSurveyInner {...args} />
    </div>
  )
}
Inner.argTypes = {
  handleDismiss: { action: 'dismiss' },
  openSurvey: { action: 'open survey' },
}
