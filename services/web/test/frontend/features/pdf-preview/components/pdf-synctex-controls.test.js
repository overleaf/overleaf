import PdfSynctexControls from '../../../../../frontend/js/features/pdf-preview/components/pdf-synctex-controls'
import { renderWithEditorContext } from '../../../helpers/render-with-context'
import sysendTestHelper from '../../../helpers/sysend'
import { cloneDeep } from 'lodash'
import fetchMock from 'fetch-mock'
import { fireEvent, screen, waitFor } from '@testing-library/react'
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
    window.metaAttributesCache = new Map()
    fetchMock.restore()
    mockCompile()
    mockSynctex()
    mockBuildFile()
  })

  afterEach(function () {
    window.showNewPdfPreview = undefined
    window.metaAttributesCache = new Map()
    fetchMock.restore()
  })

  it('handles clicks on sync buttons', async function () {
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

    renderWithEditorContext(
      <>
        <Inner />
        <PdfSynctexControls />
      </>,
      { scope }
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

  describe('with detacher role', async function () {
    beforeEach(function () {
      window.metaAttributesCache.set('ol-detachRole', 'detacher')
    })

    it('does not have go to PDF location button', async function () {
      renderWithEditorContext(<PdfSynctexControls />, { scope })

      expect(
        await screen.queryByRole('button', {
          name: 'Go to PDF location in code',
        })
      ).to.not.exist
    })

    it('send go to PDF location action', async function () {
      renderWithEditorContext(<PdfSynctexControls />, { scope })
      sysendTestHelper.resetHistory()

      const syncToPdfButton = await screen.findByRole('button', {
        name: 'Go to code location in PDF',
      })

      // mock editor cursor position update
      fireEvent(
        window,
        new CustomEvent('cursor:editor:update', {
          detail: { row: 100, column: 10 },
        })
      )

      fireEvent.click(syncToPdfButton)

      // the button is only disabled when the state is updated via sysend
      expect(syncToPdfButton.disabled).to.be.false

      expect(sysendTestHelper.getLastBroacastMessage()).to.deep.equal({
        role: 'detacher',
        event: 'action-go-to-pdf-location',
        data: { args: ['file=&line=101&column=10'] },
      })
    })

    it('update inflight state', async function () {
      renderWithEditorContext(<PdfSynctexControls />, { scope })
      sysendTestHelper.resetHistory()

      const syncToPdfButton = await screen.findByRole('button', {
        name: 'Go to code location in PDF',
      })

      sysendTestHelper.receiveMessage({
        role: 'detached',
        event: 'state-sync-to-pdf-inflight',
        data: { value: true },
      })
      expect(syncToPdfButton.disabled).to.be.true

      sysendTestHelper.receiveMessage({
        role: 'detached',
        event: 'state-sync-to-pdf-inflight',
        data: { value: false },
      })
      expect(syncToPdfButton.disabled).to.be.false
    })
  })

  describe('with detached role', async function () {
    beforeEach(function () {
      window.metaAttributesCache.set('ol-detachRole', 'detached')
    })

    it('does not have go to code location button', async function () {
      renderWithEditorContext(<PdfSynctexControls />, { scope })

      expect(
        await screen.queryByRole('button', {
          name: 'Go to code location in PDF',
        })
      ).to.not.exist
    })

    it('send go to code line action and update inflight state', async function () {
      renderWithEditorContext(<PdfSynctexControls />, { scope })
      sysendTestHelper.resetHistory()

      const syncToCodeButton = await screen.findByRole('button', {
        name: 'Go to PDF location in code',
      })

      sysendTestHelper.resetHistory()

      fireEvent.click(syncToCodeButton)

      expect(syncToCodeButton.disabled).to.be.true

      await waitFor(() => {
        expect(fetchMock.called('express:/project/:projectId/sync/pdf')).to.be
          .true
      })

      expect(sysendTestHelper.getLastBroacastMessage()).to.deep.equal({
        role: 'detached',
        event: 'action-go-to-code-line',
        data: { args: ['main.tex', 100] },
      })
    })

    it('sends PDF exists state', async function () {
      renderWithEditorContext(<PdfSynctexControls />, { scope })
      sysendTestHelper.resetHistory()

      await waitFor(() => {
        expect(fetchMock.called('express:/project/:projectId/compile')).to.be
          .true
      })
      expect(sysendTestHelper.getLastBroacastMessage()).to.deep.equal({
        role: 'detached',
        event: 'state-pdf-exists',
        data: { value: true },
      })
    })

    it('reacts to go to PDF location action', async function () {
      renderWithEditorContext(<PdfSynctexControls />, { scope })
      sysendTestHelper.resetHistory()

      await waitFor(() => {
        expect(fetchMock.called('express:/project/:projectId/compile')).to.be
          .true
      })
      sysendTestHelper.spy.broadcast.resetHistory()

      sysendTestHelper.receiveMessage({
        role: 'detacher',
        event: 'action-go-to-pdf-location',
        data: { args: ['file=&line=101&column=10'] },
      })

      await waitFor(() => {
        expect(fetchMock.called('express:/project/:projectId/sync/code')).to.be
          .true
      })

      expect(sysendTestHelper.getLastBroacastMessage()).to.deep.equal({
        role: 'detached',
        event: 'state-sync-to-pdf-inflight',
        data: { value: false },
      })
    })
  })
})
