import { expect } from 'chai'
import sinon from 'sinon'
import fetchMock from 'fetch-mock'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import UnableToSyncModal from '@/features/ide-react/components/modals/unable-to-sync-modal'
import * as eventTracking from '@/infrastructure/event-tracking'

const PROJECT_ID = 'project-123'
const ROOT_FOLDER_ID = 'root-folder-id'
const UPLOAD_URL = `express:/project/${PROJECT_ID}/upload`

describe('<UnableToSyncModal />', function () {
  let sendMBSpy: sinon.SinonSpy
  let onHide: sinon.SinonStub

  const renderModal = (props: { show?: boolean } = {}) =>
    render(
      <UnableToSyncModal
        baseContent="server content"
        targetContent="offline content"
        docName="main.tex"
        rootFolderId={ROOT_FOLDER_ID}
        show
        onHide={onHide}
        {...props}
      />
    )

  const clickSaveAsNewFile = () =>
    fireEvent.click(screen.getByRole('button', { name: 'Save as new file' }))

  beforeEach(function () {
    window.metaAttributesCache.set('ol-project_id', PROJECT_ID)
    sendMBSpy = sinon.spy(eventTracking, 'sendMB')
    onHide = sinon.stub()
  })

  afterEach(function () {
    sendMBSpy.restore()
    fetchMock.removeRoutes().clearHistory()
  })

  it('emits unable-to-sync-modal-shown when the modal is shown', function () {
    renderModal()

    expect(sendMBSpy).to.have.been.calledOnceWith('unable-to-sync-modal-shown')
  })

  it('does not emit unable-to-sync-modal-shown while hidden', function () {
    renderModal({ show: false })

    expect(sendMBSpy).not.to.have.been.called
  })

  it('emits a discard-changes click and hides the modal', function () {
    renderModal()

    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))

    expect(sendMBSpy).to.have.been.calledWithMatch(
      'unable-to-sync-modal-click',
      { action: 'discard-changes' }
    )
    expect(onHide).to.have.been.calledOnce
  })

  it('emits a save-new-file click and hides the modal when the upload succeeds', async function () {
    fetchMock.post(UPLOAD_URL, { status: 200, body: {} })

    renderModal()
    clickSaveAsNewFile()

    await waitFor(() => expect(onHide).to.have.been.calledOnce)
    expect(sendMBSpy).to.have.been.calledWithMatch(
      'unable-to-sync-modal-click',
      { action: 'save-new-file' }
    )
  })

  it('emits unable-to-sync-modal-error-shown when the upload fails', async function () {
    fetchMock.post(UPLOAD_URL, 500)

    renderModal()
    clickSaveAsNewFile()

    await screen.findByRole('link', { name: 'download the file' })
    expect(sendMBSpy).to.have.been.calledWith(
      'unable-to-sync-modal-error-shown'
    )
    expect(onHide).not.to.have.been.called
  })

  describe('downloading', function () {
    let anchorClickStub: sinon.SinonStub

    beforeEach(function () {
      // jsdom implements neither object URLs nor anchor-triggered downloads.
      window.URL.createObjectURL = sinon.stub().returns('blob:fake')
      window.URL.revokeObjectURL = sinon.stub()
      anchorClickStub = sinon.stub(HTMLAnchorElement.prototype, 'click')
    })

    afterEach(function () {
      anchorClickStub.restore()
      delete (window.URL as Partial<typeof window.URL>).createObjectURL
      delete (window.URL as Partial<typeof window.URL>).revokeObjectURL
    })

    it('emits a download click from the upload error notification', async function () {
      fetchMock.post(UPLOAD_URL, 500)

      renderModal()
      clickSaveAsNewFile()

      const downloadLink = await screen.findByRole('link', {
        name: 'download the file',
      })
      fireEvent.click(downloadLink)

      expect(sendMBSpy).to.have.been.calledWithMatch(
        'unable-to-sync-modal-click',
        { action: 'download' }
      )
      expect(anchorClickStub).to.have.been.calledOnce

      // Let the deferred revokeObjectURL run before the shims are removed.
      await new Promise(resolve => setTimeout(resolve, 0))
    })
  })
})
