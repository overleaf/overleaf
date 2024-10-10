import useFetchMock from './hooks/use-fetch-mock'
import PdfSynctexControls from '../js/features/pdf-preview/components/pdf-synctex-controls'
import PdfViewer from '../js/features/pdf-preview/components/pdf-viewer'
import {
  mockBuildFile,
  mockCompile,
  mockSynctex,
  mockValidPdf,
} from './fixtures/compile'
import { useEffect, Suspense } from 'react'
import { ScopeDecorator } from './decorators/scope'
import { PdfPreviewProvider } from '@/features/pdf-preview/components/pdf-preview-provider'
import { bsVersionDecorator } from '../../.storybook/utils/with-bootstrap-switcher'

export default {
  title: 'Editor / PDF Viewer',
  component: PdfViewer,
  decorators: [ScopeDecorator],
  argTypes: {
    ...bsVersionDecorator.argTypes,
  },
}

export const Interactive = () => {
  useFetchMock(fetchMock => {
    mockCompile(fetchMock)
    mockBuildFile(fetchMock)
    mockValidPdf(fetchMock)
    mockSynctex(fetchMock)
  })

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(`cursor:editor:update`, {
        detail: { row: 10, position: 10 },
      })
    )
  }, [])

  return (
    <div>
      <div className="pdf-viewer">
        <Suspense fallback={null}>
          <PdfPreviewProvider>
            <PdfViewer />
          </PdfPreviewProvider>
        </Suspense>
      </div>
      <div style={{ position: 'absolute', top: 150, left: 50 }}>
        <PdfSynctexControls />
      </div>
    </div>
  )
}
