import { expect } from 'chai'
import { screen, render } from '@testing-library/react'

import NewsletterSection from '../../../../../frontend/js/features/settings/components/newsletter-section'

describe('<NewsletterSection />', function () {
  it('shows link to sessions', async function () {
    render(<NewsletterSection />)

    const link = screen.getByRole('link', {
      name: 'Manage newsletter preferences',
    })

    expect(link.getAttribute('href')).to.equal('/user/email-preferences')
  })
})
