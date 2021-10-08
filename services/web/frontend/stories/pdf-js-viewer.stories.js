import PdfJsViewer from '../js/features/pdf-preview/components/pdf-js-viewer'
import useFetchMock from './hooks/use-fetch-mock'
import examplePdf from './fixtures/storybook-example.pdf'
import { Button } from 'react-bootstrap'
import { useCallback } from 'react'
import { withContextRoot } from './utils/with-context-root'
import { setupContext } from './fixtures/context'
import useScopeValue from '../js/shared/context/util/scope-value-hook'

setupContext()

export default {
  title: 'PDF Viewer',
  component: PdfJsViewer,
}

const project = {
  _id: 'story-project',
}

const mockHighlights = [
  {
    page: 1,
    h: 85.03936,
    v: 509.999878,
    width: 441.921265,
    height: 8.855677,
  },
  {
    page: 1,
    h: 85.03936,
    v: 486.089539,
    width: 441.921265,
    height: 8.855677,
  },
  {
    page: 1,
    h: 85.03936,
    v: 498.044708,
    width: 441.921265,
    height: 8.855677,
  },
  {
    page: 1,
    h: 85.03936,
    v: 521.955078,
    width: 441.921265,
    height: 8.855677,
  },
]

export const Interactive = () => {
  useFetchMock(fetchMock => {
    fetchMock.get(
      'express:/build/output.pdf',
      (url, options, request) => {
        return new Promise(resolve => {
          const xhr = new XMLHttpRequest()
          xhr.addEventListener('load', () => {
            resolve({
              status: 200,
              headers: {
                'Content-Length': xhr.getResponseHeader('Content-Length'),
                'Content-Type': xhr.getResponseHeader('Content-Type'),
                'Accept-Ranges': 'bytes',
              },
              body: xhr.response,
            })
          })
          xhr.open('GET', examplePdf)
          xhr.responseType = 'arraybuffer'
          xhr.send()
        })
      },
      { sendAsJson: false }
    )
  })

  const Inner = () => {
    const [, setHighlights] = useScopeValue('pdf.highlights')

    const dispatchSyncFromCode = useCallback(() => {
      setHighlights([])
      window.setTimeout(() => {
        setHighlights(mockHighlights)
      }, 0)
    }, [setHighlights])

    return (
      <div
        style={{
          zIndex: 10,
          position: 'absolute',
          top: 20,
          right: 40,
        }}
      >
        <div style={{ display: 'flex', gap: 20 }}>
          <Button onClick={dispatchSyncFromCode}>
            sync position from editor
          </Button>
        </div>
      </div>
    )
  }

  return withContextRoot(
    <div className="pdf-viewer">
      <PdfJsViewer url="/build/output.pdf" />
      <Inner />
    </div>,
    { project }
  )
}
