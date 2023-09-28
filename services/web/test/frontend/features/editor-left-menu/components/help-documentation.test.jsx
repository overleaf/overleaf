import { expect } from 'chai'
import { screen, render } from '@testing-library/react'
import HelpDocumentation from '../../../../../frontend/js/features/editor-left-menu/components/help-documentation'

describe('<HelpDocumentation />', function () {
  it('has correct href attribute', function () {
    render(<HelpDocumentation />)

    const link = screen.getByRole('link', { name: 'Documentation' })
    expect(link.getAttribute('href')).to.equal('/learn')
  })
})
