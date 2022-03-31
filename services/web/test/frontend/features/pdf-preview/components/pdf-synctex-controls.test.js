import PdfSynctexControls from '../../../../../frontend/js/features/pdf-preview/components/pdf-synctex-controls'
import { renderWithEditorContext } from '../../../helpers/render-with-context'
import sysendTestHelper from '../../../helpers/sysend'
import { cloneDeep } from 'lodash'
import fetchMock from 'fetch-mock'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import fs from 'fs'
import path from 'path'
import { expect } from 'chai'
import { useDetachCompileContext as useCompileContext } from '../../../../../frontend/js/shared/context/detach-compile-context'
import { useFileTreeData } from '../../../../../frontend/js/shared/context/file-tree-data-context'
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

const mockPosition = {
  page: 1,
  offset: { top: 10, left: 10 },
  pageSize: { height: 500, width: 500 },
}

const mockSelectedEntities = [{ type: 'doc' }]

const mockSynctex = () =>
  fetchMock
    .get('express:/project/:projectId/sync/code', () => {
      return { pdf: cloneDeep(mockHighlights) }
    })
    .get('express:/project/:projectId/sync/pdf', () => {
      return { code: [{ file: 'main.tex', line: 100 }] }
    })

const WithPosition = ({ mockPosition }) => {
  const { setPosition } = useCompileContext()

  // mock PDF scroll position update
  useEffect(() => {
    setPosition(mockPosition)
  }, [mockPosition, setPosition])

  return null
}

