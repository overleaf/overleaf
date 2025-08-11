import { render, screen } from '@testing-library/react'
import { expect } from 'chai'
import HotkeysModalBottomText from '../../../../../frontend/js/features/hotkeys-modal/components/hotkeys-modal-bottom-text'

describe('<HotkeysModalBottomText />', function () {
  it('renders the correct text', function () {
    render(<HotkeysModalBottomText />)

    screen.getByText(
      /A more comprehensive list of keyboard shortcuts can be found in/
    )

    const link = screen.getByRole('link', {
      name: /this Overleaf project template/,
    })

    expect(link.getAttribute('href')).to.equal(
      `https://www.overleaf.com/articles/overleaf-keyboard-shortcuts/qykqfvmxdnjf`
    )
  })
})
