import PdfPreviewHybridToolbar from '../../../../../frontend/js/features/pdf-preview/components/pdf-preview-hybrid-toolbar'
import { renderWithEditorContext } from '../../../helpers/render-with-context'
import { screen } from '@testing-library/react'

describe('<PdfPreviewHybridToolbar/>', function () {
  afterEach(function () {
    window.metaAttributesCache = new Map()
  })

  it('shows normal mode', async function () {
    renderWithEditorContext(<PdfPreviewHybridToolbar />)

    await screen.getByRole('button', {
      name: 'Recompile',
    })
  })

  it('shows orphan mode', async function () {
    window.metaAttributesCache.set('ol-detachRole', 'detached')
    renderWithEditorContext(<PdfPreviewHybridToolbar />)

    await screen.getByRole('button', {
      name: 'Redirect to editor',
    })
  })
})
