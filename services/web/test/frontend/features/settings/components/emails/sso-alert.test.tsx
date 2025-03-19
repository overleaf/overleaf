import { render, screen, fireEvent } from '@testing-library/react'
import { expect } from 'chai'
import { SSOAlert } from '../../../../../../frontend/js/features/settings/components/emails/sso-alert'

describe('<SSOAlert/>', function () {
  describe('when there is no institutional linking information', function () {
    it('should be empty', function () {
      render(<SSOAlert />)
      expect(screen.queryByRole('alert')).to.be.null
    })
  })

  describe('when there is institutional linking information', function () {
    beforeEach(function () {
      window.metaAttributesCache.set('ol-institutionLinked', {
        universityName: 'Overleaf University',
      })
    })

    it('should render an information alert with the university name', function () {
      render(<SSOAlert />)
      screen.getByRole('alert')
      screen.getByText('account was successfully linked', { exact: false })
      screen.getByText('Overleaf University', { exact: false })
    })

    it('when entitled, it should render access granted to "professional" features', function () {
      window.metaAttributesCache.get('ol-institutionLinked').hasEntitlement =
        true
      render(<SSOAlert />)
      screen.getByText('this grants you access', { exact: false })
      screen.getByText('Professional')
    })

    it('when the email is not canonical it should also render a warning alert', function () {
      window.metaAttributesCache.set(
        'ol-institutionEmailNonCanonical',
        'user@example.com'
      )
      render(<SSOAlert />)
      const alerts = screen.getAllByRole('alert')
      expect(alerts.length).to.equal(2)
    })

    it('the alerts should be closeable', function () {
      window.metaAttributesCache.set(
        'ol-institutionEmailNonCanonical',
        'user@example.com'
      )
      render(<SSOAlert />)
      const closeButtons = screen.getAllByRole('button', {
        name: 'Close',
      })
      fireEvent.click(closeButtons[0])
      fireEvent.click(closeButtons[1])
      expect(screen.queryByRole('button', { name: 'Close' })).to.be.null
    })
  })

  describe('when there is a SAML Error', function () {
    beforeEach(function () {
      window.metaAttributesCache.set('ol-samlError', {
        message: 'there was an error',
      })
    })

    it('should render an error alert', function () {
      render(<SSOAlert />)
      screen.getByRole('alert')
      screen.getByText('there was an error')
    })

    it('should render translated error if available', function () {
      window.metaAttributesCache.get('ol-samlError').translatedMessage =
        'translated error'
      render(<SSOAlert />)
      screen.getByText('translated error')
      expect(screen.queryByText('there was an error')).to.be.null
    })

    it('should render a "try again" label when requested by the error payload', function () {
      window.metaAttributesCache.get('ol-samlError').tryAgain = true
      render(<SSOAlert />)
      screen.getByText('Please try again')
    })

    it('the alert should be closeable', function () {
      render(<SSOAlert />)
      const closeButton = screen.getByRole('button', {
        name: 'Close',
      })
      fireEvent.click(closeButton)
      expect(screen.queryByRole('button', { name: 'Close' })).to.be.null
    })
  })
})
