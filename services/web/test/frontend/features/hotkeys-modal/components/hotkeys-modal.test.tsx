import { render, screen } from '@testing-library/react'
import HotkeysModal from '../../../../../frontend/js/features/hotkeys-modal/components/hotkeys-modal'
import { expect } from 'chai'
import sinon from 'sinon'

const modalProps = {
  show: true,
  handleHide: sinon.stub(),
  trackChangesVisible: false,
}

describe('<HotkeysModal />', function () {
  it('renders the translated modal title on cm6', async function () {
    const { baseElement } = render(<HotkeysModal {...modalProps} />)

    expect(baseElement.querySelector('.modal-title')?.textContent).to.equal(
      'Hotkeys'
    )
  })

  it('renders translated heading with embedded code', function () {
    const { baseElement } = render(<HotkeysModal {...modalProps} />)

    const results = baseElement.querySelectorAll('h3 code')
    expect(results).to.have.length(1)
  })

  it('renders the hotkey descriptions', function () {
    const { baseElement } = render(<HotkeysModal {...modalProps} />)

    const hotkeys = baseElement.querySelectorAll(
      '[data-test-selector="hotkey"]'
    )
    expect(hotkeys).to.have.length(19)
  })

  it('adds extra hotkey descriptions when Track Changes is enabled', function () {
    const { baseElement } = render(
      <HotkeysModal {...modalProps} trackChangesVisible />
    )

    const hotkeys = baseElement.querySelectorAll(
      '[data-test-selector="hotkey"]'
    )
    expect(hotkeys).to.have.length(22)
  })

  it('uses Ctrl for non-macOS', function () {
    render(<HotkeysModal {...modalProps} />)

    expect(screen.getAllByText(/Ctrl/)).to.have.length(16)
    expect(screen.queryByText(/Cmd/)).to.not.exist
  })

  it('uses Cmd for macOS', function () {
    render(<HotkeysModal {...modalProps} isMac />)

    expect(screen.getAllByText(/Cmd/)).to.have.length(12)
    expect(screen.getAllByText(/Ctrl/)).to.have.length(4)
  })
})
