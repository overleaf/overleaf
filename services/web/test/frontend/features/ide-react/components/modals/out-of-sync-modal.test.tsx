import { expect } from 'chai'
import sinon from 'sinon'
import { fireEvent, render, screen } from '@testing-library/react'
import OutOfSyncModal from '@/features/ide-react/components/modals/out-of-sync-modal'
import * as eventTracking from '@/infrastructure/event-tracking'
import { location } from '@/shared/components/location'
import { SplitTestProvider } from '@/shared/context/split-test-context'

describe('<OutOfSyncModal />', function () {
  let sendMBSpy: sinon.SinonSpy
  let reloadStub: sinon.SinonStub
  let onHide: sinon.SinonStub

  const renderModal = (props: { show?: boolean } = {}) =>
    render(
      <SplitTestProvider>
        <OutOfSyncModal
          editorContent="offline content"
          show
          onHide={onHide}
          {...props}
        />
      </SplitTestProvider>
    )

  beforeEach(function () {
    sendMBSpy = sinon.spy(eventTracking, 'sendMB')
    reloadStub = sinon.stub(location, 'reload')
    onHide = sinon.stub()
  })

  afterEach(function () {
    sendMBSpy.restore()
    reloadStub.restore()
  })

  it('emits out-of-sync-modal-shown when the modal is shown', function () {
    renderModal()

    expect(sendMBSpy).to.have.been.calledOnceWith('out-of-sync-modal-shown')
  })

  it('does not emit out-of-sync-modal-shown while hidden', function () {
    renderModal({ show: false })

    expect(sendMBSpy).not.to.have.been.called
  })

  it('does not emit a further event when reloading the editor', function () {
    renderModal()
    sendMBSpy.resetHistory()

    fireEvent.click(screen.getByRole('button', { name: 'Reload editor' }))

    expect(onHide).to.have.been.calledOnce
    expect(reloadStub).to.have.been.calledOnce
    expect(sendMBSpy).not.to.have.been.called
  })
})
