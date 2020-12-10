import React from 'react'
import { render, screen } from '@testing-library/react'
import HotkeysModalContent from '../../../../../frontend/js/features/hotkeys-modal/components/hotkeys-modal-content'
import { expect } from 'chai'

const handleHide = () => {
  // closed
}

describe('<HotkeysModalContent />', function() {
  it('renders the translated modal title', function() {
    const { container } = render(
      <HotkeysModalContent handleHide={handleHide} />
    )

    expect(container.querySelector('.modal-title').textContent).to.equal(
      'Hotkeys'
    )
  })

  it('renders translated heading with embedded code', function() {
    const { container } = render(
      <HotkeysModalContent handleHide={handleHide} />
    )

    const results = container.querySelectorAll('h3 code')
    expect(results).to.have.length(1)
  })

  it('renders the hotkey descriptions', function() {
    const { container } = render(
      <HotkeysModalContent handleHide={handleHide} />
    )

    const hotkeys = container.querySelectorAll('[data-test-selector="hotkey"]')
    expect(hotkeys).to.have.length(19)
  })

  it('renders extra hotkey descriptions when Track Changes is enabled', function() {
    const { container } = render(
      <HotkeysModalContent handleHide={handleHide} trackChangesVisible />
    )

    const hotkeys = container.querySelectorAll('[data-test-selector="hotkey"]')
    expect(hotkeys).to.have.length(22)
  })

  it('uses Ctrl for non-macOS', function() {
    render(<HotkeysModalContent handleHide={handleHide} />)

    screen.getAllByText(/Ctrl/)
    expect(screen.queryByText(/Cmd/)).to.not.exist
  })

  it('uses Cmd for macOS', function() {
    render(<HotkeysModalContent handleHide={handleHide} isMac />)

    screen.getAllByText(/Cmd/)
    expect(screen.queryByText(/Ctrl/)).to.not.exist
  })
})
