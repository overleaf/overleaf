import PdfSynctexControls from '../../../../../frontend/js/features/pdf-preview/components/pdf-synctex-controls'
import { EditorProviders } from '../../../helpers/render-with-context'
import { cloneDeep } from 'lodash'
import fetchMock from 'fetch-mock'
import { fireEvent, screen, waitFor, render } from '@testing-library/react'
import fs from 'fs'
import path from 'path'
import { expect } from 'chai'
import { useCompileContext } from '../../../../../frontend/js/shared/context/compile-context'
import { useEffect } from 'react'

const examplePDF = path.join(__dirname, '../fixtures/test-example.pdf')

const scope = {
  settings: {
    syntaxValidation: false,
    pdfViewer: 'pdfjs',
  },
  editor: {
    sharejs_doc: {
      doc_id: 'test-doc',
      getSnapshot: () => 'some doc content',
    },
  },
}

const outputFiles = [
  {
    path: 'output.pdf',
    build: '123',
    url: '/build/output.pdf',
    type: 'pdf',
  },
  {
    path: 'output.log',
    build: '123',
    url: '/build/output.log',
    type: 'log',
  },
]

const mockCompile = () =>
  fetchMock.post('express:/project/:projectId/compile', {
    body: {
      status: 'success',
      clsiServerId: 'foo',
      compileGroup: 'standard',
      pdfDownloadDomain: 'https://clsi.test-overleaf.com',
      outputFiles: cloneDeep(outputFiles),
    },
  })

const fileResponses = {
  '/build/output.pdf': () => fs.createReadStream(examplePDF),
  '/build/output.log': '',
}

const mockBuildFile = () =>
  fetchMock.get('begin:https://clsi.test-overleaf.com/', _url => {
    const url = new URL(_url, 'https://clsi.test-overleaf.com')

    if (url.pathname in fileResponses) {
      return fileResponses[url.pathname]
    }

    return 404
  })

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
]

const mockSynctex = () =>
  fetchMock
    .get('express:/project/:projectId/sync/code', () => {
      return { pdf: cloneDeep(mockHighlights) }
    })
    .get('express:/project/:projectId/sync/pdf', () => {
      return { code: [{ file: 'main.tex', line: 100 }] }
    })

describe('<PdfSynctexControls/>', function () {
  beforeEach(function () {
    window.showNewPdfPreview = true
    fetchMock.restore()
  })

  afterEach(function () {
    window.showNewPdfPreview = undefined
    fetchMock.restore()
  })

  it('handles clicks on sync buttons', async function () {
    mockCompile()
    mockSynctex()
    mockBuildFile()

    const Inner = () => {
      const { setPosition } = useCompileContext()

      // mock PDF scroll position update
      useEffect(() => {
        setPosition({
          page: 1,
          offset: { top: 10, left: 10 },
          pageSize: { height: 500, width: 500 },
        })
      }, [setPosition])

      return null
    }

    render(
      <EditorProviders scope={scope}>
        <Inner />
        <PdfSynctexControls />
      </EditorProviders>
    )

    const syncToPdfButton = await screen.findByRole('button', {
      name: 'Go to code location in PDF',
    })

    const syncToCodeButton = await screen.findByRole('button', {
      name: 'Go to PDF location in code',
    })

    // mock editor cursor position update
    fireEvent(
      window,
      new CustomEvent('cursor:editor:update', {
        detail: { row: 100, column: 10 },
      })
    )

    fireEvent.click(syncToPdfButton)

    expect(syncToPdfButton.disabled).to.be.true

    await waitFor(() => {
      expect(fetchMock.called('express:/project/:projectId/sync/code')).to.be
        .true
    })

    fireEvent.click(syncToCodeButton)

    expect(syncToCodeButton.disabled).to.be.true

    await waitFor(() => {
      expect(fetchMock.called('express:/project/:projectId/sync/pdf')).to.be
        .true
    })
  })
})
