import { createRoot } from 'react-dom/client'
import PdfPreview from './pdf-preview'
import useWaitForI18n from '../../../shared/hooks/use-wait-for-i18n'
import { ReactContextRoot } from '@/features/ide-react/context/react-context-root'
import { useIsNewEditorEnabled } from '@/features/ide-redesign/utils/new-editor-utils'

function PdfPreviewDetachedRoot() {
  const { isReady } = useWaitForI18n()

  if (!isReady) {
    return null
  }

  return (
    <ReactContextRoot>
      <EditorRedesignWrapper>
        <PdfPreview />
      </EditorRedesignWrapper>
    </ReactContextRoot>
  )
}

function EditorRedesignWrapper({ children }: { children: React.ReactNode }) {
  const newEditorEnabled = useIsNewEditorEnabled()
  if (!newEditorEnabled) {
    return <>{children}</>
  }

  // TODO ide-redesign-cleanup: this wrapper should not be required
  return <div className="ide-redesign-main">{children}</div>
}

export default PdfPreviewDetachedRoot // for testing

const element = document.getElementById('pdf-preview-detached-root')
if (element) {
  const root = createRoot(element)
  root.render(<PdfPreviewDetachedRoot />)
}
