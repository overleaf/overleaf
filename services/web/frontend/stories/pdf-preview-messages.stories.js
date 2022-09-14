import { ScopeDecorator } from './decorators/scope'
import { useLocalCompileContext } from '../js/shared/context/local-compile-context'
import { useEffect } from 'react'
import { PdfPreviewMessages } from '../js/features/pdf-preview/components/pdf-preview-messages'
import { useScope } from './hooks/use-scope'
import CompileTimeWarning from '../js/features/pdf-preview/components/compile-time-warning'

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
      </PdfPreviewMessages>
    </div>
  )
}
