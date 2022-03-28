import useFetchMock from './hooks/use-fetch-mock'
import { withContextRoot } from './utils/with-context-root'
import { setupContext } from './fixtures/context'
import PdfSynctexControls from '../js/features/pdf-preview/components/pdf-synctex-controls'
import PdfViewer from '../js/features/pdf-preview/components/pdf-viewer'
import {
  mockBuildFile,
  mockCompile,
  mockSynctex,
  mockValidPdf,
} from './fixtures/compile'
import { useEffect } from 'react'

setupContext()

export default {
  title: 'Editor / PDF Viewer',
  component: PdfViewer,
}

const project = {
  _id: 'story-project',
}

const scope = {
  project,
  editor: {
    sharejs_doc: {
      doc_id: 'test-doc',
      getSnapshot: () => 'some doc content',
    },
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

  return withContextRoot(
    <div>
      <div className="pdf-viewer">
        <PdfViewer />
      </div>
      <div style={{ position: 'absolute', top: 150, left: 50 }}>
        <PdfSynctexControls />
      </div>
    </div>,
    scope
  )
}
