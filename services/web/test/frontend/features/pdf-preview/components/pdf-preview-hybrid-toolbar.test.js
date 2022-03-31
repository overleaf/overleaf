import sinon from 'sinon'
import PdfPreviewHybridToolbar from '../../../../../frontend/js/features/pdf-preview/components/pdf-preview-hybrid-toolbar'
import { renderWithEditorContext } from '../../../helpers/render-with-context'
import { screen } from '@testing-library/react'
import sysendTestHelper from '../../../helpers/sysend'

describe('<PdfPreviewHybridToolbar/>', function () {
  let clock

  beforeEach(function () {
    clock = sinon.useFakeTimers()
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
    sysendTestHelper.resetHistory()
    clock.runAll()
    clock.restore()
  })

  it('shows normal mode', async function () {
    renderWithEditorContext(<PdfPreviewHybridToolbar />)

    await screen.getByRole('button', {
      name: 'Recompile',
    })
  })

  describe('orphan mode', async function () {
    it('shows connecting message  on load', async function () {
      window.metaAttributesCache.set('ol-detachRole', 'detached')
      renderWithEditorContext(<PdfPreviewHybridToolbar />)

      await screen.getByText(/Connecting with the editor/)
    })

    it('shows compile UI when connected', async function () {
      window.metaAttributesCache.set('ol-detachRole', 'detached')
      renderWithEditorContext(<PdfPreviewHybridToolbar />)
      sysendTestHelper.receiveMessage({
        role: 'detacher',
        event: 'connected',
      })
      await screen.getByRole('button', {
        name: 'Recompile',
      })
    })

    it('shows connecting message when disconnected', async function () {
      window.metaAttributesCache.set('ol-detachRole', 'detached')
      renderWithEditorContext(<PdfPreviewHybridToolbar />)
      sysendTestHelper.receiveMessage({
        role: 'detacher',
        event: 'connected',
      })
      sysendTestHelper.receiveMessage({
        role: 'detacher',
        event: 'closed',
      })

      await screen.getByText(/Connecting with the editor/)
    })

    it('shows redirect button after timeout', async function () {
      window.metaAttributesCache.set('ol-detachRole', 'detached')
      renderWithEditorContext(<PdfPreviewHybridToolbar />)
      clock.tick(6000)

      await screen.getByRole('button', {
        name: 'Redirect to editor',
      })
    })
  })
})