const WithSelectedEntities = ({ mockSelectedEntities = [] }) => {
  const { setSelectedEntities } = useFileTreeData()

  useEffect(() => {
    setSelectedEntities(mockSelectedEntities)
  }, [mockSelectedEntities, setSelectedEntities])

  return null
}
describe('<PdfSynctexControls/>', function () {
  beforeEach(function () {
    window.metaAttributesCache = new Map()
    fetchMock.restore()
    mockCompile()
    mockSynctex()
    mockBuildFile()
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
    fetchMock.restore()
  })

  it('handles clicks on sync buttons', async function () {
    const { container } = renderWithEditorContext(
      <>
        <WithPosition mockPosition={mockPosition} />
        <WithSelectedEntities mockSelectedEntities={mockSelectedEntities} />
        <PdfSynctexControls />
      </>,
      { scope }
    )

    const syncToPdfButton = await screen.findByRole('button', {
      name: 'Go to code location in PDF',
    })

    const syncToCodeButton = await screen.findByRole('button', {
      name: /Go to PDF location in code/,
    })

    expect(container.querySelectorAll('.synctex-control-icon').length).to.equal(
      2
    )

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
  it('disables button when multiple entities are selected', async function () {
    renderWithEditorContext(
      <>
        <WithPosition mockPosition={mockPosition} />
        <WithSelectedEntities
          mockSelectedEntities={[{ type: 'doc' }, { type: 'doc' }]}
        />
        <PdfSynctexControls />
      </>,
      { scope }
    )

    const syncToPdfButton = await screen.findByRole('button', {
      name: 'Go to code location in PDF',
    })
    expect(syncToPdfButton.disabled).to.be.true

    const syncToCodeButton = await screen.findByRole('button', {
      name: /Go to PDF location in code/,
    })
    expect(syncToCodeButton.disabled).to.be.true
  })

  it('disables button when a file is selected', async function () {
    renderWithEditorContext(
      <>
        <WithPosition mockPosition={mockPosition} />
        <WithSelectedEntities mockSelectedEntities={[{ type: 'file' }]} />
        <PdfSynctexControls />
      </>,
      { scope }
    )

    const syncToPdfButton = await screen.findByRole('button', {
      name: 'Go to code location in PDF',
    })
    expect(syncToPdfButton.disabled).to.be.true

    const syncToCodeButton = await screen.findByRole('button', {
      name: /Go to PDF location in code/,
    })
    expect(syncToCodeButton.disabled).to.be.true
  })

  describe('with detacher role', async function () {
    beforeEach(function () {
      window.metaAttributesCache.set('ol-detachRole', 'detacher')
    })

    it('does not have go to PDF location button nor arrow icon', async function () {
      const { container } = renderWithEditorContext(
        <>
          <WithPosition mockPosition={mockPosition} />
          <WithSelectedEntities mockSelectedEntities={mockSelectedEntities} />
          <PdfSynctexControls />
        </>,
        { scope }
      )

      expect(
        await screen.queryByRole('button', {
          name: 'Go to PDF location in code',
        })
      ).to.not.exist

      expect(container.querySelector('.synctex-control-icon')).to.not.exist
    })

    it('send set highlights action', async function () {
      renderWithEditorContext(
        <>
          <WithPosition mockPosition={mockPosition} />
          <WithSelectedEntities mockSelectedEntities={mockSelectedEntities} />
          <PdfSynctexControls />
        </>,
        { scope }
      )
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

      expect(syncToPdfButton.disabled).to.be.false

      fireEvent.click(syncToPdfButton)

      expect(syncToPdfButton.disabled).to.be.true

      await waitFor(() => {
        expect(fetchMock.called('express:/project/:projectId/sync/code')).to.be
          .true
      })

      // synctex is called locally and the result are broadcast for the detached
      // tab
      expect(sysendTestHelper.getLastBroacastMessage()).to.deep.equal({
        role: 'detacher',
        event: 'action-setHighlights',
        data: { args: [mockHighlights] },
      })
    })

    it('reacts to sync to code action', async function () {
      renderWithEditorContext(
        <>
          <WithPosition mockPosition={mockPosition} />
          <WithSelectedEntities mockSelectedEntities={mockSelectedEntities} />
          <PdfSynctexControls />
        </>,
        { scope }
      )

      await waitFor(() => {
        expect(fetchMock.called('express:/project/:projectId/compile')).to.be
          .true
      })

      sysendTestHelper.receiveMessage({
        role: 'detached',
        event: 'action-sync-to-code',
        data: {
          args: [mockPosition],
        },
      })

      await waitFor(() => {
        expect(fetchMock.called('express:/project/:projectId/sync/pdf')).to.be
          .true
      })
    })
  })

  describe('with detached role', async function () {
    beforeEach(function () {
      window.metaAttributesCache.set('ol-detachRole', 'detached')
    })

    it('does not have go to code location button nor arrow icon', async function () {
      const { container } = renderWithEditorContext(
        <>
          <WithPosition mockPosition={mockPosition} />
          <PdfSynctexControls />
        </>,
        { scope }
      )

      expect(
        await screen.queryByRole('button', {
          name: 'Go to code location in PDF',
        })
      ).to.not.exist

      expect(container.querySelector('.synctex-control-icon')).to.not.exist
    })

    it('send go to code line action', async function () {
      const { container } = renderWithEditorContext(
        <>
          <WithPosition mockPosition={mockPosition} />
          <PdfSynctexControls />
        </>,
        { scope }
      )

      const syncToCodeButton = await screen.findByRole('button', {
        name: /Go to PDF location in code/,
      })
      expect(syncToCodeButton.disabled).to.be.true

      sysendTestHelper.receiveMessage({
        role: 'detached',
        event: 'state-has-single-selected-doc',
        data: { value: true },
      })
      expect(syncToCodeButton.disabled).to.be.false

      sysendTestHelper.resetHistory()

      fireEvent.click(syncToCodeButton)

      // the button is only disabled when the state is updated via sysend
      expect(syncToCodeButton.disabled).to.be.false
      expect(container.querySelectorAll('.synctex-spin-icon').length).to.equal(
        0
      )

      expect(sysendTestHelper.getLastBroacastMessage()).to.deep.equal({
        role: 'detached',
        event: 'action-sync-to-code',
        data: {
          args: [mockPosition, 72],
        },
      })
    })

    it('update inflight state', async function () {
      const { container } = renderWithEditorContext(
        <>
          <WithPosition mockPosition={mockPosition} />
          <PdfSynctexControls />
        </>,
        { scope }
      )
      sysendTestHelper.receiveMessage({
        role: 'detached',
        event: 'state-has-single-selected-doc',
        data: { value: true },
      })

      const syncToCodeButton = await screen.findByRole('button', {
        name: /Go to PDF location in code/,
      })

      expect(syncToCodeButton.disabled).to.be.false
      expect(container.querySelectorAll('.synctex-spin-icon').length).to.equal(
        0
      )

      sysendTestHelper.receiveMessage({
        role: 'detacher',
        event: 'state-sync-to-code-inflight',
        data: { value: true },
      })

      expect(syncToCodeButton.disabled).to.be.true
      expect(container.querySelectorAll('.synctex-spin-icon').length).to.equal(
        1
      )

      sysendTestHelper.receiveMessage({
        role: 'detacher',
        event: 'state-sync-to-code-inflight',
        data: { value: false },
      })

      expect(syncToCodeButton.disabled).to.be.false
      expect(container.querySelectorAll('.synctex-spin-icon').length).to.equal(
        0
      )
    })
  })
})
