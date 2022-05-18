import { expect } from 'chai'
import { fireEvent, screen, render } from '@testing-library/react'
import { LeaversSurveyAlert } from '../../../../../frontend/js/features/settings/components/leavers-survey-alert'
import localStorage from '../../../../../frontend/js/infrastructure/local-storage'

describe('<LeaversSurveyAlert/>', function () {
  it('should render before the expiration date', function () {
    const tomorrow = Date.now() + 1000 * 60 * 60 * 24
    localStorage.setItem('showInstitutionalLeaversSurveyUntil', tomorrow)
    localStorage.setItem('hideInstitutionalLeaversSurvey', false)
    render(<LeaversSurveyAlert />)
    screen.getByRole('alert')
    screen.getByText(/Provide some quick feedback/)
    screen.getByRole('link', { name: 'Take a short survey' })
  })

  it('should not render after the expiration date', function () {
    const yesterday = Date.now() - 1000 * 60 * 60 * 24
    localStorage.setItem('showInstitutionalLeaversSurveyUntil', yesterday)
    localStorage.setItem('hideInstitutionalLeaversSurvey', false)
    render(<LeaversSurveyAlert />)
    expect(screen.queryByRole('alert')).to.be.null
  })

  it('should not render if it has been hidden', function () {
    const tomorrow = Date.now() + 1000 * 60 * 60 * 24
    localStorage.setItem('showInstitutionalLeaversSurveyUntil', tomorrow)
    localStorage.setItem('hideInstitutionalLeaversSurvey', true)
    render(<LeaversSurveyAlert />)
    expect(screen.queryByRole('alert')).to.be.null
  })

  it('should reset the expiration date when it is closed', function () {
    const tomorrow = Date.now() + 1000 * 60 * 60 * 24
    localStorage.setItem('showInstitutionalLeaversSurveyUntil', tomorrow)
    localStorage.setItem('hideInstitutionalLeaversSurvey', false)
    render(<LeaversSurveyAlert />)
    screen.getByRole('alert')

    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByRole('alert')).to.be.null

    expect(localStorage.getItem('showInstitutionalLeaversSurveyUntil')).to.be
      .null
  })
})
