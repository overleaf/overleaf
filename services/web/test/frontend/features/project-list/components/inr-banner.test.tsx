import INRBanner from '@/features/project-list/components/notifications/ads/inr-banner'
import customLocalStorage from '@/infrastructure/local-storage'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect } from 'chai'

describe('<INRBanner />', function () {
  beforeEach(function () {
    customLocalStorage.clear()
  })

  it('renders correctly', async function () {
    render(<INRBanner />)
    await screen.findByRole('dialog')

    await screen.findByText(
      '70% off all Overleaf premium plans for users in India'
    )

    await screen.findByText(
      'Get document history, track changes, additional collaborators, and more at Purchasing Power Parity prices.'
    )

    await screen.findByRole('button', { name: 'Maybe later' })

    await screen.findByRole('button', { name: 'Get discounted plan' })
  })

  it('dismisses the modal when the "Maybe later" button is clicked', async function () {
    render(<INRBanner />)
    await screen.findByRole('dialog')

    fireEvent.click(screen.getByRole('button', { name: 'Maybe later' }))

    expect(screen.queryByRole('dialog')).to.be.null

    const dismissedUntil = customLocalStorage.getItem(
      'has_dismissed_inr_banner_until'
    )

    expect(dismissedUntil).to.not.be.null

    const nowPlus2Days = new Date()
    nowPlus2Days.setDate(nowPlus2Days.getDate() + 2)

    // check if dismissal date is around 1 days after the dismissal via "Maybe later" button
    expect(new Date(dismissedUntil)).to.be.greaterThan(new Date())
    expect(new Date(dismissedUntil)).to.be.lessThan(nowPlus2Days)
  })

  it('dismisses the modal when close button is clicked', async function () {
    render(<INRBanner />)
    await screen.findByRole('dialog')

    fireEvent.click(screen.getByRole('button', { name: /close/i }))

    expect(screen.queryByRole('dialog')).to.be.null

    const dismissedUntil = customLocalStorage.getItem(
      'has_dismissed_inr_banner_until'
    )

    expect(dismissedUntil).to.not.be.null

    const nowPlus29Days = new Date()
    nowPlus29Days.setDate(nowPlus29Days.getDate() + 29)

    const nowPlus31Days = new Date()
    nowPlus31Days.setDate(nowPlus31Days.getDate() + 31)

    // check if dismissal date is around 30 days after the dismissal via close button
    expect(new Date(dismissedUntil)).to.be.greaterThan(nowPlus29Days)
    expect(new Date(dismissedUntil)).to.be.lessThan(nowPlus31Days)
  })

  it('hides the modal when user visits while current date is less than local storage date', function () {
    const until = new Date()
    until.setDate(until.getDate() + 30) // 30 days
    customLocalStorage.setItem('has_dismissed_inr_banner_until', until)

    render(<INRBanner />)

    expect(screen.queryByRole('dialog')).to.be.null
  })
})
