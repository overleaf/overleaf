import { ScopeDecorator } from './decorators/scope'
import { useLocalCompileContext } from '../js/shared/context/local-compile-context'
import { useEffect } from 'react'
import { PdfPreviewMessages } from '../js/features/pdf-preview/components/pdf-preview-messages'
import CompileTimeWarningUpgradePrompt from '@/features/pdf-preview/components/compile-time-warning-upgrade-prompt'

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

  return (
    <div style={{ width: 800, position: 'relative' }}>
      <PdfPreviewMessages>
        <CompileTimeWarningUpgradePrompt />
      </PdfPreviewMessages>
    </div>
  )
}
