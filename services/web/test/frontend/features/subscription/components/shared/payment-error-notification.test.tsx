import { expect } from 'chai'
import { render, screen } from '@testing-library/react'
import PaymentErrorNotification from '../../../../../../frontend/js/features/subscription/components/shared/payment-error-notification'
import { FetchError } from '@/infrastructure/fetch-json'
import { billingPortalUrl } from '@/features/subscription/data/subscription-url'

describe('<PaymentErrorNotification />', function () {
  it('does not render if error is missing', function () {
    render(<PaymentErrorNotification error={null} />)

    expect(screen.queryByRole('link')).to.be.null
  })

  it('renders a generic error if adviceCode is missing', function () {
    const error = { data: { adviceCode: null } } as FetchError

    render(<PaymentErrorNotification error={error} />)

    expect(
      screen.queryAllByText(
        (content, element) =>
          element?.textContent ===
          'Sorry, something went wrong. Please try again. If the problem continues please contact us.'
      ).length
    ).to.be.greaterThan(0)

    const link = screen.queryByRole('link')
    expect(link).to.exist
    expect(link?.getAttribute('href')).to.equal('/contact')
  })

  it('renders an error if adviceCode is missing but clientSecret is present', function () {
    const error = { data: { clientSecret: 'cs_12345' } } as FetchError

    render(<PaymentErrorNotification error={error} />)

    expect(
      screen.queryAllByText(
        (content, element) =>
          element?.textContent ===
          'We couldn’t complete your payment because authentication wasn’t successful. Please try again or choose a different payment method. If the problem continues please contact us.'
      ).length
    ).to.be.greaterThan(0)

    const link = screen.queryByRole('link')
    expect(link).to.exist
    expect(link?.getAttribute('href')).to.equal('/contact')
  })

  it('renders a error to try again if adviceCode is try_again_later', function () {
    const error = { data: { adviceCode: 'try_again_later' } } as FetchError

    render(<PaymentErrorNotification error={error} />)

    expect(
      screen.queryAllByText(
        (content, element) =>
          element?.textContent ===
          'We were unable to process your payment. Please try again later or contact us for assistance.'
      ).length
    ).to.be.greaterThan(0)

    const link = screen.queryByRole('link')
    expect(link).to.exist
    expect(link?.getAttribute('href')).to.equal('/contact')
  })

  it('renders an error to update payment method if adviceCode do_not_try_again', function () {
    const error = { data: { adviceCode: 'do_not_try_again' } } as FetchError

    render(<PaymentErrorNotification error={error} />)

    expect(
      screen.queryAllByText(
        (content, element) =>
          element?.textContent ===
          'Your payment was declined. Please update your billing information and try again.'
      ).length
    ).to.be.greaterThan(0)

    const link = screen.queryByRole('link')
    expect(link).to.exist
    expect(link?.getAttribute('href')).to.equal(billingPortalUrl)
  })

  it('renders an error to update payment method if adviceCode confirm_card_data', function () {
    const error = { data: { adviceCode: 'confirm_card_data' } } as FetchError

    render(<PaymentErrorNotification error={error} />)

    expect(
      screen.queryAllByText(
        (content, element) =>
          element?.textContent ===
          'Your payment was declined. Please update your billing information and try again.'
      ).length
    ).to.be.greaterThan(0)

    const link = screen.queryByRole('link')
    expect(link).to.exist
    expect(link?.getAttribute('href')).to.equal(billingPortalUrl)
  })
})
