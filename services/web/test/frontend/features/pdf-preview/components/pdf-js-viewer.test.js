import { expect } from 'chai'
import { screen } from '@testing-library/react'
import path from 'path'
import { renderWithEditorContext } from '../../../helpers/render-with-context'
import { pathToFileURL } from 'url'
import PdfJsViewer from '../../../../../frontend/js/features/pdf-preview/components/pdf-js-viewer'

const example = pathToFileURL(
  path.join(__dirname, '../fixtures/test-example.pdf')
).toString()

describe('<PdfJSViewer/>', function () {
  beforeEach(function () {
    window.showNewPdfPreview = true
  })

  afterEach(function () {
    window.showNewPdfPreview = undefined
  })

  it('loads all PDF pages', async function () {
    renderWithEditorContext(<PdfJsViewer url={example} />)

    await screen.findByLabelText('Page 1')
    await screen.findByLabelText('Page 2')
    await screen.findByLabelText('Page 3')
    expect(screen.queryByLabelText('Page 4')).to.not.exist
  })

  it('renders pages in a "loading" state', async function () {
    renderWithEditorContext(<PdfJsViewer url={example} />)
    await screen.findByLabelText('Loading…')
  })

  it('can be unmounted while loading a document', async function () {
    const { unmount } = renderWithEditorContext(<PdfJsViewer url={example} />)
    unmount()
  })

  it('can be unmounted after loading a document', async function () {
    const { unmount } = renderWithEditorContext(<PdfJsViewer url={example} />)
    await screen.findByLabelText('Page 1')
    unmount()
  })
})
